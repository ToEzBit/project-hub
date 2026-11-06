import path from "path";
import type { KanbanFile, Task, TaskStatus } from "./types";
import { PROJECTS_DIR, newId, readJson, withFileLock, writeJson } from "./fsutil";

function kanbanPath(projectId: string): string {
  return path.join(PROJECTS_DIR, projectId, "kanban.json");
}

async function readKanban(projectId: string): Promise<KanbanFile> {
  return readJson<KanbanFile>(kanbanPath(projectId), { tasks: [] });
}

export async function listTasks(projectId: string): Promise<Task[]> {
  const kanban = await readKanban(projectId);
  return kanban.tasks.sort((a, b) => a.order - b.order);
}

export async function createTask(
  projectId: string,
  input: { title: string; description?: string; status?: TaskStatus; dueDate?: string },
): Promise<Task> {
  return withFileLock(kanbanPath(projectId), async () => {
    const kanban = await readKanban(projectId);
    const status = input.status ?? "todo";
    const maxOrder = kanban.tasks
      .filter((t) => t.status === status)
      .reduce((max, t) => Math.max(max, t.order), -1);
    const now = new Date().toISOString();
    const task: Task = {
      id: newId(),
      title: input.title.trim(),
      description: (input.description ?? "").trim(),
      status,
      order: maxOrder + 1,
      createdAt: now,
      updatedAt: now,
      ...(input.dueDate ? { dueDate: input.dueDate } : {}),
    };
    kanban.tasks.push(task);
    await writeJson(kanbanPath(projectId), kanban);
    return task;
  });
}

export async function updateTask(
  projectId: string,
  taskId: string,
  patch: Partial<Pick<Task, "title" | "description" | "status" | "order" | "dueDate" | "archivedAt">>,
): Promise<Task | undefined> {
  return withFileLock(kanbanPath(projectId), async () => {
    const kanban = await readKanban(projectId);
    const task = kanban.tasks.find((t) => t.id === taskId);
    if (!task) return undefined;
    if (patch.title !== undefined) task.title = patch.title.trim();
    if (patch.description !== undefined) task.description = patch.description.trim();
    if (patch.status !== undefined) task.status = patch.status;
    if (patch.order !== undefined) task.order = patch.order;
    // Empty string / null clears the due date; a value sets it.
    if ("dueDate" in patch) {
      if (patch.dueDate) task.dueDate = patch.dueDate;
      else delete task.dueDate;
    }
    // Same pattern: truthy sets archived, empty/null restores the task.
    if ("archivedAt" in patch) {
      if (patch.archivedAt) task.archivedAt = patch.archivedAt;
      else delete task.archivedAt;
    }
    task.updatedAt = new Date().toISOString();
    await writeJson(kanbanPath(projectId), kanban);
    return task;
  });
}

// Apply a full board layout in one write: `columns` maps each status to the
// ordered list of task ids now in that column. Every listed task gets its
// status + order (index) updated; tasks not mentioned keep their fields.
export async function reorderTasks(
  projectId: string,
  columns: Partial<Record<TaskStatus, string[]>>,
): Promise<Task[]> {
  return withFileLock(kanbanPath(projectId), async () => {
    const kanban = await readKanban(projectId);
    const byId = new Map(kanban.tasks.map((t) => [t.id, t]));
    const now = new Date().toISOString();
    for (const status of ["todo", "doing", "done"] as TaskStatus[]) {
      const ids = columns[status];
      if (!ids) continue;
      ids.forEach((id, index) => {
        const task = byId.get(id);
        if (!task) return;
        if (task.status !== status || task.order !== index) {
          task.status = status;
          task.order = index;
          task.updatedAt = now;
        }
      });
    }
    await writeJson(kanbanPath(projectId), kanban);
    return kanban.tasks.sort((a, b) => a.order - b.order);
  });
}

export async function deleteTask(projectId: string, taskId: string): Promise<boolean> {
  return withFileLock(kanbanPath(projectId), async () => {
    const kanban = await readKanban(projectId);
    const before = kanban.tasks.length;
    kanban.tasks = kanban.tasks.filter((t) => t.id !== taskId);
    await writeJson(kanbanPath(projectId), kanban);
    return kanban.tasks.length < before;
  });
}
