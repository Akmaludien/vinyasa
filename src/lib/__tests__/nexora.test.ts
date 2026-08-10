import { describe, it, expect } from "vitest";
import { extractDesignSystem } from "@/lib/extractor";
import { buildExports } from "@/lib/export";
import { buildNexoraDesignContext, buildNexoraDesignContextJson } from "@/lib/nexora";
import type { CssSourceInput } from "@/lib/model";

function model(css: string, url = "https://design.example/") {
  const src: CssSourceInput[] = [{ url: "a.css", kind: "inline", content: css }];
  return extractDesignSystem(src, url, "Design Fixture");
}

const FIXTURE_CSS = `
:root { --p: #2563eb; }
body { color: #0f172a; background: #ffffff; font-family: "Inter", sans-serif; font-size: 16px; padding: 16px; }
.btn { border-radius: 8px; color: #2563eb; background: #2563eb; }
`;

describe("buildNexoraDesignContext", () => {
  it("maps a DesignModel into the bounded nexora.design-context shape", () => {
    const m = model(FIXTURE_CSS);
    const ctx = buildNexoraDesignContext(m);
    expect(ctx.schema).toBe("nexora.design-context");
    expect(ctx.generatedBy).toContain("vinyasa");
    expect(ctx.sourceUrl).toBe("https://design.example/");
    expect(ctx.designSystem.colors.length + ctx.designSystem.neutralColors.length).toBeGreaterThan(0);
    expect(ctx.designSystem.fontFamilies.length).toBeGreaterThan(0);
    expect(typeof ctx.health.overall).toBe("number");
    expect(Array.isArray(ctx.designSystem.spacing)).toBe(true);
    expect(typeof ctx.components.total).toBe("number");
    expect(ctx.sourceVersion).toBe("1.0.0");
  });

  it("round-trips through the Vinyasa export bundle", () => {
    const m = model(FIXTURE_CSS);
    const ex = buildExports(m);
    const parsed = JSON.parse(ex.files["nexora.json"]) as ReturnType<typeof buildNexoraDesignContext>;
    expect(parsed.schema).toBe("nexora.design-context");
    expect(parsed.designSystem.fontFamilies.length).toBeGreaterThan(0);
    const serializable = buildNexoraDesignContextJson(m);
    expect(() => JSON.parse(serializable)).not.toThrow();
  });
});