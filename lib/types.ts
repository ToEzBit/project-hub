export type TaskStatus = "todo" | "doing" | "done";

export interface Project {
  id: string; // slug, also the directory name under data/projects/
  name: string;
  description: string;
  color: string;
  order: number;
  createdAt: string;
  updatedAt: string;
  // Computed server-side for the sidebar (not persisted in meta.json).
  stats?: { total: number; done: number; doing: number; todo: number };
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  order: number;
  createdAt: string;
  updatedAt: string;
  dueDate?: string; // ISO date (YYYY-MM-DD), optional — additive field
  archivedAt?: string; // ISO timestamp when archived; absent = active
}

export interface KanbanFile {
  tasks: Task[];
}

export interface Note {
  id: string; // filename slug, unique within its category
  category: string; // category slug
  categoryLabel: string;
  title: string;
  body: string; // markdown body (without frontmatter)
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface NoteCategory {
  slug: string;
  label: string;
  order: number;
}

// Legacy field kept so vault.json files written by older versions still
// parse; the UI no longer shows or sets it.
export type VaultType = string;

export interface VaultEntry {
  id: string;
  label: string;
  type?: VaultType;
  value: string;
  note: string;
  order?: number;
  createdAt: string;
  updatedAt: string;
}

export interface VaultFile {
  entries: VaultEntry[];
}

export interface LinkEntry {
  id: string;
  label: string;
  url: string;
  note: string;
  order?: number;
  createdAt: string;
  updatedAt: string;
}

export interface LinksFile {
  links: LinkEntry[];
}
