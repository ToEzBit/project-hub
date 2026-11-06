import { NextResponse } from "next/server";
import { listCategories } from "@/lib/notes";
import { projectExists } from "@/lib/projects";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!(await projectExists(id))) {
    return NextResponse.json({ error: "project not found" }, { status: 404 });
  }
  const categories = await listCategories(id);
  return NextResponse.json({ categories });
}
