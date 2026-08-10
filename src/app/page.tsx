"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import type { ExtractResponse, ScanMode, ScanScopeKind } from "@/lib/model";
import { FullReport } from "./report";
import { useI18n, LangToggle, type DictKey } from "@/lib/i18n";
import { AiSettingsButton } from "@/components/AiSettings";
import type { AiConfig } from "@/lib/ai";
import { loadConfig, saveConfig } from "@/lib/ai";
import { listSessions, loadSession } from "@/lib/sessions";
import type { ScanSession } from "@/lib/sessions";

const SUGGESTIONS = [
  "https://apple.com",
  "https://stripe.com",
  "https://linear.app",
  "https://vercel.com",
  "https://tailwindcss.com",
];

function scopeOptions(t: (k: DictKey) => string): Array<{ id: ScanScopeKind; label: string; hint: string }> {
  return [
    { id: "smart", label: "Smart", hint: t("scope.smart") },
    { id: "landing", label: "Landing", hint: t("scope.landing") },
    { id: "pages", label: "5 Halaman", hint: t("scope.pages") },
    { id: "all", label: "Semua", hint: t("scope.all") },
    { id: "custom", label: "Custom", hint: t("scope.custom") },
  ];
}

function capabilities(t: (k: DictKey) => string): Array<{ title: string; desc: string }> {
  return [
    { title: t("cap.tokens"), desc: t("cap.tokensDesc") },
    { title: t("cap.components"), desc: t("cap.componentsDesc") },
    { title: t("cap.responsive"), desc: t("cap.responsiveDesc") },
    { title: t("cap.health"), desc: t("cap.healthDesc") },
    { title: t("cap.a11y"), desc: t("cap.a11yDesc") },
    { title: t("cap.export"), desc: t("cap.exportDesc") },
  ];
}

type ScanStage = "idle" | "discovering" | "collecting" | "extracting" | "analyzing" | "building";

function ScanLoader({ stage }: { stage: ScanStage }) {
  const { t } = useI18n();
  const steps: Array<{ id: ScanStage; label: string }> = [
    { id: "discovering", label: t("ld.discover") },
    { id: "collecting", label: t("ld.collect") },
    { id: "extracting", label: t("ld.extract") },
    { id: "analyzing", label: t("ld.analyze") },
    { id: "building", label: t("ld.build") },
  ];
  const activeIdx = steps.findIndex((s) => s.id === stage);
  return (
    <section className="rounded-2xl border border-border bg-surface p-6">
      <div className="mb-4 text-sm text-muted">
        {t("scan.analyzing")}{" "}
        <span className="text-fg">
          {stage === "extracting" || stage === "analyzing" ? "…" : "…"}
        </span>
      </div>
      <div className="flex flex-col gap-1.5" role="status" aria-live="polite">
        {steps.map((s, i) => {
          const done = i < activeIdx;
          const active = i === activeIdx;
          return (
            <div
              key={s.id}
              className={`flex items-center gap-2 text-sm ${
                done ? "text-success" : active ? "text-fg" : "text-faint"
              }`}
            >
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-current text-[10px]">
                {done ? "✓" : active ? "•" : ""}
              </span>
              {s.label}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RecentScans({ onLoad }: { onLoad: (m: ExtractResponse) => void }) {
  const [sessions, setSessions] = useState<ScanSession[]>([]);
  const { t } = useI18n();
  useEffect(() => {
    const t = setTimeout(() => setSessions(listSessions().slice(0, 4)), 0);
    return () => clearTimeout(t);
  }, []);

  if (sessions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-faint">
        {t("home.recentEmpty")}
      </div>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {sessions.map((s) => {
        const health = s.model.health;
        const healthVal = health ? health.overall : null;
        return (
          <button
            key={s.id}
            onClick={() => {
              const model = loadSession(s.id)?.model;
              if (model) onLoad({ ok: true, results: [model], errors: [] });
            }}
            className="group rounded-xl border border-border bg-surface p-4 text-left transition-colors hover:border-border-strong"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-fg">{s.name}</div>
                <div className="truncate font-mono text-[11px] text-faint">{s.url}</div>
                <div className="mt-1 text-[11px] text-muted">
                  {s.model.source.title} · {new Date(s.createdAt).toLocaleDateString("id-ID")}
                </div>
              </div>
              {healthVal !== null && (
                <span
                  className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
                    healthVal >= 80
                      ? "bg-emerald-950 text-success"
                      : healthVal >= 65
                        ? "bg-amber-950 text-warning"
                        : "bg-red-950 text-danger"
                  }`}
                >
                  {healthVal}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default function HomePage() {
  const { t } = useI18n();
  const [urls, setUrls] = useState("");
  const [scope, setScope] = useState<ScanScopeKind>("smart");
  const [mode, setMode] = useState<ScanMode>("fast");
  const [maxPages, setMaxPages] = useState(25);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<ScanStage>("idle");
  const [error, setError] = useState("");
  const [response, setResponse] = useState<ExtractResponse | null>(null);
  const [aiConfig, setAiConfig] = useState<AiConfig | null>(null);
  const scopeOpts = scopeOptions(t);
  const caps = capabilities(t);

  useEffect(() => {
    const t = setTimeout(() => {
      const c = loadConfig();
      if (c) setAiConfig(c);
    }, 0);
    return () => clearTimeout(t);
  }, []);

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

  async function runScan(stageSeq: ScanStage[]) {
    for (const s of stageSeq) {
      setStage(s);
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  async function handleExtract() {
    const list = parseUrls();
    if (list.length === 0) {
      setError(t("scan.error.empty"));
      return;
    }
    setError("");
    setResponse(null);
    setLoading(true);
    runScan(["discovering", "collecting", "extracting", "analyzing", "building"]);
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
      setStage("idle");
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 pb-24 pt-8">
      <header className="flex items-center justify-between">
        <button
          onClick={() => {
            setResponse(null);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className="flex items-center gap-2"
          aria-label="Vinyasa home"
        >
          <Image
            src="/logo.jpeg"
            alt="Logo Vinyasa"
            width={28}
            height={28}
            className="rounded-md object-contain"
            priority
          />
          <span className="text-sm font-semibold tracking-tight text-fg">Vinyasa</span>
        </button>
        <div className="flex items-center gap-2">
          <AiSettingsButton config={aiConfig} onChange={handleAiConfigChange} />
          <LangToggle />
        </div>
      </header>

      <section className="text-center">
        <p className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
          Design Intelligence Platform
        </p>
        <h1 className="mx-auto max-w-2xl text-4xl font-bold tracking-tight text-fg sm:text-5xl">
          {t("hero.lead")}
          <span className="bg-gradient-to-r from-brand-300 to-brand-500 bg-clip-text text-transparent">
            {t("hero.gradient")}
          </span>
          {t("hero.tail")}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-muted">
          {t("hero.subtitle")}
        </p>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
        <label htmlFor="scan-url" className="mb-2 block text-xs font-medium uppercase tracking-wide text-faint">
          {t("home.urlLabel")}
        </label>
        <textarea
          id="scan-url"
          value={urls}
          onChange={(e) => {
            setUrls(e.target.value);
            if (error) setError("");
          }}
          rows={1}
          placeholder="https://example.com"
          className="w-full resize-none rounded-lg border border-border bg-canvas px-3 py-3 font-mono text-sm text-fg outline-none placeholder:text-faint focus:border-brand-500"
        />

        <div className="mt-4">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-faint">
            {t("home.scopeLabel")}
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Scan scope">
            {scopeOpts.map((o) => (
              <button
                key={o.id}
                onClick={() => setScope(o.id)}
                aria-pressed={scope === o.id}
                className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                  scope === o.id
                    ? "border-brand-500 bg-brand-500/15 text-brand-300"
                    : "border-border text-muted hover:border-border-strong hover:text-fg"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-faint">
            {scopeOpts.find((o) => o.id === scope)?.hint}
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-faint">{t("home.modeLabel")}</span>
            <div className="inline-flex rounded-lg border border-border p-0.5" role="group" aria-label="Scan mode">
              {(["fast", "deep"] as ScanMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  aria-pressed={mode === m}
                  className={`rounded-md px-3 py-1 text-xs transition-colors ${
                    mode === m ? "bg-fg text-canvas" : "text-muted hover:text-fg"
                  }`}
                >
                  {m === "fast" ? "Fast" : "Deep"}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-faint">
              {mode === "deep" ? t("scan.modeDeep") : t("scan.modeFast")}
            </span>
          </div>
          {(scope === "custom" || scope === "all") && (
            <label className="flex items-center gap-2 text-xs text-faint">
              {t("home.maxPages")}
              <input
                type="number"
                min={1}
                max={50}
                value={maxPages}
                onChange={(e) => setMaxPages(Number(e.target.value))}
                className="w-20 rounded-lg border border-border bg-canvas px-2 py-1 text-sm text-fg outline-none focus:border-brand-500"
              />
            </label>
          )}
          <button
            onClick={handleExtract}
            disabled={loading}
            className="ml-auto rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-400 disabled:opacity-50"
          >
            {loading ? t("scan.loading") : t("home.start")}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-faint">
          <span>{t("scan.try")}</span>
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setUrls(s)}
              className="rounded-full border border-border px-2.5 py-1 text-faint transition-colors hover:border-border-strong hover:text-fg"
            >
              {s.replace("https://", "")}
            </button>
          ))}
        </div>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      </section>

      {loading && <ScanLoader stage={stage} />}

      {response && response.errors.length > 0 && (
        <section className="rounded-xl border border-red-900/50 bg-red-950/30 p-4 text-sm">
          {response.errors.map((e, i) => (
            <p key={i} className="text-danger">
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

      {!response && !loading && (
        <>
          <section>
            <h2 className="mb-4 text-lg font-semibold text-fg">{t("home.capabilities")}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {caps.map((c) => (
                <div key={c.title} className="rounded-xl border border-border bg-surface p-4">
                  <div className="text-sm font-semibold text-fg">{c.title}</div>
                  <p className="mt-1 text-xs leading-5 text-muted">{c.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-lg font-semibold text-fg">{t("home.how")}</h2>
            <ol className="grid gap-3 sm:grid-cols-3">
              {[
                [t("step1"), t("step1Desc")],
                [t("step2"), t("step2Desc")],
                [t("step3"), t("step3Desc")],
              ].map(([title, desc], i) => (
                <li key={title} className="rounded-xl border border-border bg-surface p-4">
                  <div className="mb-2 flex h-6 w-6 items-center justify-center rounded-md border border-border bg-canvas text-xs font-semibold text-muted">
                    {i + 1}
                  </div>
                  <div className="text-sm font-semibold text-fg">{title}</div>
                  <p className="mt-1 text-xs leading-5 text-muted">{desc}</p>
                </li>
              ))}
            </ol>
          </section>

          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-fg">{t("home.recent")}</h2>
            </div>
            <RecentScans onLoad={setResponse} />
          </section>
        </>
      )}
    </main>
  );
}