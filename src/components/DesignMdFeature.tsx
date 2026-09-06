"use client";

import { useMemo, useState, type ReactNode } from "react";
import { buildDesignMd, buildDownloadFilename } from "@/lib/design-md";
import { splitMdBlocks } from "@/lib/md-blocks";
import type { DesignModel } from "@/lib/model";
import { useI18n } from "@/lib/i18n";

/**
 * DESIGN.md is the one artifact a viewer can grasp in a few seconds, so it is
 * promoted to the top of the report instead of sitting behind Export. The
 * per-section toggles stay on the full tab; this block is the read and take it
 * view, not the configure it view.
 */

/* Inline pass: bold and code only, which is all buildDesignMd ever emits.
   Returns React nodes rather than an HTML string, so a font family or selector
   captured from a scanned site can never be injected as markup. */
function renderInline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|`([^`]+)`/g;
  let last = 0;
  let n = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      out.push(
        <strong key={`${key}b${n}`} className="font-semibold text-fg">
          {m[1]}
        </strong>,
      );
    } else {
      out.push(
        <code
          key={`${key}c${n}`}
          className="rounded-xs bg-surface-2 px-1 font-mono text-xs text-brand-500"
        >
          {m[2]}
        </code>,
      );
    }
    last = m.index + m[0].length;
    n += 1;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/* Presentation only. The line walk lives in lib/md-blocks so it can be tested
   as plain data instead of through rendered output. */
function MarkdownView({ md }: { md: string }) {
  const blocks = useMemo(() => splitMdBlocks(md), [md]);

  return (
    <>
      {blocks.map((b, i) => {
        switch (b.kind) {
          case "h1":
            return (
              <h3 key={i} className="text-lg font-extrabold tracking-tight text-fg">
                {renderInline(b.text, `h1${i}`)}
              </h3>
            );
          case "h2":
            return (
              <h4 key={i} className="mt-5 text-base font-bold text-brand-500">
                {renderInline(b.text, `h2${i}`)}
              </h4>
            );
          case "h3":
            return (
              <h5 key={i} className="mt-4 text-sm font-bold text-fg">
                {renderInline(b.text, `h3${i}`)}
              </h5>
            );
          case "quote":
            return (
              <p key={i} className="my-2 border-l-2 border-brand-200 pl-3 text-sm text-muted">
                {renderInline(b.text, `q${i}`)}
              </p>
            );
          case "hr":
            return <hr key={i} className="my-4 border-border" />;
          case "list":
            return (
              <ul key={i} className="my-2 flex flex-col gap-1">
                {b.items.map((it, y) => (
                  <li key={y} className="flex gap-2 text-sm text-muted">
                    <span
                      className="mt-2 h-1 w-1 shrink-0 rounded-full bg-brand-400"
                      aria-hidden="true"
                    />
                    <span>{renderInline(it, `li${i}${y}`)}</span>
                  </li>
                ))}
              </ul>
            );
          case "table":
            return (
              <div key={i} className="my-3 overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr>
                      {b.head.map((c, x) => (
                        <th
                          key={x}
                          className="border-b border-border px-2 py-1.5 font-semibold text-faint"
                        >
                          {renderInline(c, `th${i}${x}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.body.map((r, y) => (
                      <tr key={y} className="border-b border-border/60 last:border-0">
                        {r.map((c, x) => (
                          <td key={x} className="px-2 py-1.5 text-muted">
                            {renderInline(c, `td${i}${y}${x}`)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "code":
            /* Rendered as plain text inside <pre>, never as markup: the token
               values in here come from a scanned site. Scrolls on its own so a
               long custom-property line cannot widen the report column. */
            return (
              <pre
                key={i}
                className="my-3 max-h-72 overflow-auto rounded-lg border border-border bg-canvas p-3 font-mono text-2xs leading-5 text-muted"
              >
                {b.text}
              </pre>
            );
          default:
            return (
              <p key={i} className="my-2 text-sm text-muted">
                {renderInline(b.text, `p${i}`)}
              </p>
            );
        }
      })}
    </>
  );
}

function fmtBytes(n: number): string {
  return n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`;
}

export function DesignMdFeature({
  result,
  onOpenFull,
}: {
  result: DesignModel;
  onOpenFull: () => void;
}) {
  const { t } = useI18n();
  const md = useMemo(() => buildDesignMd(result), [result]);
  const [copied, setCopied] = useState(false);
  const filename = buildDownloadFilename(result.source.url);
  const size = useMemo(() => new TextEncoder().encode(md).length, [md]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(md);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Clipboard is blocked outside a secure context; download still works. */
    }
  }

  function download() {
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="card overflow-hidden">
      {/* Brand rule across the top: the one block on this page that should read
          as the headline result, not as another panel among twenty. */}
      <div className="h-0.5 w-full bg-brand-500" aria-hidden="true" />

      <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="eyebrow mb-1.5 inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" aria-hidden="true" />
            {t("md.hero.eyebrow")}
          </p>
          <h3 className="text-xl font-bold tracking-tight text-fg">{t("md.hero.title")}</h3>
          <p className="mt-1 max-w-prose text-sm text-muted">{t("md.hero.sub")}</p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <button onClick={copy} className="btn btn-primary btn-sm">
            {copied ? t("md.hero.copied") : t("md.hero.copy")}
          </button>
          <button onClick={download} className="btn btn-secondary btn-sm">
            {t("md.hero.download")}
          </button>
        </div>
      </div>

      {/* File chrome, so the preview reads as the actual artifact being handed
          over rather than as more report chrome. */}
      <div className="flex items-center gap-2 border-y border-border bg-surface-2 px-4 py-2">
        <span className="truncate font-mono text-xs font-semibold text-fg">{filename}</span>
        <span className="font-mono text-2xs text-faint">{fmtBytes(size)}</span>
        <button
          onClick={onOpenFull}
          className="ml-auto shrink-0 text-xs font-medium text-brand-500 underline-offset-2 hover:underline"
        >
          {t("md.hero.full")}
        </button>
      </div>

      <div className="relative">
        <div className="max-h-[460px] overflow-y-auto px-5 py-4">
          <MarkdownView md={md} />
        </div>
        {/* Signals that the document continues past the cap. */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-surface to-transparent"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
