export const DESIGN_MODEL_SCHEMA_VERSION = "1.0.0";
export const TOOL_NAME = "vinyasa";
export const TOOL_VERSION = "0.3.0";

import type { ComponentReport } from "./components";
import type { HealthReport } from "./health";
import type { A11yReport } from "./accessibility";
import type { ResponsiveReport } from "./responsive";
import type { DarkModeReport } from "./darkmode";

export type ScanMode = "fast" | "deep";
export type ScanScopeKind = "smart" | "landing" | "pages" | "all" | "custom";

export type CssSourceKind = "external" | "inline" | "attribute";

export interface CssSourceInput {
  url: string;
  kind: CssSourceKind;
  content: string;
}

export interface ScanScopeRequest {
  kind: ScanScopeKind;
  maxPages?: number;
  customUrls?: string[];
}

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface TokenProvenance {
  raw: string;
  normalized: string;
  frequency: number;
  sources: string[];
  selectors: string[];
}

export interface ColorToken {
  hex: string;
  rgb: Rgb;
  name: string;
  semantic?: string;
  isNeutral: boolean;
  count: number;
  usage: number;
  sources: string[];
  selectors: string[];
}

export interface FontFamilyToken {
  raw: string;
  families: string[];
  count: number;
  usage: number;
  sources: string[];
}

export interface FontSizeToken {
  raw: string;
  px: number;
  count: number;
  usage: number;
  sources: string[];
}

export interface FontWeightToken {
  value: number;
  count: number;
  usage: number;
}

export interface LineHeightToken {
  raw: string;
  count: number;
  usage: number;
}

export interface LetterSpacingToken {
  raw: string;
  px: number | null;
  count: number;
  usage: number;
}

export interface TextStyle {
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  lineHeight: string;
  selectors: string[];
  count: number;
}

export interface ScalarToken {
  raw: string;
  px: number | null;
  count: number;
  usage: number;
  sources: string[];
}

export type RadiusToken = ScalarToken;

export interface BorderToken {
  raw: string;
  widthPx: number | null;
  style: string | null;
  color: string | null;
  count: number;
  sources: string[];
}

export interface ShadowToken {
  raw: string;
  count: number;
  sources: string[];
}

export interface GradientToken {
  raw: string;
  count: number;
  sources: string[];
}

export interface BreakpointToken {
  raw: string;
  px: number | null;
  feature: string;
  count: number;
}

export interface DurationToken {
  raw: string;
  ms: number | null;
  count: number;
}

export interface EasingToken {
  raw: string;
  count: number;
}

export interface CssSourceAudit {
  url: string;
  kind: "external" | "inline" | "attribute";
  sizeBytes: number;
  ruleCount: number;
  atRuleCount: number;
  declarationCount: number;
  colorScore: number;
  typographyScore: number;
  accuracy: number;
}

export interface AnalysisScores {
  color: number;
  typography: number;
  radius: number;
  overall: number;
}

export interface ScanWarning {
  code: string;
  message: string;
  pageUrl?: string;
}

export interface ScanError {
  url: string;
  message: string;
}

export interface PageScan {
  url: string;
  title: string;
  status: "ok" | "error";
  error?: string;
  sources: CssSourceAudit[];
  scores: AnalysisScores;
  screenshots: string[];
}

export interface DesignTokens {
  colors: {
    primary: ColorToken[];
    neutral: ColorToken[];
    hardcoded: ColorToken[];
  };
  typography: {
    families: FontFamilyToken[];
    sizes: FontSizeToken[];
    weights: FontWeightToken[];
    lineHeights: LineHeightToken[];
    letterSpacings: LetterSpacingToken[];
  };
  textStyles: TextStyle[];
  spacing: ScalarToken[];
  radius: ScalarToken[];
  borders: BorderToken[];
  shadows: ShadowToken[];
  gradients: GradientToken[];
  breakpoints: BreakpointToken[];
  durations: DurationToken[];
  easings: EasingToken[];
}

export interface DesignStatistics {
  totalDeclarations: number;
  totalRules: number;
  totalAtRules: number;
  uniqueColors: number;
  uniqueFontFamilies: number;
  uniqueSpacingValues: number;
  uniqueRadiusValues: number;
  hardcodedColorCount: number;
}

export interface DesignModel {
  schemaVersion: string;
  metadata: {
    tool: string;
    version: string;
    generatedAt: string;
    scanMode: ScanMode;
    scanScope: ScanScopeRequest;
  };
  source: {
    url: string;
    title: string;
  };
  scan: {
    startedAt: string;
    durationMs: number;
    pageCount: number;
    totalRequests: number;
    warnings: ScanWarning[];
    errors: ScanError[];
  };
  pages: PageScan[];
  tokens: DesignTokens;
  statistics: DesignStatistics;
  health: HealthReport | null;
  accessibility: A11yReport | null;
  responsive: ResponsiveReport | null;
  darkMode: DarkModeReport | null;
  components: ComponentReport["components"];
}

export interface ExtractError {
  url: string;
  message: string;
}

export interface ExtractResponse {
  ok: boolean;
  results: DesignModel[];
  errors: ExtractError[];
}
