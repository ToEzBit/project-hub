import { NextResponse } from "next/server";
import { createProject, listProjects } from "@/lib/projects";
import { listTasks } from "@/lib/kanban";

export async function GET() {
  const projects = await listProjects();
  // Sidebar stats: cheap (a handful of small JSON files) and keeps the
  // client to a single request.
  const withStats = await Promise.all(
    projects.map(async (p) => {
      // Archived tasks are excluded from sidebar stats.
      const tasks = (await listTasks(p.id)).filter((t) => !t.archivedAt);
      return {
        ...p,
        stats: {
          total: tasks.length,
          done: tasks.filter((t) => t.status === "done").length,
          doing: tasks.filter((t) => t.status === "doing").length,
          todo: tasks.filter((t) => t.status === "todo").length,
        },
      };
    }),
  );
  return NextResponse.json({ projects: withStats });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const project = await createProject({
    name: body.name,
    description: body.description,
    color: body.color,
  });
  return NextResponse.json({ project }, { status: 201 });
}
