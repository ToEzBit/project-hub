import { NextResponse } from "next/server";
import { reorderTasks } from "@/lib/kanban";
import { projectExists } from "@/lib/projects";

const STATUSES = ["todo", "doing", "done"] as const;

// POST { columns: { todo: string[], doing: string[], done: string[] } }
// Full board layout; each listed task gets status + order from its position.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!(await projectExists(id))) {
    return NextResponse.json({ error: "project not found" }, { status: 404 });
  }
  const body = await req.json().catch(() => ({}));
  const columns = body.columns;
  if (
    !columns ||
    typeof columns !== "object" ||
    Object.keys(columns).some(
      (k) =>
        !STATUSES.includes(k as (typeof STATUSES)[number]) ||
        !Array.isArray(columns[k]) ||
        columns[k].some((x: unknown) => typeof x !== "string"),
    )
  ) {
    return NextResponse.json(
      { error: "columns must map todo/doing/done to arrays of task ids" },
      { status: 400 },
    );
  }
  const tasks = await reorderTasks(id, columns);
  return NextResponse.json({ tasks });
}
