"use client";

import { useMemo, useState } from "react";
import type { ExtractResponse, ExtractResult } from "@/lib/types";
import { buildDesignMd, buildDownloadFilename } from "@/lib/design-md";
import { buildPreviewHtml } from "@/lib/preview";
import { callAi, loadConfig } from "@/lib/ai";
import { AiSettingsButton } from "@/components/AiSettings";
import type { AiConfig } from "@/lib/ai";

type Tab = "colors" | "typography" | "radius" | "audit" | "md" | "preview" | "ai";

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

function ColorGrid({ tokens }: { tokens: ExtractResult["colors"]["primary"] }) {
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

function ColorsPanel({ result }: { result: ExtractResult }) {
  return (
    <>
      <SectionHeader title="Warna primer" subtitle="Token warna paling sering dipakai" />
      <ColorGrid tokens={result.colors.primary} />
      <SectionHeader title="Warna netral" subtitle="Hitam, putih, abu-abu yang dipakai" />
      <ColorGrid tokens={result.colors.neutral} />
    </>
  );
}

function TypographyPanel({ result }: { result: ExtractResult }) {
  const { fonts } = result;
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
                {w.value} · {w.usage}%
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
            {result.textStyles.slice(0, 8).map((t, i) => (
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

function RadiusPanel({ result }: { result: ExtractResult }) {
  if (result.radius.length === 0) return <p className="text-sm text-zinc-500">Tidak terdeteksi.</p>;
  return (
    <>
      <SectionHeader title="Border radius" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        {result.radius.map((r) => (
          <div key={r.raw} className="rounded-xl border border-zinc-800 p-3 text-center">
            <div
              className="mx-auto h-14 w-14 bg-zinc-700"
              style={{ borderRadius: r.raw }}
            />
            <div className="mt-2 font-mono text-xs">{r.raw}</div>
            <div className="text-[11px] text-zinc-500">{r.usage}%</div>
          </div>
        ))}
      </div>
    </>
  );
}

function AuditPanel({ result }: { result: ExtractResult }) {
  return (
    <>
      <SectionHeader title="Sumber CSS" subtitle="Setiap stylesheet yang dibaca beserta skor akurasi" />
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
            {result.sources.map((s, i) => (
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
    </>
  );
}

function MdPanel({ result }: { result: ExtractResult }) {
  const md = useMemo(() => buildDesignMd(result), [result]);
  const [copied, setCopied] = useState(false);
  const filename = buildDownloadFilename(result.url);

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

function PreviewPanel({ result }: { result: ExtractResult }) {
  const html = useMemo(() => buildPreviewHtml(result), [result]);
  return (
    <iframe
      title="Pratinjau design tokens"
      srcDoc={html}
      className="h-[70vh] w-full rounded-xl border border-zinc-800 bg-white"
    />
  );
}

function AiPanel({
  result,
  config,
  onChange,
}: {
  result: ExtractResult;
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
        ? `Berikut hasil ekstraksi design system dari ${result.url}:\n\n${md}\n\nBuatkan README.md ringkas (Bahasa Indonesia) yang menjelaskan design system ini: palet warna, tipografi, radius, dan panduan pemakaiannya. Format markdown.`
        : `Berikut hasil ekstraksi design system dari ${result.url}:\n\n${md}\n\nBuat tinjauan desain (Bahasa Indonesia): kekuatan, kelemahan, dan saran perbaikan. Ringkas.`;
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
          {busy ? "Menghasilkan…" : "Generate README dengan AI"}
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
    { id: "radius", label: "Radius" },
    { id: "audit", label: "Audit" },
    { id: "md", label: "DESIGN.md" },
    { id: "preview", label: "Preview" },
    { id: "ai", label: "AI" },
  ];

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">{result.title}</h2>
          <a
            href={result.url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            {result.url}
          </a>
        </div>
        {results.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {results.map((r, i) => (
              <button
                key={r.url}
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
            ["Warna", result.scores.color],
            ["Tipografi", result.scores.typography],
            ["Radius", result.scores.radius],
            ["Keseluruhan", result.scores.overall],
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
        {tab === "radius" && <RadiusPanel result={result} />}
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