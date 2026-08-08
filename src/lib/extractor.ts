import * as csstree from "css-tree";
import {
  extractAllColors,
  hexToName,
  toHex,
  isNeutral,
} from "./colors";
import type {
  AnalysisScores,
  ColorToken,
  CssSourceAudit,
  CssSourceInput,
  ExtractResult,
  FontFamilyToken,
  FontSizeToken,
  FontWeightToken,
  LineHeightToken,
  RadiusToken,
  Rgb,
  TextStyle,
} from "./types";

interface SourceStats {
  ruleCount: number;
  atRuleCount: number;
  declarationCount: number;
  colorDeclarations: number;
  colorParsed: number;
  typoDeclarations: number;
  typoParsed: number;
  radiusDeclarations: number;
  radiusParsed: number;
}

const COLOR_PROP = /color|background|border|shadow|outline|fill|stroke|text-decoration/i;
const TYPO_PROP = /^font-(family|size|weight|line-height)$/;
const RADIUS_PROP = /^border.*radius$/;

const SIZE_UNITS: Record<string, number> = {
  px: 1,
  rem: 16,
  em: 16,
  pt: 1.3333,
  pc: 16,
  mm: 3.7795,
  cm: 37.7953,
  q: 0.9449,
  in: 96,
};

const WEIGHTS: Record<string, number> = {
  normal: 400,
  bold: 700,
  bolder: 700,
  lighter: 300,
  "100": 100,
  "200": 200,
  "300": 300,
  "400": 400,
  "500": 500,
  "600": 600,
  "700": 700,
  "800": 800,
  "900": 900,
};

function pxFromSize(raw: string): number | null {
  const m = raw.match(/(-?[\d.]+)(px|rem|em|pt|pc|mm|cm|q|in|%)/);
  if (!m) return null;
  if (m[2] === "%") return null;
  return Math.round(parseFloat(m[1]) * SIZE_UNITS[m[2]] * 100) / 100;
}

function splitFamilies(raw: string): string[] {
  const parts = raw.split(",").map((p) => p.trim().replace(/^["']|["']$/g, ""));
  return parts.filter((p) => p.length > 0);
}

function normalizeValue(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLowerCase();
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

interface Combo {
  key: string;
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  lineHeight: string;
  selectors: string[];
  count: number;
}

export function extractDesignSystem(
  sources: CssSourceInput[],
  pageUrl: string,
  title: string,
  scannedPages: number,
): ExtractResult {
  const stats: SourceStats[] = [];
  const audits: CssSourceAudit[] = [];

  const colorMap = new Map<string, { rgb: Rgb; count: number }>();
  const familyMap = new Map<string, { raw: string; families: string[]; count: number }>();
  const sizeMap = new Map<string, { px: number; raw: string; count: number }>();
  const weightMap = new Map<number, number>();
  const lineMap = new Map<string, { raw: string; count: number }>();
  const radiusMap = new Map<string, { px: number | null; raw: string; count: number }>();
  const comboMap = new Map<string, Combo>();

  const trackColor = (rgb: Rgb) => {
    const hex = toHex(rgb);
    const existing = colorMap.get(hex);
    if (existing) existing.count++;
    else colorMap.set(hex, { rgb, count: 1 });
  };

  const trackFamily = (raw: string) => {
    const key = normalizeValue(raw);
    const existing = familyMap.get(key);
    if (existing) existing.count++;
    else familyMap.set(key, { raw, families: splitFamilies(raw), count: 1 });
  };

  const trackSize = (raw: string) => {
    const px = pxFromSize(raw);
    if (px === null) return;
    const key = px.toString();
    const existing = sizeMap.get(key);
    if (existing) existing.count++;
    else sizeMap.set(key, { px, raw, count: 1 });
  };

  const trackWeight = (raw: string) => {
    const w = WEIGHTS[raw.trim().toLowerCase()];
    if (w === undefined) return;
    weightMap.set(w, (weightMap.get(w) ?? 0) + 1);
  };

  const trackLine = (raw: string) => {
    const key = normalizeValue(raw);
    const existing = lineMap.get(key);
    if (existing) existing.count++;
    else lineMap.set(key, { raw, count: 1 });
  };

  const trackRadius = (raw: string) => {
    const parts = raw.split(/\s+/).map(normalizeValue);
    const normalized = parts.join(" ");
    const existing = radiusMap.get(normalized);
    if (existing) {
      existing.count++;
      return;
    }
    const first = parts[0];
    const px = pxFromSize(first);
    radiusMap.set(normalized, { px, raw, count: 1 });
  };

  const trackCombo = (c: Combo) => {
    const existing = comboMap.get(c.key);
    if (existing) {
      existing.count++;
      for (const sel of c.selectors) {
        if (!existing.selectors.includes(sel) && existing.selectors.length < 4) {
          existing.selectors.push(sel);
        }
      }
      return;
    }
    comboMap.set(c.key, { ...c, selectors: c.selectors.slice(0, 3) });
  };

  for (const source of sources) {
    const s: SourceStats = {
      ruleCount: 0,
      atRuleCount: 0,
      declarationCount: 0,
      colorDeclarations: 0,
      colorParsed: 0,
      typoDeclarations: 0,
      typoParsed: 0,
      radiusDeclarations: 0,
      radiusParsed: 0,
    };

    let ast: csstree.CssNode | null = null;
    try {
      ast = csstree.parse(source.content);
    } catch {
      ast = null;
    }

    if (ast) {
      csstree.walk(ast, {
        visit: "Atrule",
        enter() {
          s.atRuleCount++;
        },
      });

      csstree.walk(ast, {
        visit: "Rule",
        enter() {
          s.ruleCount++;
        },
      });

      csstree.walk(ast, {
        visit: "Declaration",
        enter(node) {
          s.declarationCount++;
          const prop = node.property.toLowerCase();
          let value = "";
          try {
            value = csstree.generate(node.value);
          } catch {
            value = "";
          }
          if (!value) return;

          const isColor = COLOR_PROP.test(prop);
          if (isColor) {
            s.colorDeclarations++;
            const colors = extractAllColors(value);
            if (colors.length > 0) {
              s.colorParsed++;
              for (const rgb of colors) trackColor(rgb);
            }
          }

          if (TYPO_PROP.test(prop)) {
            s.typoDeclarations++;
            const ok = (() => {
              switch (prop) {
                case "font-family":
                  if (splitFamilies(value).length === 0) return false;
                  trackFamily(value);
                  return true;
                case "font-size":
                  if (pxFromSize(value) === null) return false;
                  trackSize(value);
                  return true;
                case "font-weight":
                  if (WEIGHTS[value.trim().toLowerCase()] === undefined) return false;
                  trackWeight(value);
                  return true;
                case "line-height":
                  trackLine(value);
                  return true;
                default:
                  return false;
              }
            })();
            if (ok) s.typoParsed++;
          }

          if (RADIUS_PROP.test(prop)) {
            s.radiusDeclarations++;
            const px = pxFromSize(value);
            if (px !== null || value.split(/\s+/).every((v) => pxFromSize(v) !== null)) {
              s.radiusParsed++;
              trackRadius(value);
            }
          }
        },
      });

      csstree.walk(ast, {
        visit: "Rule",
        enter(node) {
          const selector = csstree.generate(node.prelude).replace(/\s+/g, " ").trim();
          const combo: Partial<Combo> = {
            key: "",
            fontFamily: "",
            fontSize: "",
            fontWeight: "",
            lineHeight: "",
            count: 1,
          };
          let hasSize = false;
          csstree.walk(node.block, {
            visit: "Declaration",
            enter(decl) {
              const prop = decl.property.toLowerCase();
              let value = "";
              try {
                value = csstree.generate(decl.value);
              } catch {
                value = "";
              }
              if (!value) return;
              switch (prop) {
                case "font-family":
                  combo.fontFamily = splitFamilies(value)[0] ?? "";
                  break;
                case "font-size":
                  combo.fontSize = value.trim();
                  hasSize = true;
                  break;
                case "font-weight":
                  combo.fontWeight = value.trim();
                  break;
                case "line-height":
                  combo.lineHeight = value.trim();
                  break;
              }
            },
          });
          if (!hasSize || !combo.fontFamily) return;
          const key = [
            combo.fontFamily ?? "",
            combo.fontSize ?? "",
            combo.fontWeight ?? "",
            combo.lineHeight ?? "",
          ]
            .map(normalizeValue)
            .join("|");
          combo.key = key;
          const full = combo as Combo;
          full.selectors = [selector];
          trackCombo(full);
        },
      });
    }

    stats.push(s);
    const colorScore = s.colorDeclarations
      ? Math.round((s.colorParsed / s.colorDeclarations) * 100)
      : 0;
    const typoScore = s.typoDeclarations
      ? Math.round((s.typoParsed / s.typoDeclarations) * 100)
      : 0;
    const accuracy = Math.round(
      (colorScore * 0.45 + typoScore * 0.4 +
        (s.radiusDeclarations
          ? (s.radiusParsed / s.radiusDeclarations) * 100 * 0.15
          : 0)),
    );
    audits.push({
      url: source.url,
      kind: source.kind,
      sizeBytes: Buffer.byteLength(source.content, "utf8"),
      ruleCount: s.ruleCount,
      atRuleCount: s.atRuleCount,
      declarationCount: s.declarationCount,
      colorScore,
      typographyScore: typoScore,
      accuracy,
    });
  }

  const totalColors = [...colorMap.values()].reduce((sum, c) => sum + c.count, 0);
  const allColorTokens: ColorToken[] = [...colorMap.entries()].map(([hex, { rgb, count }]) => ({
    hex,
    rgb,
    name: hexToName(hex),
    count,
    usage: totalColors ? round2((count / totalColors) * 100) : 0,
  }));
  allColorTokens.sort((a, b) => b.count - a.count);
  const primary = allColorTokens.filter((t) => !isNeutral(t.rgb.r, t.rgb.g, t.rgb.b)).slice(0, 16);
  const neutral = allColorTokens.filter((t) => isNeutral(t.rgb.r, t.rgb.g, t.rgb.b)).slice(0, 12);

  const familyTotal = [...familyMap.values()].reduce((sum, f) => sum + f.count, 0);
  const families: FontFamilyToken[] = [...familyMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((f) => ({ ...f, usage: familyTotal ? round2((f.count / familyTotal) * 100) : 0 }));

  const sizeTotal = [...sizeMap.values()].reduce((sum, s) => sum + s.count, 0);
  const sizes: FontSizeToken[] = [...sizeMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 12)
    .map((s) => ({ ...s, usage: sizeTotal ? round2((s.count / sizeTotal) * 100) : 0 }));

  const weightTotal = [...weightMap.values()].reduce((sum, n) => sum + n, 0);
  const weights: FontWeightToken[] = [...weightMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([value, count]) => ({
      value,
      count,
      usage: weightTotal ? round2((count / weightTotal) * 100) : 0,
    }));

  const lineTotal = [...lineMap.values()].reduce((sum, l) => sum + l.count, 0);
  const lineHeights: LineHeightToken[] = [...lineMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
    .map((l) => ({ ...l, usage: lineTotal ? round2((l.count / lineTotal) * 100) : 0 }));

  const radiusTotal = [...radiusMap.values()].reduce((sum, r) => sum + r.count, 0);
  const radius: RadiusToken[] = [...radiusMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((r) => ({ ...r, usage: radiusTotal ? round2((r.count / radiusTotal) * 100) : 0 }));

  const textStyles: TextStyle[] = [...comboMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((c) => ({
      fontFamily: c.fontFamily,
      fontSize: c.fontSize,
      fontWeight: c.fontWeight || "400",
      lineHeight: c.lineHeight || "1.5",
      selectors: c.selectors,
      count: c.count,
    }));

  const scores = computeScores(stats);

  return {
    url: pageUrl,
    title: title || pageUrl,
    scannedPages,
    colors: { primary, neutral },
    fonts: { families, sizes, weights, lineHeights },
    textStyles,
    radius,
    sources: audits,
    scores,
    generatedAt: new Date().toISOString(),
  };
}

function computeScores(stats: SourceStats[]): AnalysisScores {
  if (stats.length === 0) {
    return { color: 0, typography: 0, radius: 0, overall: 0 };
  }
  const decls = stats.reduce((s, x) => s + x.declarationCount, 0);
  if (decls === 0) {
    return { color: 0, typography: 0, radius: 0, overall: 0 };
  }
  const color = stats.reduce(
    (s, x) => s + (x.colorDeclarations ? x.colorParsed / x.colorDeclarations : 0),
    0,
  ) / stats.length;
  const typo = stats.reduce(
    (s, x) => s + (x.typoDeclarations ? x.typoParsed / x.typoDeclarations : 0),
    0,
  ) / stats.length;
  const radiusScore = stats.reduce(
    (s, x) => s + (x.radiusDeclarations ? x.radiusParsed / x.radiusDeclarations : 0),
    0,
  ) / stats.length;
  const overall = color * 0.45 + typo * 0.4 + radiusScore * 0.15;
  return {
    color: Math.round(color * 100),
    typography: Math.round(typo * 100),
    radius: Math.round(radiusScore * 100),
    overall: Math.round(overall * 100),
  };
}