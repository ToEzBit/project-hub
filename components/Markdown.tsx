"use client";

import { Fragment } from "react";

// Tiny dependency-free markdown renderer producing React elements (never
// dangerouslySetInnerHTML, so note content can't inject markup). Covers the
// subset that matters for personal notes: headings, bold/italic, inline code,
// fenced code blocks, links, bullet/numbered lists, blockquotes, hr.

function renderInline(text: string, keyBase: string): React.ReactNode[] {
  // Tokenize inline code first so other markers inside backticks are literal.
  const out: React.ReactNode[] = [];
  const parts = text.split(/(`[^`]+`)/g);
  parts.forEach((part, pi) => {
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      out.push(
        <code
          key={`${keyBase}-c${pi}`}
          className="rounded bg-surface-sunken px-1 py-0.5 font-mono text-[0.85em] text-accent"
        >
          {part.slice(1, -1)}
        </code>,
      );
      return;
    }
    // bold / italic / links on the remaining text
    const rx = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)\s]+\))/g;
    const segs = part.split(rx);
    segs.forEach((seg, si) => {
      const key = `${keyBase}-${pi}-${si}`;
      if (/^\*\*[^*]+\*\*$/.test(seg)) {
        out.push(<strong key={key}>{seg.slice(2, -2)}</strong>);
      } else if (/^\*[^*]+\*$/.test(seg)) {
        out.push(<em key={key}>{seg.slice(1, -1)}</em>);
      } else if (/^\[[^\]]+\]\([^)\s]+\)$/.test(seg)) {
        const m = seg.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/)!;
        const href = /^(https?:\/\/|\/|#|mailto:)/i.test(m[2]) ? m[2] : "#";
        out.push(
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
          >
            {m[1]}
          </a>,
        );
      } else if (seg) {
        out.push(<Fragment key={key}>{seg}</Fragment>);
      }
    });
  });
  return out;
}

export function Markdown({ source }: { source: string }) {
  const lines = source.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (/^\s*$/.test(line)) {
      i++;
      continue;
    }

    // fenced code block
    if (/^```/.test(line)) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++; // closing fence
      blocks.push(
        <pre
          key={key++}
          className="overflow-x-auto rounded-lg border border-hairline bg-surface-sunken p-3 font-mono text-xs leading-relaxed"
        >
          {buf.join("\n")}
        </pre>,
      );
      continue;
    }

    // horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      blocks.push(<hr key={key++} className="border-hairline" />);
      i++;
      continue;
    }

    // heading
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const cls = [
        "text-lg font-semibold tracking-tight",
        "text-base font-semibold tracking-tight",
        "text-sm font-semibold",
        "text-[13px] font-semibold uppercase tracking-wider text-ink-secondary",
      ][level - 1];
      const Tag = (`h${level + 2}` as unknown) as "h3";
      blocks.push(
        <Tag key={key++} className={cls}>
          {renderInline(h[2], `h${key}`)}
        </Tag>,
      );
      i++;
      continue;
    }

    // blockquote
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i]))
        buf.push(lines[i++].replace(/^>\s?/, ""));
      blocks.push(
        <blockquote
          key={key++}
          className="border-l-2 border-accent/50 pl-3 text-ink-secondary"
        >
          {renderInline(buf.join(" "), `q${key}`)}
        </blockquote>,
      );
      continue;
    }

    // lists
    if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[i]))
        items.push(lines[i++].replace(/^\s*([-*+]|\d+\.)\s+/, ""));
      const children = items.map((it, ii) => (
        <li key={ii}>{renderInline(it, `l${key}-${ii}`)}</li>
      ));
      blocks.push(
        ordered ? (
          <ol key={key++} className="list-decimal space-y-1 pl-5">
            {children}
          </ol>
        ) : (
          <ul key={key++} className="list-disc space-y-1 pl-5">
            {children}
          </ul>
        ),
      );
      continue;
    }

    // paragraph: merge consecutive plain lines
    const buf: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,4}\s|```|>\s?|\s*([-*+]|\d+\.)\s+|(-{3,}|\*{3,}|_{3,})\s*$)/.test(lines[i])
    ) {
      buf.push(lines[i++]);
    }
    blocks.push(
      <p key={key++} className="leading-relaxed">
        {renderInline(buf.join(" "), `p${key}`)}
      </p>,
    );
  }

  if (blocks.length === 0) {
    return (
      <p className="text-xs italic text-ink-muted">Nothing to preview yet.</p>
    );
  }
  return (
    <div data-testid="markdown-preview" className="flex flex-col gap-3 text-sm text-ink">
      {blocks}
    </div>
  );
}
