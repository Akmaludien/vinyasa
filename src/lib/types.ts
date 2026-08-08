export type CssSourceKind = "external" | "inline" | "attribute";

export interface CssSourceInput {
  url: string;
  kind: CssSourceKind;
  content: string;
}

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface ColorToken {
  hex: string;
  rgb: Rgb;
  name: string;
  count: number;
  usage: number;
}

export interface FontFamilyToken {
  raw: string;
  families: string[];
  count: number;
  usage: number;
}

export interface FontSizeToken {
  px: number;
  raw: string;
  count: number;
  usage: number;
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

export interface TextStyle {
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  lineHeight: string;
  selectors: string[];
  count: number;
}

export interface RadiusToken {
  px: number | null;
  raw: string;
  count: number;
  usage: number;
}

export interface CssSourceAudit {
  url: string;
  kind: CssSourceKind;
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

export interface ExtractResult {
  url: string;
  title: string;
  scannedPages: number;
  colors: {
    primary: ColorToken[];
    neutral: ColorToken[];
  };
  fonts: {
    families: FontFamilyToken[];
    sizes: FontSizeToken[];
    weights: FontWeightToken[];
    lineHeights: LineHeightToken[];
  };
  textStyles: TextStyle[];
  radius: RadiusToken[];
  sources: CssSourceAudit[];
  scores: AnalysisScores;
  generatedAt: string;
}

export interface ExtractError {
  url: string;
  message: string;
}

export interface ExtractResponse {
  ok: boolean;
  results: ExtractResult[];
  errors: ExtractError[];
}