"use client";

import { useEffect, useState } from "react";
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd";
import type { Task, TaskStatus } from "@/lib/types";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { dueState, formatDue, formatRelative } from "@/lib/dates";
import {
  AlignLeft,
  Archive,
  ArchiveRestore,
  CalendarDays,
  Check,
  Clock3,
  Plus,
  Trash2,
  X,
} from "lucide-react";

const COLUMNS: {
  key: TaskStatus;
  label: string;
  dot: string;
  soft: string;
}[] = [
  { key: "todo", label: "To do", dot: "bg-todo", soft: "bg-todo-soft" },
  { key: "doing", label: "Doing", dot: "bg-doing", soft: "bg-doing-soft" },
  { key: "done", label: "Done", dot: "bg-done", soft: "bg-done-soft" },
];

function groupByStatus(tasks: Task[]): Record<TaskStatus, Task[]> {
  const grouped: Record<TaskStatus, Task[]> = { todo: [], doing: [], done: [] };
  // Archived tasks never appear on the board.
  for (const t of [...tasks]
    .filter((t) => !t.archivedAt)
    .sort((a, b) => a.order - b.order)) {
    grouped[t.status]?.push(t);
  }
  return grouped;
}

function DueBadge({ task }: { task: Task }) {
  if (!task.dueDate) return null;
  // Done tasks are never flagged — show a neutral badge.
  const state = task.status === "done" ? "upcoming" : dueState(task.dueDate);
  const cls =
    task.status === "done"
      ? "border-hairline bg-surface-sunken text-ink-muted"
      : state === "overdue"
        ? "border-transparent bg-danger-soft text-danger"
        : state === "today"
          ? "border-transparent bg-doing-soft text-doing"
          : "border-hairline bg-surface-sunken text-ink-secondary";
  return (
    <span
      data-testid={`task-due-${task.id}`}
      data-due-state={task.status === "done" ? "done" : state}
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${cls}`}
    >
      <CalendarDays size={10} />
      {formatDue(task.dueDate)}
    </span>
  );
}

export function Board({
  projectId,
  tasks,
  onChanged,
}: {
  projectId: string;
  tasks: Task[];
  onChanged: () => void;
}) {
  const toast = useToast();
  const [draft, setDraft] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  // Local optimistic copy so drops render instantly; resynced from props.
  const [columns, setColumns] = useState(() => groupByStatus(tasks));
  const [editing, setEditing] = useState<Task | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDue, setEditDue] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmDeleteTask, setConfirmDeleteTask] = useState<Task | null>(null);
  const [confirmClearDone, setConfirmClearDone] = useState(false);
  const [showArchive, setShowArchive] = useState(false);

  const archived = tasks
    .filter((t) => t.archivedAt)
    .sort((a, b) => (b.archivedAt ?? "").localeCompare(a.archivedAt ?? ""));

  useEffect(() => {
    setColumns(groupByStatus(tasks));
  }, [tasks]);

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setBusy(true);
    try {
      await fetch(`/api/projects/${projectId}/kanban`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: draft, description }),
      });
      setDraft("");
      setDescription("");
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function handleDragEnd(result: DropResult) {
    const { source, destination } = result;
    if (!destination) return;
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }
    const from = source.droppableId as TaskStatus;
    const to = destination.droppableId as TaskStatus;
    const next: Record<TaskStatus, Task[]> = {
      todo: [...columns.todo],
      doing: [...columns.doing],
      done: [...columns.done],
    };
    const [moved] = next[from].splice(source.index, 1);
    if (!moved) return;
    next[to].splice(destination.index, 0, { ...moved, status: to });
    setColumns(next);

    const res = await fetch(`/api/projects/${projectId}/kanban/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        columns: {
          todo: next.todo.map((t) => t.id),
          doing: next.doing.map((t) => t.id),
          done: next.done.map((t) => t.id),
        },
      }),
    });
    if (!res.ok) {
      toast("Failed to move task", "error");
    }
    onChanged();
  }

  // Quick toggle from the card: not-done → done (appended), done → todo.
  async function toggleDone(task: Task, e: React.MouseEvent) {
    e.stopPropagation();
    const status: TaskStatus = task.status === "done" ? "todo" : "done";
    const res = await fetch(`/api/projects/${projectId}/kanban/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      toast(status === "done" ? "Task completed" : "Task reopened");
      onChanged();
    } else {
      toast("Failed to update task", "error");
    }
  }

  function openEdit(task: Task) {
    setEditing(task);
    setEditTitle(task.title);
    setEditDescription(task.description);
    setEditDue(task.dueDate ?? "");
  }

  async function saveEdit() {
    if (!editing || !editTitle.trim()) return;
    setSavingEdit(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/kanban/${editing.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: editTitle,
            description: editDescription,
            dueDate: editDue, // "" clears the due date server-side
          }),
        },
      );
      if (res.ok) {
        toast("Task saved");
        setEditing(null);
        onChanged();
      } else {
        toast("Failed to save task", "error");
      }
    } finally {
      setSavingEdit(false);
    }
  }

  async function deleteTask(task: Task) {
    await fetch(`/api/projects/${projectId}/kanban/${task.id}`, {
      method: "DELETE",
    });
    setConfirmDeleteTask(null);
    setEditing(null);
    toast("Task deleted");
    onChanged();
  }

  async function archiveTask(task: Task, e?: React.MouseEvent) {
    e?.stopPropagation();
    const res = await fetch(`/api/projects/${projectId}/kanban/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archivedAt: new Date().toISOString() }),
    });
    if (res.ok) {
      setEditing(null);
      toast("Task archived");
      onChanged();
    } else {
      toast("Failed to archive task", "error");
    }
  }

  async function restoreTask(task: Task) {
    const res = await fetch(`/api/projects/${projectId}/kanban/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archivedAt: null }),
    });
    if (res.ok) {
      toast("Task restored");
      onChanged();
    } else {
      toast("Failed to restore task", "error");
    }
  }

  // "Clear" on the done column now archives instead of deleting — nothing is
  // lost; everything can be restored from the archive.
  async function clearDone() {
    const done = columns.done;
    const now = new Date().toISOString();
    for (const t of done) {
      await fetch(`/api/projects/${projectId}/kanban/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archivedAt: now }),
      });
    }
    setConfirmClearDone(false);
    toast(`Archived ${done.length} done task${done.length === 1 ? "" : "s"}`);
    onChanged();
  }

  return (
    <div className="flex flex-col gap-5">
      <form
        onSubmit={addTask}
        className="flex flex-col gap-2 rounded-xl border border-hairline bg-surface p-3 card-shadow sm:flex-row sm:items-center"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Task title…"
          className="flex-1 rounded-lg border border-hairline bg-surface-sunken px-3 py-2 text-sm outline-none transition-colors placeholder:text-ink-muted focus:border-accent focus:ring-2 focus:ring-accent-soft"
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          className="flex-1 rounded-lg border border-hairline bg-surface-sunken px-3 py-2 text-sm outline-none transition-colors placeholder:text-ink-muted focus:border-accent focus:ring-2 focus:ring-accent-soft"
        />
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          className="flex items-center justify-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-40"
        >
          <Plus size={15} />
          Add task
        </button>
        {archived.length > 0 && (
          <button
            type="button"
            onClick={() => setShowArchive(true)}
            data-testid="open-archive"
            title="View archived tasks"
            className="flex items-center justify-center gap-1.5 rounded-lg border border-hairline px-3 py-2 text-sm font-medium text-ink-secondary transition-colors hover:bg-surface-sunken hover:text-ink"
          >
            <Archive size={14} />
            {archived.length}
          </button>
        )}
      </form>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {COLUMNS.map((col) => {
            const items = columns[col.key];
            return (
              <div
                key={col.key}
                className="flex flex-col rounded-xl border border-hairline bg-surface p-3 card-shadow"
              >
                <div className="mb-3 flex items-center gap-2 px-1 text-[13px] font-semibold text-ink-secondary">
                  <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                  {col.label}
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium text-ink-muted ${col.soft}`}
                  >
                    {items.length}
                  </span>
                  {col.key === "done" && items.length > 0 && (
                    <button
                      onClick={() => setConfirmClearDone(true)}
                      data-testid="clear-done-button"
                      title="Clear all done tasks"
                      className="ml-auto flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-ink-muted transition-colors hover:bg-danger-soft hover:text-danger"
                    >
                      <Trash2 size={11} />
                      Clear
                    </button>
                  )}
                </div>
                <Droppable droppableId={col.key}>
                  {(provided, snapshot) => (
                    <ul
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      data-testid={`column-${col.key}`}
                      className={`min-h-16 flex-1 rounded-lg p-1 transition-colors ${
                        snapshot.isDraggingOver ? "bg-accent-soft" : ""
                      }`}
                    >
                      {/* NOTE: no flex gap / margins between draggables — each
                          card carries its own padding-bottom wrapper so the
                          library's placeholder matches the real box exactly
                          and nothing jumps on drop. */}
                      {items.map((t, index) => (
                        <Draggable key={t.id} draggableId={t.id} index={index}>
                          {(drag, dragSnapshot) => (
                            <li
                              ref={drag.innerRef}
                              {...drag.draggableProps}
                              {...drag.dragHandleProps}
                              data-testid={`task-card-${t.id}`}
                              data-task-title={t.title}
                              onClick={() => openEdit(t)}
                              className="group/card cursor-grab pb-2 active:cursor-grabbing"
                            >
                              <div
                                className={`relative rounded-lg border border-hairline bg-surface-raised p-3 text-sm ${
                                  dragSnapshot.isDragging
                                    ? "pop-shadow ring-2 ring-accent"
                                    : "card-shadow hover:border-hairline-strong"
                                }`}
                              >
                                <button
                                  onClick={(e) => archiveTask(t, e)}
                                  data-testid={`quick-archive-${t.id}`}
                                  title="Archive task"
                                  aria-label={`Archive ${t.title}`}
                                  className="absolute right-8 top-2 flex h-5 w-5 items-center justify-center rounded-full border border-hairline-strong bg-surface text-ink-muted opacity-0 transition-all hover:border-accent hover:text-accent group-hover/card:opacity-100"
                                >
                                  <Archive size={10} />
                                </button>
                                <button
                                  onClick={(e) => toggleDone(t, e)}
                                  data-testid={`quick-done-${t.id}`}
                                  title={
                                    t.status === "done"
                                      ? "Reopen task"
                                      : "Mark as done"
                                  }
                                  aria-label={
                                    t.status === "done"
                                      ? `Reopen ${t.title}`
                                      : `Mark ${t.title} done`
                                  }
                                  className={`absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full border transition-all ${
                                    t.status === "done"
                                      ? "border-done bg-done-soft text-done opacity-100"
                                      : "border-hairline-strong bg-surface text-transparent opacity-0 hover:border-done hover:text-done group-hover/card:opacity-100"
                                  }`}
                                >
                                  <Check size={11} strokeWidth={3} />
                                </button>
                                <p
                                  className={`break-words pr-12 font-medium leading-snug ${
                                    t.status === "done"
                                      ? "text-ink-muted line-through decoration-hairline-strong"
                                      : ""
                                  }`}
                                >
                                  {t.title}
                                </p>
                                {t.description && (
                                  <p className="mt-1.5 flex items-start gap-1 text-xs leading-relaxed text-ink-muted">
                                    <AlignLeft
                                      size={12}
                                      className="mt-0.5 shrink-0"
                                    />
                                    <span className="line-clamp-2 whitespace-pre-wrap">
                                      {t.description}
                                    </span>
                                  </p>
                                )}
                                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                  <span
                                    data-testid={`task-created-${t.id}`}
                                    title={new Date(t.createdAt).toLocaleString()}
                                    className="inline-flex items-center gap-1 text-[10px] text-ink-muted"
                                  >
                                    <Clock3 size={10} />
                                    {formatRelative(t.createdAt)}
                                  </span>
                                  <DueBadge task={t} />
                                </div>
                              </div>
                            </li>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      {items.length === 0 &&
                        !snapshot.isDraggingOver &&
                        !snapshot.draggingFromThisWith && (
                          <li className="rounded-lg border border-dashed border-hairline px-3 py-4 text-center text-xs text-ink-muted">
                            Drop tasks here
                          </li>
                        )}
                    </ul>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      {editing && (
        <Modal title="Edit task" onClose={() => setEditing(null)} wide>
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-ink-secondary">
                Title
              </span>
              <input
                autoFocus
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                data-testid="edit-task-title"
                className="rounded-lg border border-hairline bg-surface-sunken px-3 py-2 text-sm outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent-soft"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-ink-secondary">
                Description
              </span>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={5}
                data-testid="edit-task-description"
                placeholder="Add more detail…"
                className="resize-y rounded-lg border border-hairline bg-surface-sunken px-3 py-2 text-sm outline-none transition-colors placeholder:text-ink-muted focus:border-accent focus:ring-2 focus:ring-accent-soft"
              />
            </label>
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-ink-secondary">
                  Due date
                </span>
                <input
                  type="date"
                  value={editDue}
                  onChange={(e) => setEditDue(e.target.value)}
                  data-testid="edit-task-due"
                  className="rounded-lg border border-hairline bg-surface-sunken px-3 py-2 text-sm outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent-soft"
                />
              </label>
              {editDue && (
                <button
                  type="button"
                  onClick={() => setEditDue("")}
                  data-testid="edit-task-due-clear"
                  className="flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-medium text-ink-secondary transition-colors hover:bg-surface-sunken hover:text-ink"
                >
                  <X size={12} />
                  Clear
                </button>
              )}
              <span className="pb-2 text-[11px] text-ink-muted">
                Created {formatRelative(editing.createdAt)} ·{" "}
                {new Date(editing.createdAt).toLocaleDateString()}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <div className="flex gap-1">
                <button
                  onClick={() => setConfirmDeleteTask(editing)}
                  data-testid="edit-task-delete"
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-danger transition-colors hover:bg-danger-soft"
                >
                  <Trash2 size={13} />
                  Delete
                </button>
                <button
                  onClick={() => archiveTask(editing)}
                  data-testid="edit-task-archive"
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-ink-secondary transition-colors hover:bg-surface-sunken hover:text-ink"
                >
                  <Archive size={13} />
                  Archive
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditing(null)}
                  className="rounded-lg px-3 py-2 text-xs font-medium text-ink-secondary transition-colors hover:bg-surface-sunken hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEdit}
                  disabled={savingEdit || !editTitle.trim()}
                  data-testid="edit-task-save"
                  className="rounded-lg bg-accent px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-40"
                >
                  {savingEdit ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {confirmDeleteTask && (
        <ConfirmDialog
          title="Delete task"
          message="Permanently delete"
          entityName={confirmDeleteTask.title}
          onCancel={() => setConfirmDeleteTask(null)}
          onConfirm={() => deleteTask(confirmDeleteTask)}
        />
      )}

      {confirmClearDone && (
        <ConfirmDialog
          title="Archive done column"
          message={`Archive all ${columns.done.length} completed task${columns.done.length === 1 ? "" : "s"}? You can restore them from the archive at any time.`}
          confirmLabel="Archive all"
          onCancel={() => setConfirmClearDone(false)}
          onConfirm={clearDone}
        />
      )}

      {showArchive && (
        <Modal
          title={`Archived tasks (${archived.length})`}
          onClose={() => setShowArchive(false)}
          wide
        >
          {archived.length === 0 ? (
            <p className="py-4 text-center text-sm text-ink-muted">
              No archived tasks.
            </p>
          ) : (
            <ul className="flex max-h-[60vh] flex-col gap-1.5 overflow-y-auto">
              {archived.map((t) => (
                <li
                  key={t.id}
                  data-testid={`archived-task-${t.id}`}
                  className="group/arch flex items-center gap-3 rounded-lg border border-hairline bg-surface-sunken px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink-secondary">
                      {t.title}
                    </p>
                    <p className="text-[11px] text-ink-muted">
                      Archived {formatRelative(t.archivedAt!)} · was{" "}
                      {t.status === "todo"
                        ? "To do"
                        : t.status === "doing"
                          ? "Doing"
                          : "Done"}
                    </p>
                  </div>
                  <button
                    onClick={() => restoreTask(t)}
                    data-testid={`restore-task-${t.id}`}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg border border-hairline px-2.5 py-1.5 text-xs font-medium text-ink-secondary transition-colors hover:border-accent hover:text-accent"
                  >
                    <ArchiveRestore size={12} />
                    Restore
                  </button>
                  <button
                    onClick={() => setConfirmDeleteTask(t)}
                    data-testid={`archived-delete-${t.id}`}
                    title="Delete permanently"
                    aria-label={`Delete ${t.title} permanently`}
                    className="shrink-0 rounded-md p-1.5 text-ink-muted transition-colors hover:bg-danger-soft hover:text-danger"
                  >
                    <Trash2 size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}
    </div>
  );
}
