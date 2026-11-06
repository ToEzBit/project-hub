# Project Hub — Rework Spec (Round 3)

User feedback round 3, plus an explicit grant of creative freedom: "ถ้านายเห็นว่ามี feature อะไรแล้วมีประโยชน์ใส่มาเลย ไปจัด layout ใหม่ด้วยก็ดี พื้นที่แม้งเหลือเต็มเลย" — add any genuinely useful features on your own judgment, and REDESIGN THE LAYOUT because lots of horizontal space is wasted. The user wants to be impressed this round. Quality over speed.

## Required fixes (user feedback, all 5 mandatory)

### 1. "เพิ่มวันที่ใน task หน่อย" — dates on tasks
- Show created date on each task card (compact, relative: "2d ago" or short date).
- Add optional **due date** field: settable in the task edit modal (date input) and shown on the card as a small badge. Overdue (due < today, not done) = red badge; due today = amber. Done tasks never flagged overdue.
- Storage: add optional `dueDate?: string` (ISO date) to Task in kanban.json. Additive only — existing files must keep working.

### 2. "ตอนลาก task วาง กล่อง task มันขยายชั่วคราวแล้วกลับมาเท่าเดิม" — DnD drop visual glitch
- Bug: when dropping a task, the card/column box visibly expands for a moment then snaps back. This is a known @hello-pangea/dnd styling issue — usually caused by margin on draggable items (use gap on a wrapper or padding instead of margin between cards), or by the placeholder transitioning, or combined transitions on the card interfering with the library's inline transform/transition styles.
- Fix it properly: no size jump on drag start, during drag, or on drop — in BOTH kanban and every other DnD list. Verify by taking screenshots mid-drag and immediately after drop in Playwright and inspecting them; also eyeball the drop animation frames.

### 3. "ไม่ใช่ alert ดิ... ใช้ alert modal ดีๆหน่อย"
- ZERO native `alert()` / `confirm()` / `prompt()` anywhere. Final check: `grep -rn "alert(\|confirm(\|prompt(" app components lib` must return nothing (except maybe code comments).
- Build a reusable `ConfirmDialog` (danger variant for deletes: entity name shown, Cancel/Delete buttons, Escape/overlay closes) and use toasts for success/info feedback.
- Deleting a PROJECT must also confirm (it currently may use confirm() or nothing — check).

### 4. "ทุกอย่างต้อง reorder ได้ — note กับ category ด้วย และ vault ด้วย"
- DnD reorder for: notes within a category, note CATEGORIES themselves, and vault entries. Same library (@hello-pangea/dnd), same persistence pattern.
- Storage (additive, keep agent-readable):
  - Note order: add `order: N` line to the note's frontmatter.
  - Category order + label: new file `data/projects/<slug>/notes/categories.json` → `{ "<cat-slug>": { "label": "...", "order": 0 }, ... }`. Lazy-migrate: when missing, build from existing dirs in current order and persist on first reorder.
  - Vault: `order` field per entry in vault.json.
- New API endpoints as needed (reorder endpoints accepting ordered id arrays, consistent with the existing /reorder pattern).

### 5. Vault improvements
- Delete MUST show the ConfirmDialog (currently deletes instantly — user called this out).
- REMOVE the `type` field from the UI entirely (form, list, edit modal). Keep reading old files that still contain `type` without breaking; just ignore it. "เอา type ออกเลยไม่มีประโยชน์".
- The `note` field: keep it, but display as a **tooltip on hover** over the entry row (user: "ทำเป็น tooltip ดิวะ ถ้ามี note อะ แสดง tooltip ตอนผม hover"). Small info icon or dotted underline on entries that have a note; clean custom tooltip (not title= attribute — style it to match the theme, with a small delay).

## Creative freedom (make it worthy — pick what's genuinely useful, implement well)

The user explicitly wants the layout redesigned to use the wasted space, and welcomes extra features. Strong candidates (choose judiciously, don't bloat):
- **Layout**: wider content area, better use of horizontal space. Consider a per-project header bar with stats (task counts by status, small progress bar), tighter sidebar.
- **Search / Ctrl+K** quick switcher across projects/tasks/notes.
- **Markdown preview** for notes (toggle write/preview, or side-by-side on wide screens) — notes are markdown but currently render as plain textarea only.
- **Task niceties**: quick "mark done" checkbox on card hover; description indicator icon; color label or priority dot.
- **Project stats** in sidebar (e.g. "5 tasks · 2 done").
- **Keyboard**: Esc closes modals (should already), Enter submits, maybe N for new task.
- **Column task counts + WIP coloring**, collapse done column, or "clear done" with confirm.
- Anything else you judge high-value/low-complexity. Do NOT add auth, sync, or anything network-external. Do NOT break the plain-file storage contract.

## Constraints (unchanged)
- Storage layout stays agent-readable plain files; all changes ADDITIVE with lazy migration. Never corrupt existing files.
- App: Next.js 16 / React 19 / TS / Tailwind v4 at /home/toezbit/project-hub, deployed via `sg docker -c "docker compose build"` + `up -d` → http://100.113.25.42:3001 (tailnet-only). ALWAYS wrap docker in `sg docker -c "..."`.
- Node at $HOME/.local/node/bin. Playwright Chromium at /home/toezbit/.cache/ms-playwright/chromium-1208/ (works, proven last round). No sudo available.
- Dark + light mode BOTH must stay polished (test both).

## Testing (MANDATORY — user: "ไปเทสให้ดีก่อนให้ผมเทส")
Playwright E2E against the live container at http://100.113.25.42:3001, same rigor as round 2 (which passed 10/10). Must cover:
1. All previous functionality still works (regression: create project, create/edit/drag task, notes CRUD, vault add/copy, dark toggle persist, project reorder persist).
2. NEW: task due date set via modal → badge appears; overdue styling logic correct (set a past date → red).
3. NEW: created-date visible on card.
4. DnD drop glitch: capture screenshots during and right after a drop; verify no layout jump (compare column/card bounding boxes before drag vs after drop — heights must match; assert programmatically via boundingBox()).
5. NEW: reorder notes within category → persists (reload + frontmatter check on disk). Reorder categories → persists (categories.json check). Reorder vault entries → persists (vault.json check).
6. Vault delete shows ConfirmDialog (assert dialog visible, cancel keeps entry, confirm removes it). No type field anywhere in vault UI. Tooltip appears on hover of an entry with a note.
7. grep check: no alert(/confirm(/prompt( in shipped code.
8. Zero console errors through the whole flow.
9. Screenshot both themes at the end (desktop 1440px wide) and visually inspect for layout quality — the user judges by eye.
Clean up ALL test data (data/projects empty) and test artifacts afterwards. Verify container Up + HTTP 200 at the very end.

## Report
Per-feature results table (pass/fail per test above), what you added under creative freedom and why, files changed, any limitations.
