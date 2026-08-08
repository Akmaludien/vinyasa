"use client";

import { useMemo, useState } from "react";
import type { ExtractResponse, DesignModel, ColorToken } from "@/lib/model";
import { buildDesignMd, buildDownloadFilename } from "@/lib/design-md";
import { buildPreviewHtml } from "@/lib/preview";
import { buildExports } from "@/lib/export";
import { callAi, loadConfig } from "@/lib/ai";
import { AiSettingsButton } from "@/components/AiSettings";
import type { AiConfig } from "@/lib/ai";
import type { HealthReport, HealthCategory } from "@/lib/health";
import type { A11yReport } from "@/lib/accessibility";

type Tab =
  | "colors"
  | "typography"
  | "spacing"
  | "shapes"
  | "effects"
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

function ColorGrid({ tokens }: { tokens: ColorToken[] }) {
  if (tokens.length === 0) return <p className="text-sm text-zinc-500">Tidak terdeteksi.</p>;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
      {tokens.map((t) => (
        <div key={t.hex} className="overflow-hidden rounded-xl border border-zinc-800">
          <div className="h-14" style={{ background: t.hex }} />
          <div className="px-2 py-1.5">
            <div className="truncate text-xs font-medium">{t.name}</div>
            <div className="font-mono text-[11px] text-zinc-500">{t.hex}</div>
            <div className="text-[11px] text-zinc-600">{t.usage}%</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ColorsPanel({ result }: { result: DesignModel }) {
  const { colors } = result.tokens;
  return (
    <>
      <SectionHeader title="Warna primer" subtitle="Token warna paling sering dipakai" />
      <ColorGrid tokens={colors.primary} />
      <SectionHeader title="Warna netral" subtitle="Hitam, putih, abu-abu yang dipakai" />
      <ColorGrid tokens={colors.neutral} />
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

function MdPanel({ result }: { result: DesignModel }) {
  const md = useMemo(() => buildDesignMd(result), [result]);
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
  const files: Record<string, string> = useMemo(() => buildExports(result).files, [result]);
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

  return (
    <>
      <SectionHeader title="Artefak design system" subtitle="Berdasarkan DesignModel, bukan output scraper mentah" />
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

function AiPanel({
  result,
  config,
  onChange,
}: {
  result: DesignModel;
  config: AiConfig | null;
  onChange: (c: AiConfig | null) => void;
}) {
  const md = useMemo(() => buildDesignMd(result), [result]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [output, setOutput] = useState("");
  const [copied, setCopied] = useState(false);

  async function generate(mode: "readme" | "review") {
    if (!config) {
      setError("Pasang API key AI dulu lewat tombol 'Atur AI' di atas.");
      return;
    }
    setBusy(true);
    setError("");
    setOutput("");
    const prompt =
      mode === "readme"
        ? `Berikut hasil ekstraksi design system dari ${result.source.url}:\n\n${md}\n\nBuatkan README.md ringkas (Bahasa Indonesia) yang menjelaskan design system ini: palet warna, tipografi, radius, dan panduan pemakaiannya. Format markdown.`
        : `Berikut hasil ekstraksi design system dari ${result.source.url}:\n\n${md}\n\nBuat tinjauan desain (Bahasa Indonesia): kekuatan, kelemahan, dan saran perbaikan. Ringkas.`;
    try {
      const out = await callAi(config, prompt);
      setOutput(out);
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
          {busy ? "Menghasilkanâ€¦" : "Generate README dengan AI"}
        </button>
        <button
          onClick={() => generate("review")}
          disabled={busy}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-500 disabled:opacity-60"
        >
          Tinjau desain
        </button>
        <AiSettingsButton config={config} onChange={onChange} />
      </div>
      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
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
          <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-xs leading-6 text-zinc-300">
            {output}
          </pre>
        </>
      )}
    </>
  );
}

export function FullReport({ response }: { response: ExtractResponse }) {
  const [tab, setTab] = useState<Tab>("colors");
  const [activeIndex, setActiveIndex] = useState(0);
  const [aiConfig, setAiConfig] = useState<AiConfig | null>(() => loadConfig());
  const results = response.results;
  const result = results[activeIndex];

  if (!result) return null;

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "colors", label: "Warna" },
    { id: "typography", label: "Tipografi" },
    { id: "spacing", label: "Spacing" },
    { id: "shapes", label: "Shapes" },
    { id: "effects", label: "Efek" },
    { id: "health", label: "Health" },
    { id: "accessibility", label: "Aksesibilitas" },
    { id: "export", label: "Export" },
    { id: "audit", label: "Audit" },
    { id: "md", label: "DESIGN.md" },
    { id: "preview", label: "Preview" },
    { id: "ai", label: "AI" },
  ];

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5">
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

      <div className="mb-4 flex flex-wrap gap-1.5">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
              tab === t.id
                ? "bg-zinc-100 font-medium text-zinc-900"
                : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

<div className="mt-6">
        {tab === "colors" && <ColorsPanel result={result} />}
        {tab === "typography" && <TypographyPanel result={result} />}
        {tab === "spacing" && <SpacingPanel result={result} />}
        {tab === "shapes" && <ShapesPanel result={result} />}
        {tab === "effects" && <EffectsPanel result={result} />}
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
            onChange={setAiConfig}
          />
        )}
      </div>
    </section>
  );
}
