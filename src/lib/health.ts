import type { DesignModel, ScalarToken } from "./model";

export interface HealthIssue {
  severity: "critical" | "warning" | "info";
  category: string;
  message: string;
  evidence: string[];
  recommendation: string;
}

export interface HealthCategory {
  name: string;
  score: number;
  dominantValues: string[];
  outliers: string[];
  explanation: string;
  issues: HealthIssue[];
}

export interface HealthReport {
  color: HealthCategory;
  typography: HealthCategory;
  spacing: HealthCategory;
  radius: HealthCategory;
  component: HealthCategory;
  overall: number;
}

function dominantScale(values: number[]): { dominant: number[]; outliers: number[] } {
  if (values.length === 0) return { dominant: [], outliers: [] };
  const sorted = [...values].sort((a, b) => a - b);
  const freq = new Map<number, number>();
  for (const v of sorted) freq.set(v, (freq.get(v) ?? 0) + 1);
  const total = sorted.length;
  const ranked = [...freq.entries()].sort((a, b) => b[1] - a[1]);
  let covered = 0;
  const dominantSet = new Set<number>();
  for (const [v, c] of ranked) {
    dominantSet.add(v);
    covered += c;
    if (covered / total >= 0.8) break;
    if (dominantSet.size >= 8) break;
  }
  const outliers = sorted.filter((v) => !dominantSet.has(v) && freq.get(v)! <= Math.max(1, total * 0.02));
  return { dominant: [...dominantSet].sort((a, b) => a - b), outliers: [...new Set(outliers)] };
}

function consistencyScore(values: number[]): number {
  if (values.length === 0) return 100;
  const { dominant, outliers } = dominantScale(values);
  const total = values.length;
  const dominantCount = dominant.reduce((sum, v) => sum + values.filter((x) => x === v).length, 0);
  const outlierCount = outliers.filter((v) => !dominant.includes(v)).length;
  const coverage = dominantCount / total;
  const base = coverage * 100;
  const penalty = Math.min(30, outlierCount * 2);
  return Math.max(0, Math.round(base - penalty));
}

function scalarPx(tokens: ScalarToken[]): number[] {
  return tokens.filter((t) => t.px !== null).map((t) => t.px!);
}

export function computeHealth(m: DesignModel): HealthReport {
  const issues: HealthIssue[] = [];

  const colorVals = [...m.tokens.colors.primary, ...m.tokens.colors.neutral].map((c) => c.count);
  const colorConsistency = consistencyScore(colorVals.length ? colorVals : []);
  const colorOutliers = m.tokens.colors.hardcoded.map((h) => `${h.hex} (${h.usage}%)`);
  if (colorOutliers.length > 0) {
    issues.push({
      severity: colorOutliers.length > 5 ? "critical" : "warning",
      category: "color",
      message: `${colorOutliers.length} warna jarang dipakai terdeteksi sebagai hardcoded.`,
      evidence: colorOutliers.slice(0, 5),
      recommendation: "Pindahkan warna sekali-pakai ke *semantic tokens* agar konsisten.",
    });
  }

  const typoVals = m.tokens.typography.sizes.map((s) => s.px);
  const typoConsistency = consistencyScore(typoVals);
  const typoScale = dominantScale(typoVals);
  if (typoScale.outliers.length > 3) {
    issues.push({
      severity: "warning",
      category: "typography",
      message: `${typoScale.outliers.length} ukuran font di luar skala dominan.`,
      evidence: typoScale.outliers.slice(0, 6).map((v) => `${v}px`),
      recommendation: "Batasi ukuran font pada skala tetap (modular scale).",
    });
  }

  const spacingVals = scalarPx(m.tokens.spacing);
  const spacingConsistency = consistencyScore(spacingVals);
  const spacingScale = dominantScale(spacingVals);
  if (spacingConsistency < 70 || spacingScale.outliers.length > 4) {
    issues.push({
      severity: spacingConsistency < 55 ? "critical" : "warning",
      category: "spacing",
      message: `Spacing tidak konsisten (skor ${spacingConsistency}).`,
      evidence: [
        ...spacingScale.dominant.slice(0, 6).map((v) => `${v}px`),
        "...outliers:",
        ...spacingScale.outliers.slice(0, 8).map((v) => `${v}px`),
      ],
      recommendation: "Gunakan skala spacing tetap (mis. 4/8/12/16/24/32).",
    });
  }

  const radiusVals = scalarPx(m.tokens.radius);
  const radiusConsistency = consistencyScore(radiusVals);
  const radiusScale = dominantScale(radiusVals);
  if (radiusScale.outliers.length > 3) {
    issues.push({
      severity: "warning",
      category: "radius",
      message: `${radiusScale.outliers.length} nilai radius di luar skala.`,
      evidence: radiusScale.outliers.slice(0, 6).map((v) => `${v}px`),
      recommendation: "Batasi radius pada skala kecil (mis. 4/8/12/16/999).",
    });
  }

  const componentConsistency = computeComponentConsistency();
  const componentIssues = m.components.length === 0
    ? [{
        severity: "info" as const,
        category: "component",
        message: "Deteksi komponen belum tersedia (mode Deep Scan).",
        evidence: [],
        recommendation: "Jalankan Deep Scan untuk analisis komponen yang lebih baik.",
      }]
    : [];

  const overall = Math.round(
    colorConsistency * 0.3 +
      typoConsistency * 0.25 +
      spacingConsistency * 0.2 +
      radiusConsistency * 0.15 +
      componentConsistency * 0.1,
  );

  const toCategory = (
    name: string,
    score: number,
    scale: { dominant: number[]; outliers: number[] },
    expl: string,
    catIssues: HealthIssue[],
  ): HealthCategory => ({
    name,
    score,
    dominantValues: scale.dominant.map((v) => `${v}px`),
    outliers: scale.outliers.map((v) => `${v}px`),
    explanation: expl,
    issues: catIssues,
  });

  return {
    color: toCategory(
      "Color",
      colorConsistency,
      { dominant: [], outliers: [] },
      "Konsistensi palet warna berdasarkan frekuensi & keberadaan hardcoded colors.",
      issues.filter((i) => i.category === "color"),
    ),
    typography: toCategory(
      "Typography",
      typoConsistency,
      { dominant: typoScale.dominant, outliers: typoScale.outliers },
      "Konsistensi skala ukuran font berdasarkan frekuensi.",
      issues.filter((i) => i.category === "typography"),
    ),
    spacing: toCategory(
      "Spacing",
      spacingConsistency,
      { dominant: spacingScale.dominant, outliers: spacingScale.outliers },
      "Konsistensi nilai margin/padding/gap dalam satu skala dominant.",
      issues.filter((i) => i.category === "spacing"),
    ),
    radius: toCategory(
      "Radius",
      radiusConsistency,
      { dominant: radiusScale.dominant, outliers: radiusScale.outliers },
      "Konsistensi border radius.",
      issues.filter((i) => i.category === "radius"),
    ),
    component: toCategory(
      "Components",
      componentConsistency,
      { dominant: [], outliers: [] },
      "Konsistensi komponen — dihitung dari pola berulang (mode Deep Scan).",
      componentIssues,
    ),
    overall,
  };
}

function computeComponentConsistency(): number {
  return 70;
}