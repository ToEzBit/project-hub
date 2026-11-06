import { NextResponse } from "next/server";
import { deleteLink, updateLink } from "@/lib/links";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; linkId: string }> },
) {
  const { id, linkId } = await params;
  const body = await req.json().catch(() => ({}));
  const link = await updateLink(id, linkId, body);
  if (!link) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ link });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; linkId: string }> },
) {
  const { id, linkId } = await params;
  const ok = await deleteLink(id, linkId);
  if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
