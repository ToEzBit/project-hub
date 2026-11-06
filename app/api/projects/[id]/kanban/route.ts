import { NextResponse } from "next/server";
import { createTask, listTasks } from "@/lib/kanban";
import { projectExists } from "@/lib/projects";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!(await projectExists(id))) {
    return NextResponse.json({ error: "project not found" }, { status: 404 });
  }
  const tasks = await listTasks(id);
  return NextResponse.json({ tasks });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!(await projectExists(id))) {
    return NextResponse.json({ error: "project not found" }, { status: 404 });
  }
  const body = await req.json().catch(() => ({}));
  if (!body.title || typeof body.title !== "string" || !body.title.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  const task = await createTask(id, {
    title: body.title,
    description: body.description,
    status: body.status,
    dueDate: typeof body.dueDate === "string" && body.dueDate ? body.dueDate : undefined,
  });
  return NextResponse.json({ task }, { status: 201 });
}
