"use client";

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: string; label: string }[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="flex w-fit gap-1 rounded-xl border border-hairline bg-surface-sunken p-1">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          data-testid={`tab-${t.key}`}
          className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-all ${
            active === t.key
              ? "bg-surface-raised text-ink card-shadow"
              : "text-ink-muted hover:text-ink"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
