// Project document links, stored as plain JSON at
// projects/<slug>/links.json — same agent-readable contract as vault.json.
import path from "path";
import type { LinkEntry, LinksFile } from "./types";
import { PROJECTS_DIR, newId, readJson, withFileLock, writeJson } from "./fsutil";

function linksPath(projectId: string): string {
  return path.join(PROJECTS_DIR, projectId, "links.json");
}

async function readLinks(projectId: string): Promise<LinksFile> {
  return readJson<LinksFile>(linksPath(projectId), { links: [] });
}

function sortByOrder(links: LinkEntry[]): LinkEntry[] {
  // Entries without an order (hand-added files) keep file position after
  // the ordered ones, matching the vault's lazy-order behavior.
  return [...links].sort((a, b) => {
    const ao = a.order ?? Number.MAX_SAFE_INTEGER;
    const bo = b.order ?? Number.MAX_SAFE_INTEGER;
    return ao - bo;
  });
}

export async function listLinks(projectId: string): Promise<LinkEntry[]> {
  const file = await readLinks(projectId);
  return sortByOrder(file.links);
}

export function normalizeUrl(raw: string): string {
  const url = raw.trim();
  if (!url) return url;
  // Allow pasting bare domains ("docs.google.com/...") — default to https.
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)) return `https://${url}`;
  return url;
}

export async function createLink(
  projectId: string,
  input: { label: string; url: string; note?: string },
): Promise<LinkEntry> {
  return withFileLock(linksPath(projectId), async () => {
    const file = await readLinks(projectId);
    const maxOrder = file.links.reduce(
      (max, l) => Math.max(max, l.order ?? -1),
      -1,
    );
    const now = new Date().toISOString();
    const link: LinkEntry = {
      id: newId(),
      label: input.label.trim(),
      url: normalizeUrl(input.url),
      note: (input.note ?? "").trim(),
      order: maxOrder + 1,
      createdAt: now,
      updatedAt: now,
    };
    file.links.push(link);
    await writeJson(linksPath(projectId), file);
    return link;
  });
}

export async function updateLink(
  projectId: string,
  linkId: string,
  patch: Partial<Pick<LinkEntry, "label" | "url" | "note">>,
): Promise<LinkEntry | undefined> {
  return withFileLock(linksPath(projectId), async () => {
    const file = await readLinks(projectId);
    const link = file.links.find((l) => l.id === linkId);
    if (!link) return undefined;
    if (patch.label !== undefined) link.label = patch.label.trim();
    if (patch.url !== undefined) link.url = normalizeUrl(patch.url);
    if (patch.note !== undefined) link.note = patch.note.trim();
    link.updatedAt = new Date().toISOString();
    await writeJson(linksPath(projectId), file);
    return link;
  });
}

export async function deleteLink(projectId: string, linkId: string): Promise<boolean> {
  return withFileLock(linksPath(projectId), async () => {
    const file = await readLinks(projectId);
    const before = file.links.length;
    file.links = file.links.filter((l) => l.id !== linkId);
    await writeJson(linksPath(projectId), file);
    return file.links.length < before;
  });
}

export async function reorderLinks(
  projectId: string,
  ids: string[],
): Promise<LinkEntry[]> {
  return withFileLock(linksPath(projectId), async () => {
    const file = await readLinks(projectId);
    const now = new Date().toISOString();
    const byId = new Map(file.links.map((l) => [l.id, l]));
    ids.forEach((id, index) => {
      const link = byId.get(id);
      if (link && link.order !== index) {
        link.order = index;
        link.updatedAt = now;
      }
    });
    await writeJson(linksPath(projectId), file);
    return sortByOrder(file.links);
  });
}
