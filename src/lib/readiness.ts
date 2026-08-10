import type { DesignModel } from "./model";

export type ReadinessState = "complete" | "partial" | "missing";

export interface ReadinessDimension {
  key: string;
  label: string;
  state: ReadinessState;
  ratio: number;
  detail?: string;
}

export interface ReadinessResult {
  score: number;
  dimensions: ReadinessDimension[];
  summary: string;
}

/**
 * Measures how structurally complete Vinyasa's design output is for downstream
 * implementation. This is NOT Build-Pack readiness — it reflects whether the
 * deterministic design layer is structured enough to build upon.
 */
export function computeReadiness(model: DesignModel): ReadinessResult {
  const dims: ReadinessDimension[] = [];

  // Design system / tokens
  dims.push(
    ratioDim(
      "tokens",
      "Design tokens",
      model.tokens.colors.primary.length +
        model.tokens.colors.neutral.length +
        model.tokens.typography.families.length +
        model.tokens.typography.sizes.length,
      6,
    ),
  );

  dims.push(ratioDim("components", "Components", model.components.length, 3));
  dims.push(ratioDim("pages", "Pages", model.pages.length, 2));
  dims.push(ratioDim("responsive", "Responsive", model.responsive?.breakpoints.length ?? 0, 1));
  dims.push(
    ratioDim(
      "accessibility",
      "Accessibility",
      (model.accessibility?.issues.length ?? 0) > 0 ? 1 : 0,
      1,
    ),
  );
  dims.push(
    ratioDim(
      "assets",
      "Assets",
      model.pages.reduce((sum, p) => sum + (p.assets?.length ?? 0), 0),
      2,
    ),
  );

  const score = dims.length
    ? Math.round(dims.reduce((sum, d) => sum + d.ratio, 0) / dims.length * 100)
    : 0;

  return {
    score,
    dimensions: dims,
    summary:
      score >= 80
        ? "Struktur desain lengkap dan siap dikonsumsi downstream."
        : score >= 50
          ? "Struktur desain memadai, beberapa dimensi dapat diperkuat (deep/visual pass)."
          : "Struktur desain perlu diperkaya sebelum dapat dibangun di atasnya.",
  };
}

function ratioDim(
  key: string,
  label: string,
  present: number,
  target: number,
): ReadinessDimension {
  const ratio = target <= 0 ? 0 : Math.min(1, present / target);
  const state: ReadinessState = ratio >= 0.8 ? "complete" : ratio >= 0.4 ? "partial" : "missing";
  return {
    key,
    label,
    ratio,
    state,
    detail: `${present}/${target}`,
  };
}