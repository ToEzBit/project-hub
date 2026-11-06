import { NextResponse } from "next/server";
import { reorderVaultEntries } from "@/lib/vault";
import { projectExists } from "@/lib/projects";

// POST { ids: string[] } — full new ordering of vault entries.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!(await projectExists(id))) {
    return NextResponse.json({ error: "project not found" }, { status: 404 });
  }
  const body = await req.json().catch(() => ({}));
  if (!Array.isArray(body.ids) || body.ids.some((x: unknown) => typeof x !== "string")) {
    return NextResponse.json({ error: "ids must be an array of strings" }, { status: 400 });
  }
  const entries = await reorderVaultEntries(id, body.ids);
  return NextResponse.json({ entries });
}
