import type { DesignModel } from "./model";
import { categorizeComponent, type ComponentSpec, type DetectedComponent } from "./components";

export const DESIGN_SPEC_SCHEMA_VERSION = "1.0.0";

export const HISTORY_ACTION = Symbol("history" as const);

export interface SpecSource {
  type: "website";
  url: string;
  title: string;
  pages: number;
}

export interface SpecVisualLanguage {
  colors: {
    primary: Array<{ name: string; value: string; usage: number }>;
    neutral: Array<{ name: string; value: string; usage: number }>;
  };
  typography: {
    families: string[];
    sizes: Array<{ value: string; px: number | null }>;
    weights: number[];
  };
  spacing: Array<{ value: string; px: number | null }>;
  radius: Array<{ value: string; px: number | null }>;
  shadows: string[];
  borders: string[];
  motion: { durations: string[]; easings: string[] };
  breakpoints: Array<{ feature: string; value: string; px: number | null }>;
  darkMode: { detected: boolean; variables: string[] };
}

export interface SpecLayout {
  containers: string[];
  grid: { breakpoints: number };
  navigation: string[];
  sections: string[];
}

export interface SpecPage {
  url: string;
  title: string;
  sections: string[];
  layout: string[];
  components: string[];
  assets: number;
  responsive: { score: number };
  interactions: number;
  states: string[];
  accessibility: { critical: number; warning: number };
}

export interface SpecResponsiveRule {
  region: string;
  breakpoint: string;
  behavior: string;
  detail?: string;
}

export interface SpecInteraction {
  interaction: string;
  target?: string;
  confidence: number;
  evidence?: string[];
}

export interface SpecAccessibility {
  wcagAA: { critical: number; warning: number; pass: number };
  wcagAAA: { critical: number; warning: number; pass: number };
  contrastIssues: string[];
}

export interface ImplementationHint {
  code: string;
  message: string;
  severity: "info" | "warning" | "critical";
}

export interface DesignSpecification {
  design_version: string;
  schema: "design-specification";
  source: SpecSource;
  visual_language: SpecVisualLanguage;
  layout: SpecLayout;
  components: ComponentSpec[];
  pages: SpecPage[];
  interactions: SpecInteraction[];
  responsive_rules: SpecResponsiveRule[];
  accessibility: SpecAccessibility;
  assets: Array<{ name: string; type: string; source: string; used_by: string[] }>;
  implementation_hints: ImplementationHint[];
}

export interface DesignVersion {
  id: string;
  createdAt: string;
  version: string;
  sourceUrl: string;
  scanMode: string;
  status: "pending" | "running" | "completed" | "partial" | "failed";
}

/**
 * Deterministic canonical design specification derived from a DesignModel.
 * The reference (website) is a DESIGN SOURCE — not the product specification.
 */
export function buildDesignSpecification(m: DesignModel): DesignSpecification {
  const t = m.tokens;
  const sections = inferSections(m);
  const interactions = inferInteractions(m);
  const states = inferStates(m);

  const spec: DesignSpecification = {
    design_version: DESIGN_SPEC_SCHEMA_VERSION,
    schema: "design-specification",
    source: {
      type: "website",
      url: m.source.url,
      title: m.source.title,
      pages: m.scan.pageCount || m.pages.length,
    },
    visual_language: {
      colors: {
        primary: t.colors.primary.map((c) => ({ name: c.name || c.hex, value: c.hex, usage: c.usage })),
        neutral: t.colors.neutral.map((c) => ({ name: c.name || c.hex, value: c.hex, usage: c.usage })),
      },
      typography: {
        families: t.typography.families.map((f) => f.raw),
        sizes: t.typography.sizes.map((s) => ({ value: s.raw, px: s.px })),
        weights: t.typography.weights.map((w) => w.value),
      },
      spacing: t.spacing.map((s) => ({ value: s.raw, px: s.px })),
      radius: t.radius.map((r) => ({ value: r.raw, px: r.px })),
      shadows: t.shadows.map((s) => s.raw),
      borders: t.borders.map((b) => b.raw),
      motion: {
        durations: t.durations.map((d) => d.raw),
        easings: t.easings.map((e) => e.raw),
      },
      breakpoints: t.breakpoints.map((b) => ({ feature: b.feature, value: b.raw, px: b.px })),
      darkMode: {
        detected: m.darkMode?.detected ?? false,
        variables: m.darkMode?.themeVariables ?? [],
      },
    },
    layout: {
      containers: inferContainers(m),
      grid: { breakpoints: t.breakpoints.length },
      navigation: m.components.filter((c) => isNavComponent(c.name)).map((c) => c.name),
      sections,
    },
    components: m.components.map((c) => toComponentSpec(c)),
    pages: m.pages.map((p) => ({
      url: p.url,
      title: p.title,
      sections: sectionsForPage(p.url),
      layout: [],
      components: m.components.filter((c) => c.pages.includes(p.url)).map((c) => c.name),
      assets: p.assets?.length ?? 0,
      responsive: { score: m.responsive ? Math.round((m.responsive.mobile + m.responsive.tablet + m.responsive.desktop) / 3) : 0 },
      interactions: interactions.length,
      states,
      accessibility: {
        critical: m.accessibility?.wcagAA.critical ?? 0,
        warning: m.accessibility?.wcagAA.warning ?? 0,
      },
    })),
    interactions,
    responsive_rules: m.responsive?.breakpoints.map((b) => ({
      region: "page",
      breakpoint: b.value,
      behavior: `${b.feature} ${b.value}`,
      detail: `${b.feature === "min-width" ? "≥" : "≤"} ${b.px ?? b.value}`,
    })) ?? [],
    accessibility: {
      wcagAA: m.accessibility?.wcagAA ?? { critical: 0, warning: 0, pass: 0 },
      wcagAAA: m.accessibility?.wcagAAA ?? { critical: 0, warning: 0, pass: 0 },
      contrastIssues: (m.accessibility?.issues ?? [])
        .filter((i) => i.severity === "critical")
        .slice(0, 12)
        .map((i) => i.message),
    },
    assets: collectAssets(m),
    implementation_hints: inferImplementationHints(m, states, interactions),
  };

  return spec;
}

function isNavComponent(name: string): boolean {
  return /nav|header|menu|sidebar/.test(name);
}

const KNOWN_SECTIONS = ["hero", "footer", "header", "navbar", "sidebar", "pricing", "form", "table", "modal", "alert", "card"];

function inferSections(m: DesignModel): string[] {
  const found: string[] = [];
  for (const c of m.components) {
    if (KNOWN_SECTIONS.includes(c.name) && !found.includes(c.name)) found.push(c.name);
  }
  return found;
}

function sectionsForPage(_url: string): string[] {
  return [];
}

const STATE_SELECTORS = ["hover", "focus", "active", "disabled", "checked", "visited", "placeholder", "focus-within"];

function inferStates(m: DesignModel): string[] {
  const found = new Set<string>();
  for (const c of m.components) {
    for (const sel of c.selectors) {
      for (const s of STATE_SELECTORS) {
        if (new RegExp(`:${s}(?:\\b|[-:(])`).test(sel)) found.add(s);
      }
    }
  }
  return [...found];
}

const INTERACTION_PATTERNS: Array<[string, RegExp]> = [
  ["hover", /:hover(?:\b|[-:(])/],
  ["focus", /:focus(?:\b|[-:(])/],
  ["active", /:active(?:\b|[-:(])/],
  ["disabled", /:disabled(?:\b|[-:(])|disabled/],
  ["modal", /\bmodal\b|\bdialog\b|\boverlay\b/],
  ["dropdown", /\bdropdown\b|\bmenu\b|\bpopover\b/],
  ["tabs", /\btab(?:s|s-panel)?\b/],
  ["accordion", /\baccordion\b|\bcollapse\b|\bexpander\b/],
  ["tooltip", /\btooltip\b/],
  ["loading", /\bspinner\b|\bskeleton\b|\bloader\b/],
  ["transition", /\btransition\b|\banimate\b/],
  ["scroll", /\bscroll\b|\bsticky\b|\bparallax\b/],
];

function inferInteractions(m: DesignModel): SpecInteraction[] {
  const found = new Map<string, { confidence: number; evidence: string[] }>();
  for (const c of m.components) {
    for (const sel of c.selectors) {
      for (const [name, re] of INTERACTION_PATTERNS) {
        if (re.test(sel)) {
          const cur = found.get(name) ?? { confidence: 0, evidence: [] };
          cur.confidence += c.confidence;
          if (!cur.evidence.includes(c.name) && cur.evidence.length < 4) cur.evidence.push(c.name);
          found.set(name, cur);
        }
      }
    }
  }
  return [...found.entries()].map(([interaction, v]) => ({
    interaction,
    confidence: Math.round(Math.min(100, v.confidence / 2)),
    evidence: v.evidence,
  }));
}

function inferContainers(m: DesignModel): string[] {
  const found = new Set<string>();
  for (const c of m.components) {
    if (/container|wrapper|wrap|section/.test(c.name) || c.selectors.some((s) => /container|wrapper/.test(s))) {
      found.add(c.name);
    }
  }
  return [...found];
}

function collectAssets(m: DesignModel): Array<{ name: string; type: string; source: string; used_by: string[] }> {
  const seen = new Map<string, { name: string; type: string; source: string; used_by: Set<string> }>();
  for (const p of m.pages) {
    for (const a of p.assets ?? []) {
      const cur = seen.get(a.source) ?? { name: a.name, type: a.type, source: a.source, used_by: new Set<string>() };
      cur.used_by.add(a.page ?? p.url);
      seen.set(a.source, cur);
    }
  }
  return [...seen.entries()]
    .slice(0, 60)
    .map(([source, a]) => ({ name: a.name, type: a.type, source, used_by: [...a.used_by].slice(0, 8) }));
}

export function inferImplementationHints(
  m: DesignModel,
  states: string[],
  interactions: SpecInteraction[],
): ImplementationHint[] {
  const hints: ImplementationHint[] = [];

  if (m.tokens.colors.hardcoded.length > 0) {
    hints.push({
      code: "hardcoded_colors",
      message: `${m.tokens.colors.hardcoded.length} warna sekali-pakai terdeteksi; jadikan semantic token.`,
      severity: "info",
    });
  }
  if (m.darkMode?.detected === false && m.tokens.colors.primary.length > 0) {
    hints.push({
      code: "dark_mode",
      message: "Tidak ada variabel dark mode terdeteksi; pertimbangkan --color-scheme.",
      severity: "info",
    });
  }
  if (interactions.length === 0) {
    hints.push({
      code: "interactions",
      message: "Tidak banyak state interaksi (hover/focus) terdeteksi dari selector.",
      severity: "info",
    });
  }
  if (m.responsive?.breakpoints.length === 0) {
    hints.push({
      code: "responsive",
      message: "Tidak ada breakpoint media query terdeteksi; pertimbangkan sistem grid responsif.",
      severity: "warning",
    });
  }
  if (m.components.length === 0) {
    hints.push({
      code: "components",
      message: "Tidak ada pola komponen terdeteksi; tinjau penamaan class.",
      severity: "info",
    });
  }
  return hints;
}

// Component specs are produced enriched by detectComponents (category/states/dimensions).
function toComponentSpec(c: DetectedComponent): ComponentSpec {
  return {
    ...c,
    states: [],
    category: categorizeComponent(c.name),
  };
}