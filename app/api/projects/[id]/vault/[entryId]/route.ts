import { NextResponse } from "next/server";
import { deleteVaultEntry, updateVaultEntry } from "@/lib/vault";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; entryId: string }> },
) {
  const { id, entryId } = await params;
  const body = await req.json().catch(() => ({}));
  const entry = await updateVaultEntry(id, entryId, body);
  if (!entry) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ entry });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; entryId: string }> },
) {
  const { id, entryId } = await params;
  const ok = await deleteVaultEntry(id, entryId);
  if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
