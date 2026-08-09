import type { DesignModel } from "./model";
import type { HealthReport } from "./health";
import type { A11yReport } from "./accessibility";
import type { ResponsiveReport } from "./responsive";

function fmtBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

export type MdLang = "id" | "en";

export interface MdOptions {
  lang?: MdLang;
  sections?: {
    colors?: boolean;
    typography?: boolean;
    textStyles?: boolean;
    radius?: boolean;
    spacing?: boolean;
    shadows?: boolean;
    audit?: boolean;
    health?: boolean;
    accessibility?: boolean;
    responsive?: boolean;
  };
}

export function buildDesignMd(r: DesignModel, opts?: MdOptions): string {
  const lang: MdLang = opts?.lang ?? "id";
  const sec = {
    colors: true,
    typography: true,
    textStyles: true,
    radius: true,
    spacing: true,
    shadows: true,
    audit: true,
    health: true,
    accessibility: true,
    responsive: true,
    ...(opts?.sections ?? {}),
  };
  const L =
    lang === "en"
      ? {
          extractedFrom: "Extracted from",
          at: "on",
          overall: "Overall accuracy score",
          color: "Color",
          typography: "Typography",
          radius: "Radius",
          sectionColors: "Colors",
          primary: "Primary colors",
          neutral: "Neutral colors",
          token: "Token",
          hex: "Hex",
          frequency: "Use count",
          share: "Share",
          sectionType: "Typography",
          fontFamily: "Font families",
          fontScale: "Font size scale",
          size: "Size",
          weight: "Font weights",
          lineHeight: "Line height",
          textStyles: "Common text styles",
          font: "Font",
          selector: "Selector",
          radiusTitle: "Border radius",
          value: "Value",
          spacingTitle: "Spacing (margin / padding / gap)",
          shadowsTitle: "Shadows",
          auditTitle: "CSS source audit",
          source: "Source",
          mode: "Type",
          sizeBytes: "Size",
          rules: "Rules",
          decls: "Declarations",
          colorAcc: "Color acc.",
          typeAcc: "Type acc.",
          score: "Score",
          notes: "Notes",
          note1: "Tokens extracted from CSS actually loaded by the page (external stylesheets, `<style>` blocks, and `style` attributes).",
          note2: "Frequency = how often a value appears across all CSS rules.",
          note3: "Accuracy score = share of successfully parsed declarations over total declarations in that category.",
          healthTitle: "Design Health",
          healthOverall: "Overall score",
          category: "Category",
          a11yTitle: "Accessibility (WCAG)",
          a11yNote: "Automatic analysis — not an official WCAG certification.",
          fail: "fail",
          warning: "warning",
          pass: "pass",
          responsiveTitle: "Responsive",
          mobile: "Mobile",
          tablet: "Tablet",
          desktop: "Desktop",
          breakpoints: "Breakpoints",
          generatedAuto: "Design tokens extracted automatically by Vinyasa from the page's loaded CSS.",
        }
      : {
          extractedFrom: "Diekstrak dari",
          at: "pada",
          overall: "Skor akurasi keseluruhan",
          color: "Warna",
          typography: "Tipografi",
          radius: "Radius",
          sectionColors: "Warna",
          primary: "Warna primer",
          neutral: "Warna netral",
          token: "Token",
          hex: "Hex",
          frequency: "Frekuensi",
          share: "Porsi",
          sectionType: "Tipografi",
          fontFamily: "Font family",
          fontScale: "Ukuran font (skala)",
          size: "Ukuran",
          weight: "Berat font",
          lineHeight: "Line height",
          textStyles: "Gaya teks yang sering dipakai",
          font: "Font",
          selector: "Selector",
          radiusTitle: "Border radius",
          value: "Nilai",
          spacingTitle: "Spacing (margin / padding / gap)",
          shadowsTitle: "Shadows",
          auditTitle: "Audit sumber CSS",
          source: "Sumber",
          mode: "Tipe",
          sizeBytes: "Ukuran",
          rules: "Rules",
          decls: "Deklarasi",
          colorAcc: "Akurasi warna",
          typeAcc: "Akurasi tipografi",
          score: "Skor",
          notes: "Catatan",
          note1: "Token diekstrak dari CSS yang benar-benar dimuat halaman (stylesheet eksternal, blok `<style>`, dan atribut `style`).",
          note2: "Frekuensi = berapa kali nilai muncul di seluruh rule CSS.",
          note3: "Skor akurasi = proporsi deklarasi yang berhasil diparsing terhadap total deklarasi pada kategori tersebut.",
          healthTitle: "Design Health",
          healthOverall: "Skor keseluruhan",
          category: "Kategori",
          a11yTitle: "Aksesibilitas (WCAG)",
          a11yNote: "Analisis otomatis — bukan sertifikasi WCAG resmi.",
          fail: "gagal",
          warning: "peringatan",
          pass: "lolos",
          responsiveTitle: "Responsif",
          mobile: "Mobile",
          tablet: "Tablet",
          desktop: "Desktop",
          breakpoints: "Breakpoints",
          generatedAuto: "Token diekstrak otomatis oleh Vinyasa dari CSS yang dimuat halaman.",
        };

  const { tokens } = r;
  const colors = tokens.colors;
  const fonts = tokens.typography;
  const textStyles = tokens.textStyles;
  const radius = tokens.radius;
  const sources = r.pages[0]?.sources ?? [];
  const scores = r.pages[0]?.scores ?? { color: 0, typography: 0, radius: 0, overall: 0 };
  const dateStr = new Date(r.metadata.generatedAt).toLocaleString(lang === "en" ? "en-US" : "id-ID");
  const lines: string[] = [];

  lines.push(`# Design System — ${r.source.title}`);
  lines.push("");
  lines.push(`> ${L.extractedFrom} **${r.source.url}** ${L.at} ${dateStr}.`);
  lines.push("");
  lines.push(`**${L.overall}: ${scores.overall}/100**`);
  lines.push("");

  lines.push(`- **${L.color}:** ${scores.color}/100`);
  lines.push(`- **${L.typography}:** ${scores.typography}/100`);
  lines.push(`- **${L.radius}:** ${scores.radius}/100`);
  lines.push("");

  if (sec.colors) {
    lines.push("---");
    lines.push("");
    lines.push(`## ${L.sectionColors}`);
    lines.push("");
    lines.push(`### ${L.primary}`);
    lines.push("");
    lines.push(`| ${L.token} | ${L.hex} | ${L.frequency} | ${L.share} |`);
    lines.push("| --- | --- | --- | --- |");
    for (const c of colors.primary) {
      lines.push(`| ${c.name} | \`${c.hex}\` | ${c.count} | ${c.usage}% |`);
    }
    lines.push("");
    lines.push(`### ${L.neutral}`);
    lines.push("");
    lines.push(`| ${L.token} | ${L.hex} | ${L.frequency} | ${L.share} |`);
    lines.push("| --- | --- | --- | --- |");
    for (const c of colors.neutral) {
      lines.push(`| ${c.name} | \`${c.hex}\` | ${c.count} | ${c.usage}% |`);
    }
    lines.push("");
  }

  if (sec.typography) {
    lines.push("---");
    lines.push("");
    lines.push(`## ${L.sectionType}`);
    lines.push("");
    lines.push(`### ${L.fontFamily}`);
    lines.push("");
    lines.push(`| ${L.font} | ${L.frequency} | ${L.share} |`);
    lines.push("| --- | --- | --- |");
    for (const f of fonts.families) {
      lines.push(`| \`${f.raw}\` | ${f.count} | ${f.usage}% |`);
    }
    lines.push("");
    lines.push(`### ${L.fontScale}`);
    lines.push("");
    lines.push(`| ${L.size} | px | ${L.frequency} | ${L.share} |`);
    lines.push("| --- | --- | --- | --- |");
    for (const s of fonts.sizes) {
      lines.push(`| \`${s.raw}\` | ${s.px}px | ${s.count} | ${s.usage}% |`);
    }
    lines.push("");
    lines.push(`### ${L.weight}`);
    lines.push("");
    lines.push(`| ${L.weight} | ${L.frequency} | ${L.share} |`);
    lines.push("| --- | --- | --- |");
    for (const w of fonts.weights) {
      lines.push(`| ${w.value} | ${w.count} | ${w.usage}% |`);
    }
    lines.push("");
    lines.push(`### ${L.lineHeight}`);
    lines.push("");
    lines.push(`| ${L.value} | ${L.frequency} | ${L.share} |`);
    lines.push("| --- | --- | --- |");
    for (const l of fonts.lineHeights) {
      lines.push(`| \`${l.raw}\` | ${l.count} | ${l.usage}% |`);
    }
    lines.push("");
  }

  if (sec.textStyles && textStyles.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push(`## ${L.textStyles}`);
    lines.push("");
    lines.push(`| ${L.font} | ${L.size} | ${L.weight} | ${L.lineHeight} | ${L.selector} |`);
    lines.push("| --- | --- | --- | --- | --- |");
    for (const t of textStyles) {
      lines.push(
        `| \`${t.fontFamily}\` | ${t.fontSize} | ${t.fontWeight} | ${t.lineHeight} | \`${t.selectors.slice(0, 2).join(", ")}\` |`,
      );
    }
    lines.push("");
  }

  if (sec.radius && radius.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push(`## ${L.radiusTitle}`);
    lines.push("");
    lines.push(`| ${L.value} | ${L.frequency} | ${L.share} |`);
    lines.push("| --- | --- | --- |");
    for (const r2 of radius) {
      lines.push(`| \`${r2.raw}\` | ${r2.count} | ${r2.usage}% |`);
    }
    lines.push("");
  }

  if (sec.spacing && tokens.spacing.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push(`## ${L.spacingTitle}`);
    lines.push("");
    lines.push(`| ${L.value} | ${L.frequency} | ${L.share} |`);
    lines.push("| --- | --- | --- |");
    for (const s of tokens.spacing) {
      lines.push(`| \`${s.raw}\` | ${s.count} | ${s.usage}% |`);
    }
    lines.push("");
  }

  if (sec.shadows && tokens.shadows.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push(`## ${L.shadowsTitle}`);
    lines.push("");
    for (const s of tokens.shadows) {
      lines.push(`- \`${s.raw}\``);
    }
    lines.push("");
  }

  if (sec.audit) {
    lines.push("---");
    lines.push("");
    lines.push(`## ${L.auditTitle}`);
    lines.push("");
    lines.push(`| ${L.source} | ${L.mode} | ${L.sizeBytes} | ${L.rules} | ${L.decls} | ${L.colorAcc} | ${L.typeAcc} | ${L.score} |`);
    lines.push("| --- | --- | --- | --- | --- | --- | --- | --- |");
    for (const s of sources) {
      lines.push(
        `| \`${s.url}\` | ${s.kind} | ${fmtBytes(s.sizeBytes)} | ${s.ruleCount} | ${s.declarationCount} | ${s.colorScore}% | ${s.typographyScore}% | ${s.accuracy} |`,
      );
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push(`## ${L.notes}`);
  lines.push("");
  lines.push(`- ${L.note1}`);
  lines.push(`- ${L.note2}`);
  lines.push(`- ${L.note3}`);

  const health = r.health as HealthReport | null;
  if (sec.health && health) {
    lines.push("");
    lines.push("---");
    lines.push("");
    lines.push(`## ${L.healthTitle}`);
    lines.push("");
    lines.push(`**${L.healthOverall}: ${health.overall}/100**`);
    lines.push("");
    lines.push(`| ${L.category} | ${L.score} |`);
    lines.push("| --- | --- |");
    for (const cat of [health.color, health.typography, health.spacing, health.radius, health.component]) {
      lines.push(`| ${cat.name} | ${cat.score}/100 |`);
      if (cat.outliers.length > 0) {
        lines.push(`|  | _Outlier: ${cat.outliers.join(", ")}_ |`);
      }
    }
  }

  const a11y = r.accessibility as A11yReport | null;
  if (sec.accessibility && a11y) {
    lines.push("");
    lines.push("---");
    lines.push("");
    lines.push(`## ${L.a11yTitle}`);
    lines.push("");
    lines.push(`- AA: ${a11y.wcagAA.critical} ${L.fail}, ${a11y.wcagAA.warning} ${L.warning}, ${a11y.wcagAA.pass} ${L.pass}`);
    lines.push(`- AAA: ${a11y.wcagAAA.critical} ${L.fail}, ${a11y.wcagAAA.warning} ${L.warning}, ${a11y.wcagAAA.pass} ${L.pass}`);
    for (const iss of a11y.issues.slice(0, 6)) {
      lines.push(`- [${iss.severity}] ${iss.message}`);
    }
    lines.push("");
    lines.push(`> ${L.a11yNote}`);
  }

  const resp = r.responsive as ResponsiveReport | null;
  if (sec.responsive && resp) {
    lines.push("");
    lines.push("---");
    lines.push("");
    lines.push(`## ${L.responsiveTitle}`);
    lines.push("");
    lines.push(`- ${L.mobile}: ${resp.mobile}/100 · ${L.tablet}: ${resp.tablet}/100 · ${L.desktop}: ${resp.desktop}/100`);
    if (resp.breakpoints.length > 0) {
      lines.push(`- ${L.breakpoints}: ${resp.breakpoints.map((b) => `${b.feature} ${b.value}`).join(", ")}`);
    }
  }

  return lines.join("\n");
}

export function buildDownloadFilename(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").replace(/[^a-z0-9.-]/gi, "_");
    return `DESIGN-${host}.md`;
  } catch {
    return "DESIGN.md";
  }
}