"use client";

import { useEffect, useState } from "react";
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd";
import type { LinkEntry } from "@/lib/types";
import { copyText } from "@/lib/clipboard";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Tooltip } from "@/components/Tooltip";
import { useToast } from "@/components/Toast";
import {
  Check,
  Copy,
  ExternalLink,
  GripVertical,
  Info,
  Link2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

// Compact display form of a URL: strip protocol + trailing slash.
function prettyUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

export function LinksPanel({ projectId }: { projectId: string }) {
  const toast = useToast();
  const [links, setLinks] = useState<LinkEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");

  const [editing, setEditing] = useState<LinkEntry | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editNote, setEditNote] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<LinkEntry | null>(null);

  async function load() {
    const res = await fetch(`/api/projects/${projectId}/links`);
    const data = await res.json();
    setLinks(data.links as LinkEntry[]);
    setLoading(false);
  }

  useEffect(() => {
    setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function addLink(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim() || !url.trim()) return;
    await fetch(`/api/projects/${projectId}/links`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, url, note }),
    });
    setLabel("");
    setUrl("");
    setNote("");
    await load();
    toast("Link added");
  }

  async function removeLink(link: LinkEntry) {
    await fetch(`/api/projects/${projectId}/links/${link.id}`, {
      method: "DELETE",
    });
    setConfirmDelete(null);
    await load();
    toast("Link deleted");
  }

  async function copyUrl(link: LinkEntry) {
    const ok = await copyText(link.url);
    if (ok) {
      setCopiedId(link.id);
      toast("Copied to clipboard");
      setTimeout(() => setCopiedId((c) => (c === link.id ? null : c)), 1500);
    } else {
      toast("Copy failed", "error");
    }
  }

  function openEdit(link: LinkEntry) {
    setEditing(link);
    setEditLabel(link.label);
    setEditUrl(link.url);
    setEditNote(link.note);
  }

  async function saveEdit() {
    if (!editing || !editLabel.trim() || !editUrl.trim()) return;
    setSavingEdit(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/links/${editing.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: editLabel,
            url: editUrl,
            note: editNote,
          }),
        },
      );
      if (res.ok) {
        setEditing(null);
        await load();
        toast("Link saved");
      } else {
        toast("Failed to save link", "error");
      }
    } finally {
      setSavingEdit(false);
    }
  }

  async function onDragEnd(result: DropResult) {
    if (!result.destination) return;
    const from = result.source.index;
    const to = result.destination.index;
    if (from === to) return;
    const next = [...links];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setLinks(next);
    const res = await fetch(`/api/projects/${projectId}/links/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: next.map((l) => l.id) }),
    });
    if (!res.ok) {
      toast("Failed to save order", "error");
      await load();
    }
  }

  if (loading)
    return <p className="text-sm text-ink-muted">Loading links…</p>;

  const inputCls =
    "rounded-lg border border-hairline bg-surface-sunken px-2.5 py-2 text-sm outline-none transition-colors placeholder:text-ink-muted focus:border-accent focus:ring-2 focus:ring-accent-soft";

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={addLink}
        className="grid grid-cols-1 gap-2 rounded-xl border border-hairline bg-surface p-3 card-shadow sm:grid-cols-[1fr_1.4fr_1fr_auto]"
      >
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (e.g. API spec)"
          data-testid="link-label-input"
          className={inputCls}
        />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="URL (e.g. docs.google.com/…)"
          data-testid="link-url-input"
          className={`${inputCls} font-mono text-[13px]`}
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          data-testid="link-note-input"
          className={inputCls}
        />
        <button
          type="submit"
          disabled={!label.trim() || !url.trim()}
          data-testid="link-add-button"
          className="flex items-center justify-center gap-1 rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-40"
        >
          <Plus size={14} />
          Add
        </button>
      </form>

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="link-entries">
          {(provided) => (
            <ul
              ref={provided.innerRef}
              {...provided.droppableProps}
              data-testid="links-list"
            >
              {links.map((link, index) => (
                <Draggable key={link.id} draggableId={link.id} index={index}>
                  {(drag, snapshot) => (
                    <li
                      ref={drag.innerRef}
                      {...drag.draggableProps}
                      data-testid={`link-entry-${link.id}`}
                      className="pb-2"
                    >
                      <div
                        className={`group flex flex-wrap items-center gap-2 rounded-xl border border-hairline bg-surface px-2 py-2.5 text-sm ${
                          snapshot.isDragging
                            ? "pop-shadow ring-2 ring-accent"
                            : "card-shadow hover:border-hairline-strong"
                        }`}
                      >
                        <span
                          {...drag.dragHandleProps}
                          data-testid={`link-handle-${link.id}`}
                          aria-label={`Drag to reorder ${link.label}`}
                          className="cursor-grab px-0.5 text-ink-muted opacity-40 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
                        >
                          <GripVertical size={14} />
                        </span>
                        <span className="flex shrink-0 items-center gap-1.5 font-medium">
                          <Link2 size={13} className="text-ink-muted" />
                          {link.label}
                          {link.note && (
                            <Tooltip content={link.note}>
                              <span
                                data-testid={`link-note-icon-${link.id}`}
                                className="flex cursor-help items-center text-ink-muted transition-colors hover:text-accent"
                              >
                                <Info size={13} />
                              </span>
                            </Tooltip>
                          )}
                        </span>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          data-testid={`link-url-${link.id}`}
                          title={link.url}
                          className="min-w-[8ch] flex-1 truncate text-[13px] text-accent underline-offset-2 hover:underline"
                        >
                          {prettyUrl(link.url)}
                        </a>
                        <div className="flex shrink-0 items-center gap-1">
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            data-testid={`link-open-${link.id}`}
                            title="Open in new tab"
                            aria-label={`Open ${link.label} in new tab`}
                            className="rounded-md p-1.5 text-ink-muted transition-colors hover:bg-surface-sunken hover:text-accent"
                          >
                            <ExternalLink size={14} />
                          </a>
                          <button
                            onClick={() => copyUrl(link)}
                            data-testid={`link-copy-${link.id}`}
                            title="Copy URL"
                            className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
                              copiedId === link.id
                                ? "border-done bg-done-soft text-done"
                                : "border-hairline text-ink-secondary hover:border-accent hover:text-ink"
                            }`}
                          >
                            {copiedId === link.id ? (
                              <>
                                <Check size={12} />
                                Copied!
                              </>
                            ) : (
                              <>
                                <Copy size={12} />
                                Copy
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => openEdit(link)}
                            data-testid={`link-edit-${link.id}`}
                            title="Edit link"
                            className="rounded-md p-1.5 text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setConfirmDelete(link)}
                            data-testid={`link-delete-${link.id}`}
                            title="Delete link"
                            className="rounded-md p-1.5 text-ink-muted opacity-0 transition-all hover:bg-danger-soft hover:text-danger group-hover:opacity-100"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
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
      {links.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-hairline px-4 py-8 text-center">
          <Link2 size={18} className="text-ink-muted" />
          <p className="text-xs text-ink-muted">
            No links yet. Collect project documents, specs and dashboards here.
          </p>
        </div>
      )}

      {editing && (
        <Modal title="Edit link" onClose={() => setEditing(null)}>
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-ink-secondary">
                Label
              </span>
              <input
                autoFocus
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                data-testid="link-edit-label"
                className={inputCls}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-ink-secondary">
                URL
              </span>
              <input
                value={editUrl}
                onChange={(e) => setEditUrl(e.target.value)}
                data-testid="link-edit-url"
                className={`${inputCls} font-mono text-[13px]`}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-ink-secondary">
                Note
              </span>
              <input
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                data-testid="link-edit-note"
                className={inputCls}
              />
            </label>
            <div className="mt-1 flex justify-end gap-2">
              <button
                onClick={() => setEditing(null)}
                className="rounded-lg px-3 py-2 text-xs font-medium text-ink-secondary transition-colors hover:bg-surface-sunken hover:text-ink"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={savingEdit || !editLabel.trim() || !editUrl.trim()}
                data-testid="link-edit-save"
                className="rounded-lg bg-accent px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-40"
              >
                {savingEdit ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete link"
          message="Delete link"
          entityName={confirmDelete.label}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => removeLink(confirmDelete)}
        />
      )}
    </div>
  );
}
