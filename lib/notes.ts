// Markdown notes, one file per note, grouped into category sub-folders:
//   projects/<project>/notes/<category-slug>/<note-slug>.md
//
// A note's public id is "<category-slug>/<note-slug>" (used as-is in API
// paths via a catch-all route). Metadata lives in a tiny hand-rolled
// frontmatter block — the field set is fixed and string-only, so a full
// YAML parser would be overkill and this stays trivial to read/edit by
// hand in a text editor.
//
// Ordering (all additive, lazily migrated):
//   - note order:     `order: N` line in each note's frontmatter
//   - category order: notes/categories.json → { "<slug>": { label, order } }
// Files without these fields keep working: categories fall back to directory
// order, notes fall back to updatedAt (the old behaviour).
import { promises as fs } from "fs";
import path from "path";
import type { Note, NoteCategory } from "./types";
import { PROJECTS_DIR, pathExists, readJson, slugify, uniqueSlug, withFileLock, writeJson } from "./fsutil";

function notesDir(projectId: string): string {
  return path.join(PROJECTS_DIR, projectId, "notes");
}

function notePath(projectId: string, category: string, slug: string): string {
  return path.join(notesDir(projectId), category, `${slug}.md`);
}

function categoriesPath(projectId: string): string {
  return path.join(notesDir(projectId), "categories.json");
}

type CategoriesFile = Record<string, { label: string; order: number }>;

function escapeFrontmatterValue(v: string): string {
  return v.replace(/\r?\n/g, " ").trim();
}

function serialize(note: Omit<Note, "id">): string {
  const lines = [
    "---",
    `title: ${escapeFrontmatterValue(note.title)}`,
    `category: ${escapeFrontmatterValue(note.category)}`,
    `categoryLabel: ${escapeFrontmatterValue(note.categoryLabel)}`,
    `order: ${note.order}`,
    `createdAt: ${note.createdAt}`,
    `updatedAt: ${note.updatedAt}`,
    "---",
    "",
  ];
  return lines.join("\n") + note.body;
}

function parse(raw: string, category: string, slug: string): Note | null {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return null;
  const [, fm, body] = match;
  const fields: Record<string, string> = {};
  for (const line of fm.split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    fields[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  const parsedOrder = Number.parseInt(fields.order ?? "", 10);
  return {
    id: `${category}/${slug}`,
    category,
    categoryLabel: fields.categoryLabel || category,
    title: fields.title || slug,
    body: body.replace(/^\n/, ""),
    order: Number.isFinite(parsedOrder) ? parsedOrder : Number.MAX_SAFE_INTEGER,
    createdAt: fields.createdAt || new Date(0).toISOString(),
    updatedAt: fields.updatedAt || new Date(0).toISOString(),
  };
}

async function readCategoriesFile(projectId: string): Promise<CategoriesFile> {
  return readJson<CategoriesFile>(categoriesPath(projectId), {});
}

async function listCategoryDirs(projectId: string): Promise<string[]> {
  const dir = notesDir(projectId);
  if (!(await pathExists(dir))) return [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

// Merged category view: categories.json order/labels where present, with any
// directories missing from the file appended in directory order (so files
// created by hand or by older versions keep showing up).
export async function listCategories(projectId: string): Promise<NoteCategory[]> {
  const file = await readCategoriesFile(projectId);
  const dirs = await listCategoryDirs(projectId);
  const known = dirs.filter((d) => file[d]);
  const unknown = dirs.filter((d) => !file[d]);
  known.sort((a, b) => file[a].order - file[b].order);
  const result: NoteCategory[] = known.map((slug, i) => ({
    slug,
    label: file[slug].label || slug,
    order: i,
  }));
  for (const slug of unknown) {
    result.push({ slug, label: slug, order: result.length });
  }
  return result;
}

export async function listNotes(projectId: string): Promise<Note[]> {
  const dir = notesDir(projectId);
  if (!(await pathExists(dir))) return [];
  const categories = await listCategories(projectId);
  const catOrder = new Map(categories.map((c, i) => [c.slug, i]));
  const notes: Note[] = [];
  for (const cat of categories) {
    const catDir = path.join(dir, cat.slug);
    const files = await fs.readdir(catDir, { withFileTypes: true });
    for (const file of files) {
      if (!file.isFile() || !file.name.endsWith(".md")) continue;
      const slug = file.name.slice(0, -3);
      const raw = await fs.readFile(path.join(catDir, file.name), "utf-8");
      const note = parse(raw, cat.slug, slug);
      if (note) notes.push(note);
    }
  }
  return notes.sort((a, b) => {
    const ac = catOrder.get(a.category) ?? 0;
    const bc = catOrder.get(b.category) ?? 0;
    if (ac !== bc) return ac - bc;
    if (a.order !== b.order) return a.order - b.order;
    return b.updatedAt.localeCompare(a.updatedAt); // legacy fallback
  });
}

export async function getNote(projectId: string, category: string, slug: string): Promise<Note | undefined> {
  const p = notePath(projectId, category, slug);
  if (!(await pathExists(p))) return undefined;
  const raw = await fs.readFile(p, "utf-8");
  return parse(raw, category, slug) ?? undefined;
}

export async function createNote(
  projectId: string,
  input: { title: string; category: string; body?: string },
): Promise<Note> {
  const categorySlug = slugify(input.category);
  const catDir = path.join(notesDir(projectId), categorySlug);
  await fs.mkdir(catDir, { recursive: true });
  const existingFiles = await fs.readdir(catDir, { withFileTypes: true }).catch(() => []);
  const existing = new Set(
    existingFiles.filter((e) => e.isFile()).map((e) => e.name.replace(/\.md$/, "")),
  );
  const slug = uniqueSlug(slugify(input.title), existing);
  const now = new Date().toISOString();
  const note: Note = {
    id: `${categorySlug}/${slug}`,
    category: categorySlug,
    categoryLabel: input.category.trim() || categorySlug,
    title: input.title.trim() || "Untitled",
    body: (input.body ?? "").trim(),
    order: existing.size, // append at the end of its category
    createdAt: now,
    updatedAt: now,
  };
  await fs.writeFile(notePath(projectId, categorySlug, slug), serialize(note), "utf-8");
  // Register the category label in categories.json if the file already exists
  // (if it doesn't, we stay lazy — it's built on first category reorder).
  if (await pathExists(categoriesPath(projectId))) {
    await withFileLock(categoriesPath(projectId), async () => {
      const file = await readCategoriesFile(projectId);
      if (!file[categorySlug]) {
        const maxOrder = Object.values(file).reduce((m, c) => Math.max(m, c.order), -1);
        file[categorySlug] = { label: note.categoryLabel, order: maxOrder + 1 };
        await writeJson(categoriesPath(projectId), file);
      }
    });
  }
  return note;
}

export async function updateNote(
  projectId: string,
  category: string,
  slug: string,
  patch: Partial<Pick<Note, "title" | "body" | "categoryLabel" | "order">>,
): Promise<Note | undefined> {
  const p = notePath(projectId, category, slug);
  return withFileLock(p, async () => {
    const existing = await getNote(projectId, category, slug);
    if (!existing) return undefined;
    if (patch.title !== undefined) existing.title = patch.title.trim() || existing.title;
    if (patch.body !== undefined) existing.body = patch.body;
    if (patch.categoryLabel !== undefined) existing.categoryLabel = patch.categoryLabel.trim() || existing.categoryLabel;
    if (patch.order !== undefined) existing.order = patch.order;
    existing.updatedAt = new Date().toISOString();
    await fs.writeFile(p, serialize(existing), "utf-8");
    return existing;
  });
}

// Persist a new order for the notes of one category. `ids` are full note ids
// ("<category>/<slug>") or bare slugs, in the desired order. Lazy migration:
// every reordered note gets an explicit `order` in its frontmatter.
export async function reorderNotes(
  projectId: string,
  category: string,
  ids: string[],
): Promise<boolean> {
  for (let i = 0; i < ids.length; i++) {
    const slug = ids[i].includes("/") ? ids[i].split("/").pop()! : ids[i];
    await updateNote(projectId, category, slug, { order: i });
  }
  return true;
}

// Persist a new category order to categories.json. Lazy migration: when the
// file is missing it is built here from the current (directory-order) list,
// preserving each category's current label.
export async function reorderCategories(
  projectId: string,
  slugs: string[],
): Promise<NoteCategory[]> {
  await fs.mkdir(notesDir(projectId), { recursive: true });
  return withFileLock(categoriesPath(projectId), async () => {
    const current = await listCategories(projectId);
    const labels = new Map(current.map((c) => [c.slug, c.label]));
    // Labels may also live in note frontmatter (categoryLabel); prefer the
    // nicer label if categories.json has never stored one.
    const notes = await listNotes(projectId);
    for (const n of notes) {
      if (labels.get(n.category) === n.category && n.categoryLabel !== n.category) {
        labels.set(n.category, n.categoryLabel);
      }
    }
    const file: CategoriesFile = {};
    slugs.forEach((slug, i) => {
      file[slug] = { label: labels.get(slug) ?? slug, order: i };
    });
    // Keep any categories not mentioned (appended after).
    let next = slugs.length;
    for (const c of current) {
      if (!file[c.slug]) file[c.slug] = { label: c.label, order: next++ };
    }
    await writeJson(categoriesPath(projectId), file);
    return listCategories(projectId);
  });
}

export async function deleteNote(projectId: string, category: string, slug: string): Promise<boolean> {
  const p = notePath(projectId, category, slug);
  if (!(await pathExists(p))) return false;
  await fs.rm(p, { force: true });
  // Clean up the category directory if it's now empty, so the notes/ tree
  // doesn't accumulate stale empty folders.
  const catDir = path.join(notesDir(projectId), category);
  const remaining = await fs.readdir(catDir).catch(() => []);
  if (remaining.length === 0) {
    await fs.rmdir(catDir).catch(() => undefined);
    // Drop it from categories.json too, if that file exists.
    if (await pathExists(categoriesPath(projectId))) {
      await withFileLock(categoriesPath(projectId), async () => {
        const file = await readCategoriesFile(projectId);
        if (file[category]) {
          delete file[category];
          await writeJson(categoriesPath(projectId), file);
        }
      });
    }
  }
  return true;
}
