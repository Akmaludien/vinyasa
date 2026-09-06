import type { DesignModel } from "./model";
import {
  assignRoles,
  failingPairs,
  shapeDecisions,
  spacingScale,
  typeScale,
  widthBreakpoints,
  type RoleId,
  type TypeRoleId,
} from "./design-decisions";
import { buildTailwindCss, buildTokensCss, isUsableValue } from "./token-css";

/**
 * DESIGN.md is a brief, not an inventory.
 *
 * It is written to be handed to a code model, and that is a harder audience
 * than a person: given twenty-eight colors and sixteen font sizes with no
 * ruling on which is which, a model picks none of them and emits its own
 * defaults. A correct, complete token dump renders as black text on white,
 * which is how this file failed its first real test.
 *
 * So every section states a decision and the rule that goes with it, and the
 * raw inventories are gone; what survives of them is the two paste-ready
 * blocks at the end. Nothing here describes the design in adjectives: the
 * scanner reads declarations, not layout, so those sentences were guesses in
 * the costume of analysis. The judgment lives in design-decisions.ts and this
 * file only formats it.
 */

export type MdLang = "id" | "en";

export interface MdOptions {
  lang?: MdLang;
  sections?: {
    colors?: boolean;
    typography?: boolean;
    spacing?: boolean;
    shape?: boolean;
    layout?: boolean;
    components?: boolean;
    contrast?: boolean;
    snippets?: boolean;
  };
}

/* The declarations that decide whether a rebuilt component looks right. The
   rest of what the scanner captured is layout noise at this altitude. */
const COMPONENT_PROPS = [
  "border-radius",
  "padding",
  "background-color",
  "background",
  "color",
  "font-size",
  "font-weight",
  "border",
  "box-shadow",
  "gap",
];

interface Dict {
  extractedFrom: string;
  at: string;
  colorsTitle: string;
  role: string;
  hex: string;
  usedFor: string;
  roleNames: Record<RoleId, string>;
  roleUses: Record<RoleId, string>;
  colorsRule: string;
  typeTitle: string;
  step: string;
  size: string;
  weight: string;
  typeNames: Record<TypeRoleId, string>;
  typeRule: string;
  spacingTitle: string;
  spacingRule: string;
  shapeTitle: string;
  radiusDefault: string;
  radiusPill: string;
  shadowLabel: string;
  flatNote: string;
  layoutTitle: string;
  layoutRule: (max: number) => string;
  breakpointsLabel: string;
  componentsTitle: string;
  component: string;
  variants: string;
  recipe: string;
  componentsRule: string;
  contrastTitle: string;
  combination: string;
  ratio: string;
  contrastNote: string;
  snippetsTitle: string;
  snippetCss: string;
  snippetTw: string;
}

const ID: Dict = {
  extractedFrom: "Diekstrak dari",
  at: "pada",
  colorsTitle: "Warna",
  role: "Peran",
  hex: "Hex",
  usedFor: "Dipakai untuk",
  roleNames: {
    background: "Latar",
    surface: "Permukaan",
    border: "Garis",
    text: "Teks utama",
    muted: "Teks sekunder",
    brand: "Brand",
    brandAlt: "Aksen",
  },
  roleUses: {
    background: "Latar seluruh halaman.",
    surface: "Kartu, panel, header, dan blok yang perlu dibedakan dari latar.",
    border: "Garis pembatas, bingkai input, pemisah antar baris.",
    text: "Judul dan teks isi.",
    muted: "Keterangan, label, dan teks pendukung yang tidak boleh menyaingi teks utama.",
    brand: "Tombol utama, tautan, dan satu elemen penarik perhatian per layar.",
    brandAlt: "Aksen kedua: sorotan, ikon, status. Bukan pengganti brand.",
  },
  colorsRule:
    "Di luar daftar ini tidak ada warna lain. Kalau butuh tingkatan, buat dari transparansi warna yang sudah ada.",
  typeTitle: "Skala teks",
  step: "Langkah",
  size: "Ukuran",
  weight: "Berat",
  typeNames: {
    display: "Display",
    h1: "Judul 1",
    h2: "Judul 2",
    h3: "Judul 3",
    body: "Teks isi",
    small: "Teks kecil",
    caption: "Keterangan",
  },
  typeRule:
    "Satu halaman memakai satu Display atau satu Judul 1, bukan keduanya. Ukuran di luar tabel ini tidak dipakai.",
  spacingTitle: "Skala jarak",
  spacingRule:
    "Semua padding, margin, dan gap memakai angka di atas. Jarak antar bagian besar memakai nilai terbesar, jarak di dalam komponen memakai yang kecil.",
  shapeTitle: "Bentuk dan bayangan",
  radiusDefault: "Radius default untuk semua kotak, kartu, tombol, dan input",
  radiusPill: "Radius penuh, khusus pil, badge, dan tombol bulat",
  shadowLabel: "Bayangan",
  flatNote:
    "Desain ini tidak memakai bayangan. Pisahkan elemen dengan garis dan perbedaan permukaan.",
  layoutTitle: "Layout",
  layoutRule: (max) =>
    `Konten ditaruh di tengah dengan lebar maksimum sekitar ${max}px, sisanya jadi ruang kosong kiri kanan. Di bawah breakpoint terkecil, semua kolom jadi satu kolom.`,
  breakpointsLabel: "Breakpoints",
  componentsTitle: "Komponen",
  component: "Komponen",
  variants: "Varian",
  recipe: "Resep",
  componentsRule:
    "Resep di bawah diambil dari situs aslinya. Nilai berbentuk var(...) milik design system situs itu, ganti dengan token setara dari dokumen ini.",
  contrastTitle: "Kontras yang gagal",
  combination: "Kombinasi",
  ratio: "Rasio",
  contrastNote:
    "Kombinasi ini di bawah WCAG AA (4.5:1). Perbaiki salah satu warnanya, jangan disalin apa adanya.",
  snippetsTitle: "Token siap tempel",
  snippetCss: "CSS custom properties",
  snippetTw: "Tailwind theme",
};

const EN: Dict = {
  extractedFrom: "Extracted from",
  at: "on",
  colorsTitle: "Colors",
  role: "Role",
  hex: "Hex",
  usedFor: "Used for",
  roleNames: {
    background: "Background",
    surface: "Surface",
    border: "Border",
    text: "Primary text",
    muted: "Secondary text",
    brand: "Brand",
    brandAlt: "Accent",
  },
  roleUses: {
    background: "The whole page ground.",
    surface: "Cards, panels, headers, any block that must separate from the ground.",
    border: "Dividers, input outlines, row separators.",
    text: "Headings and body copy.",
    muted: "Captions, labels and supporting text that must not compete with body copy.",
    brand: "Primary buttons, links, and one attention-grabbing element per screen.",
    brandAlt: "Secondary accent: highlights, icons, status. Not a substitute for brand.",
  },
  colorsRule:
    "There are no colors beyond this list. If you need steps, derive them from the transparency of a color already here.",
  typeTitle: "Type scale",
  step: "Step",
  size: "Size",
  weight: "Weight",
  typeNames: {
    display: "Display",
    h1: "Heading 1",
    h2: "Heading 2",
    h3: "Heading 3",
    body: "Body",
    small: "Small",
    caption: "Caption",
  },
  typeRule:
    "A page uses either one Display or one Heading 1, never both. Sizes outside this table are not used.",
  spacingTitle: "Spacing scale",
  spacingRule:
    "All padding, margin and gap use the values above. Space between major sections takes the largest value; space inside a component takes the small ones.",
  shapeTitle: "Shape and elevation",
  radiusDefault: "Default radius for every box, card, button and input",
  radiusPill: "Full radius, for pills, badges and round buttons only",
  shadowLabel: "Shadow",
  flatNote: "This design uses no shadows. Separate elements with lines and surface changes instead.",
  layoutTitle: "Layout",
  layoutRule: (max) =>
    `Content is centered with a maximum width of roughly ${max}px, the rest staying empty on either side. Below the smallest breakpoint every column collapses to one.`,
  breakpointsLabel: "Breakpoints",
  componentsTitle: "Components",
  component: "Component",
  variants: "Variants",
  recipe: "Recipe",
  componentsRule:
    "These recipes come from the source site. Values shaped like var(...) belong to that site's own system; substitute the equivalent token from this document.",
  contrastTitle: "Failing contrast",
  combination: "Combination",
  ratio: "Ratio",
  contrastNote:
    "These combinations fall below WCAG AA (4.5:1). Fix one of the two colors rather than copying the pair as it is.",
  snippetsTitle: "Paste-ready tokens",
  snippetCss: "CSS custom properties",
  snippetTw: "Tailwind theme",
};

export function buildDesignMd(r: DesignModel, opts?: MdOptions): string {
  const lang: MdLang = opts?.lang ?? "id";
  const L = lang === "en" ? EN : ID;
  const sec = {
    colors: true,
    typography: true,
    spacing: true,
    shape: true,
    layout: true,
    components: true,
    contrast: true,
    snippets: true,
    ...(opts?.sections ?? {}),
  };

  const dateStr = new Date(r.metadata.generatedAt).toLocaleString(
    lang === "en" ? "en-US" : "id-ID",
  );
  const roles = assignRoles(r.tokens.colors);
  const lines: string[] = [];
  const rule = () => {
    lines.push("---");
    lines.push("");
  };

  lines.push(`# Design System: ${r.source.title}`);
  lines.push("");
  lines.push(`> ${L.extractedFrom} **${r.source.url}** ${L.at} ${dateStr}.`);
  lines.push("");

  if (sec.colors && roles.length > 0) {
    rule();
    lines.push(`## ${L.colorsTitle}`);
    lines.push("");
    lines.push(`| ${L.role} | ${L.hex} | ${L.usedFor} |`);
    lines.push("| --- | --- | --- |");
    for (const { id, hex } of roles) {
      lines.push(`| ${L.roleNames[id]} | \`${hex}\` | ${L.roleUses[id]} |`);
    }
    lines.push("");
    lines.push(`> ${L.colorsRule}`);
    lines.push("");
  }

  if (sec.typography) {
    const steps = typeScale(r.tokens.typography);
    const families = r.tokens.typography.families.filter((f) => isUsableValue(f.raw));
    if (steps.length > 0 || families.length > 0) {
      rule();
      lines.push(`## ${L.typeTitle}`);
      lines.push("");
      /* Two at most: the third family a large site loads is an icon font or a
         one-off, and listing it invites a model to alternate between them. */
      for (const f of families.slice(0, 2)) {
        lines.push(`- \`${f.raw}\``);
      }
      if (families.length > 0) lines.push("");
      if (steps.length > 0) {
        lines.push(`| ${L.step} | ${L.size} | ${L.weight} |`);
        lines.push("| --- | --- | --- |");
        for (const s of steps) {
          lines.push(`| ${L.typeNames[s.id]} | ${s.px}px | ${s.weight ?? "-"} |`);
        }
        lines.push("");
        lines.push(`> ${L.typeRule}`);
        lines.push("");
      }
    }
  }

  if (sec.spacing) {
    const steps = spacingScale(r.tokens.spacing);
    if (steps.length > 0) {
      rule();
      lines.push(`## ${L.spacingTitle}`);
      lines.push("");
      lines.push(steps.map((s) => `\`${s.px}px\``).join(" · "));
      lines.push("");
      lines.push(`> ${L.spacingRule}`);
      lines.push("");
    }
  }

  if (sec.shape) {
    const shape = shapeDecisions(r.tokens);
    if (shape.defaultRadius || shape.pillRadius || shape.shadows.length > 0) {
      rule();
      lines.push(`## ${L.shapeTitle}`);
      lines.push("");
      if (shape.defaultRadius) {
        lines.push(`- ${L.radiusDefault}: \`${shape.defaultRadius.raw}\``);
      }
      if (shape.pillRadius) {
        lines.push(`- ${L.radiusPill}: \`${shape.pillRadius.raw}\``);
      }
      if (shape.shadows.length > 0) {
        for (const s of shape.shadows) lines.push(`- ${L.shadowLabel}: \`${s}\``);
      } else {
        lines.push(`- ${L.flatNote}`);
      }
      lines.push("");
    }
  }

  if (sec.layout) {
    const bps = widthBreakpoints(r.tokens);
    if (bps.length > 0) {
      rule();
      lines.push(`## ${L.layoutTitle}`);
      lines.push("");
      lines.push(L.layoutRule(bps[bps.length - 1].px));
      lines.push("");
      lines.push(`- ${L.breakpointsLabel}: ${bps.map((b) => `\`${b.px}px\``).join(" · ")}`);
      lines.push("");
    }
  }

  if (sec.components && r.components.length > 0) {
    const rows: string[] = [];
    for (const c of r.components) {
      /* One value per property. A component that sets four different radii is
         telling you about its variants, not its recipe. */
      const seen = new Set<string>();
      const props: string[] = [];
      for (const prop of COMPONENT_PROPS) {
        if (props.length === 4) break;
        const value = c.properties[prop]?.[0];
        if (!value) continue;
        /* `background` and `background-color` are one slot in a recipe, and
           letting both in costs half the row for one fact. */
        const slot = prop.startsWith("background") ? "background" : prop;
        if (seen.has(slot)) continue;
        seen.add(slot);
        props.push(`${prop}: ${value}`);
      }
      /* A name and a selector with no declarations behind them is a detection
         hit, not a component worth writing down. */
      if (props.length === 0) continue;
      rows.push(`| ${c.name} | ${c.variantCount} | \`${props.join("; ")}\` |`);
    }

    if (rows.length > 0) {
      rule();
      lines.push(`## ${L.componentsTitle}`);
      lines.push("");
      lines.push(`| ${L.component} | ${L.variants} | ${L.recipe} |`);
      lines.push("| --- | --- | --- |");
      lines.push(...rows);
      lines.push("");
      lines.push(`> ${L.componentsRule}`);
      lines.push("");
    }
  }

  if (sec.contrast) {
    const pairs = failingPairs(roles);
    if (pairs.length > 0) {
      rule();
      lines.push(`## ${L.contrastTitle}`);
      lines.push("");
      lines.push(`| ${L.combination} | ${L.ratio} |`);
      lines.push("| --- | --- |");
      for (const p of pairs) {
        const combo = `${L.roleNames[p.combo[0]]} \`${p.fg}\` / ${L.roleNames[p.combo[1]]} \`${p.bg}\``;
        lines.push(`| ${combo} | ${p.ratio.toFixed(2)}:1 |`);
      }
      lines.push("");
      lines.push(`> ${L.contrastNote}`);
      lines.push("");
    }
  }

  if (sec.snippets) {
    rule();
    lines.push(`## ${L.snippetsTitle}`);
    lines.push("");
    lines.push(`### ${L.snippetCss}`);
    lines.push("");
    lines.push("```css");
    lines.push(buildTokensCss(r).trimEnd());
    lines.push("```");
    lines.push("");
    lines.push(`### ${L.snippetTw}`);
    lines.push("");
    lines.push("```css");
    lines.push(buildTailwindCss(r).trimEnd());
    lines.push("```");
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

export function buildDownloadFilename(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").replace(/[^a-z0-9.-]/gi, "_");
    return `DESIGN-${host}.md`;
  } catch {
    return "DESIGN.md";
  }
}
