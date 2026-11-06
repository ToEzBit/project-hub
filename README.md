# Project Hub

A minimal personal project & task tracker, built to the same deployment
pattern as `mission-control` on this box, but without any of mission-control's
host-monitoring access (no systemd, no /proc, no NVIDIA runtime) because it
doesn't need it.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS v4
- Data: a single JSON file (`data/db.json`), persisted via a Docker bind
  mount — intentionally no database container for a single-user tool
- Runtime container: `node:24.19.0-slim` (not Ubuntu — this app never shells
  out to host tooling, unlike mission-control)

## Features

- Create / delete projects (name, description, colour tag)
- Per-project Kanban board: To do / Doing / Done
- Create / move / delete tasks
- All state survives container rebuilds (bind-mounted `data/` directory)

## Running

```bash
cd ~/project-hub
docker compose up -d --build   # first run / after code changes
./restart.sh                   # rebuild + recreate, verifies it came back up
```

Reachable at `http://100.113.25.42:3001/` from any device on the tailnet.
Never exposed on 0.0.0.0 — the compose port mapping binds the tailnet IP only.

## Data

`data/db.json` is the entire database: `{ projects: [...], tasks: [...] }`.
Back it up by copying that one file. Deleting it (or the `data/` dir) resets
the app to empty on next start — `lib/store.ts` recreates the file.

## Layout

```
app/
  page.tsx                 client UI: project sidebar + Kanban board
  api/projects/route.ts    GET list / POST create
  api/projects/[id]/...    GET/PATCH/DELETE one project, GET its tasks
  api/tasks/route.ts       GET (optionally ?projectId=) / POST create
  api/tasks/[id]/route.ts  PATCH/DELETE one task
components/                UI pieces (ProjectList, NewProjectForm, Board)
lib/store.ts                JSON-file store with a write queue to serialise mutations
lib/types.ts                Project/Task types
```
