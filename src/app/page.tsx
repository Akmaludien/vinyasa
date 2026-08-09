"use client";

import { useState } from "react";
import type { ExtractResponse, ScanMode, ScanScopeKind } from "@/lib/model";
import { FullReport } from "./report";
import { useI18n, LangToggle } from "@/lib/i18n";
import { AiSettingsButton } from "@/components/AiSettings";
import type { AiConfig } from "@/lib/ai";
import { loadConfig, saveConfig } from "@/lib/ai";

const SUGGESTIONS = [
  "https://apple.com",
  "https://stripe.com",
  "https://linear.app",
  "https://vercel.com",
  "https://tailwindcss.com",
];

const SCOPE_OPTIONS: Array<{ id: ScanScopeKind; label: string; hint: string }> = [
  { id: "smart", label: "Smart", hint: "Temukan & pilih halaman representatif" },
  { id: "landing", label: "Landing", hint: "Hanya halaman utama" },
  { id: "pages", label: "5 Halaman", hint: "Maksimal 5 halaman pilihan" },
  { id: "all", label: "Semua", hint: "Crawl seluruh situs (dibatasi)" },
  { id: "custom", label: "Custom", hint: "Daftar URL sendiri" },
];

export default function HomePage() {
  const { t } = useI18n();
  const [urls, setUrls] = useState("");
  const [scope, setScope] = useState<ScanScopeKind>("smart");
  const [mode, setMode] = useState<ScanMode>("fast");
  const [maxPages, setMaxPages] = useState(25);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [response, setResponse] = useState<ExtractResponse | null>(null);
  const [aiConfig, setAiConfig] = useState<AiConfig | null>(() => loadConfig());

  function handleAiConfigChange(c: AiConfig | null) {
    setAiConfig(c);
    if (c) saveConfig(c);
  }

  function parseUrls(): string[] {
    return urls
      .split(/[\n,]/)
      .map((u) => u.trim())
      .filter(Boolean);
  }

  async function handleExtract() {
    const list = parseUrls();
    if (list.length === 0) {
      setError(t("scan.error.empty"));
      return;
    }
    setError("");
    setLoading(true);
    setResponse(null);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          urls: list,
          mode,
          scope: { kind: scope, maxPages },
        }),
      });
      const data: ExtractResponse = await res.json();
      setResponse(data);
    } catch {
      setError(t("scan.error.network"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-4 pb-24 pt-14">
      <div className="flex items-center justify-end gap-2">
        <AiSettingsButton config={aiConfig} onChange={handleAiConfigChange} />
        <LangToggle />
      </div>
      <section className="text-center">
        <p className="mb-3 inline-block rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-300">
          {t("app.tagline")}
        </p>
        <h1 className="text-4xl font-bold tracking-tight">
          {t("hero.title")}
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-zinc-400">
          {t("hero.subtitle")}
        </p>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
        <textarea
          value={urls}
          onChange={(e) => {
            setUrls(e.target.value);
            if (error) setError("");
          }}
          rows={1}
          placeholder={t("scan.placeholder")}
          className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm outline-none placeholder:text-zinc-500 focus:border-zinc-500"
        />

        <div className="mt-4">
          <div className="mb-2 text-xs text-zinc-500">{t("scan.scope")}</div>
          <div className="flex flex-wrap gap-2">
            {SCOPE_OPTIONS.map((o) => (
              <button
                key={o.id}
                onClick={() => setScope(o.id)}
                className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                  scope === o.id
                    ? "border-zinc-500 bg-zinc-700 text-white"
                    : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-zinc-600">
            {SCOPE_OPTIONS.find((o) => o.id === scope)?.hint}
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">{t("scan.mode")}</span>
            <div className="inline-flex rounded-lg border border-zinc-700 p-0.5">
              {(["fast", "deep"] as ScanMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`rounded-md px-3 py-1 text-xs transition-colors ${
                    mode === m ? "bg-zinc-100 text-zinc-900" : "text-zinc-400"
                  }`}
                >
                  {m === "fast" ? "Fast" : "Deep"}
                </button>
              ))}
            </div>
          </div>
          {(scope === "custom" || scope === "all") && (
            <label className="flex items-center gap-2 text-xs text-zinc-500">
              {t("scan.max")}
              <input
                type="number"
                min={1}
                max={50}
                value={maxPages}
                onChange={(e) => setMaxPages(Number(e.target.value))}
                className="w-20 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm outline-none focus:border-zinc-500"
              />
            </label>
          )}
          <button
            onClick={handleExtract}
            disabled={loading}
            className="ml-auto rounded-xl bg-zinc-100 px-5 py-2.5 text-sm font-semibold text-zinc-900 transition-colors hover:bg-white disabled:opacity-60"
          >
            {loading ? t("scan.loading") : t("scan.start")}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          <span>{t("scan.try")}</span>
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setUrls(s)}
              className="rounded-full border border-zinc-800 px-2.5 py-1 hover:border-zinc-600 hover:text-zinc-300"
            >
              {s.replace("https://", "")}
            </button>
          ))}
        </div>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </section>

      {loading && (
        <section className="rounded-2xl border border-zinc-800 p-8 text-center text-sm text-zinc-400">
          Mengambil halaman, mengurai CSS, menghitung token…
        </section>
      )}

      {response && response.errors.length > 0 && (
        <section className="rounded-2xl border border-red-900/50 bg-red-950/30 p-4 text-sm">
          {response.errors.map((e, i) => (
            <p key={i} className="text-red-300">
              <span className="font-mono">{e.url || "(tanpa URL)"}</span> — {e.message}
            </p>
          ))}
        </section>
      )}

      {response && response.results.length > 0 && (
        <FullReport
          response={response}
          initialAiConfig={aiConfig}
          onAiConfigChange={handleAiConfigChange}
        />
      )}
    </main>
  );
}