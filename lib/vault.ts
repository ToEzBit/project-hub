import path from "path";
import type { VaultEntry, VaultFile, VaultType } from "./types";
import { PROJECTS_DIR, newId, readJson, withFileLock, writeJson } from "./fsutil";

function vaultPath(projectId: string): string {
  return path.join(PROJECTS_DIR, projectId, "vault.json");
}

async function readVault(projectId: string): Promise<VaultFile> {
  return readJson<VaultFile>(vaultPath(projectId), { entries: [] });
}

// Entries sort by explicit `order` (additive field); files written before the
// field existed fall back to createdAt, which matches the old behaviour.
function sortEntries(entries: VaultEntry[]): VaultEntry[] {
  return entries.sort((a, b) => {
    const ao = a.order ?? Number.MAX_SAFE_INTEGER;
    const bo = b.order ?? Number.MAX_SAFE_INTEGER;
    if (ao !== bo) return ao - bo;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

export async function listVaultEntries(projectId: string): Promise<VaultEntry[]> {
  const vault = await readVault(projectId);
  return sortEntries(vault.entries);
}

export async function createVaultEntry(
  projectId: string,
  input: { label: string; type?: VaultType; value: string; note?: string },
): Promise<VaultEntry> {
  return withFileLock(vaultPath(projectId), async () => {
    const vault = await readVault(projectId);
    const now = new Date().toISOString();
    const maxOrder = vault.entries.reduce(
      (max, e) => Math.max(max, e.order ?? -1),
      vault.entries.length - 1,
    );
    const entry: VaultEntry = {
      id: newId(),
      label: input.label.trim(),
      // `type` is legacy — new entries no longer carry it, old files keep it.
      ...(input.type ? { type: input.type } : {}),
      value: input.value,
      note: (input.note ?? "").trim(),
      order: maxOrder + 1,
      createdAt: now,
      updatedAt: now,
    };
    vault.entries.push(entry);
    await writeJson(vaultPath(projectId), vault);
    return entry;
  });
}

export async function updateVaultEntry(
  projectId: string,
  entryId: string,
  patch: Partial<Pick<VaultEntry, "label" | "value" | "note">>,
): Promise<VaultEntry | undefined> {
  return withFileLock(vaultPath(projectId), async () => {
    const vault = await readVault(projectId);
    const entry = vault.entries.find((e) => e.id === entryId);
    if (!entry) return undefined;
    if (patch.label !== undefined) entry.label = patch.label.trim();
    if (patch.value !== undefined) entry.value = patch.value;
    if (patch.note !== undefined) entry.note = patch.note.trim();
    entry.updatedAt = new Date().toISOString();
    await writeJson(vaultPath(projectId), vault);
    return entry;
  });
}

// Lazy migration: on first reorder every entry gets an explicit `order`.
export async function reorderVaultEntries(
  projectId: string,
  ids: string[],
): Promise<VaultEntry[]> {
  return withFileLock(vaultPath(projectId), async () => {
    const vault = await readVault(projectId);
    const current = sortEntries(vault.entries);
    const pos = new Map(ids.map((id, i) => [id, i]));
    const now = new Date().toISOString();
    // Ids listed get their index; unmentioned entries keep relative order after.
    let nextFree = ids.length;
    for (const entry of current) {
      const p = pos.get(entry.id);
      const order = p !== undefined ? p : nextFree++;
      if (entry.order !== order) {
        entry.order = order;
        entry.updatedAt = now;
      }
    }
    await writeJson(vaultPath(projectId), vault);
    return sortEntries(vault.entries);
  });
}

export async function deleteVaultEntry(projectId: string, entryId: string): Promise<boolean> {
  return withFileLock(vaultPath(projectId), async () => {
    const vault = await readVault(projectId);
    const before = vault.entries.length;
    vault.entries = vault.entries.filter((e) => e.id !== entryId);
    await writeJson(vaultPath(projectId), vault);
    return vault.entries.length < before;
  });
}
