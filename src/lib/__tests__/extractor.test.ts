import { describe, it, expect } from "vitest";
import { extractDesignSystem } from "@/lib/extractor";
import type { CssSourceInput } from "@/lib/model";

const CSS = `
:root { --brand: #6366f1; --space-md: 16px; }
body {
  color: var(--brand);
  font-family: "Inter", sans-serif;
  font-size: 16px;
  margin: var(--space-md);
  padding: 24px;
  gap: 8px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,.15);
  background: linear-gradient(135deg, #6366f1, #a855f7);
  transition-duration: 300ms;
}
.btn { padding: 12px 20px; border-radius: 9999px; }
@media (min-width: 768px) { .card { gap: 24px; } }
`;

function model() {
  const src: CssSourceInput[] = [{ url: "x.css", kind: "inline", content: CSS }];
  return extractDesignSystem(src, "https://t.test/", "Test");
}

describe("extractDesignSystem", () => {
  it("produces a valid DesignModel v1.0.0", () => {
    const m = model();
    expect(m.schemaVersion).toBe("1.0.0");
    expect(m.metadata.tool).toBe("vinyasa");
    expect(m.source.title).toBe("Test");
  });

  it("resolves CSS variables (var())", () => {
    const m = model();
    const hexes = m.tokens.colors.primary.map((c) => c.hex.toLowerCase());
    expect(hexes).toContain("#6366f1");
    expect(hexes).toContain("#a855f7");
  });

  it("extracts spacing, radius, shadows, gradients, durations", () => {
    const m = model();
    expect(m.tokens.spacing.some((s) => s.raw === "24px")).toBe(true);
    expect(m.tokens.radius.some((r) => r.raw === "12px")).toBe(true);
    expect(m.tokens.radius.some((r) => r.raw === "9999px")).toBe(true);
    expect(m.tokens.shadows.length).toBeGreaterThan(0);
    expect(m.tokens.gradients.length).toBeGreaterThan(0);
    expect(m.tokens.durations.some((d) => d.raw === "300ms")).toBe(true);
  });

  it("detects breakpoints from @media", () => {
    const m = model();
    expect(m.tokens.breakpoints.some((b) => b.feature === "min-width" && b.raw === "768px")).toBe(true);
  });

  it("detects components heuristically", () => {
    const m = model();
    expect(m.components.some((c) => c.name === "button")).toBe(true);
  });

  it("computes health and accessibility reports", () => {
    const m = model();
    expect(m.health).not.toBeNull();
    expect(m.accessibility).not.toBeNull();
    expect(m.responsive).not.toBeNull();
    expect(m.darkMode).not.toBeNull();
  });

  it("always returns the same shape", () => {
    const a = model();
    const b = model();
    expect(a.tokens.colors.primary[0].hex).toBe(b.tokens.colors.primary[0].hex);
    expect(a.health!.overall).toBe(b.health!.overall);
  });
});