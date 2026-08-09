import * as csstree from "css-tree";
import {
  extractAllColors,
  hexToName,
  toHex,
  isNeutral,
} from "./colors";
import {
  cxToMs,
  isLengthValue,
  normalizeValue,
  parseKeywordWeight,
  pxFromSize,
  round2,
  splitFamilies,
} from "./units";
import { createVarResolver } from "./cssvars";
import { computeHealth } from "./health";
import { computeAccessibility } from "./accessibility";
import { detectComponents } from "./components";
import { computeResponsive } from "./responsive";
import { detectDarkMode } from "./darkmode";
import { DESIGN_MODEL_SCHEMA_VERSION, TOOL_NAME, TOOL_VERSION } from "./model";
import type {
  AnalysisScores,
  BorderToken,
  BreakpointToken,
  ColorToken,
  CssSourceAudit,
  CssSourceInput,
  DesignModel,
  DesignStatistics,
  DurationToken,
  EasingToken,
  FontFamilyToken,
  FontSizeToken,
  FontWeightToken,
  GradientToken,
  LetterSpacingToken,
  LineHeightToken,
  PageScan,
  Rgb,
  RadiusToken,
  ScalarToken,
  ScanMode,
  ScanScopeRequest,
  ShadowToken,
  TextStyle,
} from "./model";

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
const TYPO_PROP = /^font-(family|size|weight|line-height)$|^letter-spacing$/;
const RADIUS_PROP = /^border.*radius$/;
const SPACING_PROP =
  /^(margin|padding|gap|row-gap|column-gap|inset|top|right|bottom|left|scroll-margin|scroll-padding)/;
const SHADOW_PROP = /^(box-shadow|text-shadow)$/;
const GRADIENT_PROP = /(background|background-image)/;
const BORDER_PROP = /^border(-width|-style)?$/;
const DURATION_PROP = /^transition-duration$/;
const EASING_PROP = /^transition-timing-function$/;

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

interface Combo {
  key: string;
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  lineHeight: string;
  selectors: string[];
  count: number;
}

interface BorderTokenRecord {
  raw: string;
  widthPx: number | null;
  style: string | null;
  color: string | null;
  count: number;
  acc: Acc;
}

interface Acc {
  sources: string[];
  selectors: string[];
}

export interface ExtractOptions {
  mode?: ScanMode;
  scope?: ScanScopeRequest;
}

export function extractDesignSystem(
  sources: CssSourceInput[],
  pageUrl: string,
  title: string,
  opts: ExtractOptions = {},
): DesignModel {
  const startedAt = new Date().toISOString();
  const warnings: DesignModel["scan"]["warnings"] = [];
  const resolver = createVarResolver(sources);

  const stats: SourceStats[] = [];
  const audits: CssSourceAudit[] = [];

  const colorMap = new Map<string, { rgb: Rgb; count: number; acc: Acc }>();
  const familyMap = new Map<string, { raw: string; families: string[]; count: number; acc: Acc }>();
  const sizeMap = new Map<string, { px: number; raw: string; count: number; acc: Acc }>();
  const weightMap = new Map<number, number>();
  const lineMap = new Map<string, { raw: string; count: number }>();
  const letterMap = new Map<string, { raw: string; px: number | null; count: number }>();
  const radiusMap = new Map<string, { px: number | null; raw: string; count: number; acc: Acc }>();
  const spacingMap = new Map<string, { px: number | null; raw: string; count: number; acc: Acc }>();
  const shadowMap = new Map<string, { raw: string; count: number; acc: Acc }>();
  const gradientMap = new Map<string, { raw: string; count: number; acc: Acc }>();
  const borderMap = new Map<string, BorderTokenRecord>();
  const breakpointMap = new Map<string, { raw: string; px: number | null; feature: string; count: number }>();
  const durationMap = new Map<string, { raw: string; ms: number | null; count: number }>();
  const easingMap = new Map<string, { raw: string; count: number }>();
  const comboMap = new Map<string, Combo>();
  let totalRules = 0;
  let totalAtRules = 0;
  let totalDeclarations = 0;

  const pushAcc = (acc: Acc, sourceUrl: string, selector?: string) => {
    if (!acc.sources.includes(sourceUrl)) acc.sources.push(sourceUrl);
    if (selector && !acc.selectors.includes(selector) && acc.selectors.length < 6) {
      acc.selectors.push(selector);
    }
  };

  const trackColor = (rgb: Rgb, sourceUrl: string, selector?: string) => {
    const hex = toHex(rgb);
    const existing = colorMap.get(hex);
    if (existing) {
      existing.count++;
      pushAcc(existing.acc, sourceUrl, selector);
    } else {
      colorMap.set(hex, { rgb, count: 1, acc: { sources: [sourceUrl], selectors: selector ? [selector] : [] } });
    }
  };

  const trackFamily = (raw: string, sourceUrl: string) => {
    const key = normalizeValue(raw);
    const existing = familyMap.get(key);
    if (existing) {
      existing.count++;
      pushAcc(existing.acc, sourceUrl);
    } else {
      familyMap.set(key, { raw, families: splitFamilies(raw), count: 1, acc: { sources: [sourceUrl], selectors: [] } });
    }
  };

  const trackSize = (raw: string, sourceUrl: string) => {
    const px = pxFromSize(raw);
    if (px === null) return;
    const key = px.toString();
    const existing = sizeMap.get(key);
    if (existing) {
      existing.count++;
      pushAcc(existing.acc, sourceUrl);
    } else {
      sizeMap.set(key, { px, raw, count: 1, acc: { sources: [sourceUrl], selectors: [] } });
    }
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

  const trackLetter = (raw: string) => {
    const key = normalizeValue(raw);
    const existing = letterMap.get(key);
    if (existing) existing.count++;
    else letterMap.set(key, { raw, px: pxFromSize(raw), count: 1 });
  };

  const trackRadius = (raw: string, sourceUrl: string, selector?: string) => {
    const parts = raw.split(/\s+/).map(normalizeValue);
    const normalized = parts.join(" ");
    const existing = radiusMap.get(normalized);
    if (existing) {
      existing.count++;
      pushAcc(existing.acc, sourceUrl, selector);
      return;
    }
    const first = parts[0];
    const px = pxFromSize(first);
    radiusMap.set(normalized, { px, raw, count: 1, acc: { sources: [sourceUrl], selectors: selector ? [selector] : [] } });
  };

  const trackSpacing = (raw: string, sourceUrl: string, selector?: string) => {
    const parts = raw.split(/\s+/).map(normalizeValue);
    const normalized = parts.join(" ");
    const existing = spacingMap.get(normalized);
    if (existing) {
      existing.count++;
      pushAcc(existing.acc, sourceUrl, selector);
      return;
    }
    const px = pxFromSize(normalized);
    spacingMap.set(normalized, { px, raw, count: 1, acc: { sources: [sourceUrl], selectors: selector ? [selector] : [] } });
  };

  const trackShadow = (raw: string, sourceUrl: string, selector?: string) => {
    const normalized = normalizeValue(raw);
    const existing = shadowMap.get(normalized);
    if (existing) {
      existing.count++;
      pushAcc(existing.acc, sourceUrl, selector);
    } else {
      shadowMap.set(normalized, { raw, count: 1, acc: { sources: [sourceUrl], selectors: selector ? [selector] : [] } });
    }
  };

  const trackGradient = (raw: string, sourceUrl: string, selector?: string) => {
    const normalized = normalizeValue(raw);
    const existing = gradientMap.get(normalized);
    if (existing) {
      existing.count++;
      pushAcc(existing.acc, sourceUrl, selector);
    } else {
      gradientMap.set(normalized, { raw, count: 1, acc: { sources: [sourceUrl], selectors: selector ? [selector] : [] } });
    }
  };

  const trackBorder = (raw: string, sourceUrl: string, selector?: string) => {
    const normalized = normalizeValue(raw);
    const existing = borderMap.get(normalized);
    if (existing) {
      existing.count++;
      pushAcc(existing.acc, sourceUrl, selector);
      return;
    }
    const widthPx = pxFromSize(normalized);
    const styleMatch = normalized.match(/^(solid|dashed|dotted|double|none|hidden|groove|ridge|inset|outset)\b/);
    const colorHex = extractAllColors(normalized)[0];
    borderMap.set(normalized, {
      raw,
      widthPx,
      style: styleMatch?.[1] ?? null,
      color: colorHex ? toHex(colorHex) : null,
      count: 1,
      acc: { sources: [sourceUrl], selectors: selector ? [selector] : [] },
    });
  };

  const trackBreakpoint = (raw: string, feature: string) => {
    const normalized = normalizeValue(raw);
    const px = pxFromSize(normalized);
    const key = `${feature}|${normalized}`;
    const existing = breakpointMap.get(key);
    if (existing) existing.count++;
    else breakpointMap.set(key, { raw, px, feature, count: 1 });
  };

  const trackDuration = (raw: string) => {
    const ms = cxToMs(raw);
    const existing = durationMap.get(normalizeValue(raw));
    if (existing) existing.count++;
    else durationMap.set(normalizeValue(raw), { raw, ms, count: 1 });
  };

  const trackEasing = (raw: string) => {
    const normalized = normalizeValue(raw);
    const existing = easingMap.get(normalized);
    if (existing) existing.count++;
    else easingMap.set(normalized, { raw, count: 1 });
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
      warnings.push({ code: "css_parse_error", message: `Gagal mengurai CSS: ${source.url}` });
    }

    if (ast) {
      csstree.walk(ast, { visit: "Atrule", enter() { s.atRuleCount++; } });
      csstree.walk(ast, { visit: "Rule", enter() { s.ruleCount++; } });

      csstree.walk(ast, {
        visit: "Atrule",
        enter(node) {
          if (node.name.toLowerCase() !== "media" || !node.prelude) return;
          let raw = "";
          try {
            raw = csstree.generate(node.prelude);
          } catch {
            return;
          }
          const m = raw.match(/(?:min|max)-width\s*:\s*([^)]+)/i);
          if (m) trackBreakpoint(m[1].trim(), m[0].startsWith("min") ? "min-width" : "max-width");
          else {
            const lm = raw.match(/\(\s*([^)]+)\)/i);
            if (lm) {
              const inner = lm[1];
              const fm = inner.match(/([a-z-]+)\s*:\s*([^)]+)/i);
              if (fm) trackBreakpoint(fm[2].trim(), fm[1].toLowerCase());
            }
          }
        },
      });

      csstree.walk(ast, {
        visit: "Declaration",
        enter(node) {
          s.declarationCount++;
          totalDeclarations++;
          const prop = node.property.toLowerCase();
          let raw = "";
          try {
            raw = csstree.generate(node.value);
          } catch {
            raw = "";
          }
          if (!raw) return;
          const value = resolver.resolve(raw);
          if (!value) return;

          const isColor = COLOR_PROP.test(prop);
          if (isColor) {
            s.colorDeclarations++;
            const colors = extractAllColors(value);
            if (colors.length > 0) {
              s.colorParsed++;
              for (const rgb of colors) trackColor(rgb, source.url);
            }
          }

          if (TYPO_PROP.test(prop)) {
            s.typoDeclarations++;
            const ok = (() => {
              switch (prop) {
                case "font-family":
                  if (splitFamilies(value).length === 0) return false;
                  trackFamily(value, source.url);
                  return true;
                case "font-size":
                  if (pxFromSize(value) === null) return false;
                  trackSize(value, source.url);
                  return true;
                case "font-weight": {
                  const w = WEIGHTS[value.trim().toLowerCase()] ?? parseKeywordWeight(value);
                  if (w === undefined) return false;
                  trackWeight(value);
                  return true;
                }
                case "line-height":
                  trackLine(value);
                  return true;
                case "letter-spacing":
                  trackLetter(value);
                  return true;
                default:
                  return false;
              }
            })();
            if (ok) s.typoParsed++;
          }

          if (RADIUS_PROP.test(prop)) {
            s.radiusDeclarations++;
            if (isLengthValue(value) || value.split(/\s+/).every((v) => pxFromSize(v) !== null)) {
              s.radiusParsed++;
              trackRadius(value, source.url);
            }
          }

          if (SPACING_PROP.test(prop)) {
            if (value.split(/\s+/).every((v) => isLengthValue(v))) {
              trackSpacing(value, source.url);
            }
          }

          if (SHADOW_PROP.test(prop)) {
            trackShadow(value, source.url);
          }

          if (BORDER_PROP.test(prop)) {
            trackBorder(value, source.url);
          }

          if (GRADIENT_PROP.test(prop) && /(linear|radial|conic)-gradient\(/i.test(value)) {
            trackGradient(value, source.url);
          }

          if (DURATION_PROP.test(prop)) trackDuration(value);
          if (EASING_PROP.test(prop)) trackEasing(value);
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
              const resolved = resolver.resolve(value);
              switch (prop) {
                case "font-family":
                  combo.fontFamily = splitFamilies(resolved)[0] ?? "";
                  break;
                case "font-size":
                  combo.fontSize = resolved.trim();
                  hasSize = true;
                  break;
                case "font-weight":
                  combo.fontWeight = resolved.trim();
                  break;
                case "line-height":
                  combo.lineHeight = resolved.trim();
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

      totalRules += s.ruleCount;
      totalAtRules += s.atRuleCount;
    }

    stats.push(s);
    const colorScore = s.colorDeclarations
      ? Math.round((s.colorParsed / s.colorDeclarations) * 100)
      : 0;
    const typoScore = s.typoDeclarations
      ? Math.round((s.typoParsed / s.typoDeclarations) * 100)
      : 0;
    const accuracy = Math.round(
      colorScore * 0.45 +
        typoScore * 0.4 +
        (s.radiusDeclarations ? (s.radiusParsed / s.radiusDeclarations) * 100 * 0.15 : 0),
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
  const allColorTokens: ColorToken[] = [...colorMap.entries()].map(([hex, { rgb, count, acc }]) => ({
    hex,
    rgb,
    name: hexToName(hex),
    isNeutral: isNeutral(rgb.r, rgb.g, rgb.b),
    count,
    usage: totalColors ? round2((count / totalColors) * 100) : 0,
    sources: acc.sources,
    selectors: acc.selectors,
  }));
  allColorTokens.sort((a, b) => b.count - a.count);

  const primary = allColorTokens.filter((t) => !t.isNeutral).slice(0, 16);
  const neutral = allColorTokens.filter((t) => t.isNeutral).slice(0, 12);
  const cutoff = Math.max(1, Math.floor(totalColors * 0.8));
  let hardcodedCount = 0;
  const hardcoded: ColorToken[] = [];
  for (const t of allColorTokens.slice(16)) {
    if (t.count < 2 || t.usage < 1) {
      hardcoded.push(t);
      hardcodedCount++;
    }
  }
  void cutoff;

  const familyTotal = [...familyMap.values()].reduce((sum, f) => sum + f.count, 0);
  const families: FontFamilyToken[] = [...familyMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((f) => ({ raw: f.raw, families: f.families, count: f.count, usage: familyTotal ? round2((f.count / familyTotal) * 100) : 0, sources: f.acc.sources }));

  const sizeTotal = [...sizeMap.values()].reduce((sum, s) => sum + s.count, 0);
  const sizes: FontSizeToken[] = [...sizeMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 12)
    .map((s) => ({ px: s.px, raw: s.raw, count: s.count, usage: sizeTotal ? round2((s.count / sizeTotal) * 100) : 0, sources: s.acc.sources }));

  const weightTotal = [...weightMap.values()].reduce((sum, n) => sum + n, 0);
  const weights: FontWeightToken[] = [...weightMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([value, count]) => ({ value, count, usage: weightTotal ? round2((count / weightTotal) * 100) : 0 }));

  const lineTotal = [...lineMap.values()].reduce((sum, l) => sum + l.count, 0);
  const lineHeights: LineHeightToken[] = [...lineMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
    .map((l) => ({ raw: l.raw, count: l.count, usage: lineTotal ? round2((l.count / lineTotal) * 100) : 0 }));

  const letterTotal = [...letterMap.values()].reduce((sum, l) => sum + l.count, 0);
  const letterSpacings: LetterSpacingToken[] = [...letterMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
    .map((l) => ({ raw: l.raw, px: l.px, count: l.count, usage: letterTotal ? round2((l.count / letterTotal) * 100) : 0 }));

  const radiusTotal = [...radiusMap.values()].reduce((sum, r) => sum + r.count, 0);
  const radius: RadiusToken[] = [...radiusMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((r) => ({ px: r.px, raw: r.raw, count: r.count, usage: radiusTotal ? round2((r.count / radiusTotal) * 100) : 0, sources: r.acc.sources }));

  const spacingTotal = [...spacingMap.values()].reduce((sum, s) => sum + s.count, 0);
  const spacing: ScalarToken[] = [...spacingMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 16)
    .map((s) => ({ px: s.px, raw: s.raw, count: s.count, usage: spacingTotal ? round2((s.count / spacingTotal) * 100) : 0, sources: s.acc.sources }));

  const shadowTotal = [...shadowMap.values()].reduce((sum, s) => sum + s.count, 0);
  const shadows: ShadowToken[] = [...shadowMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
    .map((s) => ({ raw: s.raw, count: s.count, sources: s.acc.sources }));
  void shadowTotal;

  const gradientTotal = [...gradientMap.values()].reduce((sum, s) => sum + s.count, 0);
  const gradients: GradientToken[] = [...gradientMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
    .map((s) => ({ raw: s.raw, count: s.count, sources: s.acc.sources }));
  void gradientTotal;

  const borders: BorderToken[] = [...borderMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
    .map(({ raw, widthPx, style, color, count, acc }) => ({
      raw,
      widthPx,
      style,
      color,
      count,
      sources: acc.sources.slice(0, 3),
    }));

  const breakpoints: BreakpointToken[] = [...breakpointMap.values()]
    .sort((a, b) => (a.px ?? 0) - (b.px ?? 0))
    .slice(0, 20);

  const durations: DurationToken[] = [...durationMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const easings: EasingToken[] = [...easingMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

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

  const page: PageScan = {
    url: pageUrl,
    title: title || pageUrl,
    status: "ok",
    sources: audits,
    scores,
    screenshots: [],
  };

  const statistics: DesignStatistics = {
    totalDeclarations,
    totalRules,
    totalAtRules,
    uniqueColors: allColorTokens.length,
    uniqueFontFamilies: families.length,
    uniqueSpacingValues: spacing.length,
    uniqueRadiusValues: radius.length,
    hardcodedColorCount: hardcodedCount,
  };

  const baseResult = {
    schemaVersion: DESIGN_MODEL_SCHEMA_VERSION,
    metadata: {
      tool: TOOL_NAME,
      version: TOOL_VERSION,
      generatedAt: new Date().toISOString(),
      scanMode: opts.mode ?? "fast",
      scanScope: opts.scope ?? { kind: "landing" },
    },
    source: { url: pageUrl, title: title || pageUrl },
    scan: {
      startedAt,
      durationMs: Date.now() - new Date(startedAt).getTime(),
      pageCount: 1,
      totalRequests: sources.length + 1,
      warnings,
      errors: [],
    },
    pages: [page],
    tokens: {
      colors: { primary, neutral, hardcoded },
      typography: { families, sizes, weights, lineHeights, letterSpacings },
      textStyles,
      spacing,
      radius,
      borders,
      shadows,
      gradients,
      breakpoints,
      durations,
      easings,
    },
    statistics,
    health: null,
    accessibility: null,
    responsive: null,
    darkMode: null,
    components: [],
  } as DesignModel;

  return {
    ...baseResult,
    health: computeHealth(baseResult),
    accessibility: computeAccessibility(baseResult),
    responsive: computeResponsive(baseResult),
    darkMode: detectDarkMode(sources),
    components: detectComponents(sources, pageUrl).components,
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

export function isHardcodedColor(token: ColorToken, paletteSize: number): boolean {
  return token.usage < 1 && token.count < 2 && paletteSize > 0;
}
