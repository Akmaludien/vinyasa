import { describe, it, expect } from "vitest";
import { compareDesignModels } from "@/lib/compare";
import { detectDesignDrift } from "@/lib/drift";
import { buildTailwindConfigJs, buildExports } from "@/lib/export";
import { extractDesignSystem } from "@/lib/extractor";

function createModel(url: string, css: string) {
  return extractDesignSystem(
    [{ url: "styles.css", kind: "inline", content: css }],
    url,
    "Test Page",
  );
}

describe("compareDesignModels", () => {
  it("computes color overlap, typography shared families, and health delta", () => {
    const modelA = createModel("https://site-a.com", "body { color: #6366f1; background: #10b981; font-family: Inter; }");
    const modelB = createModel("https://site-b.com", "body { color: #6366f1; background: #f59e0b; font-family: Inter, Poppins; }");

    const result = compareDesignModels(modelA, modelB);

    expect(result.urlA).toBe("https://site-a.com");
    expect(result.urlB).toBe("https://site-b.com");
    expect(typeof result.health.scoreA).toBe("number");
    expect(typeof result.health.scoreB).toBe("number");

    // Shared color: #6366f1
    expect(result.colors.shared.some((c) => c.hex.toLowerCase() === "#6366f1")).toBe(true);
    expect(result.colors.overlapPercentage).toBeGreaterThan(0);

    // Typography shared family: inter
    expect(result.typography.sharedFamilies).toContain("inter");
  });
});

describe("detectDesignDrift", () => {
  it("tracks added/removed colors and health changes across scans", () => {
    const prev = createModel("https://mysite.com", "body { color: #6366f1; font-family: Inter; }");
    const curr = createModel("https://mysite.com", "body { color: #6366f1; background: #3b82f6; font-family: Geist; }");

    const drift = detectDesignDrift(prev, curr);

    expect(drift.targetUrl).toBe("https://mysite.com");
    expect(typeof drift.scoreChange).toBe("number");
    expect(drift.fontChanges.addedFamilies).toContain("Geist");
  });
});

describe("buildTailwindConfigJs and buildExports", () => {
  it("generates valid module.exports string with extended theme", () => {
    const model = createModel("https://tokens.com", "body { color: #6366f1; font-family: Inter; margin: 16px; border-radius: 8px; }");
    const tailwindConfig = buildTailwindConfigJs(model);

    expect(tailwindConfig).toContain("module.exports =");
    expect(tailwindConfig).toContain("colors");
    expect(tailwindConfig).toContain("#6366f1");

    const exportsSet = buildExports(model);
    expect(exportsSet.files["tailwind.config.js"]).toBeDefined();
    expect(exportsSet.files["tokens.json"]).toBeDefined();
    expect(exportsSet.files["tokens.css"]).toBeDefined();
  });
});
