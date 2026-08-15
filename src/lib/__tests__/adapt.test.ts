import { describe, it, expect } from "vitest";
import { adaptDesign, adaptedDesignJson, type AdaptedDesign, type AdaptationInput } from "@/lib/adapt";
import type { DesignSpecification, ImplementationHint, SpecVisualLanguage } from "@/lib/spec";
import type { ComponentSpec } from "@/lib/components";
import { parseProjectContext } from "@/lib/project-context";
import { parseNexoraProductContext } from "@/lib/nexora-product-context";
import type { NexoraProductContext } from "@/lib/nexora-product-context";

function color(value: string): { name: string; value: string; usage: number } {
  return { name: "c", value, usage: 1 };
}

function spec(overrides?: Partial<DesignSpecification>): DesignSpecification {
  const visual_language: SpecVisualLanguage = {
    colors: {
      primary: [color("#2563eb")],
      neutral: [color("#0f172a")],
    },
    typography: { families: ["Inter"], sizes: [], weights: [] },
    spacing: [],
    radius: [],
    shadows: [],
    borders: [],
    motion: { durations: [], easings: [] },
    breakpoints: [],
    darkMode: { detected: false, variables: [] },
  };
  const base: DesignSpecification = {
    design_version: "1.0.0",
    schema: "design-specification",
    source: { type: "website", url: "https://design.example/", title: "Fixture", pages: 1 },
    visual_language,
    layout: { containers: [], grid: { breakpoints: 0 }, navigation: [], sections: [] },
    components: [],
    pages: [],
    interactions: [],
    responsive_rules: [],
    accessibility: {
      wcagAA: { critical: 0, warning: 0, pass: 0 },
      wcagAAA: { critical: 0, warning: 0, pass: 0 },
      contrastIssues: [],
    },
    assets: [],
    implementation_hints: [{ code: "base", message: "base hint", severity: "info" }],
  };
  return { ...base, ...overrides };
}

function component(name: string, selectors: string[]): ComponentSpec {
  return {
    name,
    category: "Other",
    confidence: 80,
    selectors,
    count: 1,
    variantCount: 0,
    properties: {},
    pages: ["https://design.example/"],
    humanName: name,
  };
}

const STACK_HINT: ImplementationHint = { code: "target_framework", message: "Target stack: next 15.", severity: "info" };

function legacyCtx(): AdaptationInput {
  return parseProjectContext({
    schema: "nexora.project-context",
    version: 1,
    projectName: "Acme",
    framework: "next",
    frameworkVersion: "15",
    brand: { primaryColor: "#ff0000" },
    styling: { prefix: "acme" },
  }) as AdaptationInput;
}

function productCtx(opts?: { prefix?: string }): NexoraProductContext {
  const ctx = parseNexoraProductContext({
    project: { key: "shop", name: "Shop", description: "d" },
    product: {
      features: [{ id: "f-1", title: "Cart" }, { id: "f-2", title: "Checkout" }],
      requirements: [{ id: "r-1", title: "Fast load" }],
      userFlows: [{ id: "u-1", title: "Buy" }],
    },
  }) as NexoraProductContext;
  if (opts?.prefix) {
    // A real NexoraProjectContext carries styling underneath the product envelope.
    ctx.context = { ...ctx.context, styling: { prefix: opts.prefix } };
  }
  return ctx;
}

describe("adaptDesign input handling", () => {
  it("accepts a bare NexoraProjectContext and adapts without product structure", () => {
    const ctx = legacyCtx();
    const adapted = adaptDesign(spec(), ctx);
    expect(adapted.context.framework).toBe("next");
    expect(adapted.product_structure).toBeUndefined();
    expect(adapted.visual_language.colors.primary[0]?.value).toBe("#ff0000");
    expect(adapted.applied).toContain("primary color overridden from brand context");
  });

  it("accepts a NexoraProductContext and exposes its product structure", () => {
    const adapted = adaptDesign(spec(), productCtx());
    expect(adapted.product_structure).toBeDefined();
    expect(adapted.product_structure!.features).toEqual(["Cart", "Checkout"]);
    expect(adapted.product_structure!.requirements).toEqual(["Fast load"]);
    expect(adapted.context.projectName).toBe("Shop");
  });

  it("applies class prefix to component selectors", () => {
    const adapted = adaptDesign(spec({ components: [component("button", [".btn"])] }), legacyCtx());
    expect(adapted.components[0].selectors).toEqual([".acme-btn"]);
    expect(adapted.applied).toContain("class prefix `acme` applied to component selectors");
  });

  it("serializes to JSON", () => {
    const adapted = adaptDesign(spec(), productCtx());
    expect(() => JSON.parse(adaptedDesignJson(adapted))).not.toThrow();
    const parsed = JSON.parse(adaptedDesignJson(adapted)) as AdaptedDesign;
    expect(parsed.product_structure?.features).toEqual(["Cart", "Checkout"]);
  });
});

describe("adaptDesign product alignment", () => {
  it("maps feature components to Nexora feature names", () => {
    const base = spec({
      components: [component("pricing", [".pricing"]), component("button", [".btn"])],
    });
    const adapted = adaptDesign(base, productCtx());
    const pricing = adapted.components.find((c) => c.name === "pricing")!;
    expect(pricing.selectors).toEqual([".cart"]);
    expect(adapted.applied).toContain("component selectors aligned to Nexora product structure");
  });

  it("leaves components with no product mapping untouched", () => {
    const base = spec({ components: [component("card", [".card"])] });
    const adapted = adaptDesign(base, productCtx());
    expect(adapted.components[0].selectors).toEqual([".card"]);
    expect(adapted.applied).not.toContain("component selectors aligned to Nexora product structure");
  });

  it("preserves descendant and pseudo selectors when re-keying", () => {
    const base = spec({
      components: [component("pricing", [".pricing .btn:hover"])],
    });
    const adapted = adaptDesign(base, productCtx());
    expect(adapted.components[0].selectors[0]).toBe(".cart .btn:hover");
  });

  it("combines product alignment with class prefix", () => {
    const base = spec({ components: [component("pricing", [".pricing"])] });
    const adapted = adaptDesign(base, productCtx({ prefix: "acme" }));
    // product maps .pricing -> .cart, then prefix -> .acme-cart
    expect(adapted.components[0].selectors[0]).toBe(".acme-cart");
  });
});

describe("adaptDesign framework hints", () => {
  it("emits target stack hints from the product context stack", () => {
    const s = spec({ implementation_hints: [] });
    const adapted = adaptDesign(s, legacyCtx());
    expect(adapted.implementation_hints).toContainEqual(STACK_HINT);
  });
});