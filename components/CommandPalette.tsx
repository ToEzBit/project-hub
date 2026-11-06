"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Boxes, FileText, Search, SquareCheckBig } from "lucide-react";

export interface SearchHit {
  kind: "project" | "task" | "note";
  projectId: string;
  projectName: string;
  id: string;
  title: string;
  subtitle: string;
}

const KIND_ICON = {
  project: Boxes,
  task: SquareCheckBig,
  note: FileText,
} as const;

// Ctrl/Cmd+K quick switcher: live search across projects, tasks and notes.
// Arrow keys + Enter navigate; Escape / overlay click closes.
export function CommandPalette({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (hit: SearchHit) => void;
}) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [active, setActive] = useState(0);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const seq = useRef(0);

  useEffect(() => {
    if (open) {
      setQuery("");
      setHits([]);
      setActive(0);
      // focus after mount
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !query.trim()) {
      setHits([]);
      return;
    }
    const mySeq = ++seq.current;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
        const data = await res.json();
        if (seq.current === mySeq) {
          setHits(data.hits as SearchHit[]);
          setActive(0);
        }
      } finally {
        if (seq.current === mySeq) setSearching(false);
      }
    }, 120);
    return () => clearTimeout(t);
  }, [query, open]);

  const pick = useCallback(
    (hit: SearchHit) => {
      onPick(hit);
      onClose();
    },
    [onPick, onClose],
  );

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, hits.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && hits[active]) {
      e.preventDefault();
      pick(hits[active]);
    } else if (e.key === "Escape") {
      onClose();
    }
  }

  if (!open) return null;

  return (
    <div
      className="animate-fade-in fixed inset-0 z-[70] flex items-start justify-center bg-black/40 p-4 pt-[12vh] backdrop-blur-[2px]"
      data-testid="command-palette"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="animate-modal-in w-full max-w-lg overflow-hidden rounded-xl border border-hairline bg-surface-raised pop-shadow">
        <div className="flex items-center gap-2.5 border-b border-hairline px-4 py-3">
          <Search size={16} className="shrink-0 text-ink-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search projects, tasks, notes…"
            data-testid="palette-input"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-ink-muted"
          />
          <kbd className="rounded border border-hairline bg-surface-sunken px-1.5 py-0.5 text-[10px] font-medium text-ink-muted">
            esc
          </kbd>
        </div>
        <div className="max-h-80 overflow-y-auto p-1.5">
          {hits.map((hit, i) => {
            const Icon = KIND_ICON[hit.kind];
            return (
              <button
                key={`${hit.kind}-${hit.projectId}-${hit.id}`}
                onClick={() => pick(hit)}
                onMouseEnter={() => setActive(i)}
                data-testid={`palette-hit-${i}`}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                  i === active ? "bg-accent-soft text-ink" : "text-ink-secondary"
                }`}
              >
                <Icon size={15} className="shrink-0 text-ink-muted" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-ink">
                    {hit.title}
                  </span>
                  <span className="block truncate text-[11px] text-ink-muted">
                    {hit.projectName} · {hit.subtitle}
                  </span>
                </span>
                <span className="shrink-0 rounded-md border border-hairline bg-surface-sunken px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-muted">
                  {hit.kind}
                </span>
              </button>
            );
          })}
          {query.trim() && !searching && hits.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-ink-muted">
              No matches for “{query.trim()}”.
            </p>
          )}
          {!query.trim() && (
            <p className="px-3 py-6 text-center text-xs text-ink-muted">
              Type to search everything in your hub.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
