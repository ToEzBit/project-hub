import { NextResponse } from "next/server";
import { createNote, listCategories, listNotes } from "@/lib/notes";
import { projectExists } from "@/lib/projects";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!(await projectExists(id))) {
    return NextResponse.json({ error: "project not found" }, { status: 404 });
  }
  const notes = await listNotes(id);
  const categories = await listCategories(id);
  return NextResponse.json({ notes, categories });
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
  if (!body.category || typeof body.category !== "string" || !body.category.trim()) {
    return NextResponse.json({ error: "category is required" }, { status: 400 });
  }
  const note = await createNote(id, {
    title: body.title,
    category: body.category,
    body: body.body,
  });
  return NextResponse.json({ note }, { status: 201 });
}
