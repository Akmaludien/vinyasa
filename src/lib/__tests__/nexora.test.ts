import { describe, it, expect } from "vitest";
import { extractDesignSystem } from "@/lib/extractor";
import { buildExports } from "@/lib/export";
import { buildNexoraDesignContext, buildNexoraDesignContextJson } from "@/lib/nexora";
import { buildDesignSpecification } from "@/lib/spec";
import { adaptDesign } from "@/lib/adapt";
import { isCanonicalDesignContext } from "@/lib/validate-design-context";
import { parseNexoraProductContext } from "@/lib/nexora-product-context";
import type { NexoraProductContext } from "@/lib/nexora-product-context";
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

function productCtx(): NexoraProductContext {
  return parseNexoraProductContext({
    schema_version: "1.0",
    project_id: "shop",
    project: { key: "shop", name: "Shop", description: "d" },
    product: {
      features: [{ id: "f-1", title: "Cart" }],
      requirements: [{ id: "r-1", title: "Fast load" }],
      userFlows: [{ id: "u-1", title: "Buy" }],
    },
  }) as NexoraProductContext;
}

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

  it("always carries components.blocks and the full design block", () => {
    const ctx = buildNexoraDesignContext(model(FIXTURE_CSS));
    expect(Array.isArray(ctx.components.blocks)).toBe(true);
    expect(ctx.components.blocks.length).toBe(ctx.components.total);
    for (const key of [
      "pages",
      "components",
      "interactions",
      "responsiveRules",
      "layout",
      "visualLanguage",
      "implementationHints",
    ] as const) {
      expect(ctx.design[key]).toBeDefined();
    }
    // No adaptation unless one is supplied.
    expect(ctx.design.adaptation).toBeUndefined();
  });

  it("derives the specification itself when none is passed", () => {
    const m = model(FIXTURE_CSS);
    const withSpec = buildNexoraDesignContext(m, buildDesignSpecification(m));
    const withoutSpec = buildNexoraDesignContext(m);
    expect(withoutSpec.design.layout).toEqual(withSpec.design.layout);
    expect(withoutSpec.design.visualLanguage).toEqual(withSpec.design.visualLanguage);
  });

  it("includes adaptation only when supplied and preserves product structure", () => {
    const m = model(FIXTURE_CSS);
    const spec = buildDesignSpecification(m);
    const adaptation = adaptDesign(spec, productCtx());
    const ctx = buildNexoraDesignContext(m, spec, adaptation);
    expect(ctx.design.adaptation).toBeDefined();
    expect(ctx.design.adaptation!.product_structure!.features).toEqual(["Cart"]);
  });

  it("serialises to JSON without loss of blocks, design, or adaptation", () => {
    const m = model(FIXTURE_CSS);
    const spec = buildDesignSpecification(m);
    const ctx = buildNexoraDesignContext(m, spec, adaptDesign(spec, productCtx()));
    const parsed = JSON.parse(JSON.stringify(ctx)) as typeof ctx;
    expect(parsed.components.blocks.length).toBe(ctx.components.blocks.length);
    expect(parsed.design.adaptation!.product_structure!.features).toEqual(["Cart"]);
    expect(Object.keys(parsed.design).sort()).toEqual(Object.keys(ctx.design).sort());
  });

  it("produces a payload that passes the canonical validator", () => {
    const m = model(FIXTURE_CSS);
    const spec = buildDesignSpecification(m);
    expect(isCanonicalDesignContext(buildNexoraDesignContext(m))).toBe(true);
    expect(isCanonicalDesignContext(buildNexoraDesignContext(m, spec, adaptDesign(spec, productCtx())))).toBe(true);
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

describe("generic nexora.json export vs live sync", () => {
  it("keeps the generic export deterministic and free of product adaptation", () => {
    const m = model(FIXTURE_CSS);
    const a = JSON.parse(buildExports(m).files["nexora.json"]) as ReturnType<typeof buildNexoraDesignContext>;
    const b = JSON.parse(buildExports(m).files["nexora.json"]) as ReturnType<typeof buildNexoraDesignContext>;
    expect(a.design.adaptation).toBeUndefined();
    expect(a).toEqual(b);
    expect(isCanonicalDesignContext(a)).toBe(true);
  });

  it("only the live payload carries adaptation, and tokens stay authoritative", () => {
    const m = model(FIXTURE_CSS);
    const spec = buildDesignSpecification(m);
    const live = buildNexoraDesignContext(m, spec, adaptDesign(spec, productCtx()));
    const generic = JSON.parse(buildExports(m).files["nexora.json"]) as typeof live;
    expect(live.design.adaptation).toBeDefined();
    expect(generic.design.adaptation).toBeUndefined();
    // Authoritative design tokens are identical in both surfaces.
    expect(live.designSystem).toEqual(generic.designSystem);
    // And the underlying DesignModel is not mutated by adaptation.
    expect(m.tokens.colors.primary[0]?.hex).toBe(model(FIXTURE_CSS).tokens.colors.primary[0]?.hex);
  });
});

describe("isCanonicalDesignContext", () => {
  const valid = () => buildNexoraDesignContext(model(FIXTURE_CSS));

  it("rejects non-objects", () => {
    for (const v of [null, undefined, 1, "x", true, []]) {
      expect(isCanonicalDesignContext(v)).toBe(false);
    }
  });

  it("rejects a wrong schema", () => {
    expect(isCanonicalDesignContext({ ...valid(), schema: "nexora.other" })).toBe(false);
  });

  it("rejects a malformed designSystem", () => {
    expect(isCanonicalDesignContext({ ...valid(), designSystem: null })).toBe(false);
    expect(isCanonicalDesignContext({ ...valid(), designSystem: "tokens" })).toBe(false);
  });

  it("rejects an empty-token payload even when the schema is right", () => {
    expect(
      isCanonicalDesignContext({
        schema: "nexora.design-context",
        designSystem: { colors: [], neutralColors: [], fontFamilies: [] },
      }),
    ).toBe(false);
  });

  it("accepts a payload read back with structured design intact", () => {
    const readBack = JSON.parse(JSON.stringify(valid()));
    expect(isCanonicalDesignContext(readBack)).toBe(true);
    // The opaque design block is not re-interpreted by the validator.
    expect(isCanonicalDesignContext({ ...readBack, design: { anything: true } })).toBe(true);
  });
});
