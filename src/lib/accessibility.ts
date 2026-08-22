import type { DesignModel, Rgb, ColorToken } from "./model";

export interface A11yIssue {
  severity: "critical" | "warning" | "suggestion";
  kind: string;
  message: string;
  evidence: string[];
  recommendation: string;
}

export interface A11yReport {
  wcagAA: { critical: number; warning: number; pass: number };
  wcagAAA: { critical: number; warning: number; pass: number };
  issues: A11yIssue[];
  note: string;
}

export function relativeLuminance(rgb: Rgb): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(rgb.r) + 0.7152 * lin(rgb.g) + 0.0722 * lin(rgb.b);
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

export function hexToRgb(hex: string): Rgb | null {
  const h = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function textSizeClass(px: number | null): "large" | "small" {
  if (px === null) return "small";
  return px >= 18.66 ? "large" : "small";
}

export function computeAccessibility(m: DesignModel): A11yReport {
  const issues: A11yIssue[] = [];
  const all = [...m.tokens.colors.primary, ...m.tokens.colors.neutral];
  const allTokens: Array<ColorToken & { rgb: Rgb }> = [];
  for (const c of all) {
    const rgb = hexToRgb(c.hex);
    if (rgb) allTokens.push({ ...c, rgb });
  }

  const sortedByUsage = [...allTokens].sort((a, b) => b.usage - a.usage);
  const textColor = sortedByUsage[0]?.rgb ?? null;
  const distinctBgs =
    allTokens.filter((t) => t.hex !== toTokenHex(textColor)) || [];
  const bgs = distinctBgs.length > 0 ? distinctBgs : allTokens.slice(0, 1);

  let aaCritical = 0;
  let aaWarning = 0;
  let aaPass = 0;
  let aaaCritical = 0;
  let aaaWarning = 0;
  let aaaPass = 0;

  const size = m.tokens.typography.sizes.find((s) => s.usage > 0)?.px ?? null;
  const sizeClass = textSizeClass(size);

  if (textColor) {
    for (const bg of bgs) {
      const ratio = contrastRatio(textColor, bg.rgb);
      const aa = sizeClass === "large" ? 3 : 4.5;
      const aaa = sizeClass === "large" ? 4.5 : 7;
      if (ratio < aa) {
        aaCritical++;
        aaaCritical++;
        issues.push({
          severity: "critical",
          kind: "contrast",
          message: `Kontras rendah (${ratio.toFixed(2)}:1) pada teks vs ${bg.hex}.`,
          evidence: [`text=${toTokenHex(textColor)} bg=${bg.hex}`, `kebutuhan AA ${aa}:1`],
          recommendation: "Perkuat kontras teks terhadap latar ini di atas 4.5:1 (AA).",
        });
      } else if (ratio < aaa) {
        aaWarning++;
        aaaWarning++;
        issues.push({
          severity: "warning",
          kind: "contrast",
          message: `Kontras cukup untuk AA (${ratio.toFixed(2)}:1) tapi belum AAA (${bg.hex}).`,
          evidence: [`text=${toTokenHex(textColor)} bg=${bg.hex}`],
          recommendation: "Pertimbangkan kontras 7:1 untuk teks kecil (AAA).",
        });
      } else {
        aaPass++;
        aaaPass++;
      }
    }
  } else {
    issues.push({
      severity: "suggestion",
      kind: "contrast",
      message: "Tidak cukup data teks/latar untuk menguji kontras.",
      evidence: [],
      recommendation: "Jalankan Deep Scan untuk data kontras per elemen.",
    });
  }

  const headingColors = m.tokens.colors.primary.filter((c) => c.usage > 5);
  for (const c of headingColors) {
    issues.push({
      severity: "suggestion",
      kind: "color-dependency",
      message: `Warna ${c.hex} dipakai untuk elemen menonjol. Pastikan tidak satu-satunya sinyal.`,
      evidence: [`usage ${c.usage}%`, ...c.selectors.slice(0, 2)],
      recommendation: "Gunakan tekstur/ikon sebagai sinyal tambahan selain warna.",
    });
  }

  return {
    wcagAA: { critical: aaCritical, warning: aaWarning, pass: aaPass },
    wcagAAA: { critical: aaaCritical, warning: aaaWarning, pass: aaaPass },
    issues,
    note: "Analisis otomatis berbasis token warna yang terdeteksi. Bukan sertifikasi WCAG resmi. Verifikasi manual tetap diperlukan.",
  };
}

function toTokenHex(rgb: Rgb): string {
  const to = (n: number) => Math.round(n).toString(16).padStart(2, "0");
  return `#${to(rgb.r)}${to(rgb.g)}${to(rgb.b)}`;
}