import type { DesignSpecification, SpecVisualLanguage, ImplementationHint } from "./spec";
import type { ComponentSpec } from "./components";
import type { NexoraProjectContext } from "./project-context";
import type { NexoraProductContext } from "./nexora-product-context";

export interface AdaptationOptions {
  /** Prefix applied to CSS class selectors generated for the target framework. */
  classNamePrefix?: string;
  /** When true, token values stay as-is and only the consumption format changes. */
  preserveTokens?: boolean;
}

/**
 * The context a design is adapted to. Prefer the full `NexoraProductContext`
 * (Nexora product structure + target stack); a bare `NexoraProjectContext`
 * (stack/brand/conventions only) is accepted for callers that do not hold a
 * Nexora product envelope yet.
 */
export type AdaptationInput = NexoraProductContext | NexoraProjectContext;

export interface AdaptedDesign {
  source: DesignSpecification;
  context: NexoraProjectContext;
  /** Canonical product structure the design must map onto (Nexora source). */
  product_structure?: {
    pages: Array<{ id: string; title: string; kind: string }>;
    features: string[];
    requirements: string[];
    userFlows: string[];
    architecture?: string[];
  };
  visual_language: SpecVisualLanguage;
  components: ComponentSpec[];
  implementation_hints: ImplementationHint[];
  /** Metadata describing what was transformed. */
  applied: string[];
}

function asProjectContext(input: AdaptationInput): NexoraProjectContext {
  return (input as NexoraProductContext).source === "nexora"
    ? (input as NexoraProductContext).context
    : (input as NexoraProjectContext);
}

function asProductContext(input: AdaptationInput): NexoraProductContext | null {
  return (input as NexoraProductContext).source === "nexora"
    ? (input as NexoraProductContext)
    : null;
}

/**
 * Adapts a canonical DesignSpecification to a target stack and product surface
 * described by a NexoraProductContext (or a bare NexoraProjectContext). Token
 * values are preserved (plants/detection stay authoritative); only the
 * consumption surface (naming, hints, product alignment) is transformed.
 */
export function adaptDesign(
  spec: DesignSpecification,
  ctx: AdaptationInput,
  opts?: AdaptationOptions,
): AdaptedDesign {
  const applied: string[] = [];
  const stack = asProjectContext(ctx);
  const product = asProductContext(ctx);
  const classPrefix = opts?.classNamePrefix ?? stack.styling?.prefix ?? "";

  const visual_language: SpecVisualLanguage = {
    ...spec.visual_language,
    colors: {
      primary: spec.visual_language.colors.primary.map((c) => (stack.brand?.primaryColor ? { ...c, value: stack.brand.primaryColor } : c)),
      neutral: spec.visual_language.colors.neutral.map((c) => (stack.brand?.accentColor ? { ...c, value: stack.brand.accentColor } : c)),
    },
  };

  if (stack.brand?.primaryColor && spec.visual_language.colors.primary.some((c) => c.value !== stack.brand!.primaryColor)) {
    applied.push("primary color overridden from brand context");
  }

  let components = spec.components;
  if (product) {
    const { components: productComponents, changed } = alignToProduct(components, product);
    if (changed) {
      components = productComponents;
      applied.push("component selectors aligned to Nexora product structure");
    }
  }

  if (classPrefix) {
    components = components.map((c) =>
      c.selectors.some((s) => classPrefixRegExp(classPrefix).test(s))
        ? c
        : { ...c, selectors: c.selectors.map((s) => prefixSelector(s, classPrefix)) },
    );
    applied.push(`class prefix \`${classPrefix}\` applied to component selectors`);
  }

  const frameworkHints = frameworkHintsFor(stack);

  return {
    source: spec,
    context: stack,
    product_structure: product?.structure,
    visual_language,
    components,
    implementation_hints: [...spec.implementation_hints, ...frameworkHints],
    applied,
  };
}

export function adaptedDesignJson(adapted: AdaptedDesign): string {
  return JSON.stringify(adapted, null, 2);
}

/**
 * Re-keys generic component selectors (`.page`, `.feature`, `.requirement` …)
 * to the product surface Nexora reports, so the delivered design reads against
 * the user's actual pages/features/requirements rather than the reference site.
 * Components whose category does not map to a product dimension are left
 * untouched so the mapping stays conservative.
 */
function alignToProduct(
  components: ComponentSpec[],
  product: NexoraProductContext,
): { components: ComponentSpec[]; changed: boolean } {
  const pageTitles = product.structure.pages.map((p) => p.title.trim()).filter(Boolean);
  const featureTitles = product.structure.features.map((f) => f.trim()).filter(Boolean);
  const requirementTitles = product.structure.requirements.map((r) => r.trim()).filter(Boolean);

  let changed = false;
  const next = components.map((c) => {
    const token = `${c.name} ${c.category}`.toLowerCase();
    let target: string | undefined;
    if (/(page|section)/.test(token) && pageTitles.length) target = pageTitles[0];
    else if (/(feature|pricing|plan)/.test(token) && featureTitles.length) target = featureTitles[0];
    else if (/(requirement|form)/.test(token) && requirementTitles.length) target = requirementTitles[0];
    if (!target) return c;
    const slug = slugify(target);
    // Map a leading class selector `.name` -> `.{slug}` (keeps pseudo/descendant parts).
    const selectors = c.selectors.map((s) => s.replace(/\.([a-zA-Z][\w-]*)/, `.${slug}`));
    if (selectors.some((s, i) => s !== c.selectors[i])) changed = true;
    return { ...c, selectors };
  });

  return { components: next, changed };
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function frameworkHintsFor(ctx: NexoraProjectContext): ImplementationHint[] {
  const hints: ImplementationHint[] = [];
  if (ctx.framework) {
    hints.push({
      code: "target_framework",
      message: `Target stack: ${ctx.framework}${ctx.frameworkVersion ? ` ${ctx.frameworkVersion}` : ""}.`,
      severity: "info",
    });
  }
  if (ctx.styling?.componentLibrary) {
    hints.push({
      code: "component_library",
      message: `Map primitives to ${ctx.styling.componentLibrary} building blocks where applicable.`,
      severity: "info",
    });
  }
  if (ctx.conventions?.namingConvention && ctx.conventions.namingConvention !== "bem") {
    hints.push({
      code: "naming_convention",
      message: `Adopt \`${ctx.conventions.namingConvention}\` naming; convert any BEM-style modifiers accordingly.`,
      severity: "info",
    });
  }
  return hints;
}

function classPrefixRegExp(prefix: string): RegExp {
  return new RegExp(`(^|[-_])${escapeRegExp(prefix)}([-_]|$)`);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function prefixSelector(selector: string, prefix: string): string {
  // Prefix bare class selectors, e.g. `.btn` -> `.prefix-btn`.
  return selector.replace(/(\.)([a-zA-Z][\w-]*)/g, (_m, dot, name) => `${dot}${prefix}-${name}`);
}