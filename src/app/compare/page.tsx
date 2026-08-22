"use client";

import { useState } from "react";
import Link from "next/link";
import type { DesignModel } from "@/lib/model";
import { compareDesignModels, type ComparisonResult } from "@/lib/compare";

// Inline SVGs
const ArrowLeftIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 19-7-7 7-7" />
    <path d="M19 12H5" />
  </svg>
);

const ArrowRightIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);

const GitCompareIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="18" r="3" />
    <circle cx="6" cy="6" r="3" />
    <path d="M13 6h3a2 2 0 0 1 2 2v7" />
    <path d="M11 18H8a2 2 0 0 1-2-2V9" />
  </svg>
);

const RefreshIcon = ({ size = 16, className = "" }: { size?: number; className?: string }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
    <path d="M16 21h5v-5" />
  </svg>
);

const PaletteIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
    <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
    <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
    <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
  </svg>
);

const TypeIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 7 4 4 20 4 20 7" />
    <line x1="9" x2="15" y1="20" y2="20" />
    <line x1="12" x2="12" y1="4" y2="20" />
  </svg>
);

export default function ComparePage() {
  const [urlA, setUrlA] = useState("https://stripe.com");
  const [urlB, setUrlB] = useState("https://linear.app");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCompare() {
    if (!urlA.trim() || !urlB.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Scan URL A
      const resA = await fetch("/api/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: urlA, scope: "smart" }),
      });
      const dataA = await resA.json();
      if (!resA.ok) throw new Error(`Failed scanning URL A (${urlA}): ${dataA.error || "Unknown"}`);

      // Scan URL B
      const resB = await fetch("/api/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: urlB, scope: "smart" }),
      });
      const dataB = await resB.json();
      if (!resB.ok) throw new Error(`Failed scanning URL B (${urlB}): ${dataB.error || "Unknown"}`);

      const modelA: DesignModel = dataA.results ? dataA.results[0] : dataA.model;
      const modelB: DesignModel = dataB.results ? dataB.results[0] : dataB.model;

      if (!modelA || !modelB) throw new Error("Could not extract valid models from both URLs");

      const comp = compareDesignModels(modelA, modelB);
      setResult(comp);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Comparison failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg, #0b0c10)", color: "var(--ink, #f3f4f6)", padding: "32px 16px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* Navigation back */}
        <div style={{ marginBottom: 20 }}>
          <Link href="/" className="btn btn-quiet" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <ArrowLeftIcon size={14} />
            <span>Vinyasa Extractor</span>
          </Link>
        </div>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--accent, #818cf8)", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
            <GitCompareIcon size={14} />
            <span>A/B Design System Comparison</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 8px" }}>Compare Two Design Systems Side-by-Side</h1>
          <p style={{ color: "var(--subtle, #9ca3af)", fontSize: 14, margin: 0 }}>
            Bandingkan token warna, hierarki typography, skor audit health, dan konsistensi komponen antar dua website secara langsung.
          </p>
        </div>

        {/* Input Card */}
        <div style={{ padding: 24, borderRadius: 12, border: "1px solid var(--border, #2d3139)", background: "var(--surface, #14161d)", marginBottom: 32 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink, #fff)", display: "block", marginBottom: 6 }}>
                URL Website A
              </label>
              <input
                type="url"
                value={urlA}
                onChange={(e) => setUrlA(e.target.value)}
                placeholder="https://example.com"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--border, #2d3139)",
                  background: "var(--bg, #0b0c10)",
                  color: "var(--ink, #fff)",
                  fontSize: 14,
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink, #fff)", display: "block", marginBottom: 6 }}>
                URL Website B
              </label>
              <input
                type="url"
                value={urlB}
                onChange={(e) => setUrlB(e.target.value)}
                placeholder="https://competitor.com"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--border, #2d3139)",
                  background: "var(--bg, #0b0c10)",
                  color: "var(--ink, #fff)",
                  fontSize: 14,
                }}
              />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={loading || !urlA.trim() || !urlB.trim()}
              onClick={handleCompare}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 24px", fontSize: 14, fontWeight: 600 }}
            >
              {loading ? (
                <>
                  <RefreshIcon size={16} className="animate-spin" />
                  <span>Memindai & Membandingkan...</span>
                </>
              ) : (
                <>
                  <GitCompareIcon size={16} />
                  <span>Bandingkan Sekarang</span>
                  <ArrowRightIcon size={16} />
                </>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ padding: "12px 16px", background: "rgba(239, 68, 68, 0.15)", border: "1px solid var(--danger, #ef4444)", color: "var(--danger, #fca5a5)", borderRadius: 8, marginBottom: 24 }}>
            {error}
          </div>
        )}

        {/* Results View */}
        {result && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* Overview Summary Card */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <div style={{ padding: 20, borderRadius: 10, border: "1px solid var(--border, #2d3139)", background: "var(--surface, #14161d)" }}>
                <div style={{ fontSize: 12, color: "var(--subtle, #9ca3af)", marginBottom: 4 }}>Website A</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "var(--ink, #fff)", marginBottom: 12, wordBreak: "break-all" }}>
                  {result.urlA}
                </div>
                <div style={{ display: "flex", gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: "var(--accent, #818cf8)" }}>{result.health.scoreA}/100</div>
                    <div style={{ fontSize: 11, color: "var(--subtle, #9ca3af)" }}>Design Health</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: "var(--ink, #fff)" }}>{result.colors.totalA}</div>
                    <div style={{ fontSize: 11, color: "var(--subtle, #9ca3af)" }}>Color Tokens</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: "var(--ink, #fff)" }}>{result.components.totalA}</div>
                    <div style={{ fontSize: 11, color: "var(--subtle, #9ca3af)" }}>Components</div>
                  </div>
                </div>
              </div>

              <div style={{ padding: 20, borderRadius: 10, border: "1px solid var(--border, #2d3139)", background: "var(--surface, #14161d)" }}>
                <div style={{ fontSize: 12, color: "var(--subtle, #9ca3af)", marginBottom: 4 }}>Website B</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "var(--ink, #fff)", marginBottom: 12, wordBreak: "break-all" }}>
                  {result.urlB}
                </div>
                <div style={{ display: "flex", gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: "var(--accent, #818cf8)" }}>{result.health.scoreB}/100</div>
                    <div style={{ fontSize: 11, color: "var(--subtle, #9ca3af)" }}>Design Health</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: "var(--ink, #fff)" }}>{result.colors.totalB}</div>
                    <div style={{ fontSize: 11, color: "var(--subtle, #9ca3af)" }}>Color Tokens</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: "var(--ink, #fff)" }}>{result.components.totalB}</div>
                    <div style={{ fontSize: 11, color: "var(--subtle, #9ca3af)" }}>Components</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Colors Overlap Matrix */}
            <div style={{ padding: 20, borderRadius: 10, border: "1px solid var(--border, #2d3139)", background: "var(--surface, #14161d)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: "var(--accent, #818cf8)" }}><PaletteIcon size={18} /></span>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Color Token Overlap & Divergence</h3>
                </div>
                <span style={{ fontSize: 12, padding: "2px 8px", background: "rgba(16,185,129,0.15)", color: "var(--success, #34d399)", borderRadius: 8, fontWeight: 700 }}>
                  {result.colors.overlapPercentage}% Shared Palettes
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                {/* Shared */}
                <div style={{ padding: 12, background: "var(--bg, #0b0c10)", borderRadius: 8, border: "1px solid var(--border, #2d3139)" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--success, #34d399)", marginBottom: 8 }}>
                    Shared Colors ({result.colors.shared.length})
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {result.colors.shared.map((c, idx) => (
                      <div key={idx} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", background: "rgba(255,255,255,0.05)", borderRadius: 6, fontSize: 11 }}>
                        <div style={{ width: 12, height: 12, borderRadius: 2, background: c.hex }} />
                        <span className="mono">{c.hex}</span>
                      </div>
                    ))}
                    {result.colors.shared.length === 0 && <span style={{ fontSize: 12, color: "var(--subtle, #9ca3af)" }}>Tidak ada kesamaan warna persis.</span>}
                  </div>
                </div>

                {/* Unique A */}
                <div style={{ padding: 12, background: "var(--bg, #0b0c10)", borderRadius: 8, border: "1px solid var(--border, #2d3139)" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent, #818cf8)", marginBottom: 8 }}>
                    Unique to A ({result.colors.uniqueA.length})
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 160, overflowY: "auto" }}>
                    {result.colors.uniqueA.slice(0, 12).map((c, idx) => (
                      <div key={idx} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", background: "rgba(255,255,255,0.05)", borderRadius: 6, fontSize: 11 }}>
                        <div style={{ width: 12, height: 12, borderRadius: 2, background: c.hex }} />
                        <span className="mono">{c.hex}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Unique B */}
                <div style={{ padding: 12, background: "var(--bg, #0b0c10)", borderRadius: 8, border: "1px solid var(--border, #2d3139)" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--warning, #fbbf24)", marginBottom: 8 }}>
                    Unique to B ({result.colors.uniqueB.length})
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 160, overflowY: "auto" }}>
                    {result.colors.uniqueB.slice(0, 12).map((c, idx) => (
                      <div key={idx} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", background: "rgba(255,255,255,0.05)", borderRadius: 6, fontSize: 11 }}>
                        <div style={{ width: 12, height: 12, borderRadius: 2, background: c.hex }} />
                        <span className="mono">{c.hex}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Typography Comparison */}
            <div style={{ padding: 20, borderRadius: 10, border: "1px solid var(--border, #2d3139)", background: "var(--surface, #14161d)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <span style={{ color: "var(--accent, #818cf8)" }}><TypeIcon size={18} /></span>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Typography Scale Comparison</h3>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--subtle, #9ca3af)", marginBottom: 6 }}>Font Families A:</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {result.typography.familiesA.map((f, i) => (
                      <span key={i} className="mono" style={{ fontSize: 12, padding: "4px 8px", background: "var(--bg, #0b0c10)", borderRadius: 6, border: "1px solid var(--border, #2d3139)" }}>{f}</span>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--subtle, #9ca3af)", marginBottom: 6 }}>Font Families B:</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {result.typography.familiesB.map((f, i) => (
                      <span key={i} className="mono" style={{ fontSize: 12, padding: "4px 8px", background: "var(--bg, #0b0c10)", borderRadius: 6, border: "1px solid var(--border, #2d3139)" }}>{f}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
