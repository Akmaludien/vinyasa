"use client";

import { useState } from "react";
import type { DesignModel } from "@/lib/model";

interface Props {
  model: DesignModel;
}

// Inline SVGs
const SparklesIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    <path d="M5 3v4" />
    <path d="M19 17v4" />
    <path d="M3 5h4" />
    <path d="M17 19h4" />
  </svg>
);

const PaletteIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
    <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
    <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
    <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
  </svg>
);

const TypeIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 7 4 4 20 4 20 7" />
    <line x1="9" x2="15" y1="20" y2="20" />
    <line x1="12" x2="12" y1="4" y2="20" />
  </svg>
);

const MaximizeIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 3H5a2 2 0 0 0-2 2v3" />
    <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
    <path d="M3 16v3a2 2 0 0 0 2 2h3" />
    <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
  </svg>
);

const CopyIcon = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </svg>
);

const CheckIcon = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

// Calculate relative luminance for WCAG contrast
function getLuminance(hex: string): number {
  const clean = hex.replace("#", "");
  if (clean.length < 6) return 0.5;
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;

  const a = [r, g, b].map((v) => {
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

function getContrastRatio(hex1: string, hex2: string): number {
  const lum1 = getLuminance(hex1);
  const lum2 = getLuminance(hex2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return Number(((brightest + 0.05) / (darkest + 0.05)).toFixed(2));
}

export function VisualPlayground({ model }: Props) {
  const [activeTab, setActiveTab] = useState<"colors" | "typography" | "spacing">("colors");
  const [sampleText, setSampleText] = useState("The quick brown fox jumps over the lazy dog");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const colors = [...model.tokens.colors.primary, ...model.tokens.colors.neutral];
  const typography = model.tokens.typography;
  const spacing = model.tokens.spacing;
  const radius = model.tokens.radius;

  function copy(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedToken(id);
    setTimeout(() => setCopiedToken(null), 1800);
  }

  return (
    <div style={{ background: "var(--card-bg, #14161d)", border: "1px solid var(--border, #2d3139)", borderRadius: 12, overflow: "hidden", marginTop: 24 }}>
      {/* Playground Header */}
      <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border, #2d3139)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "var(--accent, #6366f1)" }}><SparklesIcon size={18} /></span>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Visual Token Playground</h3>
          <span style={{ fontSize: 11, padding: "2px 8px", background: "rgba(99, 102, 241, 0.15)", color: "var(--accent, #818cf8)", borderRadius: 10, fontWeight: 600 }}>
            Interactive
          </span>
        </div>

        {/* Tab Controls */}
        <div style={{ display: "flex", background: "var(--bg, #0b0c10)", padding: 3, borderRadius: 8, border: "1px solid var(--border, #2d3139)", gap: 4 }}>
          <button
            type="button"
            className={`btn ${activeTab === "colors" ? "btn-primary" : "btn-quiet"}`}
            style={{ fontSize: 12, padding: "4px 12px", display: "flex", alignItems: "center", gap: 6 }}
            onClick={() => setActiveTab("colors")}
          >
            <PaletteIcon size={14} />
            <span>Colors & Contrast</span>
          </button>
          <button
            type="button"
            className={`btn ${activeTab === "typography" ? "btn-primary" : "btn-quiet"}`}
            style={{ fontSize: 12, padding: "4px 12px", display: "flex", alignItems: "center", gap: 6 }}
            onClick={() => setActiveTab("typography")}
          >
            <TypeIcon size={14} />
            <span>Type Scale</span>
          </button>
          <button
            type="button"
            className={`btn ${activeTab === "spacing" ? "btn-primary" : "btn-quiet"}`}
            style={{ fontSize: 12, padding: "4px 12px", display: "flex", alignItems: "center", gap: 6 }}
            onClick={() => setActiveTab("spacing")}
          >
            <MaximizeIcon size={14} />
            <span>Spacing & Radius</span>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div style={{ padding: 24 }}>
        {/* TAB 1: Color Ramp & Contrast Grid */}
        {activeTab === "colors" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
              {colors.slice(0, 16).map((c, i) => {
                const contrastOnWhite = getContrastRatio(c.hex, "#FFFFFF");
                const contrastOnDark = getContrastRatio(c.hex, "#111827");
                const isAA = contrastOnWhite >= 4.5 || contrastOnDark >= 4.5;
                const isAAA = contrastOnWhite >= 7.0 || contrastOnDark >= 7.0;

                return (
                  <div
                    key={i}
                    style={{
                      borderRadius: 8,
                      border: "1px solid var(--border, #2d3139)",
                      background: "var(--bg, #0b0c10)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: 72,
                        background: c.hex,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        position: "relative",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => copy(c.hex, `color-${i}`)}
                        style={{
                          background: "rgba(0,0,0,0.6)",
                          color: "#fff",
                          border: "none",
                          borderRadius: 4,
                          padding: "4px 8px",
                          fontSize: 11,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        {copiedToken === `color-${i}` ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
                        <span className="mono">{c.hex}</span>
                      </button>
                    </div>

                    <div style={{ padding: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontWeight: 600, fontSize: 13, color: "var(--ink, #fff)" }}>
                          {c.name || `Color ${i + 1}`}
                        </span>
                        <span style={{ fontSize: 11, color: "var(--subtle, #9ca3af)" }}>
                          {c.usage}%
                        </span>
                      </div>

                      {/* WCAG Badges */}
                      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                        <span
                          style={{
                            fontSize: 10,
                            padding: "2px 6px",
                            borderRadius: 4,
                            background: isAA ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                            color: isAA ? "var(--success, #34d399)" : "var(--danger, #fca5a5)",
                            fontWeight: 700,
                          }}
                        >
                          {isAA ? "WCAG AA PASS" : "WCAG AA FAIL"}
                        </span>
                        {isAAA && (
                          <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "rgba(99, 102, 241, 0.2)", color: "var(--accent, #818cf8)", fontWeight: 700 }}>
                            AAA
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: Typography Scale Visualizer */}
        {activeTab === "typography" && (
          <div>
            {/* Live Text Customizer */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: "var(--subtle, #9ca3af)", display: "block", marginBottom: 6 }}>
                Pratinjau Teks Sampel
              </label>
              <input
                type="text"
                value={sampleText}
                onChange={(e) => setSampleText(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "1px solid var(--border, #2d3139)",
                  background: "var(--bg, #0b0c10)",
                  color: "var(--ink, #fff)",
                  fontSize: 13,
                }}
              />
            </div>

            {/* Font Family Banner */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
              {typography.families.map((f, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: "6px 12px",
                    background: "var(--bg, #0b0c10)",
                    border: "1px solid var(--border, #2d3139)",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                >
                  <span style={{ color: "var(--subtle, #9ca3af)", marginRight: 6 }}>Family {idx + 1}:</span>
                  <span className="mono" style={{ color: "var(--accent, #818cf8)", fontWeight: 600 }}>{f.raw}</span>
                </div>
              ))}
            </div>

            {/* Rendered Scale List */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {typography.sizes.slice(0, 7).map((s, idx) => {
                const label = idx === 0 ? "Display / H1" : idx === 1 ? "Heading 2" : idx === 2 ? "Heading 3" : idx === 3 ? "Body Large" : idx === 4 ? "Body Regular" : "Caption / Small";
                const sizePx = s.px ?? 16;
                const clampedSize = Math.min(Math.max(sizePx, 11), 48);

                return (
                  <div
                    key={idx}
                    style={{
                      padding: "16px",
                      borderRadius: 8,
                      border: "1px solid var(--border, #2d3139)",
                      background: "var(--bg, #0b0c10)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent, #818cf8)", textTransform: "uppercase" }}>
                        {label} · {s.raw} ({s.px}px)
                      </span>
                      <button
                        type="button"
                        onClick={() => copy(s.raw, `size-${idx}`)}
                        className="btn btn-quiet"
                        style={{ fontSize: 11, padding: "2px 8px", display: "flex", alignItems: "center", gap: 4 }}
                      >
                        {copiedToken === `size-${idx}` ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
                        <span>Copy token</span>
                      </button>
                    </div>

                    <div
                      style={{
                        fontSize: clampedSize,
                        lineHeight: 1.25,
                        color: "var(--ink, #fff)",
                        wordBreak: "break-word",
                        fontFamily: typography.families[0]?.raw || "inherit",
                      }}
                    >
                      {sampleText}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: Spacing & Border Radius Scale */}
        {activeTab === "spacing" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            {/* Spacing Scale */}
            <div>
              <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: "var(--ink, #fff)" }}>
                Spacing Dimensions
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {spacing.slice(0, 8).map((sp, idx) => {
                  const widthPx = Math.min((sp.px ?? 16) * 4, 260);
                  return (
                    <div key={idx} style={{ padding: 10, background: "var(--bg, #0b0c10)", borderRadius: 6, border: "1px solid var(--border, #2d3139)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                        <span className="mono" style={{ color: "var(--accent, #818cf8)" }}>{sp.raw}</span>
                        <span style={{ color: "var(--subtle, #9ca3af)" }}>{sp.px}px</span>
                      </div>
                      <div style={{ height: 12, width: widthPx, background: "var(--accent, #6366f1)", borderRadius: 3 }} />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Radius Scale */}
            <div>
              <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: "var(--ink, #fff)" }}>
                Border Radius Scale
              </h4>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {radius.slice(0, 6).map((r, idx) => (
                  <div
                    key={idx}
                    style={{
                      height: 80,
                      borderRadius: r.raw,
                      border: "2px dashed var(--accent, #6366f1)",
                      background: "rgba(99, 102, 241, 0.08)",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 8,
                    }}
                  >
                    <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: "var(--ink, #fff)" }}>
                      {r.raw}
                    </span>
                    <span style={{ fontSize: 10, color: "var(--subtle, #9ca3af)" }}>
                      radius-{idx + 1}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
