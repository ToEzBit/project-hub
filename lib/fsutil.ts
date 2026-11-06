// Shared filesystem helpers for the per-project JSON/Markdown store.
//
// Layout on disk (DATA_DIR, bind-mounted from the host via compose.yaml):
//   projects/<slug>/meta.json        — project name/description/color
//   projects/<slug>/kanban.json      — { tasks: Task[] }
//   projects/<slug>/vault.json       — { entries: VaultEntry[] }
//   projects/<slug>/notes/<category>/<note-slug>.md  — frontmatter + body
//
// Everything is plain JSON/Markdown on purpose: the host operator (or an
// agent with filesystem access) can read or hand-edit any file directly
// without going through this app's API.
import { promises as fs } from "fs";
import path from "path";

export const DATA_DIR = process.env.PH_DATA_DIR || path.join(process.cwd(), "data");
export const PROJECTS_DIR = path.join(DATA_DIR, "projects");

export function slugify(input: string): string {
  const base = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0E00-\u0E7F]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "untitled";
}

// Appends a short random suffix if `slug` already exists among `existing`,
// so two projects/notes with the same name don't collide on disk.
export function uniqueSlug(slug: string, existing: Set<string>): string {
  if (!existing.has(slug)) return slug;
  let i = 2;
  while (existing.has(`${slug}-${i}`)) i++;
  return `${slug}-${i}`;
}

export async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

// Write-then-rename so a crash mid-write never leaves a truncated file for
// either this app or a human/agent editing alongside it to read.
export async function writeFileAtomic(filePath: string, contents: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tmp, contents, "utf-8");
  await fs.rename(tmp, filePath);
}

export async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function writeJson(filePath: string, data: unknown): Promise<void> {
  await writeFileAtomic(filePath, JSON.stringify(data, null, 2) + "\n");
}

export function newId(): string {
  return crypto.randomUUID();
}

// Per-file write queues keyed by path, so concurrent requests touching the
// *same* JSON file serialize (no lost updates from an interleaved
// read-modify-write), while requests against different projects/files never
// block each other.
const queues = new Map<string, Promise<unknown>>();

export function withFileLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prior = queues.get(key) ?? Promise.resolve();
  const run = prior.then(fn, fn);
  queues.set(
    key,
    run.catch(() => undefined),
  );
  return run;
}
