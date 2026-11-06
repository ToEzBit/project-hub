import { NextResponse } from "next/server";
import { reorderProjects } from "@/lib/projects";

// POST { ids: string[] } — full new ordering of all projects.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (!Array.isArray(body.ids) || body.ids.some((x: unknown) => typeof x !== "string")) {
    return NextResponse.json({ error: "ids must be an array of strings" }, { status: 400 });
  }
  const projects = await reorderProjects(body.ids);
  return NextResponse.json({ projects });
}
