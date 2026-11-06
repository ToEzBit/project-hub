import { NextResponse } from "next/server";
import { deleteNote, getNote, updateNote } from "@/lib/notes";

// noteId arrives as a catch-all segment: ["<category-slug>", "<note-slug>"]
// because a note's public id is "category/slug".
function splitNoteId(noteId: string[]): [string, string] | null {
  if (noteId.length !== 2) return null;
  return [noteId[0], noteId[1]];
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; noteId: string[] }> },
) {
  const { id, noteId } = await params;
  const parts = splitNoteId(noteId);
  if (!parts) return NextResponse.json({ error: "invalid note id" }, { status: 400 });
  const note = await getNote(id, parts[0], parts[1]);
  if (!note) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ note });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; noteId: string[] }> },
) {
  const { id, noteId } = await params;
  const parts = splitNoteId(noteId);
  if (!parts) return NextResponse.json({ error: "invalid note id" }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const note = await updateNote(id, parts[0], parts[1], body);
  if (!note) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ note });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; noteId: string[] }> },
) {
  const { id, noteId } = await params;
  const parts = splitNoteId(noteId);
  if (!parts) return NextResponse.json({ error: "invalid note id" }, { status: 400 });
  const ok = await deleteNote(id, parts[0], parts[1]);
  if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
