import type { DesignModel } from "./model";

export interface NexoraDesignContext {
  schema: "nexora.design-context";
  version: 1;
  generatedBy: string;
  sourceVersion?: string;
  sourceUrl: string;
  sourceTitle: string;
  generatedAt: string;
  designSystem: {
    colors: Array<{ name: string; hex: string; usage: number }>;
    neutralColors: Array<{ name: string; hex: string; usage: number }>;
    fontFamilies: string[];
    fontSizes: Array<{ value: string; px: number | null }>;
    spacing: Array<{ value: string; px: number | null }>;
    radius: Array<{ value: string; px: number | null }>;
  };
  health: { overall: number | null };
  accessibility: { critical: number; warning: number; pass: number };
  components: { total: number };
}

const pxOf = (raw: string): number | null => {
  const px = /([\d.]+)\s*px$/i.exec(raw.trim());
  return px ? Math.round(parseFloat(px[1]) * 100) / 100 : null;
};

export function buildNexoraDesignContext(m: DesignModel): NexoraDesignContext {
  const colors = m.tokens.colors.primary.slice(0, 24).map((c) => ({ name: c.name || c.hex, hex: c.hex, usage: c.usage }));
  const neutralColors = m.tokens.colors.neutral.slice(0, 12).map((c) => ({ name: c.name || c.hex, hex: c.hex, usage: c.usage }));
  const fontFamilies = m.tokens.typography.families.slice(0, 8).map((f) => f.raw);
  const fontSizes = m.tokens.typography.sizes.slice(0, 16).map((s) => ({ value: s.raw, px: pxOf(s.raw) }));
  const spacing = m.tokens.spacing.slice(0, 20).map((s) => ({ value: s.raw, px: s.px }));
  const radius = m.tokens.radius.slice(0, 12).map((r) => ({ value: r.raw, px: r.px }));
  const components = Array.isArray(m.components) ? m.components.length : m.components ? Object.keys(m.components).length : 0;
  return {
    schema: "nexora.design-context",
    version: 1,
    generatedBy: `${m.metadata.tool} ${m.metadata.version}`,
    sourceVersion: m.schemaVersion,
    sourceUrl: m.source.url,
    sourceTitle: m.source.title,
    generatedAt: m.metadata.generatedAt,
    designSystem: { colors, neutralColors, fontFamilies, fontSizes, spacing, radius },
    health: { overall: m.health?.overall ?? null },
    accessibility: {
      critical: Math.min(m.accessibility?.wcagAA.critical ?? 0, 999),
      warning: Math.min(m.accessibility?.wcagAA.warning ?? 0, 999),
      pass: Math.min(m.accessibility?.wcagAA.pass ?? 0, 9999),
    },
    components: { total: components },
  };
}

export function buildNexoraDesignContextJson(m: DesignModel): string {
  return JSON.stringify(buildNexoraDesignContext(m), null, 2);
}