import type { DesignSpecification, SpecVisualLanguage, ImplementationHint } from "./spec";
import type { ComponentSpec } from "./components";
import type { NexoraProjectContext } from "./project-context";

export interface AdaptationOptions {
  /** Prefix applied to CSS class selectors generated for the target framework. */
  classNamePrefix?: string;
  /** When true, token values stay as-is and only the consumption format changes. */
  preserveTokens?: boolean;
}

export interface AdaptedDesign {
  source: DesignSpecification;
  context: NexoraProjectContext;
  visual_language: SpecVisualLanguage;
  components: ComponentSpec[];
  implementation_hints: ImplementationHint[];
  /** Metadata describing what was transformed. */
  applied: string[];
}

/**
 * Adapts a canonical DesignSpecification to a target stack described by
 * NexoraProjectContext. Token values are preserved (plants/detection stay
 * authoritative); only the consumption surface (naming, hints) is transformed.
 */
export function adaptDesign(
  spec: DesignSpecification,
  ctx: NexoraProjectContext,
  opts?: AdaptationOptions,
): AdaptedDesign {
  const applied: string[] = [];
  const classPrefix = opts?.classNamePrefix ?? ctx.styling?.prefix ?? "";

  const visual_language: SpecVisualLanguage = {
    ...spec.visual_language,
    colors: {
      primary: spec.visual_language.colors.primary.map((c) => (ctx.brand?.primaryColor ? { ...c, value: ctx.brand.primaryColor } : c)),
      neutral: spec.visual_language.colors.neutral.map((c) => (ctx.brand?.accentColor ? { ...c, value: ctx.brand.accentColor } : c)),
    },
  };

  if (ctx.brand?.primaryColor && spec.visual_language.colors.primary.some((c) => c.value !== ctx.brand!.primaryColor)) {
    applied.push("primary color overridden from brand context");
  }

  const components = spec.components.map((c) =>
    classPrefix
      ? { ...c, selectors: c.selectors.map((s) => (classPrefixRegExp(classPrefix).test(s) ? s : prefixSelector(s, classPrefix))) }
      : c,
  );
  if (classPrefix) applied.push(`class prefix \`${classPrefix}\` applied to component selectors`);

  const frameworkHints = frameworkHintsFor(ctx);

  return {
    source: spec,
    context: ctx,
    visual_language,
    components,
    implementation_hints: [...spec.implementation_hints, ...frameworkHints],
    applied,
  };
}

export function adaptedDesignJson(adapted: AdaptedDesign): string {
  return JSON.stringify(adapted, null, 2);
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