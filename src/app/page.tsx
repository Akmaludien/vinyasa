"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import type { ExtractResponse, ScanMode, ScanScopeKind } from "@/lib/model";
import { FullReport } from "./report";
import { useI18n, LangToggle, type DictKey } from "@/lib/i18n";
import { AiSettingsButton } from "@/components/AiSettings";
import { ThemeToggle } from "@/components/ThemeToggle";
import { HomeDecor } from "@/components/HomeDecor";
import type { AiConfig } from "@/lib/ai";
import { loadConfig, saveConfig } from "@/lib/ai";
import { FEATURES } from "@/lib/flags";

/**
 * Sites worth cloning that are also cheap to scan.
 *
 * All five serve static HTML and CSS, so a suggestion click rarely ends in a
 * failed scan the way a large consumer site would. Their icons live in
 * `public/suggestions/` rather than coming from a favicon service, so opening
 * the landing page makes no third-party request and nothing depends on someone
 * else's uptime to render.
 */
const SUGGESTIONS = [
  { domain: "supabase.com", icon: "/suggestions/supabase.png" },
  { domain: "resend.com", icon: "/suggestions/resend.png" },
  { domain: "raycast.com", icon: "/suggestions/raycast.png" },
  { domain: "cal.com", icon: "/suggestions/cal.png" },
  { domain: "posthog.com", icon: "/suggestions/posthog.png" },
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

/** The three stages of a scan, in the order the user meets them. */
function flowSteps(t: (k: DictKey) => string): Array<{ title: string; desc: string }> {
  return [
    { title: t("flow.1"), desc: t("flow.1Desc") },
    { title: t("flow.2"), desc: t("flow.2Desc") },
    { title: t("flow.3"), desc: t("flow.3Desc") },
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

/**
 * How long to sit on each stage before moving to the next.
 *
 * These are estimates, not measurements: /api/extract returns one response with
 * no progress events, so the client has nothing real to sync to. They are at
 * least weighted the way a scan actually spends its time, on the two network
 * bound stages, instead of the flat 500ms that marched through all five in two
 * and a half seconds and then sat on the last one for the rest of the scan.
 *
 * The final stage has no entry to advance past, so the march parks there until
 * the response lands. Making this genuinely accurate means streaming progress
 * from the route.
 */
const STAGE_DWELL_MS: Record<Exclude<ScanStage, "idle">, number> = {
  discovering: 1400,
  collecting: 3200,
  extracting: 1100,
  analyzing: 1300,
  building: 0,
};

function ScanLoader({ stage }: { stage: ScanStage }) {
  const { t } = useI18n();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const labels: Record<Exclude<ScanStage, "idle">, string> = {
    discovering: t("ld.discover"),
    collecting: t("ld.collect"),
    extracting: t("ld.extract"),
    analyzing: t("ld.analyze"),
    building: t("ld.build"),
  };
  const activeIdx = (STAGE_SEQUENCE as ScanStage[]).indexOf(stage);

  /* Completed stages, not the current one. The old count was activeIdx + 1,
     which read 5/5 with a full bar while the fifth row was still unticked: the
     header claimed a finish the checklist below it contradicted. A stage counts
     only once the next one has started, so the last stage can never be counted
     from here. That is correct, because /api/extract answers in a single
     response with no progress events; the moment the scan is really done this
     component has already unmounted. */
  const doneCount = activeIdx < 0 ? 0 : activeIdx;
  const pct = (doneCount / STAGE_SEQUENCE.length) * 100;

  return (
    <section className="card animate-fade-up p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-md font-semibold text-fg">{t("scan.analyzing")}</h2>
        {/* Outside the live region below on purpose: a value that changes every
            second would otherwise be announced every second. */}
        <span className="shrink-0 font-mono text-xs text-faint tabular-nums">
          {elapsed}s · {doneCount}/{STAGE_SEQUENCE.length}
        </span>
      </div>

      {/* The filled width is what is genuinely finished; the sweep on top is
          what carries the sense of ongoing work. */}
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
                className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm text-2xs ${
                  done
                    ? "border border-success bg-success text-canvas"
                    : active
                      ? "text-brand-500"
                      : "border border-border text-transparent"
                }`}
                aria-hidden="true"
              >
                {done ? (
                  "✓"
                ) : active ? (
                  /* A spinner, not a filled box: this row is running, and a
                     static marker here is what made the panel look stalled. */
                  <svg viewBox="0 0 16 16" className="h-4 w-4 animate-spin">
                    <circle
                      cx="8"
                      cy="8"
                      r="6"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      pathLength={100}
                      strokeDasharray="25 75"
                    />
                  </svg>
                ) : (
                  "·"
                )}
              </span>
              {labels[s]}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default function HomePage() {
  const { t } = useI18n();
  const [urls, setUrls] = useState("");
  const [scope, setScope] = useState<ScanScopeKind>("smart");
  const [mode, setMode] = useState<ScanMode>("fast");
  const [maxPages, setMaxPages] = useState(25);
  const [showSettings, setShowSettings] = useState(false);
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
  /* Page count only means something for the two scopes that read it, so it
     joins the summary only then; otherwise the line advertises a number the
     scan will ignore. */
  const scanSummary = [
    activeScope?.label,
    mode === "deep" ? "Deep" : "Fast",
    scope === "custom" || scope === "all" ? `${maxPages} ${t("home.pagesUnit")}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
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
        await new Promise((r) => setTimeout(r, STAGE_DWELL_MS[s]));
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
              src="/logo.png"
              alt=""
              width={40}
              height={26}
              className="object-contain"
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
            {FEATURES.abCompare && (
              <Link
                href="/compare"
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:border-zinc-500 hover:text-fg"
              >
                A/B Compare
              </Link>
            )}
            <ThemeToggle />
            <LangToggle />
          </div>
        </div>
      </header>

      {/* Landing and report share one column width, so nothing shifts sideways
          when results replace the form. */}
      {/* The aura behind the scan console is wider than the column, so the
          landing must not grow a horizontal scrollbar from its spill. Scoped to
          the landing rather than applied to `main` outright: the report carries
          two lg:sticky sidebars, and there is no reason to put any overflow value
          in their ancestor chain. */}
      <main
        id="main"
        className={`w-full px-4 pb-20 pt-8 ${hasResults ? "" : "overflow-x-clip"}`}
      >
        {!hasResults && (
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-10">
            {/* ---------------------------------------------------------- hero */}
            <section className="animate-fade-up text-center">
              <p className="eyebrow mb-3 inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500" aria-hidden="true" />
                {t("hero.eyebrow")}
              </p>
              <h1 className="text-display text-fg">
                {t("hero.lead")}
                <span className="text-brand-500">{t("hero.gradient")}</span>
              </h1>
              <p className="mx-auto mt-3 max-w-lg text-md text-muted">{t("hero.subtitle")}</p>
            </section>

            {/* ------------------------------------------------- scan console */}
            <div className="relative isolate">
              <HomeDecor />
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
                        /* Enter starts the scan, the way every other single
                           field on the web behaves. It stays a textarea so a
                           list of addresses can still be pasted, and
                           Shift+Enter is the way left to reach a new line. */
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          if (!loading) handleExtract();
                        }
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

                  {/* The row ends flush with the field above, and the chips are
                      sized so that reaching the edge costs almost nothing.

                      At the base chip size the five names only fill about four
                      fifths of the column, so `grow` had to hand each pill some
                      28px of slack and the leftover read as hollow padding. A
                      taller pill with 13px text and a 16px mark takes up most of
                      that width on its own, leaving a few pixels per chip to
                      absorb. The utilities beat `.chip` because Tailwind's
                      utilities layer sits above `@layer components`, so the
                      scope chips inside the settings block keep the base size. */}
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-faint">
                    <span className="shrink-0">{t("scan.try")}</span>
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s.domain}
                        onClick={() => setUrls(`https://${s.domain}`)}
                        className="chip h-8 grow justify-center px-3 text-sm"
                      >
                        <Image
                          src={s.icon}
                          alt=""
                          width={16}
                          height={16}
                          className="shrink-0 rounded-[3px]"
                        />
                        {s.domain}
                      </button>
                    ))}
                  </div>

                  <hr className="my-5 border-border" />

                  {/* The settings start collapsed. Nobody tunes a scan before
                      seeing its first result, and giving five scope chips the
                      same visual weight as the URL field made the card read as
                      a form rather than as one action.

                      The summary line is not decoration. Hiding the block costs
                      the user sight of which mode is active, and Deep is the
                      mode that produces the better document, so the line states
                      it without requiring a click. */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-faint">{scanSummary}</p>
                    <button
                      type="button"
                      onClick={() => setShowSettings((v) => !v)}
                      aria-expanded={showSettings}
                      aria-controls="scan-settings"
                      className="text-xs font-semibold text-brand-500 underline-offset-2 hover:underline"
                    >
                      {showSettings ? t("home.settingsHide") : t("home.settingsShow")}
                    </button>
                  </div>

                  {showSettings && (
                    <div id="scan-settings" className="animate-fade mt-4">
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
                                  mode === m ? "bg-brand-500 text-on-brand" : "text-muted hover:text-fg"
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
                        <label className="animate-fade mt-4 flex items-center gap-2 text-xs text-muted">
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
                    </div>
                  )}
                </section>
              )}

              {loading && <ScanLoader stage={stage} />}
            </div>

            {scanErrors}

            {/* -------------------------------------------------- idle content */}
            {!response && !loading && (
              <section>
                <h2 className="eyebrow mb-4">{t("home.how")}</h2>
                <ol className="grid gap-2 sm:grid-cols-3">
                  {flow.map((step, i) => (
                    <li
                      key={step.title}
                      className="card p-4 transition-colors hover:border-border-strong"
                    >
                      <div className="mb-2 flex items-baseline gap-2">
                        <span className="font-mono text-xs font-bold text-brand-500">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="text-base font-semibold text-fg">{step.title}</span>
                      </div>
                      <p className="text-sm text-muted">{step.desc}</p>
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------ report */}
        {hasResults && response && (
          <div ref={resultsRef} className="mx-auto w-full max-w-3xl scroll-mt-20">
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
