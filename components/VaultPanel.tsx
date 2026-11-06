"use client";

import { useEffect, useState } from "react";
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd";
import type { VaultEntry } from "@/lib/types";
import { copyText } from "@/lib/clipboard";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Tooltip } from "@/components/Tooltip";
import { useToast } from "@/components/Toast";
import {
  Copy,
  Check,
  Eye,
  EyeOff,
  GripVertical,
  Info,
  KeyRound,
  Pencil,
  Plus,
  ShieldAlert,
  Trash2,
} from "lucide-react";

export function VaultPanel({ projectId }: { projectId: string }) {
  const toast = useToast();
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");

  // Edit modal state
  const [editing, setEditing] = useState<VaultEntry | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editValue, setEditValue] = useState("");
  const [editNote, setEditNote] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<VaultEntry | null>(null);

  async function load() {
    const res = await fetch(`/api/projects/${projectId}/vault`);
    const data = await res.json();
    setEntries(data.entries as VaultEntry[]);
    setLoading(false);
  }

  useEffect(() => {
    setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function addEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim() || !value) return;
    await fetch(`/api/projects/${projectId}/vault`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, value, note }),
    });
    setLabel("");
    setValue("");
    setNote("");
    await load();
    toast("Entry added");
  }

  async function removeEntry(entry: VaultEntry) {
    await fetch(`/api/projects/${projectId}/vault/${entry.id}`, {
      method: "DELETE",
    });
    setConfirmDelete(null);
    await load();
    toast("Entry deleted");
  }

  // Works over plain HTTP too: copyText falls back to the hidden-textarea
  // + execCommand path when navigator.clipboard is unavailable.
  async function copyValue(entry: VaultEntry) {
    const ok = await copyText(entry.value);
    if (ok) {
      setCopiedId(entry.id);
      toast("Copied to clipboard");
      setTimeout(() => setCopiedId((c) => (c === entry.id ? null : c)), 1500);
    } else {
      toast("Copy failed", "error");
    }
  }

  function toggleReveal(id: string) {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openEdit(entry: VaultEntry) {
    setEditing(entry);
    setEditLabel(entry.label);
    setEditValue(entry.value);
    setEditNote(entry.note);
  }

  async function saveEdit() {
    if (!editing || !editLabel.trim() || !editValue) return;
    setSavingEdit(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/vault/${editing.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: editLabel,
            value: editValue,
            note: editNote,
          }),
        },
      );
      if (res.ok) {
        setEditing(null);
        await load();
        toast("Entry saved");
      } else {
        toast("Failed to save entry", "error");
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
    const next = [...entries];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setEntries(next);
    const res = await fetch(`/api/projects/${projectId}/vault/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: next.map((e) => e.id) }),
    });
    if (!res.ok) {
      toast("Failed to save order", "error");
      await load();
    }
  }

  if (loading)
    return <p className="text-sm text-ink-muted">Loading vault…</p>;

  const inputCls =
    "rounded-lg border border-hairline bg-surface-sunken px-2.5 py-2 text-sm outline-none transition-colors placeholder:text-ink-muted focus:border-accent focus:ring-2 focus:ring-accent-soft";

  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-start gap-1.5 text-xs text-ink-muted">
        <ShieldAlert size={14} className="mt-px shrink-0" />
        <span>
          Stored as plain text in <code>vault.json</code> on this host only —
          nothing is encrypted or sent anywhere. Suitable for a single-user,
          local-only deployment.
        </span>
      </p>

      <form
        onSubmit={addEntry}
        className="grid grid-cols-1 gap-2 rounded-xl border border-hairline bg-surface p-3 card-shadow sm:grid-cols-[1fr_1.2fr_1fr_auto]"
      >
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (e.g. Staging DB password)"
          data-testid="vault-label-input"
          className={inputCls}
        />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Value"
          data-testid="vault-value-input"
          className={`${inputCls} font-mono`}
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          data-testid="vault-note-input"
          className={inputCls}
        />
        <button
          type="submit"
          disabled={!label.trim() || !value}
          data-testid="vault-add-button"
          className="flex items-center justify-center gap-1 rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-40"
        >
          <Plus size={14} />
          Add
        </button>
      </form>

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="vault-entries">
          {(provided) => (
            <ul
              ref={provided.innerRef}
              {...provided.droppableProps}
              data-testid="vault-list"
            >
              {entries.map((entry, index) => {
                const isRevealed = revealed.has(entry.id);
                const masked =
                  entry.value.length > 4
                    ? "•".repeat(Math.min(entry.value.length, 16))
                    : "••••";
                return (
                  <Draggable key={entry.id} draggableId={entry.id} index={index}>
                    {(drag, snapshot) => (
                      <li
                        ref={drag.innerRef}
                        {...drag.draggableProps}
                        data-testid={`vault-entry-${entry.id}`}
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
                            data-testid={`vault-handle-${entry.id}`}
                            aria-label={`Drag to reorder ${entry.label}`}
                            className="cursor-grab px-0.5 text-ink-muted opacity-40 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
                          >
                            <GripVertical size={14} />
                          </span>
                          <span className="flex shrink-0 items-center gap-1.5 font-medium">
                            {entry.label}
                            {entry.note && (
                              <Tooltip content={entry.note}>
                                <span
                                  data-testid={`vault-note-icon-${entry.id}`}
                                  className="flex cursor-help items-center text-ink-muted transition-colors hover:text-accent"
                                >
                                  <Info size={13} />
                                </span>
                              </Tooltip>
                            )}
                          </span>
                          <code className="min-w-[8ch] flex-1 truncate text-[13px] text-ink-secondary">
                            {isRevealed ? entry.value : masked}
                          </code>
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              onClick={() => toggleReveal(entry.id)}
                              title={isRevealed ? "Hide value" : "Show value"}
                              aria-label={isRevealed ? "Hide value" : "Show value"}
                              className="rounded-md p-1.5 text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
                            >
                              {isRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                            <button
                              onClick={() => copyValue(entry)}
                              data-testid={`vault-copy-${entry.id}`}
                              title="Copy value"
                              className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
                                copiedId === entry.id
                                  ? "border-done bg-done-soft text-done"
                                  : "border-hairline text-ink-secondary hover:border-accent hover:text-ink"
                              }`}
                            >
                              {copiedId === entry.id ? (
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
                              onClick={() => openEdit(entry)}
                              data-testid={`vault-edit-${entry.id}`}
                              title="Edit entry"
                              className="rounded-md p-1.5 text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => setConfirmDelete(entry)}
                              data-testid={`vault-delete-${entry.id}`}
                              title="Delete entry"
                              className="rounded-md p-1.5 text-ink-muted opacity-0 transition-all hover:bg-danger-soft hover:text-danger group-hover:opacity-100"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </li>
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
            </ul>
          )}
        </Droppable>
      </DragDropContext>
      {entries.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-hairline px-4 py-8 text-center">
          <KeyRound size={18} className="text-ink-muted" />
          <p className="text-xs text-ink-muted">
            No entries yet. Add IPs, URLs, API keys or passwords above.
          </p>
        </div>
      )}

      {editing && (
        <Modal title="Edit entry" onClose={() => setEditing(null)}>
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-ink-secondary">
                Label
              </span>
              <input
                autoFocus
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                data-testid="vault-edit-label"
                className={inputCls}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-ink-secondary">
                Value
              </span>
              <input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                data-testid="vault-edit-value"
                className={`${inputCls} font-mono`}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-ink-secondary">
                Note
              </span>
              <input
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                data-testid="vault-edit-note"
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
                disabled={savingEdit || !editLabel.trim() || !editValue}
                data-testid="vault-edit-save"
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
          title="Delete vault entry"
          message="Permanently delete entry"
          entityName={confirmDelete.label}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => removeEntry(confirmDelete)}
        />
      )}
    </div>
  );
}
