"use client";

import { useState } from "react";
import type { Project } from "@/lib/types";
import { Modal } from "@/components/Modal";

export function EditProjectModal({
  project,
  onClose,
  onSaved,
}: {
  project: Project;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [color, setColor] = useState(project.color);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, color }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "failed");
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed");
      setBusy(false);
    }
  }

  return (
    <Modal title="Edit project" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5 text-xs font-medium text-ink-secondary">
          Name
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-testid="edit-project-name"
            className="rounded-lg border border-hairline bg-surface px-3 py-2 text-sm font-normal text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent-soft"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-medium text-ink-secondary">
          Description
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Optional"
            className="resize-none rounded-lg border border-hairline bg-surface px-3 py-2 text-sm font-normal text-ink outline-none transition-colors placeholder:text-ink-muted focus:border-accent focus:ring-2 focus:ring-accent-soft"
          />
        </label>
        <label className="flex items-center gap-2.5 text-xs font-medium text-ink-secondary">
          Color
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            data-testid="edit-project-color"
            className="h-8 w-8 cursor-pointer rounded-lg border border-hairline bg-transparent"
          />
          <span className="font-normal text-ink-muted">{color}</span>
        </label>
        {error && <p className="text-xs text-danger">{error}</p>}
        <div className="mt-1 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-ink-secondary transition-colors hover:bg-surface-sunken hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || !name.trim()}
            data-testid="edit-project-save"
            className="rounded-lg bg-accent px-3.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-40"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
