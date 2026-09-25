import * as csstree from "css-tree";
import { cssColorToRgb, toHex } from "./colors";
import type { ColorRole, ColorRoleEvidence } from "./model";
import type { VarResolver } from "./cssvars";

const DARK_CONTEXT = /(?:prefers-color-scheme\s*:\s*dark|(?:^|[\s.\[:_-])dark(?:$|[\s.\]:_-])|data-theme\s*=\s*["']?dark)/i;
const INACTIVE_CONTEXT = /:(?:hover|focus|active|disabled|visited|before|after)\b|\[aria-hidden\s*=\s*["']?true/i;

function opaqueHex(value: string): string | null {
  const clean = value.replace(/\s*!important\s*$/i, "").trim();
  if (/gradient\(|image\(|url\(|transparent|\bnone\b/i.test(clean)) return null;
  const hexAlpha = clean.match(/^#(?:[\da-f]{4}|[\da-f]{8})$/i);
  if (hexAlpha) {
    const alpha = clean.length === 5 ? parseInt(clean[4] + clean[4], 16) : parseInt(clean.slice(-2), 16);
    if (alpha < 230) return null;
  }
  const fnAlpha = clean.match(/^rgba?\([^)]*[,/]\s*([\d.]+%?)\s*\)$/i);
  if (fnAlpha && (/^rgba\(/i.test(clean) || clean.includes("/"))) {
    const raw = fnAlpha[1];
    const alpha = raw.endsWith("%") ? parseFloat(raw) / 100 : parseFloat(raw);
    if (alpha < 0.9) return null;
  }
  const rgb = cssColorToRgb(clean);
  return rgb ? toHex(rgb) : null;
}

function selectorScore(selector: string): number {
  const parts = selector.split(",").map((part) => part.trim());
  if (parts.some((part) => /^(?:html|body|:root|:host)$/.test(part))) return 100;
  if (parts.some((part) => /^(?:html|body)(?:[.#:\[]|\s)/.test(part))) return 90;
  if (parts.some((part) => /^(?:main|#app|#__next|#root)(?:$|[.#:\[]|\s)/.test(part))) return 75;
  if (/(?:homepage|page|layout|theme|site|shell)/i.test(selector)) return 50;
  return 0;
}

/** CSS declarations provide stronger role evidence than palette frequency. */
export function collectColorEvidence(ast: csstree.CssNode, resolver: VarResolver): ColorRoleEvidence[] {
  const evidence: ColorRoleEvidence[] = [];
  const context: string[] = [];
  const add = (role: ColorRole, value: string, score: number) => {
    const hex = opaqueHex(resolver.resolve(value));
    if (hex) evidence.push({ role, hex, score });
  };

  csstree.walk(ast, {
    enter(node: csstree.CssNode) {
      if (node.type === "Atrule") {
        context.push(node.prelude ? csstree.generate(node.prelude) : node.name);
        return;
      }
      if (node.type !== "Rule") return;
      const selector = csstree.generate(node.prelude).replace(/\s+/g, " ").trim();
      if (DARK_CONTEXT.test(selector) || INACTIVE_CONTEXT.test(selector) || context.some((item) => DARK_CONTEXT.test(item))) return;
      const pageScore = selectorScore(selector);
      node.block.children.forEach((child: csstree.CssNode) => {
        if (child.type !== "Declaration") return;
        const prop = child.property.toLowerCase();
        const value = csstree.generate(child.value);
        if (prop.startsWith("--")) {
          if (/(?:background-base|page-background|background-page)$/.test(prop)) add("background", value, 65);
          else if (/(?:card-background|surface-background)$/.test(prop)) add("surface", value, 55);
          else if (/(?:text-strong|text-primary|text-default)$/.test(prop)) add("text", value, 55);
          else if (/(?:text-muted|text-secondary|link-secondary-text)$/.test(prop)) add("muted", value, 45);
          else if (/(?:button-primary-background|brand-primary)$/.test(prop)) add("brand", value, 55);
          return;
        }
        if (prop === "background" || prop === "background-color") {
          if (pageScore) add("background", value, pageScore);
          else if (/(?:card|panel|surface|navbar|header)/i.test(selector)) add("surface", value, 35);
          if (/(?:button|btn|cta)/i.test(selector) && /primary/i.test(selector)) add("brand", value, 55);
        } else if (prop === "color") {
          if (pageScore >= 75) add("text", value, pageScore);
          else if (/(?:heading|title|paragraph|body|copy)/i.test(selector)) add("text", value, 45);
          else if (/(?:muted|secondary|caption)/i.test(selector)) add("muted", value, 40);
        } else if (prop === "border-color" || prop === "border") {
          add("border", value, 25);
        }
      });
    },
    leave(node: csstree.CssNode) {
      if (node.type === "Atrule") context.pop();
    },
  });

  const grouped = new Map<string, ColorRoleEvidence>();
  for (const item of evidence) {
    const key = `${item.role}|${item.hex}`;
    const previous = grouped.get(key);
    grouped.set(key, {
      ...item,
      score: Math.max(previous?.score ?? 0, item.score),
      count: (previous?.count ?? 0) + 1,
    });
  }
  const roles: ColorRole[] = ["background", "surface", "border", "text", "muted", "brand", "brandAlt"];
  return roles.flatMap((role) => [...grouped.values()]
    .filter((item) => item.role === role)
    .sort((a, b) => b.score - a.score || (b.count ?? 0) - (a.count ?? 0))
    .slice(0, 12));
}
