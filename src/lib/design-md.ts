import type { DesignModel } from "./model";
import type { HealthReport } from "./health";
import type { A11yReport } from "./accessibility";
import type { ResponsiveReport } from "./responsive";

function fmtBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

export function buildDesignMd(r: DesignModel): string {
  const { tokens } = r;
  const colors = tokens.colors;
  const fonts = tokens.typography;
  const textStyles = tokens.textStyles;
  const radius = tokens.radius;
  const sources = r.pages[0]?.sources ?? [];
  const scores = r.pages[0]?.scores ?? { color: 0, typography: 0, radius: 0, overall: 0 };
  const lines: string[] = [];

  lines.push(`# Design System — ${r.source.title}`);
  lines.push("");
  lines.push(`> Diekstrak dari **${r.source.url}** pada ${new Date(r.metadata.generatedAt).toLocaleString("id-ID")}.`);
  lines.push("");
  lines.push(`**Skor akurasi keseluruhan: ${scores.overall}/100**`);
  lines.push("");

  lines.push(`- **Warna:** ${scores.color}/100`);
  lines.push(`- **Tipografi:** ${scores.typography}/100`);
  lines.push(`- **Radius:** ${scores.radius}/100`);
  lines.push("");

  lines.push("---");
  lines.push("");
  lines.push("## Warna");
  lines.push("");
  lines.push("### Warna primer");
  lines.push("");
  lines.push("| Token | Hex | Frekuensi | Porsi |");
  lines.push("| --- | --- | --- | --- |");
  for (const c of colors.primary) {
    lines.push(`| ${c.name} | \`${c.hex}\` | ${c.count} | ${c.usage}% |`);
  }
  lines.push("");
  lines.push("### Warna netral");
  lines.push("");
  lines.push("| Token | Hex | Frekuensi | Porsi |");
  lines.push("| --- | --- | --- | --- |");
  for (const c of colors.neutral) {
    lines.push(`| ${c.name} | \`${c.hex}\` | ${c.count} | ${c.usage}% |`);
  }
  lines.push("");

  lines.push("---");
  lines.push("");
  lines.push("## Tipografi");
  lines.push("");
  lines.push("### Font family");
  lines.push("");
  lines.push("| Font | Frekuensi | Porsi |");
  lines.push("| --- | --- | --- |");
  for (const f of fonts.families) {
    lines.push(`| \`${f.raw}\` | ${f.count} | ${f.usage}% |`);
  }
  lines.push("");
  lines.push("### Ukuran font (skala)");
  lines.push("");
  lines.push("| Ukuran | px | Frekuensi | Porsi |");
  lines.push("| --- | --- | --- | --- |");
  for (const s of fonts.sizes) {
    lines.push(`| \`${s.raw}\` | ${s.px}px | ${s.count} | ${s.usage}% |`);
  }
  lines.push("");
  lines.push("### Berat font");
  lines.push("");
  lines.push("| Berat | Frekuensi | Porsi |");
  lines.push("| --- | --- | --- |");
  for (const w of fonts.weights) {
    lines.push(`| ${w.value} | ${w.count} | ${w.usage}% |`);
  }
  lines.push("");
  lines.push("### Line height");
  lines.push("");
  lines.push("| Nilai | Frekuensi | Porsi |");
  lines.push("| --- | --- | --- |");
  for (const l of fonts.lineHeights) {
    lines.push(`| \`${l.raw}\` | ${l.count} | ${l.usage}% |`);
  }
  lines.push("");

  if (textStyles.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("## Gaya teks yang sering dipakai");
    lines.push("");
    lines.push("| Font | Ukuran | Berat | Line height | Selector |");
    lines.push("| --- | --- | --- | --- | --- |");
    for (const t of textStyles) {
      lines.push(
        `| \`${t.fontFamily}\` | ${t.fontSize} | ${t.fontWeight} | ${t.lineHeight} | \`${t.selectors.slice(0, 2).join(", ")}\` |`,
      );
    }
    lines.push("");
  }

  if (radius.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("## Border radius");
    lines.push("");
    lines.push("| Nilai | Frekuensi | Porsi |");
    lines.push("| --- | --- | --- |");
    for (const r2 of radius) {
      lines.push(`| \`${r2.raw}\` | ${r2.count} | ${r2.usage}% |`);
    }
    lines.push("");
  }

  if (tokens.spacing.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("## Spacing (margin / padding / gap)");
    lines.push("");
    lines.push("| Nilai | Frekuensi | Porsi |");
    lines.push("| --- | --- | --- |");
    for (const s of tokens.spacing) {
      lines.push(`| \`${s.raw}\` | ${s.count} | ${s.usage}% |`);
    }
    lines.push("");
  }

  if (tokens.shadows.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("## Shadows");
    lines.push("");
    for (const s of tokens.shadows) {
      lines.push(`- \`${s.raw}\``);
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push("## Audit sumber CSS");
  lines.push("");
  lines.push("| Sumber | Tipe | Ukuran | Rules | Deklarasi | Akurasi warna | Akurasi tipografi | Skor |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const s of sources) {
    lines.push(
      `| \`${s.url}\` | ${s.kind} | ${fmtBytes(s.sizeBytes)} | ${s.ruleCount} | ${s.declarationCount} | ${s.colorScore}% | ${s.typographyScore}% | ${s.accuracy} |`,
    );
  }
  lines.push("");

  lines.push("---");
  lines.push("");
  lines.push("## Catatan");
  lines.push("");
  lines.push("- Token diekstrak dari CSS yang benar-benar dimuat halaman (stylesheet eksternal, blok `<style>`, dan atribut `style`).");
  lines.push("- Frekuensi = berapa kali nilai muncul di seluruh rule CSS.");
  lines.push("- Skor akurasi = proporsi deklarasi yang berhasil diparsing terhadap total deklarasi pada kategori tersebut.");

  const health = r.health as HealthReport | null;
  if (health) {
    lines.push("");
    lines.push("---");
    lines.push("");
    lines.push("## Design Health");
    lines.push("");
    lines.push(`**Skor keseluruhan: ${health.overall}/100**`);
    lines.push("");
    lines.push("| Kategori | Skor |");
    lines.push("| --- | --- |");
    for (const cat of [health.color, health.typography, health.spacing, health.radius, health.component]) {
      lines.push(`| ${cat.name} | ${cat.score}/100 |`);
      if (cat.outliers.length > 0) {
        lines.push(`|  | _Outlier: ${cat.outliers.join(", ")}_ |`);
      }
    }
  }

  const a11y = r.accessibility as A11yReport | null;
  if (a11y) {
    lines.push("");
    lines.push("---");
    lines.push("");
    lines.push("## Aksesibilitas (WCAG)");
    lines.push("");
    lines.push(`- AA: ${a11y.wcagAA.critical} gagal, ${a11y.wcagAA.warning} peringatan, ${a11y.wcagAA.pass} lolos`);
    lines.push(`- AAA: ${a11y.wcagAAA.critical} gagal, ${a11y.wcagAAA.warning} peringatan, ${a11y.wcagAAA.pass} lolos`);
    for (const iss of a11y.issues.slice(0, 6)) {
      lines.push(`- [${iss.severity}] ${iss.message}`);
    }
    lines.push("");
    lines.push("> Analisis otomatis — bukan sertifikasi WCAG resmi.");
  }

  const resp = r.responsive as ResponsiveReport | null;
  if (resp) {
    lines.push("");
    lines.push("---");
    lines.push("");
    lines.push("## Responsif");
    lines.push("");
    lines.push(`- Mobile: ${resp.mobile}/100 · Tablet: ${resp.tablet}/100 · Desktop: ${resp.desktop}/100`);
    if (resp.breakpoints.length > 0) {
      lines.push(`- Breakpoints: ${resp.breakpoints.map((b) => `${b.feature} ${b.value}`).join(", ")}`);
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