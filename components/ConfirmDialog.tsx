"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";

// Reusable confirmation dialog — replaces every native confirm(). The danger
// variant is used for all deletes: shows the entity name, red confirm button.
// Escape and overlay click cancel; the confirm button gets initial focus so
// Enter confirms.
export function ConfirmDialog({
  title,
  message,
  entityName,
  confirmLabel = "Delete",
  danger = true,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  entityName?: string;
  confirmLabel?: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCancel();
      }
    }
    document.addEventListener("keydown", onKey, true);
    confirmRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onCancel]);

  return (
    <div
      className="animate-fade-in fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
      data-testid="confirm-dialog"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        className="animate-modal-in w-full max-w-sm rounded-xl border border-hairline bg-surface-raised p-5 pop-shadow"
      >
        <div className="flex items-start gap-3">
          {danger && (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger">
              <AlertTriangle size={17} />
            </span>
          )}
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">{title}</h3>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-secondary">
              {message}
              {entityName && (
                <>
                  {" "}
                  <span
                    className="font-medium text-ink"
                    data-testid="confirm-entity-name"
                  >
                    “{entityName}”
                  </span>
                  ?
                </>
              )}
            </p>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            data-testid="confirm-cancel"
            className="rounded-lg px-3.5 py-2 text-xs font-medium text-ink-secondary transition-colors hover:bg-surface-sunken hover:text-ink"
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            data-testid="confirm-accept"
            className={`rounded-lg px-4 py-2 text-xs font-medium text-white transition-colors focus:outline-none focus:ring-2 ${
              danger
                ? "bg-danger hover:opacity-90 focus:ring-danger-soft"
                : "bg-accent hover:bg-accent-hover focus:ring-accent-soft"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
