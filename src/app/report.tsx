"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { ExtractResponse, DesignModel, ColorToken } from "@/lib/model";
import { buildDesignMd, buildDownloadFilename, type MdOptions, type MdLang } from "@/lib/design-md";
import { buildPreviewHtml } from "@/lib/preview";
import { buildExports, buildZip } from "@/lib/export";
import { streamAiWithAutoSwitch, loadConfig, buildModelContext } from "@/lib/ai";
import type { ModelContextSection, AiConfig } from "@/lib/ai";
import { AiSettingsButton } from "@/components/AiSettings";
import type { HealthReport, HealthCategory } from "@/lib/health";
import type { A11yReport } from "@/lib/accessibility";
import type { ResponsiveReport } from "@/lib/responsive";
import { diffModels, type DiffResult } from "@/lib/diff";
import { playgroundFromModel, applyPlayground } from "@/lib/playground";
import { listSessions, saveSession, deleteSession, renameSession, loadSession, clearAllSessions } from "@/lib/sessions";
import type { ScanSession } from "@/lib/sessions";
import { useI18n } from "@/lib/i18n";
import type { DarkModeReport } from "@/lib/darkmode";
import { buildDesignSpecification } from "@/lib/spec";
import { computeReadiness } from "@/lib/readiness";
import { buildDesignPackZip } from "@/lib/pack";
import { NexoraPanel } from "@/components/NexoraPanel";
import { VisualPlayground } from "@/components/VisualPlayground";

const BASELINE_KEY = "vinyasa-baseline-scan";

function loadBaseline(): DesignModel | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(BASELINE_KEY);
    return raw ? (JSON.parse(raw) as DesignModel) : null;
  } catch {
    return null;
  }
}

function saveBaseline(m: DesignModel) {
  localStorage.setItem(BASELINE_KEY, JSON.stringify(m));
}

type Tab =
  | "overview"
  | "pages"
  | "colors"
  | "typography"
  | "spacing"
  | "shapes"
  | "effects"
  | "components"
  | "responsive"
  | "darkmode"
  | "playground"
  | "diff"
  | "history"
  | "drift"
  | "health"
  | "accessibility"
  | "export"
  | "audit"
  | "md"
  | "preview"
  | "ai"
  | "project"
  | "spec"
  | "nexora";

function fmtBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

function ScoreBar({ value }: { value: number }) {
  const color =
    value >= 80 ? "bg-success" : value >= 50 ? "bg-warning" : "bg-danger";
  return (
    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-border">
      <div className={`h-full ${color}`} style={{ width: `${value}%` }} />
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      {subtitle && <p className="text-sm text-faint">{subtitle}</p>}
    </div>
  );
}

function ColorGrid({
  tokens,
  onSelect,
  selectedHex,
}: {
  tokens: ColorToken[];
  onSelect: (t: ColorToken) => void;
  selectedHex: string | null;
}) {
  if (tokens.length === 0) return <p className="text-sm text-muted">Tidak terdeteksi.</p>;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
      {tokens.map((t) => (
        <button
          key={t.hex}
          onClick={() => onSelect(t)}
          className={`group overflow-hidden rounded-xl border text-left transition-colors ${
            selectedHex === t.hex
              ? "border-brand-500 ring-1 ring-brand-500"
              : "border-border hover:border-border-strong"
          }`}
        >
          <div className="h-14 w-full" style={{ background: t.hex }} />
          <div className="px-2 py-1.5">
            <div className="truncate text-xs font-medium text-fg">{t.name}</div>
            <div className="font-mono text-xs text-muted">{t.hex}</div>
            <div className="text-xs text-faint">{t.usage}%</div>
          </div>
        </button>
      ))}
    </div>
  );
}

function ColorDetail({ token }: { token: ColorToken }) {
  const rgb = token.rgb;
  return (
    <div className="rounded-xl border border-border bg-canvas p-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 grow-0 rounded-md border border-border" style={{ background: token.hex }} />
        <div>
          <div className="text-sm font-semibold text-fg">{token.name}</div>
          <div className="font-mono text-xs text-muted">
            {token.hex} · rgb({rgb.r}, {rgb.g}, {rgb.b})
          </div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-lg font-bold text-fg">{token.usage}%</div>
          <div className="text-xs text-faint">{token.count} pemakaian</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg border border-border bg-surface p-2">
          <div className="text-faint">Tipe</div>
          <div className="text-fg">{token.isNeutral ? "Netral" : token.semantic ? token.semantic : "Primer"}</div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-2">
          <div className="text-faint">Frekuensi</div>
          <div className="font-mono text-fg">{token.count}x</div>
        </div>
      </div>

      {token.sources.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-faint">Sumber</div>
          <div className="flex flex-wrap gap-1">
            {token.sources.slice(0, 8).map((s) => (
              <code key={s} className="rounded bg-surface px-1.5 py-0.5 font-mono text-2xs text-muted">
                {s}
              </code>
            ))}
          </div>
        </div>
      )}

      {token.selectors.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-faint">Selector</div>
          <div className="flex flex-wrap gap-1">
            {token.selectors.slice(0, 12).map((sel) => (
              <code key={sel} className="rounded bg-surface px-1.5 py-0.5 font-mono text-2xs text-muted">
                {sel}
              </code>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ColorsPanel({ result }: { result: DesignModel }) {
  const { colors } = result.tokens;
  const [selected, setSelected] = useState<ColorToken | null>(null);
  return (
    <>
      <SectionHeader title="Warna primer" subtitle="Token warna paling sering dipakai. Klik untuk detail & sumber" />
      <div className="grid gap-4 lg:grid-cols-[1fr,320px]">
        <div>
          <ColorGrid tokens={colors.primary} onSelect={setSelected} selectedHex={selected?.hex ?? null} />
          <SectionHeader title="Warna netral" subtitle="Hitam, putih, abu-abu yang dipakai" />
          <ColorGrid tokens={colors.neutral} onSelect={setSelected} selectedHex={selected?.hex ?? null} />
        </div>
        <div className="lg:sticky lg:top-4">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-faint">
            Source Inspector
          </div>
          {selected ? (
            <ColorDetail token={selected} />
          ) : (
            <div className="rounded-xl border border-dashed border-border p-4 text-sm text-faint">
              Pilih token warna untuk melihat nilai, sumber, dan selector yang menggunakannya.
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function TypographyPanel({ result }: { result: DesignModel }) {
  const fonts = result.tokens.typography;
  return (
    <>
      <SectionHeader title="Font family" />
      <div className="flex flex-wrap gap-2">
        {fonts.families.map((f) => (
          <code
            key={f.raw}
            className="rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs"
          >
            {f.raw}
            <span className="ml-2 text-faint">{f.usage}%</span>
          </code>
        ))}
      </div>

      <SectionHeader title="Skala ukuran font" />
      <div className="overflow-hidden rounded-xl border border-border">
        {fonts.sizes.map((s, i) => (
          <div
            key={`${s.raw}-${i}`}
            className={`flex items-center justify-between px-4 py-2 ${i % 2 ? "bg-surface-2/60" : ""}`}
          >
            <span className="font-mono text-sm">{s.raw}</span>
            <div className="flex items-center gap-3">
              <span className="text-xs text-faint">{s.px}px</span>
              <span className="w-10 text-right text-xs text-faint">{s.usage}%</span>
            </div>
          </div>
        ))}
      </div>

      {fonts.weights.length > 0 && (
        <>
          <SectionHeader title="Berat font" />
          <div className="flex flex-wrap gap-2">
            {fonts.weights.map((w, i) => (
              <span
                key={`${w.value}-${i}`}
                className="rounded-full border border-border px-3 py-1 text-xs"
                style={{ fontWeight: w.value }}
              >
                {w.value} · {w.usage}%
              </span>
            ))}
          </div>
        </>
      )}

      <SectionHeader title="Gaya teks yang umum dipakai" />
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-2 text-xs text-faint">
            <tr>
              <th className="px-4 py-2 font-medium">Contoh</th>
              <th className="px-4 py-2 font-medium">Ukuran</th>
              <th className="hidden px-4 py-2 font-medium sm:table-cell">Berat</th>
              <th className="hidden px-4 py-2 font-medium sm:table-cell">Line height</th>
              <th className="px-4 py-2 font-medium">Selector</th>
            </tr>
          </thead>
          <tbody>
            {result.tokens.textStyles.slice(0, 8).map((t, i) => (
              <tr key={i} className="border-t border-border">
                <td
                  className="px-4 py-3"
                  style={{
                    fontFamily: t.fontFamily,
                    fontSize: t.fontSize,
                    fontWeight: t.fontWeight,
                    lineHeight: t.lineHeight,
                  }}
                >
                  Aa
                </td>
                <td className="px-4 py-3 font-mono text-xs">{t.fontSize}</td>
                <td className="hidden px-4 py-3 text-xs sm:table-cell">{t.fontWeight}</td>
                <td className="hidden px-4 py-3 text-xs sm:table-cell">{t.lineHeight}</td>
                <td className="max-w-[200px] truncate px-4 py-3 font-mono text-xs text-faint">
                  {t.selectors[0]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function SpacingPanel({ result }: { result: DesignModel }) {
  const spacing = result.tokens.spacing;
  return (
    <>
      <SectionHeader title="Spacing" subtitle="Margin, padding, dan gap, diurutkan berdasarkan pemakaian" />
      {spacing.length === 0 ? (
        <p className="text-sm text-faint">Tidak terdeteksi.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          {spacing.map((s, i) => (
            <div
              key={s.raw}
              className={`flex items-center justify-between px-4 py-2 ${i % 2 ? "bg-surface-2/60" : ""}`}
            >
              <span className="font-mono text-sm">{s.raw}</span>
              <div className="flex items-center gap-3">
                {s.px !== null && <span className="text-xs text-faint">{s.px}px</span>}
                <span className="w-10 text-right text-xs text-faint">{s.usage}%</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function ShapesPanel({ result }: { result: DesignModel }) {
  const { radius, borders, breakpoints } = result.tokens;
  return (
    <>
      <SectionHeader title="Border radius" />
      {radius.length === 0 ? (
        <p className="text-sm text-faint">Tidak terdeteksi.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {radius.map((r) => (
            <div key={r.raw} className="rounded-xl border border-border p-3 text-center">
              <div className="mx-auto h-14 w-14 bg-border-strong" style={{ borderRadius: r.raw }} />
              <div className="mt-2 font-mono text-xs">{r.raw}</div>
              <div className="text-xs text-faint">{r.usage}%</div>
            </div>
          ))}
        </div>
      )}

      {borders.length > 0 && (
        <>
          <SectionHeader title="Borders" />
          <div className="flex flex-wrap gap-2">
            {borders.map((b) => (
              <code key={b.raw} className="rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs">
                {b.raw}
              </code>
            ))}
          </div>
        </>
      )}

      {breakpoints.length > 0 && (
        <>
          <SectionHeader title="Breakpoints (@media)" />
          <div className="flex flex-wrap gap-2">
            {breakpoints.map((b, i) => (
              <span
                key={`${b.feature}-${b.raw}-${i}`}
                className="rounded-full border border-border px-3 py-1 text-xs"
              >
                {b.feature}: {b.raw}
              </span>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function EffectsPanel({ result }: { result: DesignModel }) {
  const { shadows, gradients, durations, easings } = result.tokens;
  return (
    <>
      {shadows.length > 0 && (
        <>
          <SectionHeader title="Shadows" />
          <div className="flex flex-wrap gap-2">
            {shadows.map((s) => (
              <code key={s.raw} className="rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs">
                {s.raw.slice(0, 60)}
              </code>
            ))}
          </div>
        </>
      )}
      {gradients.length > 0 && (
        <>
          <SectionHeader title="Gradients" />
          <div className="overflow-hidden rounded-xl border border-border bg-canvas p-3">
            {gradients.slice(0, 6).map((g) => (
              <div
                key={g.raw}
                className="mb-2 h-10 rounded-lg"
                style={{ background: g.raw, border: "1px solid rgba(255,255,255,.1)" }}
              />
            ))}
          </div>
        </>
      )}
      {durations.length > 0 && (
        <>
          <SectionHeader title="Durasi transisi" />
          <div className="flex flex-wrap gap-2">
            {durations.map((d) => (
              <span key={d.raw} className="rounded-full border border-border px-3 py-1 text-xs">
                {d.raw}
              </span>
            ))}
          </div>
        </>
      )}
      {easings.length > 0 && (
        <>
          <SectionHeader title="Easing" />
          <div className="flex flex-wrap gap-2">
            {easings.map((e) => (
              <code key={e.raw} className="rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs">
                {e.raw}
              </code>
            ))}
          </div>
        </>
      )}
      {shadows.length === 0 &&
        gradients.length === 0 &&
        durations.length === 0 &&
        easings.length === 0 && <p className="text-sm text-faint">Tidak ada efek yang terdeteksi.</p>}
    </>
  );
}

function AuditPanel({ result }: { result: DesignModel }) {
  const sources = result.pages[0]?.sources ?? [];
  return (
    <>
      <SectionHeader title="Sumber CSS" subtitle="Setiap stylesheet yang dibaca beserta skor akurasi" />
      {sources.length === 0 ? (
        <p className="text-sm text-faint">Tidak ada sumber CSS yang tercatat.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-2 text-xs text-faint">
              <tr>
                <th className="px-4 py-2 font-medium">Sumber</th>
                <th className="px-4 py-2 font-medium">Tipe</th>
                <th className="px-4 py-2 font-medium">Ukuran</th>
                <th className="hidden px-4 py-2 font-medium md:table-cell">Rules</th>
                <th className="hidden px-4 py-2 font-medium md:table-cell">Deklarasi</th>
                <th className="px-4 py-2 font-medium">Warna</th>
                <th className="px-4 py-2 font-medium">Tipografi</th>
                <th className="px-4 py-2 font-medium">Skor</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="max-w-[220px] truncate px-4 py-2.5 font-mono text-xs text-muted">
                    {s.url}
                  </td>
                  <td className="px-4 py-2.5 text-xs">{s.kind}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{fmtBytes(s.sizeBytes)}</td>
                  <td className="hidden px-4 py-2.5 text-xs md:table-cell">{s.ruleCount}</td>
                  <td className="hidden px-4 py-2.5 text-xs md:table-cell">{s.declarationCount}</td>
                  <td className="px-4 py-2.5 text-xs">{s.colorScore}%</td>
                  <td className="px-4 py-2.5 text-xs">{s.typographyScore}%</td>
                  <td className="px-4 py-2.5 text-xs font-semibold">{s.accuracy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

const MD_SECTION_LABELS: Array<{ key: keyof NonNullable<MdOptions["sections"]>; label: string }> = [
  { key: "colors", label: "Warna" },
  { key: "typography", label: "Tipografi" },
  { key: "textStyles", label: "Gaya teks" },
  { key: "radius", label: "Radius" },
  { key: "spacing", label: "Spacing" },
  { key: "shadows", label: "Shadows" },
  { key: "audit", label: "Audit CSS" },
  { key: "health", label: "Health" },
  { key: "accessibility", label: "A11y" },
  { key: "responsive", label: "Responsif" },
];

function MdControls({
  opts,
  onChange,
}: {
  opts: MdOptions;
  onChange: (o: MdOptions) => void;
}) {
  function toggle(key: keyof NonNullable<MdOptions["sections"]>) {
    const cur = opts.sections ?? {};
    onChange({
      ...opts,
      sections: { ...cur, [key]: !(cur[key] ?? true) },
    });
  }

  return (
    <div className="mb-4 grid gap-3 rounded-xl border border-border p-4 md:grid-cols-2">
      <div>
        <div className="mb-1.5 text-xs uppercase tracking-wide text-faint">Bahasa</div>
        <div className="inline-flex rounded-lg border border-border p-0.5">
          {(["id", "en"] as MdLang[]).map((l) => (
            <button
              key={l}
              onClick={() => onChange({ ...opts, lang: l })}
              className={`rounded-md px-3 py-1 text-xs transition-colors ${
                (opts.lang ?? "id") === l ? "bg-fg text-canvas" : "text-muted"
              }`}
            >
              {l === "id" ? "Indonesia" : "English"}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-1.5 text-xs uppercase tracking-wide text-faint">
          Bagian yang disertakan
        </div>
        <div className="flex flex-wrap gap-1.5">
          {MD_SECTION_LABELS.map((s) => {
            const on = opts.sections?.[s.key] ?? true;
            return (
              <button
                key={s.key}
                onClick={() => toggle(s.key)}
                className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                  on
                    ? "border-fg bg-fg text-canvas"
                    : "border-border text-faint hover:border-border-strong"
                }`}
              >
                {on ? "✓ " : ""}
                {s.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MdPanel({ result }: { result: DesignModel }) {
  const [opts, setOpts] = useState<MdOptions>({});
  const md = useMemo(() => buildDesignMd(result, opts), [result, opts]);
  const [copied, setCopied] = useState(false);
  const filename = buildDownloadFilename(result.source.url);

  async function copy() {
    try {
      await navigator.clipboard.writeText(md);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
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
    <>
      <MdControls opts={opts} onChange={setOpts} />
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={copy}
          className="rounded-lg bg-fg px-3 py-1.5 text-xs font-semibold text-canvas hover:bg-muted"
        >
          {copied ? "Tersalin!" : "Salin"}
        </button>
        <button
          onClick={download}
          className="rounded-lg border border-border px-3 py-1.5 text-xs text-fg hover:border-border-strong"
        >
          Download {filename}
        </button>
      </div>
      <pre className="max-h-[60vh] overflow-auto rounded-xl border border-border bg-canvas p-4 text-xs leading-6 text-fg">
        {md}
      </pre>
    </>
  );
}

function PreviewPanel({ result }: { result: DesignModel }) {
  const html = useMemo(() => buildPreviewHtml(result), [result]);
  return (
    <iframe
      title="Pratinjau design tokens"
      srcDoc={html}
      className="h-[70vh] w-full rounded-xl border border-border bg-white"
    />
  );
}

function ComponentsPanel({ result }: { result: DesignModel }) {
  const components = result.components;
  const [sel, setSel] = useState(0);

  if (!components || components.length === 0) {
    return <p className="text-sm text-muted">Tidak ada pola komponen yang terdeteksi.</p>;
  }

  const active = components[sel];
  const confColor = (v: number) =>
    v >= 70 ? "text-success" : v >= 50 ? "text-warning" : "text-muted";

  return (
    <>
      <SectionHeader
        title="Pola komponen"
        subtitle="Deteksi heuristik berbasis selector, bukan kepastian mutlak"
      />
      <div className="grid gap-4 lg:grid-cols-[260px,1fr]">
        <div className="flex flex-col gap-1.5">
          {components.map((c, i) => (
            <button
              key={c.name}
              onClick={() => setSel(i)}
              aria-current={i === sel ? "true" : undefined}
              className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition-colors ${
                i === sel
                  ? "border-brand-500 bg-brand-500/10"
                  : "border-border bg-canvas hover:border-border-strong"
              }`}
            >
              <span className="text-sm font-medium capitalize text-fg">{c.name}</span>
              <span className="shrink-0 rounded-md bg-surface px-1.5 py-0.5 text-xs text-muted">
                x{c.count} · {c.confidence}%
              </span>
            </button>
          ))}
        </div>

        {active && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-canvas p-4">
              <div>
                <h3 className="text-base font-semibold capitalize text-fg">{active.name}</h3>
                <p
                  className={`text-xs font-medium ${confColor(active.confidence)}`}
                >
                  Confidence {active.confidence}%, {active.confidence >= 70 ? "pola konsisten" : "heuristik lemah"}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="rounded-lg border border-border bg-surface px-4 py-1.5">
                  <div className="text-base font-bold text-fg">{active.count}</div>
                  <div className="text-2xs text-faint">selector</div>
                </div>
                <div className="rounded-lg border border-border bg-surface px-4 py-1.5">
                  <div className="text-base font-bold text-fg">{active.variantCount}</div>
                  <div className="text-2xs text-faint">varian</div>
                </div>
              </div>
            </div>

            {Object.keys(active.properties).length > 0 && (
              <div className="rounded-xl border border-border bg-canvas p-4">
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-faint">
                  Properti & nilai
                </div>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {Object.entries(active.properties).map(([prop, vals]) => (
                    <div key={prop} className="rounded-lg border border-border bg-surface px-3 py-2">
                      <div className="text-xs font-medium text-fg">{prop}</div>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {vals.slice(0, 4).map((v) => (
                          <code key={v} className="rounded bg-canvas px-1 py-0.5 text-2xs text-muted">
                            {v}
                          </code>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-xl border border-border bg-canvas p-4">
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-faint">
                Selector
              </div>
              <div className="flex flex-wrap gap-1">
                {active.selectors.map((s) => (
                  <code key={s} className="rounded bg-surface px-1.5 py-0.5 font-mono text-2xs text-muted">
                    {s}
                  </code>
                ))}
              </div>
              {active.pages.length > 0 && (
                <div className="mt-3">
                  <div className="mb-1 text-xs font-medium uppercase tracking-wide text-faint">Halaman</div>
                  <div className="flex flex-wrap gap-1">
                    {active.pages.slice(0, 8).map((p) => (
                      <code key={p} className="rounded bg-surface px-1.5 py-0.5 font-mono text-2xs text-muted">
                        {p}
                      </code>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <p className="text-xs text-faint">
              Deteksi berbasis nama class (heuristik). Interpretasi manual tetap disarankan untuk tata letak kompleks.
            </p>
          </div>
        )}
      </div>
    </>
  );
}

function HealthBar({ value }: { value: number }) {
  const color = value >= 85 ? "bg-success" : value >= 65 ? "bg-warning" : "bg-danger";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-32 overflow-hidden rounded-full bg-border">
        <div className={`h-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="w-8 text-right text-sm font-bold">{value}</span>
    </div>
  );
}

function HealthCategoryCard({ cat }: { cat: HealthCategory }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-medium">{cat.name}</div>
        <HealthBar value={cat.score} />
      </div>
      <p className="text-xs text-faint">{cat.explanation}</p>
      {cat.dominantValues.length > 0 && (
        <div className="mt-2">
          <div className="text-xs text-faint">Skala dominan: {cat.dominantValues.join(" / ")}</div>
        </div>
      )}
      {cat.outliers.length > 0 && (
        <div className="mt-1 text-xs">
          <span className="text-warning">Outlier: {cat.outliers.join(", ")}</span>
        </div>
      )}
      {cat.issues.map((iss, i) => (
        <div key={i} className="mt-2 rounded-lg border border-danger-border bg-danger-bg p-2 text-xs text-danger">
          <div className="font-semibold capitalize">{iss.severity}</div>
          <div>{iss.message}</div>
          {iss.recommendation && <div className="mt-1 text-muted">{iss.recommendation}</div>}
        </div>
      ))}
    </div>
  );
}

function ResponsivePanel({ result }: { result: DesignModel }) {
  const r = result.responsive as ResponsiveReport | null;
  const [vp, setVp] = useState(0);
  if (!r) return <p className="text-sm text-faint">Belum dihitung.</p>;
  const tiers: Array<{ label: string; value: number; range: string }> = [
    { label: "Mobile", value: r.mobile, range: "320-414px" },
    { label: "Tablet", value: r.tablet, range: "768-1024px" },
    { label: "Desktop", value: r.desktop, range: "1280-1920px" },
  ];
  const active = tiers[vp];
  const c = ratingColor(active.value);

  return (
    <>
      <SectionHeader
        title="Responsive Lab"
        subtitle="Skor & breakpoint berdasarkan heuristik CSS dari situs yang dianalisis"
      />

      <div className="mb-4 grid grid-cols-3 gap-2">
        {tiers.map((t, i) => (
          <button
            key={t.label}
            onClick={() => setVp(i)}
            aria-pressed={i === vp}
            className={`rounded-xl border p-3 text-center transition-colors ${
              i === vp
                ? "border-brand-500 bg-brand-500/10"
                : "border-border bg-canvas hover:border-border-strong"
            }`}
          >
            <div className="text-xs font-medium text-fg">{t.label}</div>
            <div className={`mt-1 text-2xl font-bold ${i === vp ? c.text : "text-fg"}`}>{t.value}</div>
            <ScoreBar value={t.value} />
            <div className="mt-1 text-2xs text-faint">{t.range}</div>
          </button>
        ))}
      </div>

      <div className="mb-4 rounded-xl border border-border bg-canvas p-4">
        <div className="flex items-baseline gap-2">
          <span className={`text-3xl font-bold ${c.text}`}>{active.value}</span>
          <span className="text-xs text-faint">/100</span>
        </div>
        <p className="mt-1 text-sm text-muted">
          Skor {active.label.toLowerCase()} ({active.range}) berdasarkan breakpoint, tipografi & spacing yang terdeteksi.
        </p>
      </div>

      {r.breakpoints.length > 0 && (
        <>
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-faint">Breakpoints</div>
          <div className="mb-4 flex flex-wrap gap-2">
            {r.breakpoints.map((b, i) => (
              <span key={`${b.feature}-${b.value}-${i}`} className="rounded-md border border-border bg-surface px-2.5 py-1 font-mono text-xs text-muted">
                {b.feature}: {b.value}
                {b.px !== null && <span className="text-faint"> ({b.px}px)</span>}
              </span>
            ))}
          </div>
        </>
      )}

      <div className="mb-1 text-xs font-medium uppercase tracking-wide text-faint">Isu terdeteksi</div>
      {r.issues.length === 0 ? (
        <p className="text-sm text-muted">Tidak ada isu responsif yang terdeteksi.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {r.issues.map((iss, i) => (
            <div key={i} className="rounded-xl border border-border bg-canvas p-3">
              <div className="flex items-center gap-2">
                <span
                  className={`rounded px-2 py-0.5 text-2xs font-bold uppercase ${
                    iss.severity === "warning" ? "bg-warning-bg text-warning" : "bg-surface text-muted"
                  }`}
                >
                  {iss.severity}
                </span>
                <span className="text-sm font-medium text-fg">{iss.kind}</span>
              </div>
              <p className="mt-1 text-sm text-muted">{iss.message}</p>
              {iss.recommendation && <p className="mt-1 text-xs text-faint">{iss.recommendation}</p>}
              {iss.evidence.length > 0 && (
                <code className="mt-1 block font-mono text-xs text-faint">
                  {iss.evidence.join(" · ")}
                </code>
              )}
            </div>
          ))}
        </div>
      )}
      <p className="mt-3 text-xs text-faint">{r.note}</p>
    </>
  );
}

function PlaygroundPanel({
  result,
  prefill,
}: {
  result: DesignModel;
  prefill?: { colors?: Record<string, string>; radius?: Record<string, string> } | null;
}) {
  const initial = useMemo(() => {
    const base = playgroundFromModel(result);
    if (prefill) {
      if (prefill.colors) Object.assign(base.colors, prefill.colors);
      if (prefill.radius) Object.assign(base.radius, prefill.radius);
    }
    return base;
  }, [result, prefill]);
  const [colors, setColors] = useState<Record<string, string>>(() => initial.colors);
  const [radius, setRadius] = useState<Record<string, string>>(() => initial.radius);
  const [copied, setCopied] = useState(false);

  const modified: DesignModel = useMemo(
    () => applyPlayground(result, { colors, radius }),
    [result, colors, radius],
  );

  const changedCount =
    Object.entries(colors).filter(([k, v]) => k !== v).length +
    Object.entries(radius).filter(([k, v]) => k !== v).length;

  async function copyTokens() {
    try {
      await navigator.clipboard.writeText(JSON.stringify({ colors, radius }, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  function reset() {
    setColors(initial.colors);
    setRadius(initial.radius);
  }

  return (
    <>
      <SectionHeader
        title="Playground"
        subtitle="Ubah token (layer modifikasi). Data asli yang diekstrak tidak disentuh"
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          onClick={reset}
          className="rounded-lg border border-border px-3 py-1.5 text-xs text-fg hover:border-border-strong"
        >
          Reset
        </button>
        <button
          onClick={copyTokens}
          className="rounded-lg border border-border px-3 py-1.5 text-xs text-fg hover:border-border-strong"
        >
          {copied ? "Tersalin!" : "Salin modifikasi (JSON)"}
        </button>
        {changedCount > 0 && (
          <span className="rounded-full bg-warning-bg px-2.5 py-1 text-xs text-warning">
            {changedCount} token diubah
          </span>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <div className="mb-2 text-xs text-faint">Edit warna</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Object.entries(colors).map(([orig, val]) => (
              <label key={orig} className="rounded-xl border border-border p-2">
                <input
                  type="color"
                  value={val}
                  onChange={(e) => setColors((c) => ({ ...c, [orig]: e.target.value }))}
                  className="h-9 w-full cursor-pointer rounded-md border-0 bg-transparent"
                />
                <div className="mt-1 truncate font-mono text-2xs text-faint">{orig}</div>
                <div className="truncate font-mono text-2xs text-muted">{val}</div>
              </label>
            ))}
          </div>

          <div className="mt-4 mb-2 text-xs text-faint">Edit radius</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Object.entries(radius).map(([orig, val]) => (
              <label key={orig} className="rounded-xl border border-border p-2">
                <input
                  type="text"
                  value={val}
                  onChange={(e) => setRadius((r) => ({ ...r, [orig]: e.target.value }))}
                  className="w-full rounded-md border border-border bg-canvas px-2 py-1 font-mono text-xs outline-none focus:border-border-strong"
                />
                <div className="mt-1 truncate font-mono text-2xs text-faint">{orig}</div>
              </label>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs text-faint">Preview modifikasi</div>
          <PreviewPanel result={modified} />
        </div>
      </div>
    </>
  );
}

function DarkModePanel({ result }: { result: DesignModel }) {
  const d = result.darkMode as DarkModeReport | null;
  if (!d) return <p className="text-sm text-faint">Belum dianalisis.</p>;
  return (
    <>
      <div
        className={`mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${
          d.detected
            ? "border-success-border bg-success-bg text-success"
            : "border-border text-muted"
        }`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${d.detected ? "bg-success" : "bg-border-strong"}`} />
        {d.detected ? "Dark mode terdeteksi" : "Dark mode tidak terdeteksi"}
      </div>
      <div className="flex flex-col gap-2 text-sm">
        <div>Media query <code>prefers-color-scheme</code>: {d.prefersColorScheme ? "ada" : "tidak ada"}</div>
        <div>Class/tema dark: {d.mediaQuery ? "ada" : "tidak ada"}</div>
        {d.themeVariables.length > 0 && (
          <div>
            <div className="mb-1 text-xs text-faint">Variabel tema:</div>
            <div className="flex flex-wrap gap-1">
              {d.themeVariables.slice(0, 10).map((v) => (
                <code key={v} className="rounded bg-border px-1.5 py-0.5 text-xs">
                  {v}
                </code>
              ))}
            </div>
          </div>
        )}
      </div>
      <p className="mt-3 text-xs text-faint">{d.note}</p>
    </>
  );
}

function DiffPanel({ result }: { result: DesignModel }) {
  const [baseline, setBaseline] = useState<DesignModel | null>(() => loadBaseline());
  const [savedMsg, setSavedMsg] = useState("");
  const diff = useMemo(() => diffModels(baseline, result), [baseline, result]);

  function saveAsBaseline() {
    saveBaseline(result);
    setBaseline(result);
    setSavedMsg("Scan saat ini disimpan sebagai baseline.");
    setTimeout(() => setSavedMsg(""), 2500);
  }

  function clearBaseline() {
    localStorage.removeItem(BASELINE_KEY);
    setBaseline(null);
    setSavedMsg("Baseline dihapus.");
    setTimeout(() => setSavedMsg(""), 2500);
  }

  return (
    <>
      <SectionHeader
        title="Perbandingan design system"
        subtitle="Diff antara baseline tersimpan dan scan saat ini"
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={saveAsBaseline}
          className="rounded-lg bg-fg px-3 py-1.5 text-xs font-semibold text-canvas hover:bg-muted"
        >
          Simpan scan ini sebagai baseline
        </button>
        {baseline && (
          <button
            onClick={clearBaseline}
            className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:border-border-strong"
          >
            Hapus baseline
          </button>
        )}
      </div>
      {savedMsg && <p className="mb-3 text-xs text-success">{savedMsg}</p>}

      {baseline ? (
        diff ? (
          <>
            <div className="mb-3 flex flex-wrap gap-2 text-xs text-faint">
              <span className="rounded-full border border-border px-2.5 py-1">Baseline: {diff.a}</span>
              <span className="rounded-full border border-border px-2.5 py-1">Sekarang: {diff.b}</span>
            </div>
            <div className="mb-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-success-bg px-2.5 py-1 text-success">+{diff.summary.added} ditambah</span>
              <span className="rounded-full bg-danger-bg px-2.5 py-1 text-danger">-{diff.summary.removed} dihapus</span>
              <span className="rounded-full bg-warning-bg px-2.5 py-1 text-warning">~{diff.summary.changed} berubah</span>
            </div>
            <div className="flex flex-col gap-3">
              {diff.groups.map((g) => {
                const isEmpty = g.added.length === 0 && g.removed.length === 0 && g.changed.length === 0;
                if (isEmpty) return null;
                return (
                  <div key={g.category} className="rounded-xl border border-border p-4">
                    <div className="mb-2 text-sm font-semibold capitalize">{g.category}</div>
                    {g.added.length > 0 && (
                      <div className="mb-1 text-xs text-success">
                        {g.added.map((a) => `${a.label}: ${a.value}`).join(" · ")}
                      </div>
                    )}
                    {g.removed.length > 0 && (
                      <div className="mb-1 text-xs text-danger">
                        {g.removed.map((a) => `${a.label}: ${a.value}`).join(" · ")}
                      </div>
                    )}
                    {g.changed.length > 0 && (
                      <div className="text-xs text-warning">
                        {g.changed.map((c) => `${c.label}: ${c.before} → ${c.after}`).join(" · ")}
                      </div>
                    )}
                  </div>
                );
              })}
              {diff.summary.added + diff.summary.removed + diff.summary.changed === 0 && (
                <p className="text-sm text-faint">Tidak ada perbedaan yang terdeteksi.</p>
              )}
            </div>
          </>
        ) : (
          <p className="text-sm text-faint">Belum ada baseline.</p>
        )
      ) : (
        <p className="text-sm text-faint">
          Belum ada baseline. Jalankan scan, lalu simpan sebagai baseline untuk membandingkan perubahan design system.
        </p>
      )}
    </>
  );
}

function ratingColor(v: number): { text: string; bg: string } {
  if (v >= 80) return { text: "text-success", bg: "bg-success-bg" };
  if (v >= 60) return { text: "text-warning", bg: "bg-warning-bg" };
  return { text: "text-danger", bg: "bg-danger-bg" };
}

function RatioCard({
  label,
  value,
  note,
}: {
  label: string;
  value: number;
  note?: string;
}) {
  const c = ratingColor(value);
  return (
    <div className="rounded-xl border border-border bg-canvas p-4">
      <div className="flex items-baseline gap-2">
        <span className={`text-2xl font-bold ${c.text}`}>{value}</span>
        <span className="text-xs text-faint">/100</span>
      </div>
      <div className="mt-1 text-sm font-medium text-fg">{label}</div>
      {note && <div className="mt-0.5 text-xs text-faint">{note}</div>}
    </div>
  );
}

function tokenCounts(m: DesignModel): Array<[string, number]> {
  const t = m.tokens;
  const colors = t.colors.primary.length + t.colors.neutral.length + t.colors.hardcoded.length;
  const typo = t.typography.families.length + t.typography.sizes.length;
  return [
    ["Warna", colors],
    ["Tipografi", typo],
    ["Spacing", t.spacing.length],
    ["Radius", t.radius.length],
    ["Shadow", t.shadows.length],
    ["Breakpoints", t.breakpoints.length],
  ];
}

function OverviewPanel({ result, onVoice }: { result: DesignModel; onVoice: () => void }) {
  const health = result.health as HealthReport | null;
  const a11y = result.accessibility as A11yReport | null;
  const resp = result.responsive as ResponsiveReport | null;
  const comps = result.components ?? [];
  const pages = result.pages ?? [];
  const scan = result.scan;

  const issues: Array<{ severity: "critical" | "warning" | "info" | "suggestion"; text: string }> = [];
  if (a11y) {
    for (const i of a11y.issues.slice(0, 4)) issues.push({ severity: i.severity, text: i.message });
  }
  if (resp) {
    for (const i of resp.issues.slice(0, 4)) issues.push({ severity: i.severity, text: i.message });
  }
  if (health) {
    for (const cat of [health.color, health.typography, health.spacing, health.radius, health.component]) {
      for (const o of cat.outliers.slice(0, 2)) {
        issues.push({ severity: "warning", text: `${cat.name} outlier: ${o}` });
      }
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-md border border-border bg-canvas px-2 py-1 text-muted">
            {pages.length} halaman · {scan?.totalRequests ?? pages.length} request
          </span>
          <span className="rounded-md border border-border bg-canvas px-2 py-1 text-muted">
            {result.metadata.scanMode === "deep" ? "Deep Scan" : "Fast Scan"}
          </span>
          {result.metadata.generatedAt && (
            <span className="rounded-md border border-border bg-canvas px-2 py-1 text-faint">
              {new Date(result.metadata.generatedAt).toLocaleString("id-ID")}
            </span>
          )}
        </div>
        <h3 className="text-lg font-semibold text-fg">Ringkasan</h3>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <RatioCard label="Design Health" value={health?.overall ?? 0} note="Konsistensi token" />
        <RatioCard
          label="Aksesibilitas"
          value={a11y ? Math.max(0, 100 - a11y.issues.filter((i) => i.severity === "critical").length * 12) : 0}
          note={`${a11y?.issues.length ?? 0} isu`}
        />
        <RatioCard
          label="Responsif"
          value={resp ? Math.round((resp.mobile + resp.tablet + resp.desktop) / 3) : 0}
          note="Mobile / Tablet / Desktop"
        />
        <RatioCard
          label="Komponen"
          value={Math.min(100, comps.length * 12)}
          note={`${comps.length} pola terdeteksi`}
        />
      </div>

      <div>
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-faint">Tokens</div>
        <div className="flex flex-wrap gap-2">
          {tokenCounts(result).map(([label, n]) => (
            <span
              key={label}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm"
            >
              <span className="font-semibold text-fg">{n}</span>{" "}
              <span className="text-muted">{label}</span>
            </span>
          ))}
        </div>
      </div>

      {comps.length > 0 && (
        <div>
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-faint">
            Komponen utama
          </div>
          <div className="flex flex-wrap gap-2">
            {comps.slice(0, 8).map((c) => (
              <button
                key={c.name}
                onClick={onVoice}
                className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-fg transition-colors hover:border-border-strong"
              >
                {c.name}
                <span className="ml-1.5 rounded bg-canvas px-1.5 py-0.5 text-xs text-faint">
                  x{c.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {issues.length > 0 && (
        <div>
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-faint">
            Perlu perhatian
          </div>
          <div className="flex flex-col gap-1.5">
            {issues.slice(0, 6).map((iss, i) => (
              <div
                key={i}
                className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                  iss.severity === "critical"
                    ? "border-danger-border bg-danger-bg text-danger"
                    : iss.severity === "warning"
                      ? "border-warning-border bg-warning-bg text-warning"
                      : "border-border bg-surface text-muted"
                }`}
              >
                <span aria-hidden className="mt-0.5 select-none">
                  {iss.severity === "critical" ? "●" : iss.severity === "warning" ? "▲" : "·"}
                </span>
                <span>{iss.text}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-faint">
            Buka tab Aksesibilitas, Responsif, atau Health untuk detail.
          </p>
        </div>
      )}
    </div>
  );
}

function PagesPanel({ result }: { result: DesignModel }) {
  const pages = result.pages ?? [];
  const [sel, setSel] = useState(0);
  const active = pages[sel];

  if (pages.length === 0) {
    return <p className="text-sm text-muted">Tidak ada data halaman.</p>;
  }

  const summary = (s: typeof active.scores) =>
    `Warna ${s.color} · ${s.typography} · R ${s.radius}`;

  return (
    <div className="grid gap-4 lg:grid-cols-[280px,1fr]">
      <div className="flex flex-col gap-1.5">
        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-faint">
          {pages.length} halaman
        </div>
        {pages.map((p, i) => (
          <button
            key={p.url}
            onClick={() => setSel(i)}
            aria-current={i === sel ? "true" : undefined}
            className={`rounded-lg border px-3 py-2 text-left transition-colors ${
              i === sel
                ? "border-brand-500 bg-brand-500/10"
                : "border-border bg-canvas hover:border-border-strong"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium text-fg">{p.title || p.url}</span>
              {p.status === "ok" ? (
                <span className="shrink-0 text-2xs text-success">ok</span>
              ) : (
                <span className="shrink-0 text-2xs text-danger">error</span>
              )}
            </div>
            <div className="truncate font-mono text-xs text-faint">{p.url}</div>
            <div className="mt-0.5 text-xs text-muted">{summary(p.scores)}</div>
          </button>
        ))}
      </div>

      {active && (
        <div className="rounded-xl border border-border bg-canvas p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-fg">{active.title}</h3>
              <a
                href={active.url}
                target="_blank"
                rel="noreferrer"
                className="truncate font-mono text-xs text-faint hover:text-fg"
              >
                {active.url}
              </a>
            </div>
            {active.status !== "ok" && active.error && (
              <span className="rounded-md bg-danger-bg px-2 py-1 text-xs text-danger">
                {active.error}
              </span>
            )}
          </div>

          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(
              [
                ["Warna", active.scores.color],
                ["Tipografi", active.scores.typography],
                ["Radius", active.scores.radius],
                ["Overall", active.scores.overall],
              ] as Array<[string, number]>
            ).map(([label, v]) => {
              const c = ratingColor(v);
              return (
                <div key={label} className="rounded-lg border border-border bg-surface p-3">
                  <div className={`text-lg font-bold ${c.text}`}>{v}</div>
                  <div className="text-xs text-faint">{label}</div>
                </div>
              );
            })}
          </div>

          {active.screenshots.length > 0 && (
            <div className="mb-4">
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-faint">Screenshot</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {active.screenshots.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt={`Screenshot ${active.title} ${i + 1}`}
                    className="w-full rounded-lg border border-border object-cover"
                    loading="lazy"
                  />
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-faint">
              Sumber CSS ({active.sources.length})
            </div>
            {active.sources.length === 0 ? (
              <p className="text-sm text-faint">Tidak ada sumber CSS yang tercatat.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {active.sources.map((s, i) => (
                  <div
                    key={i}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-surface px-3 py-2 text-xs"
                  >
                    <span className="max-w-[220px] truncate font-mono text-faint">{s.url}</span>
                    <span className="rounded bg-canvas px-1.5 py-0.5 text-2xs text-muted">{s.kind}</span>
                    <span className="text-faint">
                      {(s.sizeBytes / 1024).toFixed(1)} KB · {s.ruleCount} rules ·{" "}
                      {s.declarationCount} decl
                    </span>
                    <span className="ml-auto text-faint">akkurasi {s.accuracy}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function HealthPanel({ result }: { result: DesignModel }) {
  const health = result.health as HealthReport | null;
  if (!health) return <p className="text-sm text-faint">Belum dihitung.</p>;
  const cats = [health.color, health.typography, health.spacing, health.radius, health.component];
  return (
    <>
      <div className="mb-4 rounded-xl border border-border p-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted">Design Health</span>
          <HealthBar value={health.overall} />
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {cats.map((c) => (
          <HealthCategoryCard key={c.name} cat={c} />
        ))}
      </div>
    </>
  );
}

function A11yPanel({ result }: { result: DesignModel }) {
  const a11y = result.accessibility as A11yReport | null;
  if (!a11y) return <p className="text-sm text-faint">Belum dihitung.</p>;
  const gauge = (v: number) => {
    const color = v === 0 ? "bg-success" : v <= 2 ? "bg-warning" : "bg-danger";
    return (
      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${color}`}>{v}</span>
    );
  };
  return (
    <>
      <SectionHeader title="Aksesibilitas (WCAG)" subtitle="Analisis otomatis berbasis token kontras" />
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border p-4">
          <div className="mb-2 text-xs text-faint">WCAG AA (teks kecil 4.5:1)</div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            Gagal {gauge(a11y.wcagAA.critical)} &nbsp; Peringatan {gauge(a11y.wcagAA.warning)} &nbsp; Lolos {gauge(a11y.wcagAA.pass)}
          </div>
        </div>
        <div className="rounded-xl border border-border p-4">
          <div className="mb-2 text-xs text-faint">WCAG AAA (7:1)</div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            Gagal {gauge(a11y.wcagAAA.critical)} &nbsp; Peringatan {gauge(a11y.wcagAAA.warning)} &nbsp; Lolos {gauge(a11y.wcagAAA.pass)}
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {a11y.issues.map((iss, i) => (
          <div key={i} className="rounded-xl border border-border p-3">
            <div className="flex items-center gap-2">
              <span
                className={`rounded px-2 py-0.5 text-2xs font-bold uppercase ${
                  iss.severity === "critical"
                    ? "bg-danger text-canvas"
                    : iss.severity === "warning"
                      ? "bg-warning text-canvas"
                      : "bg-border-strong text-canvas"
                }`}
              >
                {iss.severity}
              </span>
              <span className="text-sm font-medium">{iss.kind}</span>
            </div>
            <p className="mt-1 text-sm">{iss.message}</p>
            {iss.recommendation && <p className="mt-1 text-xs text-muted">{iss.recommendation}</p>}
            {iss.evidence.length > 0 && (
              <code className="mt-1 block text-xs text-faint">{iss.evidence.join(" · ")}</code>
            )}
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-faint">{a11y.note}</p>
    </>
  );
}

function ExportPanel({ result }: { result: DesignModel }) {
  const [opts, setOpts] = useState<MdOptions>({});
  const files: Record<string, string> = useMemo(
    () => buildExports(result, opts).files,
    [result, opts],
  );
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(key: string) {
    try {
      await navigator.clipboard.writeText(files[key]);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // ignore
    }
  }

  function download(key: string) {
    const blob = new Blob([files[key]], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = key;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadZip() {
    const { name, data } = buildZip(result, opts);
    const bytes = new Uint8Array(data);
    const blob = new Blob([bytes], { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadPackZip() {
    const { name, data } = buildDesignPackZip(result);
    const bytes = new Uint8Array(data);
    const blob = new Blob([bytes], { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <MdControls opts={opts} onChange={setOpts} />
      <div className="mb-4 flex items-center justify-between">
        <SectionHeader title="Artefak design system" subtitle="Berdasarkan DesignModel, bukan output scraper mentah" />
        <div className="flex gap-2">
          <button
            onClick={downloadPackZip}
            className="rounded-lg bg-brand-500 px-4 py-2 text-xs font-semibold text-on-brand hover:bg-brand-600"
          >
            Download Design Pack (.zip)
          </button>
          <button
            onClick={downloadZip}
            className="rounded-lg bg-fg px-4 py-2 text-xs font-semibold text-canvas hover:bg-muted"
          >
            Download semua (.zip)
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {Object.entries(files).map(([key]) => (
          <div
            key={key}
            className="flex items-center justify-between rounded-xl border border-border px-4 py-2.5"
          >
            <code className="text-sm">{key}</code>
            <div className="flex gap-2">
              <button
                onClick={() => copy(key)}
                className="rounded-lg border border-border px-2.5 py-1 text-xs text-fg hover:border-border-strong"
              >
                {copied === key ? "Tersalin!" : "Salin"}
              </button>
              <button
                onClick={() => download(key)}
                className="rounded-lg bg-fg px-2.5 py-1 text-xs font-semibold text-canvas hover:bg-muted"
              >
                Download
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function SpecPanel({ result }: { result: DesignModel }) {
  const spec = useMemo(() => buildDesignSpecification(result), [result]);
  const [showCode, setShowCode] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <SectionHeader
          title="Design Specification"
          subtitle="Spesifikasi desain kanonik (nullable output downstream), bukan artifact scraper mentah"
        />
        <button
          onClick={() => setShowCode((s) => !s)}
          className="rounded-lg border border-border px-3 py-1 text-xs text-fg hover:border-border-strong"
        >
          {showCode ? "Lihat ringkasan" : "Lihat JSON"}
        </button>
      </div>

      {showCode ? (
        <pre className="max-h-[28rem] overflow-auto rounded-xl border border-border bg-canvas p-4 text-xs text-fg">
          {JSON.stringify(spec, null, 2)}
        </pre>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          <SpecBlock title="Sumber">
            <SpecKV k="URL" v={spec.source.url} />
            <SpecKV k="Judul" v={spec.source.title} />
            <SpecKV k="Halaman" v={String(spec.source.pages)} />
          </SpecBlock>
          <SpecBlock title="Visual Language">
            <SpecKV k="Warna primer" v={String(spec.visual_language.colors.primary.length)} />
            <SpecKV k="Warna netral" v={String(spec.visual_language.colors.neutral.length)} />
            <SpecKV k="Font family" v={spec.visual_language.typography.families.join(", ") || "-"} />
            <SpecKV k="Ukuran font" v={String(spec.visual_language.typography.sizes.length)} />
            <SpecKV k="Dark mode" v={spec.visual_language.darkMode.detected ? "Terdeteksi" : "Tidak terdeteksi"} />
          </SpecBlock>
          <SpecBlock title="Layout">
            <div className="flex flex-wrap gap-1">
              {spec.layout.containers.length ? (
                spec.layout.containers.map((c) => <Chip key={c}>{c}</Chip>)
              ) : (
                <span className="text-xs text-faint">Tidak ada kontainer terdeteksi</span>
              )}
            </div>
          </SpecBlock>
          <SpecBlock title="Komponen">
            <div className="flex flex-wrap gap-1">
              {spec.components.length ? (
                spec.components.slice(0, 20).map((c) => <Chip key={c.name}>{c.name}</Chip>)
              ) : (
                <span className="text-xs text-faint">Tidak ada komponen terdeteksi</span>
              )}
            </div>
          </SpecBlock>
          <SpecBlock title="Interaksi">
            <div className="flex flex-wrap gap-1">
              {spec.interactions.length ? (
                spec.interactions.map((i) => <Chip key={i.interaction}>{i.interaction}</Chip>)
              ) : (
                <span className="text-xs text-faint">Tidak ada interaksi terdeteksi</span>
              )}
            </div>
          </SpecBlock>
          <SpecBlock title="Aset">
            <SpecKV k="Total" v={String(spec.assets.length)} />
          </SpecBlock>
          <SpecBlock title="Accessibility (AA)">
            <SpecKV k="Kritis" v={String(spec.accessibility.wcagAA.critical)} />
            <SpecKV k="Peringatan" v={String(spec.accessibility.wcagAA.warning)} />
            <SpecKV k="Lolos" v={String(spec.accessibility.wcagAA.pass)} />
          </SpecBlock>
          <SpecBlock title="Implementation Hints">
            <ul className="flex flex-col gap-1">
              {spec.implementation_hints.slice(0, 8).map((h) => (
                <li key={h.code} className="text-xs text-muted">
                  <span
                    className={`mr-1.5 rounded px-1 py-0.5 text-2xs font-semibold ${
                      h.severity === "critical"
                        ? "bg-danger-bg text-danger"
                        : h.severity === "warning"
                          ? "bg-warning-bg text-warning"
                          : "bg-border-strong text-fg"
                    }`}
                  >
                    {h.severity}
                  </span>
                  {h.message}
                </li>
              ))}
            </ul>
          </SpecBlock>
        </div>
      )}
    </div>
  );
}

function ProjectPanel({ result }: { result: DesignModel }) {
  const readiness = useMemo(() => computeReadiness(result), [result]);
  const spec = useMemo(() => buildDesignSpecification(result), [result]);

  const badgeColor =
    readiness.score >= 80 ? "bg-success-bg text-success" : readiness.score >= 50 ? "bg-warning-bg text-warning" : "bg-danger-bg text-danger";

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader title="Proyek" subtitle="Informasi proyek desain & kesiapan struktur untuk implementasi (bukan Build-Pack readines)" />
      <div className="grid gap-3 md:grid-cols-2">
        <SpecBlock title="Sumber">
          <SpecKV k="Nama" v={result.source.title} />
          <SpecKV k="URL" v={result.source.url} />
          <SpecKV k="Mode scan" v={result.metadata.scanMode} />
          <SpecKV k="Dibuat" v={new Date(result.metadata.generatedAt).toLocaleString("id-ID")} />
        </SpecBlock>
        <SpecBlock title="Status spesifikasi">
          <SpecKV k="Schema" v={spec.schema} />
          <SpecKV k="Versi desain" v={spec.design_version} />
          <SpecKV k="Halaman" v={String(spec.source.pages)} />
          <SpecKV k="Komponen" v={String(spec.components.length)} />
        </SpecBlock>
      </div>

      <div className="rounded-xl border border-border p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Readiness</h3>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${badgeColor}`}>
            {readiness.score}/100
          </span>
        </div>
        <p className="mt-1 text-xs text-faint">{readiness.summary}</p>
        <div className="mt-4 space-y-2">
          {readiness.dimensions.map((d) => (
            <div key={d.key}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-fg">{d.label}</span>
                <span className="font-mono text-faint">{d.detail}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
                <div
                  className={`h-full ${
                    d.ratio >= 0.8 ? "bg-success" : d.ratio >= 0.4 ? "bg-warning" : "bg-danger"
                  }`}
                  style={{ width: `${Math.round(d.ratio * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SpecBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">{title}</h4>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function SpecKV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs text-faint">{k}</span>
      <span className="truncate font-mono text-xs text-fg">{v}</span>
    </div>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-md border border-border px-2 py-0.5 text-xs text-fg">{children}</span>
  );
}

function HistoryPanel({
  current,
  onLoad,
}: {
  current: DesignModel;
  onLoad: (m: DesignModel) => void;
}) {
  const [sessions, setSessions] = useState<ScanSession[]>(() => listSessions());
  const [msg, setMsg] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  function flash(text: string) {
    setMsg(text);
    setTimeout(() => setMsg(""), 2500);
  }

  function refresh() {
    setSessions(listSessions());
  }

  function handleSave() {
    const s = saveSession(current);
    flash(`Tersimpan: ${s.name}`);
    refresh();
  }

  function handleDelete(id: string) {
    deleteSession(id);
    refresh();
  }

  function handleRename(id: string) {
    renameSession(id, editingName.trim() || "untitled");
    setEditingId(null);
    refresh();
  }

  function handleLoad(id: string) {
    const s = loadSession(id);
    if (s) {
      onLoad(s.model);
      flash(`Dimuat: ${s.name}`);
    }
  }

  return (
    <>
      <SectionHeader
        title="Riwayat scan"
        subtitle="Scan tersimpan di browser, fondasi untuk melacak perubahan (drift)"
      />
      <div className="mb-3 flex flex-wrap gap-2">
        <button
          onClick={handleSave}
          className="rounded-lg bg-fg px-3 py-1.5 text-xs font-semibold text-canvas hover:bg-muted"
        >
          Simpan scan ini
        </button>
        {sessions.length > 0 && (
          <button
            onClick={() => {
              clearAllSessions();
              refresh();
              flash("Semua riwayat dihapus.");
            }}
            className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:border-border-strong"
          >
            Hapus semua
          </button>
        )}
      </div>
      {msg && <p className="mb-3 text-xs text-success">{msg}</p>}

      {sessions.length === 0 ? (
        <p className="text-sm text-faint">
          Belum ada scan tersimpan. Tekan {"“Simpan scan ini”"} untuk menyimpan hasil saat ini.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {sessions.map((s) => (
            <div key={s.id} className="rounded-xl border border-border px-4 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                {editingId === s.id ? (
                  <input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRename(s.id);
                    }}
                    autoFocus
                    className="w-48 rounded-md border border-border bg-canvas px-2 py-1 text-xs outline-none focus:border-border-strong"
                  />
                ) : (
                  <div>
                    <div className="text-sm font-medium">{s.name}</div>
                    <div className="text-xs text-faint">
                      {s.url} · {new Date(s.createdAt).toLocaleString("id-ID")}
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => handleLoad(s.id)}
                    className="rounded-lg bg-fg px-2.5 py-1 text-xs font-semibold text-canvas hover:bg-muted"
                  >
                    Muat
                  </button>
                  <button
                    onClick={() => {
                      setEditingId(s.id);
                      setEditingName(s.name);
                    }}
                    className="rounded-lg border border-border px-2.5 py-1 text-xs text-fg hover:border-border-strong"
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => handleDelete(s.id)}
                    className="rounded-lg border border-danger-border px-2.5 py-1 text-xs text-danger hover:border-danger-border"
                  >
                    Hapus
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function DriftPanel({
  current,
  onLoad,
}: {
  current: DesignModel;
  onLoad: (m: DesignModel) => void;
}) {
  const [snapshots, setSnapshots] = useState<ScanSession[]>(() => {
    const all = listSessions();
    return all
      .filter((s) => s.url === current.source.url)
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  });
  const [flash, setFlash] = useState("");

  const timeline = useMemo(() => {
    const entries: Array<{
      session: ScanSession;
      delta: DiffResult | null;
      prev: ScanSession | null;
    }> = [];
    for (let i = 0; i < snapshots.length; i++) {
      const cur = snapshots[i];
      const prev = i > 0 ? snapshots[i - 1] : null;
      entries.push({ session: cur, delta: diffModels(prev?.model, cur.model), prev });
    }
    return entries;
  }, [snapshots]);

  const totalDrift = useMemo(() => {
    let added = 0;
    let removed = 0;
    let changed = 0;
    for (const e of timeline) {
      if (!e.delta) continue;
      added += e.delta.summary.added;
      removed += e.delta.summary.removed;
      changed += e.delta.summary.changed;
    }
    return { added, removed, changed };
  }, [timeline]);

  function flashMsg(text: string) {
    setFlash(text);
    setTimeout(() => setFlash(""), 2500);
  }

  function handleSnapshot() {
    saveSession(current);
    const all = listSessions();
    setSnapshots(
      all
        .filter((s) => s.url === current.source.url)
        .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)),
    );
    flashMsg("Snapshot tersimpan. Drift dihitung otomatis.");
  }

  return (
    <>
      <SectionHeader
        title="Design Drift"
        subtitle="Lacak perubahan design system antar snapshot secara otomatis (berbasis riwayat scan)"
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          onClick={handleSnapshot}
          className="rounded-lg bg-fg px-3 py-1.5 text-xs font-semibold text-canvas hover:bg-muted"
        >
          Simpan snapshot drift
        </button>
        {timeline.length > 1 && (
          <span className="rounded-full bg-warning-bg px-3 py-1 text-xs text-warning">
            Total drift: +{totalDrift.added} / -{totalDrift.removed} / ~{totalDrift.changed}
          </span>
        )}
      </div>
      {flash && <p className="mb-3 text-xs text-success">{flash}</p>}

      {timeline.length === 0 ? (
        <p className="text-sm text-faint">
          Belum ada snapshot untuk URL ini. Simpan snapshot pertama untuk mulai melacak drift design system.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {[...timeline].reverse().map((e, idx) => (
            <div key={e.session.id} className="rounded-xl border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-medium">{e.session.name}</div>
                  <div className="text-xs text-faint">
                    {new Date(e.session.createdAt).toLocaleString("id-ID")}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {idx === 0 && (
                    <button
                      onClick={() => onLoad(e.session.model)}
                      className="rounded-lg border border-border px-2.5 py-1 text-xs text-fg hover:border-border-strong"
                    >
                      Muat
                    </button>
                  )}
                  {e.delta && e.prev && (
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        e.delta.summary.added + e.delta.summary.removed + e.delta.summary.changed === 0
                          ? "bg-success-bg text-success"
                          : "bg-warning-bg text-warning"
                      }`}
                    >
                      +{e.delta.summary.added} / -{e.delta.summary.removed} / ~{e.delta.summary.changed}
                    </span>
                  )}
                </div>
              </div>
              {e.delta && e.prev && e.delta.groups.some((g) => g.added.length + g.removed.length + g.changed.length > 0) && (
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                  {e.delta.groups
                    .filter((g) => g.added.length + g.removed.length + g.changed.length > 0)
                    .map((g) => (
                      <span key={g.category}>
                        <span className="text-fg">{g.category}</span>:{" "}
                        <span className="text-success">+{g.added.length}</span>{" "}
                        <span className="text-danger">-{g.removed.length}</span>{" "}
                        <span className="text-warning">~{g.changed.length}</span>
                      </span>
                    ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function AiPanel({
  result,
  config,
  onChange,
  onRecommend,
  onGoToPlayground,
}: {
  result: DesignModel;
  config: AiConfig | null;
  onChange: (c: AiConfig | null) => void;
  onRecommend?: (p: { colors?: Record<string, string>; radius?: Record<string, string> }) => void;
  onGoToPlayground?: () => void;
}) {
  const md = useMemo(() => buildDesignMd(result), [result]);
  const [contextSections, setContextSections] = useState<ModelContextSection[]>([
    "tokens",
    "health",
    "accessibility",
    "responsive",
    "components",
    "darkmode",
  ]);
  const modelContext = useMemo(
    () => buildModelContext(result, contextSections),
    [result, contextSections],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [output, setOutput] = useState("");
  const [copied, setCopied] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<Array<{ role: "user" | "ai"; text: string }>>([]);
  const [switchedNote, setSwitchedNote] = useState("");
  const [recommendation, setRecommendation] = useState<{
    changes: Array<{ type: string; key: string; value: string; reason: string }>;
  } | null>(null);
  const [recommendError, setRecommendError] = useState("");

  const CONTEXT_OPTIONS: Array<{ id: ModelContextSection; label: string }> = [
    { id: "tokens", label: "Token" },
    { id: "health", label: "Health" },
    { id: "accessibility", label: "A11y" },
    { id: "responsive", label: "Responsif" },
    { id: "components", label: "Komponen" },
    { id: "darkmode", label: "Dark" },
  ];

  function guard(): boolean {
    if (!config) {
      setError("Pasang API key AI dulu lewat tombol 'Atur AI' di atas.");
      return false;
    }
    setError("");
    return true;
  }

  function toggleSection(id: ModelContextSection) {
    setContextSections((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );
  }

  async function generate(mode: "readme" | "review") {
    if (!guard()) return;
    const cfg = config!;
    setBusy(true);
    setOutput("");
    setSwitchedNote("");
    const prompt =
      mode === "readme"
        ? `Berikut hasil ekstraksi design system dari ${result.source.url}:\n\n${md}\n\nBuatkan README.md ringkas (Bahasa Indonesia) yang menjelaskan design system ini: palet warna, tipografi, radius, dan panduan pemakaiannya. Format markdown.`
        : `Berikut hasil ekstraksi design system dari ${result.source.url}:\n\n${md}\n\nBuat tinjauan desain (Bahasa Indonesia): kekuatan, kelemahan, dan saran perbaikan. Ringkas.`;
    try {
      let acc = "";
      await streamAiWithAutoSwitch(cfg, prompt, (chunk) => {
        acc += chunk;
        setOutput(acc);
      }, undefined, (from, to) => setSwitchedNote(`Auto-switch: model ${from} → ${to} (rate limit).`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menghubungi AI.");
    } finally {
      setBusy(false);
    }
  }

  async function recommend() {
    if (!guard()) return;
    const cfg = config!;
    setBusy(true);
    setError("");
    setRecommendError("");
    setOutput("");
    setSwitchedNote("");
    const colorList = [...result.tokens.colors.primary, ...result.tokens.colors.neutral]
      .slice(0, 12)
      .map((c) => c.hex)
      .join(", ");
    const radiusList = result.tokens.radius.slice(0, 6).map((r) => r.raw).join(", ");
    const prompt =
      `Kamu adalah konsultan design system. Berdasarkan DesignModel berikut untuk ${result.source.url}:\n\n` +
      `Warna yang ada: ${colorList}\n` +
      `Radius yang ada: ${radiusList}\n` +
      `\nBuat rekomendasi perbaikan design system. Yang boleh diubah: warna (hex) dan radius (nilai radius CSS, mis. '16px').\n` +
      `Balas HANYA JSON array, tanpa teks lain atau markdown code fence, format:\n` +
      `[{"type":"color"|"radius","key":"<nilai asli persis yang mau diubah>","value":"<nilai baru>","reason":"<singkat>"}]\n` +
      `Pastikan 'key' adalah salah satu nilai persis dari daftar di atas. Maksimal 6 item.`;
    try {
      let acc = "";
      await streamAiWithAutoSwitch(cfg, prompt, (chunk) => {
        acc += chunk;
        setOutput(acc);
      }, undefined, (from, to) => setSwitchedNote(`Auto-switch: model ${from} → ${to} (rate limit).`));
      const parsed = JSON.parse(acc.replace(/```json|```/g, "").trim()) as Array<{
        type?: string;
        key?: string;
        value?: string;
        reason?: string;
      }>;
      if (!Array.isArray(parsed)) throw new Error("Respons AI bukan array.");
      const changes = parsed
        .filter((c) => c.type && c.key && c.value)
        .map((c) => ({ type: c.type!, key: c.key!, value: c.value!, reason: c.reason ?? "" }));
      setRecommendation({ changes });
    } catch (e) {
      setRecommendError(e instanceof Error ? e.message : "Gagal memproses rekomendasi AI.");
    } finally {
      setBusy(false);
    }
  }

  function applyRecommendation() {
    if (!recommendation) return;
    const colors: Record<string, string> = {};
    const radius: Record<string, string> = {};
    for (const ch of recommendation.changes) {
      if (ch.type === "color") colors[ch.key] = ch.value;
      if (ch.type === "radius") radius[ch.key] = ch.value;
    }
    onRecommend?.({ colors, radius });
    onGoToPlayground?.();
  }

  async function sendChat() {
    const text = chatInput.trim();
    if (!text || busy) return;
    if (!guard()) return;
    const cfg = config!;
    setChatInput("");
    setChatHistory((h) => [...h, { role: "user", text }]);
    setBusy(true);
    setSwitchedNote("");
    const prompt = `Konteks DesignModel Vinyasa untuk ${result.source.url}:\n${modelContext}\n\nPertanyaan: ${text}`;
    try {
      let acc = "";
      const msgId = chatHistory.length;
      setChatHistory((h) => [...h, { role: "ai", text: "" }]);
      await streamAiWithAutoSwitch(cfg, prompt, (chunk) => {
        acc += chunk;
        setChatHistory((h) => h.map((c, i) => (i === msgId + 1 ? { ...c, text: acc } : c)));
      }, undefined, (from, to) => setSwitchedNote(`Auto-switch: model ${from} → ${to} (rate limit).`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menghubungi AI.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => generate("readme")}
          disabled={busy}
          className="rounded-lg bg-fg px-3 py-1.5 text-xs font-semibold text-canvas hover:bg-muted disabled:opacity-60"
        >
          {busy ? "Menghasilkan…" : "Generate README dengan AI"}
        </button>
        <button
          onClick={() => generate("review")}
          disabled={busy}
          className="rounded-lg border border-border px-3 py-1.5 text-xs text-fg hover:border-border-strong disabled:opacity-60"
        >
          Tinjau desain
        </button>
        <button
          onClick={recommend}
          disabled={busy}
          className="rounded-lg border border-success-border px-3 py-1.5 text-xs text-success hover:border-success disabled:opacity-60"
        >
          {busy ? "Menyusun…" : "Rekomendasi perbaikan"}
        </button>
        <AiSettingsButton config={config} onChange={onChange} />
      </div>

      <div className="mb-4">
        <div className="mb-1.5 text-xs uppercase tracking-wide text-faint">
          Konteks AI yang disertakan
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CONTEXT_OPTIONS.map((o) => {
            const on = contextSections.includes(o.id);
            return (
              <button
                key={o.id}
                onClick={() => toggleSection(o.id)}
                className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                  on
                    ? "border-fg bg-fg text-canvas"
                    : "border-border text-faint hover:border-border-strong"
                }`}
              >
                {on ? "✓ " : ""}
                {o.label}
              </button>
            );
          })}
        </div>
      </div>

      {switchedNote && <p className="mb-3 text-xs text-warning">{switchedNote}</p>}
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}

      {recommendError && <p className="mb-3 text-sm text-danger">{recommendError}</p>}

      {recommendation && recommendation.changes.length > 0 && (
        <div className="mb-5 rounded-xl border border-success-border bg-success-bg p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-semibold text-success">Rekomendasi perbaikan</div>
            <button
              onClick={applyRecommendation}
              className="rounded-lg bg-success px-3 py-1.5 text-xs font-semibold text-canvas hover:bg-brand-600"
            >
              Terapkan ke Playground →
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {recommendation.changes.map((ch, i) => (
              <div key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 rounded-lg bg-surface-2 px-3 py-2 text-xs">
                <code className="text-muted">{ch.key}</code>
                <span className="text-faint">→</span>
                <code className="text-success">{ch.value}</code>
                <span className="text-xs text-faint">({ch.type})</span>
                {ch.reason && <span className="w-full text-xs text-muted">{ch.reason}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-5 rounded-xl border border-border bg-canvas p-3">
        <div className="mb-2 text-xs uppercase tracking-wide text-faint">
          AI Chat, grounded di DesignModel ({result.source.title})
        </div>
        <div className="mb-2 flex max-h-64 flex-col gap-2 overflow-auto">
          {chatHistory.length === 0 && (
            <p className="text-xs text-faint">
              Contoh: {"“Kenapa desain ini terasa tidak konsisten?”, “Cari outlier spacing.”, “Apa yang salah di mobile?”, “Generate DESIGN.md.”"}
            </p>
          )}
          {chatHistory.map((c, i) => (
            <div key={i} className={`text-xs leading-5 ${c.role === "ai" ? "text-fg" : "text-fg"}`}>
              <span className="mr-1 font-semibold">{c.role === "ai" ? "AI" : "Kamu"}:</span>
              <span className="whitespace-pre-wrap">{c.text || (busy && i === chatHistory.length - 1 ? "…" : "")}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") sendChat();
            }}
            placeholder="Tanya tentang design system ini…"
            className="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none placeholder:text-faint focus:border-border-strong"
          />
          <button
            onClick={sendChat}
            disabled={busy || !chatInput.trim()}
            className="rounded-lg bg-fg px-4 py-2 text-xs font-semibold text-canvas hover:bg-muted disabled:opacity-50"
          >
            {busy ? "Mengetik…" : "Kirim"}
          </button>
        </div>
      </div>

      {output && (
        <>
          <div className="mb-2 flex justify-end">
            <button
              onClick={copy}
              className="rounded-lg border border-border px-2.5 py-1 text-xs text-fg hover:border-border-strong"
            >
              {copied ? "Tersalin!" : "Salin"}
            </button>
          </div>
          <pre className="max-h-[40vh] overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-canvas p-4 text-xs leading-6 text-fg">
            {output}
          </pre>
        </>
      )}
    </>
  );
}

export function FullReport({
  response,
  initialAiConfig,
  onAiConfigChange,
}: {
  response: ExtractResponse;
  initialAiConfig?: AiConfig | null;
  onAiConfigChange?: (c: AiConfig | null) => void;
}) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("overview");
  const [activeIndex, setActiveIndex] = useState(0);
  const [aiConfig, setAiConfig] = useState<AiConfig | null>(() =>
    initialAiConfig !== undefined ? initialAiConfig : loadConfig(),
  );
  const [loaded, setLoaded] = useState<DesignModel | null>(null);
  const [aiPrefill, setAiPrefill] = useState<{ colors?: Record<string, string>; radius?: Record<string, string> } | null>(null);
  const [prefillKey, setPrefillKey] = useState(0);

  function handleRecommend(p: { colors?: Record<string, string>; radius?: Record<string, string> }) {
    setAiPrefill(p);
    setPrefillKey((k) => k + 1);
  }

  function syncAiConfig(c: AiConfig | null) {
    setAiConfig(c);
    onAiConfigChange?.(c);
  }
  const results = response.results;
  const baseResult = results[activeIndex];
  const result = loaded ?? baseResult;

  if (!result) return null;

  const tabGroups: Array<{ label: string; items: Array<{ id: Tab; label: string }> }> = [
    {
      label: t("nav.overall"),
      items: [
        { id: "overview", label: t("nav.overview") },
        { id: "pages", label: t("nav.pages") },
      ],
    },
    {
      label: t("nav.tokens"),
      items: [
        { id: "colors", label: t("tab.colors") },
        { id: "typography", label: t("tab.typography") },
        { id: "spacing", label: t("tab.spacing") },
        { id: "shapes", label: t("tab.shapes") },
        { id: "effects", label: t("tab.effects") },
      ],
    },
    {
      label: t("nav.components"),
      items: [{ id: "components", label: t("tab.components") }],
    },
    {
      label: t("nav.responsive"),
      items: [
        { id: "responsive", label: t("tab.responsive") },
        { id: "darkmode", label: t("tab.darkmode") },
      ],
    },
    {
      label: t("nav.analysis"),
      items: [
        { id: "health", label: t("tab.health") },
        { id: "accessibility", label: t("tab.accessibility") },
      ],
    },
    {
      label: t("nav.ai"),
      items: [{ id: "ai", label: t("tab.ai") }],
    },
    {
      label: t("nav.edit"),
      items: [{ id: "playground", label: t("tab.playground") }],
    },
    {
      label: t("nav.compare"),
      items: [
        { id: "diff", label: t("tab.diff") },
        { id: "drift", label: t("nav.drift") },
        { id: "history", label: t("tab.history") },
      ],
    },
    {
      label: t("nav.export"),
      items: [
        { id: "export", label: t("tab.export") },
        { id: "audit", label: t("tab.audit") },
        { id: "md", label: t("tab.md") },
        { id: "preview", label: t("tab.preview") },
      ],
    },
    {
      label: "Proyek",
      items: [
        { id: "project", label: "Proyek & Readiness" },
        { id: "spec", label: "Design Spec" },
      ],
    },
    {
      label: "Integrasi",
      items: [{ id: "nexora", label: "Nexora" }],
    },
  ];

  const activeTabLabel =
    tabGroups.flatMap((g) => g.items).find((i) => i.id === tab)?.label ?? "";
  const scores = result.pages[0]?.scores;
  const scoreCells: Array<[string, number]> = [
    ["Warna", scores?.color ?? 0],
    ["Tipografi", scores?.typography ?? 0],
    ["Radius", scores?.radius ?? 0],
    ["Keseluruhan", scores?.overall ?? 0],
  ];

  return (
    <section className="flex flex-col gap-4">
      {/* ------------------------------------------------- report identity */}
      <div className="card p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="truncate text-2xl font-bold tracking-tight text-fg">
              {result.source.title}
            </h2>
            <a
              href={result.source.url}
              target="_blank"
              rel="noreferrer"
              className="mt-0.5 inline-block max-w-full truncate font-mono text-xs text-faint underline-offset-2 transition-colors hover:text-brand-500 hover:underline"
            >
              {result.source.url}
            </a>
          </div>
          {results.length > 1 && (
            <div
              className="flex shrink-0 flex-wrap gap-1"
              role="group"
              aria-label="Pilih hasil scan"
            >
              {results.map((r, i) => (
                <button
                  key={r.source.url}
                  onClick={() => setActiveIndex(i)}
                  aria-pressed={i === activeIndex}
                  className="chip"
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {scoreCells.map(([label, value]) => (
            <div key={label} className="card-quiet p-3">
              <div className="text-xs text-faint">{label}</div>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-xl font-extrabold tabular-nums text-fg">{value}</span>
                <ScoreBar value={value} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ------------------------------------------- navigation + panel */}
      <div className="grid gap-4 lg:grid-cols-[188px_minmax(0,1fr)] lg:items-start">
        {/* Under lg the 22 sections collapse into a grouped picker. */}
        <div className="lg:hidden">
          <label htmlFor="report-section" className="label mb-1.5">
            Bagian laporan
          </label>
          <select
            id="report-section"
            value={tab}
            onChange={(e) => setTab(e.target.value as Tab)}
            className="field"
          >
            {tabGroups.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <nav
          aria-label="Bagian laporan"
          className="hidden lg:sticky lg:top-[72px] lg:block lg:max-h-[calc(100vh-88px)] lg:overflow-y-auto lg:pr-1"
        >
          <div className="flex flex-col gap-4">
            {tabGroups.map((g) => (
              <div key={g.label}>
                <div className="eyebrow mb-1.5 px-2">{g.label}</div>
                <ul className="flex flex-col gap-0.5">
                  {g.items.map((item) => {
                    const active = tab === item.id;
                    return (
                      <li key={item.id}>
                        <button
                          onClick={() => setTab(item.id)}
                          aria-current={active ? "page" : undefined}
                          className={`w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                            active
                              ? "bg-brand-500 font-semibold text-on-brand"
                              : "text-muted hover:bg-surface-2 hover:text-fg"
                          }`}
                        >
                          {item.label}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        <div className="card min-w-0 p-5">
          <h3 className="sr-only">{activeTabLabel}</h3>
          <div key={tab} className="animate-fade">
        {tab === "overview" && (
          <OverviewPanel result={result} onVoice={() => setTab("components")} />
        )}
        {tab === "pages" && <PagesPanel result={result} />}
        {tab === "colors" && <ColorsPanel result={result} />}
        {tab === "typography" && <TypographyPanel result={result} />}
        {tab === "spacing" && <SpacingPanel result={result} />}
        {tab === "shapes" && <ShapesPanel result={result} />}
        {tab === "effects" && <EffectsPanel result={result} />}
        {tab === "components" && <ComponentsPanel result={result} />}
        {tab === "responsive" && <ResponsivePanel result={result} />}
        {tab === "darkmode" && <DarkModePanel result={result} />}
        {tab === "playground" && (
          <PlaygroundPanel key={prefillKey} result={result} prefill={aiPrefill} />
        )}
        {tab === "diff" && <DiffPanel result={result} />}
        {tab === "history" && <HistoryPanel current={result} onLoad={setLoaded} />}
        {tab === "drift" && <DriftPanel current={result} onLoad={setLoaded} />}
        {tab === "health" && <HealthPanel result={result} />}
        {tab === "accessibility" && <A11yPanel result={result} />}
        {tab === "export" && <ExportPanel result={result} />}
        {tab === "audit" && <AuditPanel result={result} />}
        {tab === "md" && <MdPanel result={result} />}
        {tab === "preview" && <PreviewPanel result={result} />}
        {tab === "project" && <ProjectPanel result={result} />}
        {tab === "spec" && <SpecPanel result={result} />}
        {tab === "nexora" && <NexoraPanel result={result} />}
        {tab === "ai" && (
          <AiPanel
            result={result}
            config={aiConfig}
            onChange={syncAiConfig}
            onRecommend={handleRecommend}
            onGoToPlayground={() => setTab("playground")}
          />
        )}
          </div>
        </div>
      </div>
    </section>
  );
}
