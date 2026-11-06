import { NextResponse } from "next/server";
import { reorderCategories } from "@/lib/notes";
import { projectExists } from "@/lib/projects";

// POST { slugs: string[] } — full new ordering of note categories; also the
// lazy-migration point that materialises notes/categories.json.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!(await projectExists(id))) {
    return NextResponse.json({ error: "project not found" }, { status: 404 });
  }
  const body = await req.json().catch(() => ({}));
  if (!Array.isArray(body.slugs) || body.slugs.some((x: unknown) => typeof x !== "string")) {
    return NextResponse.json({ error: "slugs must be an array of strings" }, { status: 400 });
  }
  const categories = await reorderCategories(id, body.slugs);
  return NextResponse.json({ categories });
}
