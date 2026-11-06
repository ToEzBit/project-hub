import { promises as fs } from "fs";
import path from "path";
import type { Project } from "./types";
import { PROJECTS_DIR, newId, pathExists, readJson, slugify, uniqueSlug, withFileLock, writeJson } from "./fsutil";

interface Meta {
  id: string;
  name: string;
  description: string;
  color: string;
  order?: number;
  createdAt: string;
  updatedAt: string;
}

function metaPath(slug: string): string {
  return path.join(PROJECTS_DIR, slug, "meta.json");
}

// List all projects sorted by `order`. Projects written before the order
// field existed get one assigned (by createdAt) and persisted lazily, so
// hand-made meta.json files from an external agent keep working.
export async function listProjects(): Promise<Project[]> {
  await fs.mkdir(PROJECTS_DIR, { recursive: true });
  const entries = await fs.readdir(PROJECTS_DIR, { withFileTypes: true });
  const metas: Meta[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const meta = await readJson<Meta | null>(metaPath(entry.name), null);
    if (meta) metas.push(meta);
  }
  metas.sort((a, b) => {
    const ao = a.order ?? Number.MAX_SAFE_INTEGER;
    const bo = b.order ?? Number.MAX_SAFE_INTEGER;
    if (ao !== bo) return ao - bo;
    return a.createdAt.localeCompare(b.createdAt);
  });
  const projects: Project[] = [];
  for (let i = 0; i < metas.length; i++) {
    const meta = metas[i];
    if (meta.order === undefined) {
      // Migrate lazily: persist the computed order once.
      await withFileLock(metaPath(meta.id), async () => {
        const cur = await readJson<Meta | null>(metaPath(meta.id), null);
        if (cur && cur.order === undefined) {
          cur.order = i;
          await writeJson(metaPath(meta.id), cur);
        }
      });
      meta.order = i;
    }
    projects.push(meta as Project);
  }
  return projects;
}

export async function getProject(id: string): Promise<Project | undefined> {
  const meta = await readJson<Meta | null>(metaPath(id), null);
  if (!meta) return undefined;
  return { ...meta, order: meta.order ?? 0 };
}

export async function projectExists(id: string): Promise<boolean> {
  return pathExists(metaPath(id));
}

export async function createProject(input: {
  name: string;
  description?: string;
  color?: string;
}): Promise<Project> {
  await fs.mkdir(PROJECTS_DIR, { recursive: true });
  const existingDirs = (await fs.readdir(PROJECTS_DIR, { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
  const existing = new Set(existingDirs);
  const slug = uniqueSlug(slugify(input.name), existing);
  // New projects go to the end of the list.
  let maxOrder = -1;
  for (const dir of existingDirs) {
    const meta = await readJson<Meta | null>(metaPath(dir), null);
    if (meta) maxOrder = Math.max(maxOrder, meta.order ?? existingDirs.length - 1);
  }
  const now = new Date().toISOString();
  const project: Project = {
    id: slug,
    name: input.name.trim(),
    description: (input.description ?? "").trim(),
    color: input.color || "#6366f1",
    order: maxOrder + 1,
    createdAt: now,
    updatedAt: now,
  };
  await fs.mkdir(path.join(PROJECTS_DIR, slug, "notes"), { recursive: true });
  await writeJson(metaPath(slug), project);
  return project;
}

export async function updateProject(
  id: string,
  patch: Partial<Pick<Project, "name" | "description" | "color" | "order">>,
): Promise<Project | undefined> {
  return withFileLock(metaPath(id), async () => {
    const meta = await readJson<Meta | null>(metaPath(id), null);
    if (!meta) return undefined;
    if (patch.name !== undefined) meta.name = patch.name.trim();
    if (patch.description !== undefined) meta.description = patch.description.trim();
    if (patch.color !== undefined) meta.color = patch.color;
    if (patch.order !== undefined) meta.order = patch.order;
    meta.updatedAt = new Date().toISOString();
    await writeJson(metaPath(id), meta);
    return { ...meta, order: meta.order ?? 0 };
  });
}

// Reorder all projects at once: `ids` is the full new order; each project's
// `order` becomes its index in the array. Unknown ids are skipped.
export async function reorderProjects(ids: string[]): Promise<Project[]> {
  for (let i = 0; i < ids.length; i++) {
    const p = metaPath(ids[i]);
    if (!(await pathExists(p))) continue;
    await withFileLock(p, async () => {
      const meta = await readJson<Meta | null>(p, null);
      if (!meta) return;
      meta.order = i;
      meta.updatedAt = new Date().toISOString();
      await writeJson(p, meta);
    });
  }
  return listProjects();
}

export async function deleteProject(id: string): Promise<boolean> {
  const dir = path.join(PROJECTS_DIR, id);
  if (!(await pathExists(dir))) return false;
  await fs.rm(dir, { recursive: true, force: true });
  return true;
}

export { newId };
