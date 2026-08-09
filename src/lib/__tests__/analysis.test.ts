import { describe, it, expect } from "vitest";
import { extractDesignSystem } from "@/lib/extractor";
import { computeHealth } from "@/lib/health";
import { computeAccessibility } from "@/lib/accessibility";
import { diffModels } from "@/lib/diff";
import { buildExports } from "@/lib/export";
import type { CssSourceInput } from "@/lib/model";

function model(css: string, url = "https://t.test/") {
  const src: CssSourceInput[] = [{ url: "a.css", kind: "inline", content: css }];
  return extractDesignSystem(src, url, "Test");
}

const HEALTHY_CSS = `
:root { --p: #2563eb; }
body { color: #0f172a; background: #ffffff; font-family: "Inter",sans-serif; }
.btn { padding: 4px 8px 12px 16px; gap: 8px; border-radius: 8px; color: #2563eb; background: #2563eb; }
.card { padding: 16px; gap: 8px; border-radius: 8px; }
`;

describe("computeHealth", () => {
  it("scores consistency with dominant scale", () => {
    const m = model(HEALTHY_CSS);
    const h = computeHealth(m);
    expect(h.overall).toBeGreaterThanOrEqual(0);
    expect(h.overall).toBeLessThanOrEqual(100);
    expect(h.spacing.dominantValues.length).toBeGreaterThan(0);
  });

  it("flags outliers when values are scattered", () => {
    const m = model(`
      body { margin: 13px; }
      .a { padding: 19px; }
      .b { padding: 27px; }
      .c { padding: 37px; }
      .d { padding: 47px; }
      .e { padding: 57px; }
      .f { padding: 67px; }
      .g { padding: 77px; }
    `);
    const h = computeHealth(m);
    expect(h.spacing.outliers.length).toBeGreaterThan(0);
  });
});

describe("computeAccessibility", () => {
  it("reports contrast issues", () => {
    const m = model(`
      body { color: #ffffff; background: #ffffff; font-size: 14px; }
    `);
    const a11y = computeAccessibility(m);
    expect(a11y.wcagAA.critical).toBeGreaterThan(0);
    expect(a11y.issues.some((i) => i.kind === "contrast")).toBe(true);
  });
});

describe("diffModels", () => {
  it("detects added/removed tokens", () => {
    const a = model(`body { color: #000; } .btn { border-radius: 8px; }`);
    const b = model(`body { color: #fff; } .btn { border-radius: 12px; } .tag { padding: 4px; }`);
    const d = diffModels(a, b);
    expect(d).not.toBeNull();
    expect(d!.summary.added).toBeGreaterThan(0);
    expect(d!.summary.removed).toBeGreaterThan(0);
  });

  it("detects changed tokens of same key", () => {
    const a = model(`body { color: #000; } .btn { border-radius: 8px; } .button { border-radius: 8px; }`);
    const b = model(`body { color: #000; } .btn { border-radius: 8px; }`);
    const d = diffModels(a, b);
    expect(d).not.toBeNull();
    expect(d!.summary.changed).toBeGreaterThan(0);
  });
});

describe("buildExports", () => {
  it("produces all export files", () => {
    const m = model(`body { color: #2563eb; font-size: 16px; }`);
    const ex = buildExports(m);
    expect(ex.files["tokens.json"]).toBeTruthy();
    expect(ex.files["tokens.css"]).toBeTruthy();
    expect(ex.files["tailwind.css"]).toBeTruthy();
    expect(ex.files["DESIGN.md"]).toBeTruthy();
    expect(ex.files["raw.json"]).toBeTruthy();
    const parsed = JSON.parse(ex.files["tokens.json"]);
    expect(parsed.$metadata.schemaVersion).toBe("1.0.0");
  });
});