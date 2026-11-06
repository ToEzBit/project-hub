"use client";

import { useState } from "react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import type { Project } from "@/lib/types";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { GripVertical, Trash2 } from "lucide-react";

export function ProjectList({
  projects,
  selectedId,
  onSelect,
  onDelete,
  onReorder,
}: {
  projects: Project[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onReorder: (ids: string[]) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState<Project | null>(null);

  function handleDragEnd(result: DropResult) {
    if (!result.destination) return;
    const from = result.source.index;
    const to = result.destination.index;
    if (from === to) return;
    const ids = projects.map((p) => p.id);
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved);
    onReorder(ids);
  }

  if (projects.length === 0) {
    return (
      <p className="px-1 text-sm text-ink-muted">
        No projects yet — create one below.
      </p>
    );
  }

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="projects">
          {(provided) => (
            <ul
              ref={provided.innerRef}
              {...provided.droppableProps}
              data-testid="project-list"
            >
              {projects.map((p, index) => (
                <Draggable key={p.id} draggableId={p.id} index={index}>
                  {(drag, snapshot) => (
                    <li
                      ref={drag.innerRef}
                      {...drag.draggableProps}
                      data-testid={`project-item-${p.id}`}
                      className="pb-0.5"
                    >
                      <div
                        className={`group flex items-center gap-1 rounded-lg ${
                          snapshot.isDragging
                            ? "bg-surface-raised pop-shadow"
                            : selectedId === p.id
                              ? "bg-accent-soft"
                              : "hover:bg-surface-sunken"
                        }`}
                      >
                        <span
                          {...drag.dragHandleProps}
                          data-testid={`project-handle-${p.id}`}
                          aria-label={`Drag to reorder ${p.name}`}
                          className="cursor-grab px-1 py-2 text-ink-muted opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
                        >
                          <GripVertical size={14} />
                        </span>
                        <button
                          onClick={() => onSelect(p.id)}
                          className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pr-1 text-left text-sm"
                        >
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ background: p.color }}
                          />
                          <span className="min-w-0">
                            <span
                              className={`block truncate ${
                                selectedId === p.id
                                  ? "font-medium text-ink"
                                  : "text-ink-secondary group-hover:text-ink"
                              }`}
                            >
                              {p.name}
                            </span>
                            {p.stats && p.stats.total > 0 && (
                              <span
                                data-testid={`project-stats-${p.id}`}
                                className="block truncate text-[10px] leading-tight text-ink-muted"
                              >
                                {p.stats.total} task{p.stats.total === 1 ? "" : "s"} ·{" "}
                                {p.stats.done} done
                              </span>
                            )}
                          </span>
                        </button>
                        <button
                          onClick={() => setConfirmDelete(p)}
                          title="Delete project"
                          data-testid={`project-delete-${p.id}`}
                          aria-label={`Delete ${p.name}`}
                          className="mr-1.5 rounded-md p-1 text-ink-muted opacity-0 transition-all hover:bg-danger-soft hover:text-danger group-hover:opacity-100"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </li>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </ul>
          )}
        </Droppable>
      </DragDropContext>

      {confirmDelete && (
        <ConfirmDialog
          title="Delete project"
          message="Permanently delete project (including all its tasks, notes and vault entries)"
          entityName={confirmDelete.name}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => {
            onDelete(confirmDelete.id);
            setConfirmDelete(null);
          }}
        />
      )}
    </>
  );
}
