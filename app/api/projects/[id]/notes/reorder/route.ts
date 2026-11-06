import { NextResponse } from "next/server";
import { reorderNotes } from "@/lib/notes";
import { projectExists } from "@/lib/projects";

// POST { category: string, ids: string[] } — new order of the notes in one
// category (ids may be full "cat/slug" ids or bare slugs).
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!(await projectExists(id))) {
    return NextResponse.json({ error: "project not found" }, { status: 404 });
  }
  const body = await req.json().catch(() => ({}));
  if (
    !body.category ||
    typeof body.category !== "string" ||
    !Array.isArray(body.ids) ||
    body.ids.some((x: unknown) => typeof x !== "string")
  ) {
    return NextResponse.json(
      { error: "category (string) and ids (string[]) are required" },
      { status: 400 },
    );
  }
  await reorderNotes(id, body.category, body.ids);
  return NextResponse.json({ ok: true });
}
