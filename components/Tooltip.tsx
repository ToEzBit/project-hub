"use client";

import { useRef, useState } from "react";

// Minimal themed tooltip (no title= attribute): shows after a short delay on
// hover/focus, positioned above the wrapped element.
export function Tooltip({
  content,
  children,
  delay = 250,
}: {
  content: string;
  children: React.ReactNode;
  delay?: number;
}) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function show() {
    timer.current = setTimeout(() => setOpen(true), delay);
  }
  function hide() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setOpen(false);
  }

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          data-testid="tooltip"
          className="animate-fade-in pointer-events-none absolute bottom-full left-1/2 z-[90] mb-2 w-max max-w-64 -translate-x-1/2 rounded-lg border border-hairline bg-surface-raised px-2.5 py-1.5 text-xs leading-relaxed text-ink pop-shadow"
        >
          {content}
          <span className="absolute left-1/2 top-full -ml-1 border-4 border-transparent border-t-hairline-strong" />
        </span>
      )}
    </span>
  );
}
