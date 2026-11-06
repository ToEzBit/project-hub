"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

export function NewProjectForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, color }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "failed");
      setName("");
      setDescription("");
      setColor("#6366f1");
      setOpen(false);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        data-testid="new-project-button"
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-hairline-strong px-3 py-2 text-sm font-medium text-ink-secondary transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent"
      >
        <Plus size={15} />
        New project
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-2.5 rounded-xl border border-hairline bg-surface-sunken p-3"
    >
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Project name"
        data-testid="new-project-name"
        className="rounded-lg border border-hairline bg-surface px-3 py-2 text-sm outline-none transition-colors placeholder:text-ink-muted focus:border-accent focus:ring-2 focus:ring-accent-soft"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        rows={2}
        className="resize-none rounded-lg border border-hairline bg-surface px-3 py-2 text-sm outline-none transition-colors placeholder:text-ink-muted focus:border-accent focus:ring-2 focus:ring-accent-soft"
      />
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          title="Project color"
          className="h-8 w-8 cursor-pointer rounded-lg border border-hairline bg-transparent"
        />
        <div className="flex flex-1 justify-end gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg px-3 py-1.5 text-sm text-ink-secondary transition-colors hover:bg-surface hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || !name.trim()}
            data-testid="new-project-submit"
            className="rounded-lg bg-accent px-3.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-40"
          >
            {busy ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </form>
  );
}
