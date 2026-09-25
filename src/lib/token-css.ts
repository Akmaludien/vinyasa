import type { DesignModel } from "./model";
import { assignRoles } from "./design-decisions";
import { isUsableValue } from "./token-value";
export { isUsableValue } from "./token-value";

/**
 * The two paste-ready token blocks: plain custom properties, and a Tailwind v4
 * `@theme`.
 *
 * They live here rather than in export.ts because DESIGN.md embeds the same two
 * blocks. Sharing them keeps both callers byte-identical: what a
 * reader copies out of the document is exactly what lands in tokens.css.
 */

function cssVarName(...parts: string[]): string {
  return `--${parts.join("-")}`;
}

/**
 * The custom property a palette entry becomes.
 *
 * Exported so DESIGN.md can label its palette rows with the exact name that
 * appears in the snippet below them: hue names repeat (three different greys
 * all come out as "white"), and without the index the table cannot say which
 * row is which variable.
 */
export function colorVarName(kind: "primary" | "neutral", index: number, name: string): string {
  return cssVarName("color", kind, `${index + 1}-${name}`);
}

function usable<T extends { raw: string }>(tokens: T[]): T[] {
  return tokens.filter((t) => isUsableValue(t.raw));
}

export function buildTokensCss(m: DesignModel): string {
  const lines: string[] = [];
  lines.push(":root {");
  for (const role of assignRoles(m.tokens.colors)) {
    lines.push(`  --color-${role.id}: ${role.hex};`);
  }
  lines.push("");
  const colors = m.tokens.colors;
  colors.primary.slice(0, 16).forEach((c, i) => {
    lines.push(`  ${colorVarName("primary", i, c.name)}: ${c.hex};`);
  });
  colors.neutral.slice(0, 12).forEach((c, i) => {
    lines.push(`  ${colorVarName("neutral", i, c.name)}: ${c.hex};`);
  });

  const fonts = m.tokens.typography;
  lines.push("");
  usable(fonts.families)
    .slice(0, 5)
    .forEach((f, i) => {
      lines.push(`  ${cssVarName("font", "family", String(i + 1))}: ${f.raw};`);
    });
  usable(fonts.sizes)
    .slice(0, 8)
    .forEach((s, i) => {
      lines.push(`  ${cssVarName("font", "size", String(i + 1))}: ${s.raw};`);
    });
  fonts.weights.slice(0, 5).forEach((w, i) => {
    lines.push(`  ${cssVarName("font", "weight", String(i + 1))}: ${w.value};`);
  });

  usable(m.tokens.spacing)
    .slice(0, 10)
    .forEach((s, i) => {
      lines.push(`  ${cssVarName("spacing", String(i + 1))}: ${s.raw};`);
    });
  usable(m.tokens.radius)
    .slice(0, 6)
    .forEach((r, i) => {
      lines.push(`  ${cssVarName("radius", String(i + 1))}: ${r.raw};`);
    });
  usable(m.tokens.durations)
    .slice(0, 4)
    .forEach((d, i) => {
      lines.push(`  ${cssVarName("duration", String(i + 1))}: ${d.raw};`);
    });

  lines.push("}");
  lines.push("");
  return lines.join("\n");
}

export function buildTailwindCss(m: DesignModel): string {
  const lines: string[] = [];
  lines.push('@import "tailwindcss";');
  lines.push("");
  lines.push("@theme {");
  for (const role of assignRoles(m.tokens.colors)) {
    lines.push(`  --color-${role.id}: ${role.hex};`);
  }
  lines.push("");

  m.tokens.colors.primary.slice(0, 16).forEach((c, i) => {
    lines.push(`  --color-primary-${i + 1}: ${c.hex};`);
  });
  m.tokens.colors.neutral.slice(0, 12).forEach((c, i) => {
    lines.push(`  --color-neutral-${i + 1}: ${c.hex};`);
  });

  const fonts = m.tokens.typography;
  lines.push("");
  usable(fonts.families)
    .slice(0, 5)
    .forEach((f, i) => {
      lines.push(`  --font-family-sans-${i + 1}: ${f.raw};`);
    });
  usable(fonts.sizes)
    .slice(0, 8)
    .forEach((s, i) => {
      lines.push(`  --text-${i + 1}: ${s.raw};`);
    });

  usable(m.tokens.spacing)
    .slice(0, 10)
    .forEach((s, i) => {
      lines.push(`  --spacing-${i + 1}: ${s.raw};`);
    });
  usable(m.tokens.radius)
    .slice(0, 6)
    .forEach((r, i) => {
      lines.push(`  --radius-${i + 1}: ${r.raw};`);
    });

  lines.push("}");
  lines.push("");
  return lines.join("\n");
}
