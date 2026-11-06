"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { Check, X, AlertCircle } from "lucide-react";

type ToastKind = "success" | "error";

interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
}

const ToastContext = createContext<(message: string, kind?: ToastKind) => void>(
  () => {},
);

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const push = useCallback((message: string, kind: ToastKind = "success") => {
    const id = ++counter.current;
    setToasts((prev) => [...prev, { id, message, kind }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2600);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col gap-2"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            data-testid="toast"
            data-kind={t.kind}
            className="animate-toast-in pointer-events-auto flex items-center gap-2 rounded-lg border border-hairline bg-surface-raised px-3.5 py-2.5 text-sm pop-shadow"
          >
            {t.kind === "success" ? (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-done-soft text-done">
                <Check size={12} strokeWidth={3} />
              </span>
            ) : (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-danger-soft text-danger">
                <AlertCircle size={12} strokeWidth={3} />
              </span>
            )}
            <span>{t.message}</span>
            <button
              onClick={() =>
                setToasts((prev) => prev.filter((x) => x.id !== t.id))
              }
              className="ml-1 text-ink-muted transition-colors hover:text-ink"
              aria-label="Dismiss"
            >
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
