// Small date helpers shared by task cards / badges. Pure functions, safe on
// both server and client.

const DAY = 24 * 60 * 60 * 1000;

/** Compact relative time: "just now", "5m", "3h", "2d", "5w", or "Mar 3". */
export function formatRelative(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  if (isNaN(then.getTime())) return "";
  const diff = now.getTime() - then.getTime();
  if (diff < 60_000) return "just now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(diff / DAY);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return then.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(then.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
}

/** Local YYYY-MM-DD for "today" comparisons (due dates are plain dates). */
export function todayISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export type DueState = "overdue" | "today" | "upcoming";

/** Classify a due date; done tasks are never overdue (handled by caller). */
export function dueState(dueDate: string, now: Date = new Date()): DueState {
  const today = todayISO(now);
  if (dueDate < today) return "overdue";
  if (dueDate === today) return "today";
  return "upcoming";
}

/** Human label for a YYYY-MM-DD due date: "Today", "Tomorrow", "Mar 3". */
export function formatDue(dueDate: string, now: Date = new Date()): string {
  const today = todayISO(now);
  if (dueDate === today) return "Today";
  const d = new Date(dueDate + "T00:00:00");
  if (isNaN(d.getTime())) return dueDate;
  const tomorrow = todayISO(new Date(now.getTime() + DAY));
  const yesterday = todayISO(new Date(now.getTime() - DAY));
  if (dueDate === tomorrow) return "Tomorrow";
  if (dueDate === yesterday) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
}
