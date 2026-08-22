"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import type { ExtractResponse, ScanMode, ScanScopeKind } from "@/lib/model";
import { FullReport } from "./report";
import { useI18n, LangToggle, type DictKey } from "@/lib/i18n";
import { AiSettingsButton } from "@/components/AiSettings";
import { ThemeToggle } from "@/components/ThemeToggle";
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

/**
 * One pass instead of two lists. The old page described the same six features
 * twice, once as a capability grid and once as three numbered steps, so the
 * capabilities now live inside the flow as the output of each stage.
 */
function flowSteps(
  t: (k: DictKey) => string,
): Array<{ title: string; desc: string; tags: string[] }> {
  return [
    { title: t("flow.1"), desc: t("flow.1Desc"), tags: ["Tokens", "Components"] },
    {
      title: t("flow.2"),
      desc: t("flow.2Desc"),
      tags: ["Health", "Accessibility", "Responsive"],
    },
    {
      title: t("flow.3"),
      desc: t("flow.3Desc"),
      tags: ["tokens.json", "tokens.css", "Tailwind", "DESIGN.md", "ZIP"],
    },
  ];
}

type ScanStage = "idle" | "discovering" | "collecting" | "extracting" | "analyzing" | "building";

const STAGE_SEQUENCE: Array<Exclude<ScanStage, "idle">> = [
  "discovering",
  "collecting",
  "extracting",
  "analyzing",
  "building",
];

function scoreTone(value: number): "success" | "warning" | "danger" {
  if (value >= 80) return "success";
  if (value >= 65) return "warning";
  return "danger";
}

function ScanLoader({ stage }: { stage: ScanStage }) {
  const { t } = useI18n();
  const labels: Record<Exclude<ScanStage, "idle">, string> = {
    discovering: t("ld.discover"),
    collecting: t("ld.collect"),
    extracting: t("ld.extract"),
    analyzing: t("ld.analyze"),
    building: t("ld.build"),
  };
  const activeIdx = (STAGE_SEQUENCE as ScanStage[]).indexOf(stage);
  const pct = activeIdx < 0 ? 0 : ((activeIdx + 1) / STAGE_SEQUENCE.length) * 100;

  return (
    <section className="card animate-fade-up p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-md font-semibold text-fg">{t("scan.analyzing")}</h2>
        <span className="font-mono text-xs text-faint">
          {Math.max(activeIdx + 1, 1)}/{STAGE_SEQUENCE.length}
        </span>
      </div>

      <div className="relative mt-3 h-1 overflow-hidden rounded-sm bg-border">
        <div
          className="h-full rounded-sm bg-brand-500 transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
        <div className="animate-sweep absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-brand-300/50 to-transparent" />
      </div>

      <ol className="mt-4 flex flex-col gap-2" role="status" aria-live="polite">
        {STAGE_SEQUENCE.map((s, i) => {
          const done = i < activeIdx;
          const active = i === activeIdx;
          return (
            <li
              key={s}
              className={`flex items-center gap-2.5 text-sm transition-colors ${
                done ? "text-muted" : active ? "font-medium text-fg" : "text-faint"
              }`}
            >
              <span
                className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border text-2xs ${
                  done
                    ? "border-success bg-success text-canvas"
                    : active
                      ? "border-brand-500 text-brand-500"
                      : "border-border text-transparent"
                }`}
                aria-hidden="true"
              >
                {done ? "✓" : active ? "•" : "·"}
              </span>
              {labels[s]}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function RecentScans({ onLoad }: { onLoad: (m: ExtractResponse) => void }) {
  const [sessions, setSessions] = useState<ScanSession[]>([]);
  const { t } = useI18n();

  useEffect(() => {
    const timer = setTimeout(() => setSessions(listSessions().slice(0, 4)), 0);
    return () => clearTimeout(timer);
  }, []);

  if (sessions.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border-strong px-6 py-8 text-center text-sm text-faint">
        {t("home.recentEmpty")}
      </div>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {sessions.map((s) => {
        const healthVal = s.model.health ? s.model.health.overall : null;
        return (
          <button
            key={s.id}
            onClick={() => {
              const model = loadSession(s.id)?.model;
              if (model) onLoad({ ok: true, results: [model], errors: [] });
            }}
            className="card group p-4 text-left transition-colors hover:border-border-strong hover:bg-surface-2"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-base font-semibold text-fg">{s.name}</div>
                <div className="truncate font-mono text-xs text-faint">{s.url}</div>
                <div className="mt-1.5 text-xs text-muted">
                  {s.model.source.title} · {new Date(s.createdAt).toLocaleDateString("id-ID")}
                </div>
              </div>
              {healthVal !== null && (
                <span className={`tag tag-${scoreTone(healthVal)} shrink-0`}>{healthVal}</span>
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

  const resultsRef = useRef<HTMLDivElement>(null);
  const urlFieldRef = useRef<HTMLTextAreaElement>(null);
  const scopeOpts = scopeOptions(t);
  const flow = flowSteps(t);
  const activeScope = scopeOpts.find((o) => o.id === scope);
  const hasResults = Boolean(response && response.results.length > 0);

  useEffect(() => {
    const timer = setTimeout(() => {
      const c = loadConfig();
      if (c) setAiConfig(c);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Bring freshly-produced results into view instead of leaving the user at the form.
  useEffect(() => {
    if (hasResults) {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [hasResults]);

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

  const resetToScan = useCallback(() => {
    setResponse(null);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => urlFieldRef.current?.focus(), 320);
  }, []);

  async function handleExtract() {
    const list = parseUrls();
    if (list.length === 0) {
      setError(t("scan.error.empty"));
      urlFieldRef.current?.focus();
      return;
    }
    setError("");
    setResponse(null);
    setLoading(true);

    let cancelled = false;
    void (async () => {
      for (const s of STAGE_SEQUENCE) {
        if (cancelled) return;
        setStage(s);
        await new Promise((r) => setTimeout(r, 500));
      }
    })();

    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ urls: list, mode, scope: { kind: scope, maxPages } }),
      });
      const data: ExtractResponse = await res.json();
      setResponse(data);
    } catch {
      setError(t("scan.error.network"));
    } finally {
      cancelled = true;
      setLoading(false);
      setStage("idle");
    }
  }

  const scanErrors =
    response && response.errors.length > 0 ? (
      <section className="animate-fade-up rounded-md border border-danger-border bg-danger-bg p-4">
        <h2 className="text-sm font-semibold text-danger">Sebagian URL gagal dipindai</h2>
        <ul className="mt-2 flex flex-col gap-1">
          {response.errors.map((e, i) => (
            <li key={i} className="text-sm text-danger">
              <span className="font-mono">{e.url || "(tanpa URL)"}</span>: {e.message}
            </li>
          ))}
        </ul>
      </section>
    ) : null;

  return (
    <div className="min-h-screen">
      {/* ---------------------------------------------------------- app bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4">
          <button
            onClick={resetToScan}
            className="flex shrink-0 items-center gap-2.5"
            aria-label="Vinyasa, kembali ke scan"
          >
            <Image
              src="/logo.jpeg"
              alt=""
              width={26}
              height={26}
              className="rounded-sm object-contain"
              priority
            />
            <span className="text-md font-bold tracking-tight text-fg">Vinyasa</span>
          </button>

          {/* Context breadcrumb - keeps the user oriented once a report is open. */}
          {hasResults && response && (
            <div className="animate-fade hidden min-w-0 items-center gap-2 sm:flex">
              <span className="text-border-strong" aria-hidden="true">
                /
              </span>
              <span className="truncate font-mono text-xs text-muted">
                {response.results[0]?.source.url.replace(/^https?:\/\//, "")}
              </span>
            </div>
          )}

          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            {hasResults && (
              <button onClick={resetToScan} className="btn btn-secondary btn-sm">
                Scan baru
              </button>
            )}
            <AiSettingsButton config={aiConfig} onChange={handleAiConfigChange} />
            <Link
              href="/compare"
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:border-zinc-500 hover:text-fg"
            >
              A/B Compare
            </Link>
            <ThemeToggle />
            <LangToggle />
          </div>
        </div>
      </header>

      {/* Every landing block shares one column width; only the report widens. */}
      <main id="main" className="w-full px-4 pb-20 pt-8">
        {!hasResults && (
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-10">
            {/* ---------------------------------------------------------- hero */}
            <section className="animate-fade-up text-center">
              <p className="eyebrow mb-3 inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500" aria-hidden="true" />
                Design Intelligence Platform
              </p>
              <h1 className="text-display text-fg">
                {t("hero.lead")}
                <span className="text-brand-500">{t("hero.gradient")}</span>
                {t("hero.tail")}
              </h1>
              <p className="mx-auto mt-3 max-w-lg text-md text-muted">{t("hero.subtitle")}</p>
            </section>

            {/* ------------------------------------------------- scan console */}
            {!loading && (
              <section className="card animate-fade-up p-5 sm:p-6">
                <label htmlFor="scan-url" className="label mb-2">
                  {t("home.urlLabel")}
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <textarea
                    id="scan-url"
                    ref={urlFieldRef}
                    value={urls}
                    onChange={(e) => {
                      setUrls(e.target.value);
                      if (error) setError("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleExtract();
                    }}
                    rows={1}
                    placeholder="https://example.com"
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? "scan-error" : undefined}
                    className="field resize-none font-mono"
                  />
                  <button
                    onClick={handleExtract}
                    disabled={loading}
                    className="btn btn-primary btn-lg shrink-0"
                  >
                    {loading ? t("scan.loading") : t("home.start")}
                  </button>
                </div>

                {error && (
                  <p
                    id="scan-error"
                    role="alert"
                    className="mt-2 flex items-center gap-1.5 text-sm text-danger"
                  >
                    <span aria-hidden="true">!</span>
                    {error}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-faint">
                  <span>{t("scan.try")}</span>
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => setUrls(s)} className="chip">
                      {s.replace("https://", "")}
                    </button>
                  ))}
                </div>

                <hr className="my-5 border-border" />

                {/* Fixed second column and reserved hint height: swapping
                    Fast/Deep changes the hint text, and an `auto` track would
                    resize and shove the toggle sideways on every click. */}
                <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_232px]">
                  <div>
                    <div className="label mb-2">{t("home.scopeLabel")}</div>
                    <div
                      className="flex flex-wrap gap-1.5"
                      role="group"
                      aria-label={t("home.scopeLabel")}
                    >
                      {scopeOpts.map((o) => (
                        <button
                          key={o.id}
                          onClick={() => setScope(o.id)}
                          aria-pressed={scope === o.id}
                          className="chip"
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 min-h-9 text-xs text-faint">{activeScope?.hint}</p>
                  </div>

                  <div>
                    <div className="label mb-2">{t("home.modeLabel")}</div>
                    <div
                      className="inline-flex rounded-md border border-border p-0.5"
                      role="group"
                      aria-label={t("home.modeLabel")}
                    >
                      {(["fast", "deep"] as ScanMode[]).map((m) => (
                        <button
                          key={m}
                          onClick={() => setMode(m)}
                          aria-pressed={mode === m}
                          className={`w-16 rounded-sm py-1 text-xs font-semibold transition-colors ${
                            mode === m ? "bg-fg text-canvas" : "text-muted hover:text-fg"
                          }`}
                        >
                          {m === "fast" ? "Fast" : "Deep"}
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 min-h-9 text-xs text-faint">
                      {mode === "deep" ? t("scan.modeDeep") : t("scan.modeFast")}
                    </p>
                  </div>
                </div>

                {(scope === "custom" || scope === "all") && (
                  <label className="animate-fade mt-1 flex items-center gap-2 text-xs text-muted">
                    {t("home.maxPages")}
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={maxPages}
                      onChange={(e) => setMaxPages(Number(e.target.value))}
                      className="field w-20 py-1"
                    />
                  </label>
                )}
              </section>
            )}

            {loading && <ScanLoader stage={stage} />}

            {scanErrors}

            {/* -------------------------------------------------- idle content */}
            {!response && !loading && (
              <>
                <section>
                  <h2 className="eyebrow mb-4">{t("home.how")}</h2>
                  {/* Row gap goes to zero at sm because the three implicit rows
                      are the shared subgrid bands, not the space between cards. */}
                  <ol className="flow-grid grid gap-2 sm:grid-cols-3 sm:gap-y-0">
                    {flow.map((step, i) => (
                      <li
                        key={step.title}
                        className="card flow-card p-4 transition-colors hover:border-border-strong"
                      >
                        <div className="mb-2 flex items-baseline gap-2">
                          <span className="font-mono text-xs font-bold text-brand-500">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <span className="text-base font-semibold text-fg">{step.title}</span>
                        </div>
                        <p className="text-sm text-muted">{step.desc}</p>
                        <div className="pt-4">
                          <div className="divider-wave" aria-hidden="true" />
                          <div className="mt-3 flex flex-wrap gap-1">
                            {step.tags.map((tag) => (
                              <span key={tag} className="tag">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>

                <section>
                  <h2 className="eyebrow mb-4">{t("home.recent")}</h2>
                  <RecentScans onLoad={setResponse} />
                </section>
              </>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------ report */}
        {hasResults && response && (
          <div ref={resultsRef} className="mx-auto w-full max-w-6xl scroll-mt-20">
            {scanErrors}
            <div className="animate-fade-up mt-4 first:mt-0">
              <FullReport
                response={response}
                initialAiConfig={aiConfig}
                onAiConfigChange={handleAiConfigChange}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
