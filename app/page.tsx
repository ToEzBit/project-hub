"use client";

import { useCallback, useEffect, useState } from "react";
import type { Project, Task } from "@/lib/types";
import { ProjectList } from "@/components/ProjectList";
import { NewProjectForm } from "@/components/NewProjectForm";
import { Board } from "@/components/Board";
import { Tabs } from "@/components/Tabs";
import { NotesPanel } from "@/components/NotesPanel";
import { VaultPanel } from "@/components/VaultPanel";
import { LinksPanel } from "@/components/LinksPanel";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CommandPalette, type SearchHit } from "@/components/CommandPalette";
import { EditProjectModal } from "@/components/EditProjectModal";
import { useToast } from "@/components/Toast";
import { Boxes, CalendarDays, Pencil, Search } from "lucide-react";
import { formatRelative } from "@/lib/dates";

const TABS = [
  { key: "kanban", label: "Kanban" },
  { key: "notes", label: "Notes" },
  { key: "links", label: "Links" },
  { key: "vault", label: "Vault" },
];

export default function Home() {
  const toast = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<string>("kanban");
  const [loading, setLoading] = useState(true);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [noteFocus, setNoteFocus] = useState<string | null>(null);
  const [editingProject, setEditingProject] = useState(false);

  const loadProjects = useCallback(async () => {
    const res = await fetch("/api/projects");
    const data = await res.json();
    setProjects(data.projects as Project[]);
    return data.projects as Project[];
  }, []);

  const loadTasks = useCallback(async (projectId: string) => {
    const res = await fetch(`/api/projects/${projectId}/kanban`);
    const data = await res.json();
    setTasks(data.tasks as Task[]);
  }, []);

  useEffect(() => {
    (async () => {
      const ps = await loadProjects();
      if (ps.length > 0) setSelectedId(ps[0].id);
      setLoading(false);
    })();
  }, [loadProjects]);

  useEffect(() => {
    if (selectedId) loadTasks(selectedId);
    else setTasks([]);
  }, [selectedId, loadTasks]);

  // Global Ctrl/Cmd+K opens the quick switcher.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function refreshAll() {
    const ps = await loadProjects();
    if (selectedId) {
      if (!ps.find((p) => p.id === selectedId)) {
        setSelectedId(ps[0]?.id ?? null);
      } else {
        await loadTasks(selectedId);
      }
    }
  }

  async function handleCreated() {
    const ps = await loadProjects();
    setSelectedId(ps[ps.length - 1]?.id ?? null);
    setTab("kanban");
    toast("Project created");
  }

  async function handleDelete(id: string) {
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    const ps = await loadProjects();
    if (selectedId === id) setSelectedId(ps[0]?.id ?? null);
    toast("Project deleted");
  }

  // Optimistic sidebar reorder; the API writes order = index for each id.
  async function handleReorder(ids: string[]) {
    const byId = new Map(projects.map((p) => [p.id, p]));
    const next = ids
      .map((id, i) => {
        const p = byId.get(id);
        return p ? { ...p, order: i } : null;
      })
      .filter((p): p is Project => p !== null);
    setProjects(next);
    const res = await fetch("/api/projects/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) {
      toast("Failed to save order", "error");
      await loadProjects();
    }
  }

  function selectProject(id: string) {
    setSelectedId(id);
    setTab("kanban");
    setNoteFocus(null);
  }

  function handlePaletteHit(hit: SearchHit) {
    setSelectedId(hit.projectId);
    if (hit.kind === "note") {
      setNoteFocus(hit.id);
      setTab("notes");
    } else {
      setNoteFocus(null);
      setTab("kanban");
    }
  }

  const selected = projects.find((p) => p.id === selectedId) ?? null;
  // Header stats count only active (non-archived) tasks.
  const activeTasks = tasks.filter((t) => !t.archivedAt);
  const counts = {
    todo: activeTasks.filter((t) => t.status === "todo").length,
    doing: activeTasks.filter((t) => t.status === "doing").length,
    done: activeTasks.filter((t) => t.status === "done").length,
  };
  const total = activeTasks.length;
  const pct = total > 0 ? Math.round((counts.done / total) * 100) : 0;

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-ink-muted">
        Loading…
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col md:h-screen md:flex-row md:overflow-hidden">
      <aside className="flex w-full shrink-0 flex-col gap-4 border-b border-hairline bg-surface p-4 md:w-64 md:overflow-y-auto md:border-b-0 md:border-r">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-accent">
              <Boxes size={18} />
            </span>
            <div>
              <h1 className="text-sm font-semibold leading-tight">
                Project Hub
              </h1>
              <p className="text-[11px] leading-tight text-ink-muted">
                {projects.length} project{projects.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          <ThemeToggle />
        </div>

        <button
          onClick={() => setPaletteOpen(true)}
          data-testid="open-palette"
          className="flex items-center gap-2 rounded-lg border border-hairline bg-surface-sunken px-2.5 py-2 text-xs text-ink-muted transition-colors hover:border-hairline-strong hover:text-ink"
        >
          <Search size={13} />
          <span className="flex-1 text-left">Search everything…</span>
          <kbd className="rounded border border-hairline bg-surface px-1.5 py-0.5 text-[10px] font-medium">
            Ctrl K
          </kbd>
        </button>

        <ProjectList
          projects={projects}
          selectedId={selectedId}
          onSelect={selectProject}
          onDelete={handleDelete}
          onReorder={handleReorder}
        />
        <NewProjectForm onCreated={handleCreated} />
      </aside>

      <section className="flex-1 overflow-y-auto p-4 md:p-6">
        {!selected ? (
          <div className="flex h-full min-h-[50vh] flex-col items-center justify-center gap-2 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-sunken text-ink-muted">
              <Boxes size={22} />
            </span>
            <p className="text-sm font-medium">No project selected</p>
            <p className="max-w-xs text-xs text-ink-muted">
              Create your first project with the button in the sidebar to start
              tracking tasks, notes and credentials.
            </p>
          </div>
        ) : (
          <div className="mx-auto flex max-w-[1800px] flex-col gap-5">
            {/* Project header: identity on the left, live stats on the right —
                fills the horizontal space that used to sit empty. */}
            <div
              data-testid="project-header"
              className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-hairline bg-surface px-5 py-4 card-shadow"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2.5">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full ring-4 ring-surface-sunken"
                    style={{ background: selected.color }}
                  />
                  <h2 className="truncate text-xl font-semibold tracking-tight">
                    {selected.name}
                  </h2>
                  <button
                    onClick={() => setEditingProject(true)}
                    title="Edit project"
                    aria-label="Edit project"
                    data-testid="edit-project-button"
                    className="rounded-md p-1.5 text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
                  >
                    <Pencil size={14} />
                  </button>
                </div>
                {selected.description && (
                  <p className="mt-1 truncate text-sm text-ink-secondary">
                    {selected.description}
                  </p>
                )}
                <p className="mt-1 flex items-center gap-1 text-[11px] text-ink-muted">
                  <CalendarDays size={11} />
                  Created {formatRelative(selected.createdAt)}
                </p>
              </div>
              <div
                className="flex shrink-0 flex-wrap items-center gap-4"
                data-testid="project-header-stats"
              >
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1.5 text-ink-secondary">
                    <span className="h-2 w-2 rounded-full bg-todo" />
                    {counts.todo} to do
                  </span>
                  <span className="flex items-center gap-1.5 text-ink-secondary">
                    <span className="h-2 w-2 rounded-full bg-doing" />
                    {counts.doing} doing
                  </span>
                  <span className="flex items-center gap-1.5 text-ink-secondary">
                    <span className="h-2 w-2 rounded-full bg-done" />
                    {counts.done} done
                  </span>
                </div>
                <div className="flex min-w-36 flex-col gap-1">
                  <div className="flex items-center justify-between text-[11px] text-ink-muted">
                    <span>Progress</span>
                    <span data-testid="project-progress-pct">{pct}%</span>
                  </div>
                  <div className="h-1.5 w-36 overflow-hidden rounded-full bg-surface-sunken">
                    <div
                      className="h-full rounded-full bg-done transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <Tabs tabs={TABS} active={tab} onChange={setTab} />

            {tab === "kanban" && (
              <Board
                projectId={selected.id}
                tasks={tasks}
                onChanged={refreshAll}
              />
            )}
            {tab === "notes" && (
              <NotesPanel projectId={selected.id} initialNoteId={noteFocus} />
            )}
            {tab === "links" && <LinksPanel projectId={selected.id} />}
            {tab === "vault" && <VaultPanel projectId={selected.id} />}
          </div>
        )}
      </section>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onPick={handlePaletteHit}
      />

      {editingProject && selected && (
        <EditProjectModal
          project={selected}
          onClose={() => setEditingProject(false)}
          onSaved={async () => {
            await loadProjects();
            toast("Project updated");
          }}
        />
      )}
    </main>
  );
}
