"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

// The inline script in layout.tsx applies the saved/system theme before
// hydration; this component just reflects + toggles it.
export function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {}
    setDark(next);
  }

  return (
    <button
      onClick={toggle}
      data-testid="theme-toggle"
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label="Toggle dark mode"
      className="rounded-lg border border-hairline bg-surface p-2 text-ink-secondary transition-colors hover:border-hairline-strong hover:text-ink"
    >
      {dark === null ? (
        <span className="block h-4 w-4" />
      ) : dark ? (
        <Sun size={16} />
      ) : (
        <Moon size={16} />
      )}
    </button>
  );
}
