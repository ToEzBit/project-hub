"use client";

import { useEffect, useState } from "react";
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd";
import type { Note, NoteCategory } from "@/lib/types";
import { useToast } from "@/components/Toast";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Markdown } from "@/components/Markdown";
import {
  Eye,
  FileText,
  FolderOpen,
  GripVertical,
  PenLine,
  Plus,
  Trash2,
} from "lucide-react";

export function NotesPanel({
  projectId,
  initialNoteId,
}: {
  projectId: string;
  initialNoteId?: string | null;
}) {
  const toast = useToast();
  const [notes, setNotes] = useState<Note[]>([]);
  const [categories, setCategories] = useState<NoteCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Note | null>(null);

  // New-note form state
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("");

  async function load() {
    const res = await fetch(`/api/projects/${projectId}/notes`);
    const data = await res.json();
    setNotes(data.notes as Note[]);
    setCategories((data.categories ?? []) as NoteCategory[]);
    setLoading(false);
  }

  useEffect(() => {
    setLoading(true);
    setActiveNoteId(initialNoteId ?? null);
    if (initialNoteId) setActiveCategory(initialNoteId.split("/")[0]);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, initialNoteId]);

  useEffect(() => {
    if (
      (!activeCategory || !categories.some((c) => c.slug === activeCategory)) &&
      categories.length > 0
    ) {
      setActiveCategory(categories[0].slug);
    }
  }, [categories, activeCategory]);

  const visibleNotes = notes.filter((n) => n.category === activeCategory);
  const activeNote = notes.find((n) => n.id === activeNoteId) ?? null;

  useEffect(() => {
    if (activeNote) {
      setEditTitle(activeNote.title);
      setEditBody(activeNote.body);
      setDirty(false);
      setPreview(false);
    }
  }, [activeNote?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function createNote(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim() || !newCategory.trim()) return;
    const res = await fetch(`/api/projects/${projectId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle, category: newCategory, body: "" }),
    });
    const data = await res.json();
    setNewTitle("");
    await load();
    setActiveCategory(data.note.category);
    setActiveNoteId(data.note.id);
    toast("Note created");
  }

  async function saveActive() {
    if (!activeNote) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/notes/${activeNote.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: editTitle, body: editBody }),
        },
      );
      if (res.ok) {
        setDirty(false);
        toast("Note saved");
        await load();
      } else {
        toast("Failed to save note", "error");
      }
    } finally {
      setSaving(false);
    }
  }

  async function removeNote(note: Note) {
    await fetch(`/api/projects/${projectId}/notes/${note.id}`, {
      method: "DELETE",
    });
    setConfirmDelete(null);
    if (activeNoteId === note.id) setActiveNoteId(null);
    await load();
    toast("Note deleted");
  }

  async function onCategoryDragEnd(result: DropResult) {
    if (!result.destination) return;
    const from = result.source.index;
    const to = result.destination.index;
    if (from === to) return;
    const next = [...categories];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setCategories(next);
    const res = await fetch(
      `/api/projects/${projectId}/notes/categories/reorder`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slugs: next.map((c) => c.slug) }),
      },
    );
    if (!res.ok) {
      toast("Failed to save category order", "error");
      await load();
    }
  }

  async function onNoteDragEnd(result: DropResult) {
    if (!result.destination || !activeCategory) return;
    const from = result.source.index;
    const to = result.destination.index;
    if (from === to) return;
    const current = visibleNotes;
    const nextVisible = [...current];
    const [moved] = nextVisible.splice(from, 1);
    nextVisible.splice(to, 0, moved);
    // Optimistic: rebuild the notes array with the new in-category order.
    const others = notes.filter((n) => n.category !== activeCategory);
    setNotes([...others, ...nextVisible.map((n, i) => ({ ...n, order: i }))]);
    const res = await fetch(`/api/projects/${projectId}/notes/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: activeCategory,
        ids: nextVisible.map((n) => n.id),
      }),
    });
    if (!res.ok) {
      toast("Failed to save note order", "error");
    }
    await load();
  }

  if (loading)
    return <p className="text-sm text-ink-muted">Loading notes…</p>;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[210px_240px_1fr]">
      {/* Category list */}
      <div className="flex flex-col gap-2 self-start rounded-xl border border-hairline bg-surface p-3 card-shadow">
        <span className="px-1 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
          Categories
        </span>
        <DragDropContext onDragEnd={onCategoryDragEnd}>
          <Droppable droppableId="note-categories">
            {(provided) => (
              <ul
                ref={provided.innerRef}
                {...provided.droppableProps}
                data-testid="category-list"
              >
                {categories.map((cat, index) => (
                  <Draggable key={cat.slug} draggableId={cat.slug} index={index}>
                    {(drag, snapshot) => (
                      <li
                        ref={drag.innerRef}
                        {...drag.draggableProps}
                        data-testid={`category-item-${cat.slug}`}
                        className="pb-0.5"
                      >
                        <div
                          className={`group flex items-center rounded-lg ${
                            snapshot.isDragging
                              ? "bg-surface-raised pop-shadow"
                              : activeCategory === cat.slug
                                ? "bg-accent-soft"
                                : "hover:bg-surface-sunken"
                          }`}
                        >
                          <span
                            {...drag.dragHandleProps}
                            data-testid={`category-handle-${cat.slug}`}
                            aria-label={`Drag to reorder ${cat.label}`}
                            className="cursor-grab px-1 py-1.5 text-ink-muted opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
                          >
                            <GripVertical size={13} />
                          </span>
                          <button
                            onClick={() => {
                              setActiveCategory(cat.slug);
                              setActiveNoteId(null);
                            }}
                            className={`flex min-w-0 flex-1 items-center gap-2 py-1.5 pr-2 text-left text-sm ${
                              activeCategory === cat.slug
                                ? "font-medium text-ink"
                                : "text-ink-secondary group-hover:text-ink"
                            }`}
                          >
                            <FolderOpen
                              size={14}
                              className="shrink-0 text-ink-muted"
                            />
                            <span className="truncate">{cat.label}</span>
                            <span className="ml-auto text-[10px] text-ink-muted">
                              {notes.filter((n) => n.category === cat.slug).length}
                            </span>
                          </button>
                        </div>
                      </li>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </ul>
            )}
          </Droppable>
        </DragDropContext>
        {categories.length === 0 && (
          <p className="px-2 py-1 text-xs text-ink-muted">
            No categories yet — create a note below.
          </p>
        )}

        <form
          onSubmit={createNote}
          className="mt-1 flex flex-col gap-1.5 border-t border-hairline pt-3"
        >
          <input
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="Category (e.g. payment)"
            data-testid="note-category-input"
            className="rounded-lg border border-hairline bg-surface-sunken px-2.5 py-1.5 text-xs outline-none transition-colors placeholder:text-ink-muted focus:border-accent focus:ring-2 focus:ring-accent-soft"
          />
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="New note title"
            data-testid="note-title-input"
            className="rounded-lg border border-hairline bg-surface-sunken px-2.5 py-1.5 text-xs outline-none transition-colors placeholder:text-ink-muted focus:border-accent focus:ring-2 focus:ring-accent-soft"
          />
          <button
            type="submit"
            disabled={!newTitle.trim() || !newCategory.trim()}
            data-testid="note-create-button"
            className="flex items-center justify-center gap-1 rounded-lg bg-accent px-2 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-40"
          >
            <Plus size={13} />
            New note
          </button>
        </form>
      </div>

      {/* Note list for the active category */}
      <div className="flex flex-col gap-1 self-start rounded-xl border border-hairline bg-surface p-3 card-shadow">
        <span className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
          Notes
        </span>
        <DragDropContext onDragEnd={onNoteDragEnd}>
          <Droppable droppableId="notes-in-category">
            {(provided) => (
              <ul
                ref={provided.innerRef}
                {...provided.droppableProps}
                data-testid="note-list"
              >
                {visibleNotes.map((n, index) => (
                  <Draggable key={n.id} draggableId={n.id} index={index}>
                    {(drag, snapshot) => (
                      <li
                        ref={drag.innerRef}
                        {...drag.draggableProps}
                        data-testid={`note-item-${n.id}`}
                        className="pb-0.5"
                      >
                        <div
                          className={`group flex items-center rounded-lg ${
                            snapshot.isDragging
                              ? "bg-surface-raised pop-shadow"
                              : activeNoteId === n.id
                                ? "bg-accent-soft"
                                : "hover:bg-surface-sunken"
                          }`}
                        >
                          <span
                            {...drag.dragHandleProps}
                            data-testid={`note-handle-${n.id}`}
                            aria-label={`Drag to reorder ${n.title}`}
                            className="cursor-grab px-1 py-1.5 text-ink-muted opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
                          >
                            <GripVertical size={13} />
                          </span>
                          <button
                            onClick={() => setActiveNoteId(n.id)}
                            className={`flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left text-sm ${
                              activeNoteId === n.id
                                ? "font-medium text-ink"
                                : "text-ink-secondary group-hover:text-ink"
                            }`}
                          >
                            <FileText
                              size={14}
                              className="shrink-0 text-ink-muted"
                            />
                            <span className="truncate">{n.title}</span>
                          </button>
                          <button
                            onClick={() => setConfirmDelete(n)}
                            className="mr-1 rounded-md p-1 text-ink-muted opacity-0 transition-all hover:bg-danger-soft hover:text-danger group-hover:opacity-100"
                            title="Delete note"
                            aria-label={`Delete note ${n.title}`}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </li>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </ul>
            )}
          </Droppable>
        </DragDropContext>
        {visibleNotes.length === 0 && (
          <p className="px-2 py-1 text-xs text-ink-muted">
            No notes in this category.
          </p>
        )}
      </div>

      {/* Editor */}
      <div className="rounded-xl border border-hairline bg-surface p-3 card-shadow">
        {!activeNote ? (
          <div className="flex h-full min-h-40 flex-col items-center justify-center gap-2 text-center">
            <FileText size={20} className="text-ink-muted" />
            <p className="text-xs text-ink-muted">
              Select a note on the left, or create a new one.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2">
              <input
                value={editTitle}
                onChange={(e) => {
                  setEditTitle(e.target.value);
                  setDirty(true);
                }}
                data-testid="note-editor-title"
                className="min-w-0 flex-1 rounded-lg border border-hairline bg-surface-sunken px-3 py-2 text-sm font-medium outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent-soft"
              />
              <div className="flex shrink-0 rounded-lg border border-hairline bg-surface-sunken p-0.5">
                <button
                  onClick={() => setPreview(false)}
                  data-testid="note-mode-write"
                  className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    !preview
                      ? "bg-surface-raised text-ink card-shadow"
                      : "text-ink-muted hover:text-ink"
                  }`}
                >
                  <PenLine size={12} />
                  Write
                </button>
                <button
                  onClick={() => setPreview(true)}
                  data-testid="note-mode-preview"
                  className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    preview
                      ? "bg-surface-raised text-ink card-shadow"
                      : "text-ink-muted hover:text-ink"
                  }`}
                >
                  <Eye size={12} />
                  Preview
                </button>
              </div>
            </div>
            {preview ? (
              <div className="min-h-[21rem] rounded-lg border border-hairline bg-surface-sunken px-4 py-3">
                <Markdown source={editBody} />
              </div>
            ) : (
              <textarea
                value={editBody}
                onChange={(e) => {
                  setEditBody(e.target.value);
                  setDirty(true);
                }}
                rows={14}
                placeholder="Write in markdown…"
                data-testid="note-editor-body"
                className="resize-y rounded-lg border border-hairline bg-surface-sunken px-3 py-2 font-mono text-sm outline-none transition-colors placeholder:text-ink-muted focus:border-accent focus:ring-2 focus:ring-accent-soft"
              />
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={saveActive}
                disabled={!dirty || saving}
                data-testid="note-save-button"
                className="rounded-lg bg-accent px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-40"
              >
                {saving ? "Saving…" : "Save"}
              </button>
              {dirty && (
                <span className="text-xs text-ink-muted">Unsaved changes</span>
              )}
            </div>
          </div>
        )}
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="Delete note"
          message="Permanently delete note"
          entityName={confirmDelete.title}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => removeNote(confirmDelete)}
        />
      )}
    </div>
  );
}
