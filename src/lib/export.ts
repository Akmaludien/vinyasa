import { zipSync, strToU8 } from "fflate";
import type { DesignModel } from "./model";
import { buildDesignMd, type MdOptions } from "./design-md";
import { buildNexoraDesignContextJson } from "./nexora";

export type ExportFormat = "tokens.json" | "tokens.css" | "tailwind.css" | "design.md" | "raw.json" | "readme.md" | "nexora.json";

export interface ExportSet {
  files: Record<string, string>;
}

function cssVarName(...parts: string[]): string {
  return `--${parts.join("-")}`;
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function buildTailwindConfigJs(m: DesignModel): string {
  const colors: Record<string, string> = {};
  m.tokens.colors.primary.slice(0, 16).forEach((c, i) => {
    const key = c.name ? c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") : `primary-${i + 1}`;
    colors[key] = c.hex;
  });
  m.tokens.colors.neutral.slice(0, 12).forEach((c, i) => {
    const key = c.name ? c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") : `neutral-${i + 1}`;
    colors[key] = c.hex;
  });

  const fontFamilies: Record<string, string[]> = {};
  m.tokens.typography.families.slice(0, 4).forEach((f, i) => {
    fontFamilies[`sans-${i + 1}`] = [f.raw, "sans-serif"];
  });

  const spacing: Record<string, string> = {};
  m.tokens.spacing.slice(0, 10).forEach((s, i) => {
    spacing[`space-${i + 1}`] = s.raw;
  });

  const borderRadius: Record<string, string> = {};
  m.tokens.radius.slice(0, 6).forEach((r, i) => {
    borderRadius[`radius-${i + 1}`] = r.raw;
  });

  const config = {
    theme: {
      extend: {
        colors,
        fontFamily: fontFamilies,
        spacing,
        borderRadius,
      },
    },
  };

  return `/** @type {import('tailwindcss').Config} */\nmodule.exports = ${JSON.stringify(config, null, 2)};\n`;
}

export function buildExports(m: DesignModel, mdOpts?: MdOptions): ExportSet {
  const files: Record<string, string> = {};
  files["tokens.json"] = buildTokensJson(m);
  files["tokens.css"] = buildTokensCss(m);
  files["tailwind.css"] = buildTailwindCss(m);
  files["tailwind.config.js"] = buildTailwindConfigJs(m);
  files["DESIGN.md"] = designMdForExport(m, mdOpts);
  files["raw.json"] = JSON.stringify(m, null, 2);
  files["nexora.json"] = buildNexoraDesignContextJson(m);
  return { files };
}

function buildTokensJson(m: DesignModel): string {
  const tokens: Record<string, { $type: string; $value: unknown; $description?: string }> = {};

  const colors = m.tokens.colors;
  colors.primary.slice(0, 16).forEach((c, i) => {
    tokens[`color.primary.${c.name || `c${i}`}`] = {
      $type: "color",
      $value: c.hex,
      $description: `usage ${c.usage}%, count ${c.count}`,
    };
  });
  colors.neutral.slice(0, 12).forEach((c, i) => {
    tokens[`color.neutral.${c.name || `n${i}`}`] = {
      $type: "color",
      $value: c.hex,
      $description: `usage ${c.usage}%`,
    };
  });

  const fonts = m.tokens.typography;
  fonts.families.slice(0, 5).forEach((f, i) => {
    tokens[`font.family.${i + 1}`] = { $type: "fontFamily", $value: f.raw };
  });
  fonts.sizes.slice(0, 8).forEach((s, i) => {
    tokens[`font.size.${i + 1}`] = {
      $type: "dimension",
      $value: s.raw,
      $description: `${s.px}px`,
    };
  });
  fonts.weights.slice(0, 5).forEach((w, i) => {
    tokens[`font.weight.${i + 1}`] = { $type: "fontWeight", $value: w.value };
  });
  fonts.letterSpacings.slice(0, 4).forEach((l, i) => {
    tokens[`font.letterSpacing.${i + 1}`] = { $type: "dimension", $value: l.raw };
  });

  m.tokens.spacing.slice(0, 10).forEach((s, i) => {
    tokens[`spacing.${i + 1}`] = {
      $type: "dimension",
      $value: s.raw,
      $description: s.px !== null ? `${s.px}px` : undefined,
    };
  });

  m.tokens.radius.slice(0, 6).forEach((r, i) => {
    tokens[`radius.${i + 1}`] = { $type: "dimension", $value: r.raw };
  });

  m.tokens.durations.slice(0, 4).forEach((d, i) => {
    tokens[`motion.duration.${i + 1}`] = { $type: "duration", $value: d.raw };
  });

  m.tokens.easings.slice(0, 4).forEach((e, i) => {
    tokens[`motion.easing.${i + 1}`] = { $type: "cubicBezier", $value: e.raw };
  });

  const doc = {
    $schema: "https://schemas.design-tokens.org/0.13.0/modern-types.json",
    $metadata: {
      generator: `vinyasa ${m.metadata.version}`,
      source: m.source.url,
      generatedAt: m.metadata.generatedAt,
      schemaVersion: m.schemaVersion,
    },
    vinyasa: tokens,
  };
  return JSON.stringify(doc, null, 2);
}

function buildTokensCss(m: DesignModel): string {
  const lines: string[] = [];
  lines.push(":root {");
  const colors = m.tokens.colors;
  colors.primary.slice(0, 16).forEach((c, i) => {
    lines.push(`  ${cssVarName("color", "primary", `${i + 1}-${c.name}`)}: ${c.hex};`);
  });
  colors.neutral.slice(0, 12).forEach((c, i) => {
    lines.push(`  ${cssVarName("color", "neutral", `${i + 1}-${c.name}`)}: ${c.hex};`);
  });

  const fonts = m.tokens.typography;
  lines.push("");
  fonts.families.slice(0, 5).forEach((f, i) => {
    lines.push(`  ${cssVarName("font", "family", String(i + 1))}: ${f.raw};`);
  });
  fonts.sizes.slice(0, 8).forEach((s, i) => {
    lines.push(`  ${cssVarName("font", "size", String(i + 1))}: ${s.raw};`);
  });
  fonts.weights.slice(0, 5).forEach((w, i) => {
    lines.push(`  ${cssVarName("font", "weight", String(i + 1))}: ${w.value};`);
  });

  m.tokens.spacing.slice(0, 10).forEach((s, i) => {
    lines.push(`  ${cssVarName("spacing", String(i + 1))}: ${s.raw};`);
  });
  m.tokens.radius.slice(0, 6).forEach((r, i) => {
    lines.push(`  ${cssVarName("radius", String(i + 1))}: ${r.raw};`);
  });
  m.tokens.durations.slice(0, 4).forEach((d, i) => {
    lines.push(`  ${cssVarName("duration", String(i + 1))}: ${d.raw};`);
  });

  lines.push("}");
  lines.push("");
  return lines.join("\n");
}

function buildTailwindCss(m: DesignModel): string {
  const lines: string[] = [];
  lines.push("@import \"tailwindcss\";");
  lines.push("");
  lines.push("@theme {");

  m.tokens.colors.primary.slice(0, 16).forEach((c, i) => {
    lines.push(`  --color-primary-${i + 1}: ${c.hex};`);
  });
  m.tokens.colors.neutral.slice(0, 12).forEach((c, i) => {
    lines.push(`  --color-neutral-${i + 1}: ${c.hex};`);
  });

  const fonts = m.tokens.typography;
  lines.push("");
  fonts.families.slice(0, 5).forEach((f, i) => {
    lines.push(`  --font-family-sans-${i + 1}: ${f.raw};`);
  });
  fonts.sizes.slice(0, 8).forEach((s, i) => {
    lines.push(`  --text-${i + 1}: ${s.raw};`);
  });

  m.tokens.spacing.slice(0, 10).forEach((s, i) => {
    lines.push(`  --spacing-${i + 1}: ${s.raw};`);
  });
  m.tokens.radius.slice(0, 6).forEach((r, i) => {
    lines.push(`  --radius-${i + 1}: ${r.raw};`);
  });

  lines.push("}");
  lines.push("");
  return lines.join("\n");
}

function designMdForExport(m: DesignModel, mdOpts?: MdOptions): string {
  return buildDesignMd(m, mdOpts);
}

export function buildDownloadFolder(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").replace(/[^a-z0-9.-]/gi, "_");
    return `vinyasa-${host}`;
  } catch {
    return "vinyasa-design";
  }
}

export function buildZip(m: DesignModel, mdOpts?: MdOptions): { name: string; data: Uint8Array } {
  const files = buildExports(m, mdOpts).files;
  const folder = buildDownloadFolder(m.source.url);
  const entries: Record<string, Uint8Array> = {};
  for (const [name, content] of Object.entries(files)) {
    entries[`${folder}/${name}`] = strToU8(content);
  }
  return { name: `${folder}.zip`, data: zipSync(entries, { level: 6 }) };
}

export { hexToRgba };