"use client";

import { useMemo, useState } from "react";
import type { ExtractResponse, DesignModel, ColorToken } from "@/lib/model";
import { buildDesignMd, buildDownloadFilename, type MdOptions, type MdLang } from "@/lib/design-md";
import { buildPreviewHtml } from "@/lib/preview";
import { buildExports, buildZip } from "@/lib/export";
import { streamAiWithAutoSwitch, loadConfig, buildModelContext } from "@/lib/ai";
import type { ModelContextSection } from "@/lib/ai";
import { AiSettingsButton } from "@/components/AiSettings";
import type { AiConfig } from "@/lib/ai";
import type { HealthReport, HealthCategory } from "@/lib/health";
import type { A11yReport } from "@/lib/accessibility";
import type { ResponsiveReport } from "@/lib/responsive";
import { diffModels, type DiffResult } from "@/lib/diff";
import { playgroundFromModel, applyPlayground } from "@/lib/playground";
import { listSessions, saveSession, deleteSession, renameSession, loadSession, clearAllSessions } from "@/lib/sessions";
import type { ScanSession } from "@/lib/sessions";
import { useI18n } from "@/lib/i18n";
import type { DarkModeReport } from "@/lib/darkmode";

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
  | "ai";

function fmtBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

function ScoreBar({ value }: { value: number }) {
  const color =
    value >= 80 ? "bg-emerald-500" : value >= 50 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-zinc-800">
      <div className={`h-full ${color}`} style={{ width: `${value}%` }} />
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      {subtitle && <p className="text-sm text-zinc-500">{subtitle}</p>}
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
            <div className="font-mono text-[11px] text-muted">{t.hex}</div>
            <div className="text-[11px] text-faint">{t.usage}%</div>
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
          <div className="text-[11px] text-faint">{token.count} pemakaian</div>
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
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-faint">Sumber</div>
          <div className="flex flex-wrap gap-1">
            {token.sources.slice(0, 8).map((s) => (
              <code key={s} className="rounded bg-surface px-1.5 py-0.5 font-mono text-[10px] text-muted">
                {s}
              </code>
            ))}
          </div>
        </div>
      )}

      {token.selectors.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-faint">Selector</div>
          <div className="flex flex-wrap gap-1">
            {token.selectors.slice(0, 12).map((sel) => (
              <code key={sel} className="rounded bg-surface px-1.5 py-0.5 font-mono text-[10px] text-muted">
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
      <SectionHeader title="Warna primer" subtitle="Token warna paling sering dipakai — klik untuk detail & sumber" />
      <div className="grid gap-4 lg:grid-cols-[1fr,320px]">
        <div>
          <ColorGrid tokens={colors.primary} onSelect={setSelected} selectedHex={selected?.hex ?? null} />
          <SectionHeader title="Warna netral" subtitle="Hitam, putih, abu-abu yang dipakai" />
          <ColorGrid tokens={colors.neutral} onSelect={setSelected} selectedHex={selected?.hex ?? null} />
        </div>
        <div className="lg:sticky lg:top-4">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-faint">
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
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs"
          >
            {f.raw}
            <span className="ml-2 text-zinc-500">{f.usage}%</span>
          </code>
        ))}
      </div>

      <SectionHeader title="Skala ukuran font" />
      <div className="overflow-hidden rounded-xl border border-zinc-800">
        {fonts.sizes.map((s, i) => (
          <div
            key={s.px}
            className={`flex items-center justify-between px-4 py-2 ${i % 2 ? "bg-zinc-900/40" : ""}`}
          >
            <span className="font-mono text-sm">{s.raw}</span>
            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-500">{s.px}px</span>
              <span className="w-10 text-right text-xs text-zinc-500">{s.usage}%</span>
            </div>
          </div>
        ))}
      </div>

      {fonts.weights.length > 0 && (
        <>
          <SectionHeader title="Berat font" />
          <div className="flex flex-wrap gap-2">
            {fonts.weights.map((w) => (
              <span
                key={w.value}
                className="rounded-full border border-zinc-800 px-3 py-1 text-xs"
                style={{ fontWeight: w.value }}
              >
                {w.value} Â· {w.usage}%
              </span>
            ))}
          </div>
        </>
      )}

      <SectionHeader title="Gaya teks yang umum dipakai" />
      <div className="overflow-hidden rounded-xl border border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-900 text-xs text-zinc-500">
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
              <tr key={i} className="border-t border-zinc-800">
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
                <td className="max-w-[200px] truncate px-4 py-3 font-mono text-[11px] text-zinc-500">
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
      <SectionHeader title="Spacing" subtitle="Margin, padding, dan gap — diurutkan berdasarkan pemakaian" />
      {spacing.length === 0 ? (
        <p className="text-sm text-zinc-500">Tidak terdeteksi.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-800">
          {spacing.map((s, i) => (
            <div
              key={s.raw}
              className={`flex items-center justify-between px-4 py-2 ${i % 2 ? "bg-zinc-900/40" : ""}`}
            >
              <span className="font-mono text-sm">{s.raw}</span>
              <div className="flex items-center gap-3">
                {s.px !== null && <span className="text-xs text-zinc-500">{s.px}px</span>}
                <span className="w-10 text-right text-xs text-zinc-500">{s.usage}%</span>
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
        <p className="text-sm text-zinc-500">Tidak terdeteksi.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {radius.map((r) => (
            <div key={r.raw} className="rounded-xl border border-zinc-800 p-3 text-center">
              <div className="mx-auto h-14 w-14 bg-zinc-700" style={{ borderRadius: r.raw }} />
              <div className="mt-2 font-mono text-xs">{r.raw}</div>
              <div className="text-[11px] text-zinc-500">{r.usage}%</div>
            </div>
          ))}
        </div>
      )}

      {borders.length > 0 && (
        <>
          <SectionHeader title="Borders" />
          <div className="flex flex-wrap gap-2">
            {borders.map((b) => (
              <code key={b.raw} className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs">
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
            {breakpoints.map((b) => (
              <span
                key={`${b.feature}-${b.raw}`}
                className="rounded-full border border-zinc-800 px-3 py-1 text-xs"
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
              <code key={s.raw} className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs">
                {s.raw.slice(0, 60)}
              </code>
            ))}
          </div>
        </>
      )}
      {gradients.length > 0 && (
        <>
          <SectionHeader title="Gradients" />
          <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 p-3">
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
              <span key={d.raw} className="rounded-full border border-zinc-800 px-3 py-1 text-xs">
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
              <code key={e.raw} className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs">
                {e.raw}
              </code>
            ))}
          </div>
        </>
      )}
      {shadows.length === 0 &&
        gradients.length === 0 &&
        durations.length === 0 &&
        easings.length === 0 && <p className="text-sm text-zinc-500">Tidak ada efek yang terdeteksi.</p>}
    </>
  );
}

function AuditPanel({ result }: { result: DesignModel }) {
  const sources = result.pages[0]?.sources ?? [];
  return (
    <>
      <SectionHeader title="Sumber CSS" subtitle="Setiap stylesheet yang dibaca beserta skor akurasi" />
      {sources.length === 0 ? (
        <p className="text-sm text-zinc-500">Tidak ada sumber CSS yang tercatat.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-900 text-xs text-zinc-500">
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
                <tr key={i} className="border-t border-zinc-800">
                  <td className="max-w-[220px] truncate px-4 py-2.5 font-mono text-[11px] text-zinc-400">
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
    <div className="mb-4 grid gap-3 rounded-xl border border-zinc-800 p-4 md:grid-cols-2">
      <div>
        <div className="mb-1.5 text-[11px] uppercase tracking-wide text-zinc-500">Bahasa</div>
        <div className="inline-flex rounded-lg border border-zinc-700 p-0.5">
          {(["id", "en"] as MdLang[]).map((l) => (
            <button
              key={l}
              onClick={() => onChange({ ...opts, lang: l })}
              className={`rounded-md px-3 py-1 text-xs transition-colors ${
                (opts.lang ?? "id") === l ? "bg-zinc-100 text-zinc-900" : "text-zinc-400"
              }`}
            >
              {l === "id" ? "Indonesia" : "English"}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-1.5 text-[11px] uppercase tracking-wide text-zinc-500">
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
                    ? "border-zinc-400 bg-zinc-700 text-white"
                    : "border-zinc-700 text-zinc-500 hover:border-zinc-500"
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
          className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-white"
        >
          {copied ? "Tersalin!" : "Salin"}
        </button>
        <button
          onClick={download}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-500"
        >
          Download {filename}
        </button>
      </div>
      <pre className="max-h-[60vh] overflow-auto rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-xs leading-6 text-zinc-300">
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
      className="h-[70vh] w-full rounded-xl border border-zinc-800 bg-white"
    />
  );
}

function ComponentsPanel({ result }: { result: DesignModel }) {
  const components = result.components;
  if (!components || components.length === 0) {
    return <p className="text-sm text-zinc-500">Tidak ada pola komponen yang terdeteksi.</p>;
  }
  return (
    <>
      <SectionHeader title="Pola komponen" subtitle="Heuristik berbasis selector — bukan kepastian" />
      <div className="grid gap-3 md:grid-cols-2">
        {components.map((c) => (
          <div key={c.name} className="rounded-xl border border-zinc-800 p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">{c.name}</div>
              <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-400">
                {c.confidence}% · x{c.count}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {c.selectors.slice(0, 5).map((sel) => (
                <code key={sel} className="rounded bg-zinc-800 px-1.5 py-0.5 text-[11px] text-zinc-400">
                  {sel}
                </code>
              ))}
            </div>
            {Object.keys(c.properties).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-zinc-500">
                {Object.entries(c.properties)
                  .slice(0, 4)
                  .map(([prop, vals]) => (
                    <span key={prop}>
                      {prop}: {vals.slice(0, 3).join(", ")}
                    </span>
                  ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

function HealthBar({ value }: { value: number }) {
  const color = value >= 85 ? "bg-emerald-500" : value >= 65 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-32 overflow-hidden rounded-full bg-zinc-800">
        <div className={`h-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="w-8 text-right text-sm font-bold">{value}</span>
    </div>
  );
}

function HealthCategoryCard({ cat }: { cat: HealthCategory }) {
  return (
    <div className="rounded-xl border border-zinc-800 p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-medium">{cat.name}</div>
        <HealthBar value={cat.score} />
      </div>
      <p className="text-xs text-zinc-500">{cat.explanation}</p>
      {cat.dominantValues.length > 0 && (
        <div className="mt-2">
          <div className="text-[11px] text-zinc-500">Skala dominan: {cat.dominantValues.join(" / ")}</div>
        </div>
      )}
      {cat.outliers.length > 0 && (
        <div className="mt-1 text-[11px]">
          <span className="text-amber-400">Outlier: {cat.outliers.join(", ")}</span>
        </div>
      )}
      {cat.issues.map((iss, i) => (
        <div key={i} className="mt-2 rounded-lg border border-red-900/30 bg-red-950/20 p-2 text-[11px] text-red-300">
          <div className="font-semibold capitalize">{iss.severity}</div>
          <div>{iss.message}</div>
          {iss.recommendation && <div className="mt-1 text-zinc-400">{iss.recommendation}</div>}
        </div>
      ))}
    </div>
  );
}

function ResponsivePanel({ result }: { result: DesignModel }) {
  const r = result.responsive as ResponsiveReport | null;
  if (!r) return <p className="text-sm text-zinc-500">Belum dihitung.</p>;
  const tiers = [
    ["Mobile", r.mobile],
    ["Tablet", r.tablet],
    ["Desktop", r.desktop],
  ] as Array<[string, number]>;
  return (
    <>
      <div className="mb-4 grid grid-cols-3 gap-3">
        {tiers.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-zinc-800 p-3 text-center">
            <div className="text-xs text-zinc-500">{label}</div>
            <div className="mt-1 text-lg font-bold">{value}</div>
            <ScoreBar value={value} />
          </div>
        ))}
      </div>
      {r.breakpoints.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2 text-xs">
          {r.breakpoints.map((b) => (
            <span key={`${b.feature}-${b.value}`} className="rounded-full border border-zinc-800 px-2.5 py-1">
              {b.feature}: {b.value} {b.px !== null && <span className="text-zinc-500">({b.px}px)</span>}
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-2">
        {r.issues.map((iss, i) => (
          <div key={i} className="rounded-xl border border-zinc-800 p-3">
            <div className="flex items-center gap-2">
              <span
                className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                  iss.severity === "warning" ? "bg-amber-500 text-black" : "bg-zinc-600 text-white"
                }`}
              >
                {iss.severity}
              </span>
              <span className="text-sm font-medium">{iss.kind}</span>
            </div>
            <p className="mt-1 text-sm">{iss.message}</p>
            {iss.recommendation && <p className="mt-1 text-xs text-zinc-400">{iss.recommendation}</p>}
            {iss.evidence.length > 0 && (
              <code className="mt-1 block text-[11px] text-zinc-500">{iss.evidence.join(" · ")}</code>
            )}
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-zinc-600">{r.note}</p>
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
        subtitle="Ubah token (layer modifikasi) — data asli yang diekstrak tidak disentuh"
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          onClick={reset}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-500"
        >
          Reset
        </button>
        <button
          onClick={copyTokens}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-500"
        >
          {copied ? "Tersalin!" : "Salin modifikasi (JSON)"}
        </button>
        {changedCount > 0 && (
          <span className="rounded-full bg-amber-950 px-2.5 py-1 text-xs text-amber-300">
            {changedCount} token diubah
          </span>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <div className="mb-2 text-xs text-zinc-500">Edit warna</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Object.entries(colors).map(([orig, val]) => (
              <label key={orig} className="rounded-xl border border-zinc-800 p-2">
                <input
                  type="color"
                  value={val}
                  onChange={(e) => setColors((c) => ({ ...c, [orig]: e.target.value }))}
                  className="h-9 w-full cursor-pointer rounded-md border-0 bg-transparent"
                />
                <div className="mt-1 truncate font-mono text-[10px] text-zinc-500">{orig}</div>
                <div className="truncate font-mono text-[10px] text-zinc-400">{val}</div>
              </label>
            ))}
          </div>

          <div className="mt-4 mb-2 text-xs text-zinc-500">Edit radius</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Object.entries(radius).map(([orig, val]) => (
              <label key={orig} className="rounded-xl border border-zinc-800 p-2">
                <input
                  type="text"
                  value={val}
                  onChange={(e) => setRadius((r) => ({ ...r, [orig]: e.target.value }))}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 font-mono text-xs outline-none focus:border-zinc-500"
                />
                <div className="mt-1 truncate font-mono text-[10px] text-zinc-500">{orig}</div>
              </label>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs text-zinc-500">Preview modifikasi</div>
          <PreviewPanel result={modified} />
        </div>
      </div>
    </>
  );
}

function DarkModePanel({ result }: { result: DesignModel }) {
  const d = result.darkMode as DarkModeReport | null;
  if (!d) return <p className="text-sm text-zinc-500">Belum dianalisis.</p>;
  return (
    <>
      <div
        className={`mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${
          d.detected
            ? "border-emerald-800 bg-emerald-950/40 text-emerald-300"
            : "border-zinc-700 text-zinc-400"
        }`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${d.detected ? "bg-emerald-400" : "bg-zinc-600"}`} />
        {d.detected ? "Dark mode terdeteksi" : "Dark mode tidak terdeteksi"}
      </div>
      <div className="flex flex-col gap-2 text-sm">
        <div>Media query <code>prefers-color-scheme</code>: {d.prefersColorScheme ? "ada" : "tidak ada"}</div>
        <div>Class/tema dark: {d.mediaQuery ? "ada" : "tidak ada"}</div>
        {d.themeVariables.length > 0 && (
          <div>
            <div className="mb-1 text-xs text-zinc-500">Variabel tema:</div>
            <div className="flex flex-wrap gap-1">
              {d.themeVariables.slice(0, 10).map((v) => (
                <code key={v} className="rounded bg-zinc-800 px-1.5 py-0.5 text-[11px]">
                  {v}
                </code>
              ))}
            </div>
          </div>
        )}
      </div>
      <p className="mt-3 text-[11px] text-zinc-600">{d.note}</p>
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
          className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-white"
        >
          Simpan scan ini sebagai baseline
        </button>
        {baseline && (
          <button
            onClick={clearBaseline}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:border-zinc-500"
          >
            Hapus baseline
          </button>
        )}
      </div>
      {savedMsg && <p className="mb-3 text-xs text-emerald-400">{savedMsg}</p>}

      {baseline ? (
        diff ? (
          <>
            <div className="mb-3 flex flex-wrap gap-2 text-xs text-zinc-500">
              <span className="rounded-full border border-zinc-700 px-2.5 py-1">Baseline: {diff.a}</span>
              <span className="rounded-full border border-zinc-700 px-2.5 py-1">Sekarang: {diff.b}</span>
            </div>
            <div className="mb-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-emerald-950 px-2.5 py-1 text-emerald-300">+{diff.summary.added} ditambah</span>
              <span className="rounded-full bg-red-950 px-2.5 py-1 text-red-300">-{diff.summary.removed} dihapus</span>
              <span className="rounded-full bg-amber-950 px-2.5 py-1 text-amber-300">~{diff.summary.changed} berubah</span>
            </div>
            <div className="flex flex-col gap-3">
              {diff.groups.map((g) => {
                const isEmpty = g.added.length === 0 && g.removed.length === 0 && g.changed.length === 0;
                if (isEmpty) return null;
                return (
                  <div key={g.category} className="rounded-xl border border-zinc-800 p-4">
                    <div className="mb-2 text-sm font-semibold capitalize">{g.category}</div>
                    {g.added.length > 0 && (
                      <div className="mb-1 text-xs text-emerald-400">
                        {g.added.map((a) => `${a.label}: ${a.value}`).join(" · ")}
                      </div>
                    )}
                    {g.removed.length > 0 && (
                      <div className="mb-1 text-xs text-red-400">
                        {g.removed.map((a) => `${a.label}: ${a.value}`).join(" · ")}
                      </div>
                    )}
                    {g.changed.length > 0 && (
                      <div className="text-xs text-amber-400">
                        {g.changed.map((c) => `${c.label}: ${c.before} → ${c.after}`).join(" · ")}
                      </div>
                    )}
                  </div>
                );
              })}
              {diff.summary.added + diff.summary.removed + diff.summary.changed === 0 && (
                <p className="text-sm text-zinc-500">Tidak ada perbedaan yang terdeteksi.</p>
              )}
            </div>
          </>
        ) : (
          <p className="text-sm text-zinc-500">Belum ada baseline.</p>
        )
      ) : (
        <p className="text-sm text-zinc-500">
          Belum ada baseline. Jalankan scan, lalu simpan sebagai baseline untuk membandingkan perubahan design system.
        </p>
      )}
    </>
  );
}

function ratingColor(v: number): { text: string; bg: string } {
  if (v >= 80) return { text: "text-success", bg: "bg-emerald-950" };
  if (v >= 60) return { text: "text-warning", bg: "bg-amber-950" };
  return { text: "text-danger", bg: "bg-red-950" };
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
      {note && <div className="mt-0.5 text-[11px] text-faint">{note}</div>}
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
                <span className="ml-1.5 rounded bg-canvas px-1.5 py-0.5 text-[11px] text-faint">
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
                    ? "border-red-900/50 bg-red-950/30 text-danger"
                    : iss.severity === "warning"
                      ? "border-amber-900/40 bg-amber-950/20 text-warning"
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
          <p className="mt-2 text-[11px] text-faint">
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
                <span className="shrink-0 text-[10px] text-success">ok</span>
              ) : (
                <span className="shrink-0 text-[10px] text-danger">error</span>
              )}
            </div>
            <div className="truncate font-mono text-[11px] text-faint">{p.url}</div>
            <div className="mt-0.5 text-[11px] text-muted">{summary(p.scores)}</div>
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
              <span className="rounded-md bg-red-950 px-2 py-1 text-xs text-danger">
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
                  <div className="text-[11px] text-faint">{label}</div>
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
                    <span className="rounded bg-canvas px-1.5 py-0.5 text-[10px] text-muted">{s.kind}</span>
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
  if (!health) return <p className="text-sm text-zinc-500">Belum dihitung.</p>;
  const cats = [health.color, health.typography, health.spacing, health.radius, health.component];
  return (
    <>
      <div className="mb-4 rounded-xl border border-zinc-800 p-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-zinc-400">Design Health</span>
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
  if (!a11y) return <p className="text-sm text-zinc-500">Belum dihitung.</p>;
  const gauge = (v: number) => {
    const color = v === 0 ? "bg-emerald-500" : v <= 2 ? "bg-amber-500" : "bg-red-500";
    return (
      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${color}`}>{v}</span>
    );
  };
  return (
    <>
      <SectionHeader title="Aksesibilitas (WCAG)" subtitle="Analisis otomatis berbasis token kontras" />
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-zinc-800 p-4">
          <div className="mb-2 text-xs text-zinc-500">WCAG AA (teks kecil 4.5:1)</div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            Gagal {gauge(a11y.wcagAA.critical)} &nbsp; Peringatan {gauge(a11y.wcagAA.warning)} &nbsp; Lolos {gauge(a11y.wcagAA.pass)}
          </div>
        </div>
        <div className="rounded-xl border border-zinc-800 p-4">
          <div className="mb-2 text-xs text-zinc-500">WCAG AAA (7:1)</div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            Gagal {gauge(a11y.wcagAAA.critical)} &nbsp; Peringatan {gauge(a11y.wcagAAA.warning)} &nbsp; Lolos {gauge(a11y.wcagAAA.pass)}
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {a11y.issues.map((iss, i) => (
          <div key={i} className="rounded-xl border border-zinc-800 p-3">
            <div className="flex items-center gap-2">
              <span
                className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                  iss.severity === "critical"
                    ? "bg-red-500 text-white"
                    : iss.severity === "warning"
                      ? "bg-amber-500 text-black"
                      : "bg-zinc-600 text-white"
                }`}
              >
                {iss.severity}
              </span>
              <span className="text-sm font-medium">{iss.kind}</span>
            </div>
            <p className="mt-1 text-sm">{iss.message}</p>
            {iss.recommendation && <p className="mt-1 text-xs text-zinc-400">{iss.recommendation}</p>}
            {iss.evidence.length > 0 && (
              <code className="mt-1 block text-[11px] text-zinc-500">{iss.evidence.join(" · ")}</code>
            )}
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-zinc-600">{a11y.note}</p>
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

  return (
    <>
      <MdControls opts={opts} onChange={setOpts} />
      <div className="mb-4 flex items-center justify-between">
        <SectionHeader title="Artefak design system" subtitle="Berdasarkan DesignModel, bukan output scraper mentah" />
        <button
          onClick={downloadZip}
          className="rounded-lg bg-zinc-100 px-4 py-2 text-xs font-semibold text-zinc-900 hover:bg-white"
        >
          Download semua (.zip)
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {Object.entries(files).map(([key]) => (
          <div
            key={key}
            className="flex items-center justify-between rounded-xl border border-zinc-800 px-4 py-2.5"
          >
            <code className="text-sm">{key}</code>
            <div className="flex gap-2">
              <button
                onClick={() => copy(key)}
                className="rounded-lg border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 hover:border-zinc-500"
              >
                {copied === key ? "Tersalin!" : "Salin"}
              </button>
              <button
                onClick={() => download(key)}
                className="rounded-lg bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-900 hover:bg-white"
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
        subtitle="Scan tersimpan di browser — fondasi untuk melacak perubahan (drift)"
      />
      <div className="mb-3 flex flex-wrap gap-2">
        <button
          onClick={handleSave}
          className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-white"
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
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:border-zinc-500"
          >
            Hapus semua
          </button>
        )}
      </div>
      {msg && <p className="mb-3 text-xs text-emerald-400">{msg}</p>}

      {sessions.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Belum ada scan tersimpan. Tekan {"“Simpan scan ini”"} untuk menyimpan hasil saat ini.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {sessions.map((s) => (
            <div key={s.id} className="rounded-xl border border-zinc-800 px-4 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                {editingId === s.id ? (
                  <input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRename(s.id);
                    }}
                    autoFocus
                    className="w-48 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs outline-none focus:border-zinc-500"
                  />
                ) : (
                  <div>
                    <div className="text-sm font-medium">{s.name}</div>
                    <div className="text-[11px] text-zinc-500">
                      {s.url} · {new Date(s.createdAt).toLocaleString("id-ID")}
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => handleLoad(s.id)}
                    className="rounded-lg bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-900 hover:bg-white"
                  >
                    Muat
                  </button>
                  <button
                    onClick={() => {
                      setEditingId(s.id);
                      setEditingName(s.name);
                    }}
                    className="rounded-lg border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 hover:border-zinc-500"
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => handleDelete(s.id)}
                    className="rounded-lg border border-red-900/40 px-2.5 py-1 text-xs text-red-400 hover:border-red-700"
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
    flashMsg("Snapshot tersimpan — drift dihitung otomatis.");
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
          className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-white"
        >
          Simpan snapshot drift
        </button>
        {timeline.length > 1 && (
          <span className="rounded-full bg-amber-950 px-3 py-1 text-xs text-amber-300">
            Total drift: +{totalDrift.added} / -{totalDrift.removed} / ~{totalDrift.changed}
          </span>
        )}
      </div>
      {flash && <p className="mb-3 text-xs text-emerald-400">{flash}</p>}

      {timeline.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Belum ada snapshot untuk URL ini. Simpan snapshot pertama untuk mulai melacak drift design system.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {[...timeline].reverse().map((e, idx) => (
            <div key={e.session.id} className="rounded-xl border border-zinc-800 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-medium">{e.session.name}</div>
                  <div className="text-[11px] text-zinc-500">
                    {new Date(e.session.createdAt).toLocaleString("id-ID")}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {idx === 0 && (
                    <button
                      onClick={() => onLoad(e.session.model)}
                      className="rounded-lg border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 hover:border-zinc-500"
                    >
                      Muat
                    </button>
                  )}
                  {e.delta && e.prev && (
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        e.delta.summary.added + e.delta.summary.removed + e.delta.summary.changed === 0
                          ? "bg-emerald-950 text-emerald-300"
                          : "bg-amber-950 text-amber-300"
                      }`}
                    >
                      +{e.delta.summary.added} / -{e.delta.summary.removed} / ~{e.delta.summary.changed}
                    </span>
                  )}
                </div>
              </div>
              {e.delta && e.prev && e.delta.groups.some((g) => g.added.length + g.removed.length + g.changed.length > 0) && (
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-400">
                  {e.delta.groups
                    .filter((g) => g.added.length + g.removed.length + g.changed.length > 0)
                    .map((g) => (
                      <span key={g.category}>
                        <span className="text-zinc-300">{g.category}</span>:{" "}
                        <span className="text-emerald-400">+{g.added.length}</span>{" "}
                        <span className="text-red-400">-{g.removed.length}</span>{" "}
                        <span className="text-amber-400">~{g.changed.length}</span>
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
          className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-white disabled:opacity-60"
        >
          {busy ? "Menghasilkan…" : "Generate README dengan AI"}
        </button>
        <button
          onClick={() => generate("review")}
          disabled={busy}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-500 disabled:opacity-60"
        >
          Tinjau desain
        </button>
        <button
          onClick={recommend}
          disabled={busy}
          className="rounded-lg border border-emerald-700 px-3 py-1.5 text-xs text-emerald-300 hover:border-emerald-500 disabled:opacity-60"
        >
          {busy ? "Menyusun…" : "Rekomendasi perbaikan"}
        </button>
        <AiSettingsButton config={config} onChange={onChange} />
      </div>

      <div className="mb-4">
        <div className="mb-1.5 text-[11px] uppercase tracking-wide text-zinc-500">
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
                    ? "border-zinc-400 bg-zinc-700 text-white"
                    : "border-zinc-700 text-zinc-500 hover:border-zinc-500"
                }`}
              >
                {on ? "✓ " : ""}
                {o.label}
              </button>
            );
          })}
        </div>
      </div>

      {switchedNote && <p className="mb-3 text-xs text-amber-400">{switchedNote}</p>}
      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

      {recommendError && <p className="mb-3 text-sm text-red-400">{recommendError}</p>}

      {recommendation && recommendation.changes.length > 0 && (
        <div className="mb-5 rounded-xl border border-emerald-800 bg-emerald-950/20 p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-semibold text-emerald-300">Rekomendasi perbaikan</div>
            <button
              onClick={applyRecommendation}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
            >
              Terapkan ke Playground →
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {recommendation.changes.map((ch, i) => (
              <div key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 rounded-lg bg-black/30 px-3 py-2 text-xs">
                <code className="text-zinc-400">{ch.key}</code>
                <span className="text-zinc-500">→</span>
                <code className="text-emerald-300">{ch.value}</code>
                <span className="text-[11px] text-zinc-500">({ch.type})</span>
                {ch.reason && <span className="w-full text-[11px] text-zinc-400">{ch.reason}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-5 rounded-xl border border-zinc-800 bg-zinc-950 p-3">
        <div className="mb-2 text-[11px] uppercase tracking-wide text-zinc-500">
          AI Chat — grounded di DesignModel ({result.source.title})
        </div>
        <div className="mb-2 flex max-h-64 flex-col gap-2 overflow-auto">
          {chatHistory.length === 0 && (
            <p className="text-xs text-zinc-600">
              Contoh: {"“Kenapa desain ini terasa tidak konsisten?”, “Cari outlier spacing.”, “Apa yang salah di mobile?”, “Generate DESIGN.md.”"}
            </p>
          )}
          {chatHistory.map((c, i) => (
            <div key={i} className={`text-xs leading-5 ${c.role === "ai" ? "text-zinc-300" : "text-zinc-100"}`}>
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
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none placeholder:text-zinc-600 focus:border-zinc-500"
          />
          <button
            onClick={sendChat}
            disabled={busy || !chatInput.trim()}
            className="rounded-lg bg-zinc-100 px-4 py-2 text-xs font-semibold text-zinc-900 hover:bg-white disabled:opacity-50"
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
              className="rounded-lg border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 hover:border-zinc-500"
            >
              {copied ? "Tersalin!" : "Salin"}
            </button>
          </div>
          <pre className="max-h-[40vh] overflow-auto whitespace-pre-wrap rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-xs leading-6 text-zinc-300">
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
      label: "Keseluruhan",
      items: [
        { id: "overview", label: "Overview" },
        { id: "pages", label: "Pages" },
      ],
    },
    {
      label: "Tokens",
      items: [
        { id: "colors", label: t("tab.colors") },
        { id: "typography", label: t("tab.typography") },
        { id: "spacing", label: t("tab.spacing") },
        { id: "shapes", label: t("tab.shapes") },
        { id: "effects", label: t("tab.effects") },
      ],
    },
    {
      label: "Components",
      items: [{ id: "components", label: t("tab.components") }],
    },
    {
      label: "Responsive",
      items: [
        { id: "responsive", label: t("tab.responsive") },
        { id: "darkmode", label: t("tab.darkmode") },
      ],
    },
    {
      label: "Analysis",
      items: [
        { id: "health", label: t("tab.health") },
        { id: "accessibility", label: t("tab.accessibility") },
      ],
    },
    {
      label: "AI",
      items: [{ id: "ai", label: t("tab.ai") }],
    },
    {
      label: "Edit",
      items: [{ id: "playground", label: t("tab.playground") }],
    },
    {
      label: "Compare",
      items: [
        { id: "diff", label: t("tab.diff") },
        { id: "drift", label: "Drift" },
        { id: "history", label: t("tab.history") },
      ],
    },
    {
      label: "Export",
      items: [
        { id: "export", label: t("tab.export") },
        { id: "audit", label: t("tab.audit") },
        { id: "md", label: t("tab.md") },
        { id: "preview", label: t("tab.preview") },
      ],
    },
  ];

  return (
<section className="rounded-2xl border border-border bg-surface p-5">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">{result.source.title}</h2>
          <a
            href={result.source.url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            {result.source.url}
          </a>
        </div>
        {results.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {results.map((r, i) => (
              <button
                key={r.source.url}
                onClick={() => setActiveIndex(i)}
                className={`rounded-lg border px-2.5 py-1 text-xs ${
                  i === activeIndex
                    ? "border-zinc-500 bg-zinc-700 text-white"
                    : "border-zinc-800 text-zinc-400 hover:border-zinc-600"
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            ["Warna", result.pages[0]?.scores?.color ?? 0],
            ["Tipografi", result.pages[0]?.scores?.typography ?? 0],
            ["Radius", result.pages[0]?.scores?.radius ?? 0],
            ["Keseluruhan", result.pages[0]?.scores?.overall ?? 0],
          ] as Array<[string, number]>
        ).map(([label, value]) => (
          <div key={label} className="rounded-xl border border-zinc-800 p-3">
            <div className="text-xs text-zinc-500">{label}</div>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-lg font-bold">{value}</span>
              <ScoreBar value={value} />
            </div>
          </div>
        ))}
      </div>

<div className="mb-5 flex flex-col gap-2">
        {tabGroups.map((g) => (
          <div key={g.label} className="flex flex-wrap items-center gap-1.5">
            <span className="w-20 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-faint">
              {g.label}
            </span>
            <div className="flex flex-wrap gap-1">
              {g.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  aria-current={tab === item.id ? "page" : undefined}
                  className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                    tab === item.id
                      ? "border-brand-500 bg-brand-500/15 font-medium text-brand-300"
                      : "border-transparent text-muted hover:bg-surface hover:text-fg"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

<div className="mt-6">
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
    </section>
  );
}
