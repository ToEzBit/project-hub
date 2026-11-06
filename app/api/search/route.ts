import { NextResponse } from "next/server";
import { listProjects } from "@/lib/projects";
import { listTasks } from "@/lib/kanban";
import { listNotes } from "@/lib/notes";

export interface SearchHit {
  kind: "project" | "task" | "note";
  projectId: string;
  projectName: string;
  id: string; // task id / note id / project id
  title: string;
  subtitle: string; // status, category, description snippet…
}

// GET /api/search?q=… — case-insensitive substring search across project
// names, task titles/descriptions and note titles/bodies. Small personal
// datasets: a linear scan over the plain files is instant and keeps zero
// index state.
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim().toLowerCase() ?? "";
  if (!q) return NextResponse.json({ hits: [] });
  const projects = await listProjects();
  const hits: SearchHit[] = [];
  const LIMIT = 30;

  for (const p of projects) {
    if (hits.length >= LIMIT) break;
    if (p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)) {
      hits.push({
        kind: "project",
        projectId: p.id,
        projectName: p.name,
        id: p.id,
        title: p.name,
        subtitle: p.description || "Project",
      });
    }
    const tasks = await listTasks(p.id);
    for (const t of tasks) {
      if (hits.length >= LIMIT) break;
      if (
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)
      ) {
        hits.push({
          kind: "task",
          projectId: p.id,
          projectName: p.name,
          id: t.id,
          title: t.title,
          subtitle: t.status === "todo" ? "To do" : t.status === "doing" ? "Doing" : "Done",
        });
      }
    }
    const notes = await listNotes(p.id);
    for (const n of notes) {
      if (hits.length >= LIMIT) break;
      if (n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q)) {
        hits.push({
          kind: "note",
          projectId: p.id,
          projectName: p.name,
          id: n.id,
          title: n.title,
          subtitle: n.categoryLabel,
        });
      }
    }
  }
  return NextResponse.json({ hits });
}
