import { NextResponse } from "next/server";
import { createVaultEntry, listVaultEntries } from "@/lib/vault";
import { projectExists } from "@/lib/projects";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!(await projectExists(id))) {
    return NextResponse.json({ error: "project not found" }, { status: 404 });
  }
  const entries = await listVaultEntries(id);
  return NextResponse.json({ entries });
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
  if (!body.label || typeof body.label !== "string" || !body.label.trim()) {
    return NextResponse.json({ error: "label is required" }, { status: 400 });
  }
  if (typeof body.value !== "string" || !body.value) {
    return NextResponse.json({ error: "value is required" }, { status: 400 });
  }
  const entry = await createVaultEntry(id, {
    label: body.label,
    // `type` is legacy — only kept if a caller explicitly sends it.
    type: typeof body.type === "string" && body.type ? body.type : undefined,
    value: body.value,
    note: body.note,
  });
  return NextResponse.json({ entry }, { status: 201 });
}
