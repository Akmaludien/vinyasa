import type { DesignModel } from "./model";

export interface ResponsiveIssue {
  severity: "warning" | "info";
  kind: string;
  message: string;
  evidence: string[];
  recommendation: string;
}

export interface ResponsiveReport {
  mobile: number;
  tablet: number;
  desktop: number;
  breakpoints: Array<{ feature: string; value: string; px: number | null }>;
  baseFontSize: number | null;
  minFontSize: number | null;
  maxFontSize: number | null;
  issues: ResponsiveIssue[];
  note: string;
}

const VIEWPORT_BUCKETS = [
  { name: "mobile", min: 320, max: 414 },
  { name: "tablet", min: 768, max: 1024 },
  { name: "desktop", min: 1280, max: 1920 },
];

export function computeResponsive(m: DesignModel): ResponsiveReport {
  const issues: ResponsiveIssue[] = [];
  const bps = m.tokens.breakpoints.map((b) => ({ feature: b.feature, value: b.raw, px: b.px }));

  const sizeRow = m.tokens.typography.sizes[0];
  const baseFontSize =
    (sizeRow ? sizeRow.px : null) ?? m.tokens.typography.sizes.find((s) => s.usage > 0)?.px ?? null;
  const pxVals = m.tokens.typography.sizes.map((s) => s.px).filter((p): p is number => p !== null);
  const minFontSize = pxVals.length ? Math.min(...pxVals) : null;
  const maxFontSize = pxVals.length ? Math.max(...pxVals) : null;

  const hasMinWidth = bps.some((b) => b.feature === "min-width");
  const hasMaxWidth = bps.some((b) => b.feature === "max-width");
  const breakpointPx = bps.map((b) => b.px ?? 0).filter((p) => p > 0).sort((a, b) => a - b);

  if (bps.length === 0) {
    issues.push({
      severity: "info",
      kind: "breakpoints",
      message: "Tidak ada media query (@media) yang terdeteksi di CSS.",
      evidence: [],
      recommendation:
        "Tambahkan media query berbasis min-width/max-width supaya tata letak responsif terdokumentasi.",
    });
  } else if (!hasMinWidth && hasMaxWidth) {
    issues.push({
      severity: "warning",
      kind: "breakpoints",
      message: "Hanya media query max-width (desktop-first) yang ditemukan.",
      evidence: bps.slice(0, 3).map((b) => `@media ${b.value} (${b.feature})`),
      recommendation:
        "Pertimbangkan pendekatan mobile-first (min-width) untuk pemeliharaan yang lebih mudah.",
    });
  }

  if (breakpointPx.length > 0) {
    const coveredBuckets = VIEWPORT_BUCKETS.filter((bucket) => {
      const covered =
        breakpointPx.some((px) => px >= bucket.min && px <= bucket.max) || hasMinWidth;
      return !covered;
    });
    for (const bucket of coveredBuckets) {
      issues.push({
        severity: "info",
        kind: "viewport",
        message: `Tidak ada breakpoint untuk ukuran ${bucket.name}.`,
        evidence: [`viewport ${bucket.name} (${bucket.min}-${bucket.max}px)`],
        recommendation: `Verifikasi tata letak pada lebar ${bucket.name} (${bucket.min}-${bucket.max}px).`,
      });
    }
  }

  if (minFontSize !== null && minFontSize < 11) {
    issues.push({
      severity: "warning",
      kind: "font-size",
      message: `Ukuran font minimum ${minFontSize}px — terlalu kecil untuk dibaca di mobile.`,
      evidence: [`font-size min=${minFontSize}px`],
      recommendation: "Hindari ukuran font di bawah 14px untuk teks konten.",
    });
  }

  if (maxFontSize !== null && maxFontSize > 80) {
    issues.push({
      severity: "info",
      kind: "font-size",
      message: `Font hero besar terdeteksi (${maxFontSize}px) — pastikan diskalakan di viewport kecil.`,
      evidence: [`font-size max=${maxFontSize}px`],
      recommendation: "Gunakan clamp() atau media query untuk skala heading responsif.",
    });
  }

  const mobile =
    bps.length === 0
      ? 50
      : Math.round(
          Math.min(100, 55 + Math.min(bps.length, 6) * 7 + (minFontSize === null || minFontSize >= 14 ? 8 : 0)),
        );
  const tablet = Math.round(Math.min(100, mobile + bps.length * 2));
  const desktop = Math.round(Math.min(100, tablet + (hasMinWidth ? 6 : 0)));

  return {
    mobile,
    tablet,
    desktop,
    breakpoints: bps,
    baseFontSize,
    minFontSize,
    maxFontSize,
    issues,
    note: "Analisis responsif berbasis heuristik CSS (breakpoints, tipografi, spacing). Analisis visual per viewport memerlukan Deep Scan.",
  };
}