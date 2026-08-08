export const SIZE_UNITS: Record<string, number> = {
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

export function pxFromSize(raw: string): number | null {
  const m = raw.match(/(-?[\d.]+)(px|rem|em|pt|pc|mm|cm|q|in|%)/);
  if (!m) return null;
  if (m[2] === "%") return null;
  const factor = SIZE_UNITS[m[2]];
  if (!factor) return null;
  return Math.round(parseFloat(m[1]) * factor * 100) / 100;
}

export function cxToMs(raw: string): number | null {
  const m = raw.match(/(-?[\d.]+)(ms|s)/);
  if (!m) return null;
  if (m[2] === "s") return Math.round(parseFloat(m[1]) * 1000);
  return Math.round(parseFloat(m[1]));
}

export function parseKeywordWeight(raw: string): number | undefined {
  const map: Record<string, number> = {
    normal: 400,
    bold: 700,
    bolder: 700,
    lighter: 300,
  };
  return map[raw.trim().toLowerCase()];
}

export function normalizeValue(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLowerCase();
}

export function splitFamilies(raw: string): string[] {
  const parts = raw.split(",").map((p) => p.trim().replace(/^["']|["']$/g, ""));
  return parts.filter((p) => p.length > 0);
}

export function isLengthValue(raw: string): boolean {
  return /^(-?[\d.]+)(px|rem|em|pt|pc|mm|cm|q|in|%)$/.test(raw.trim());
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}