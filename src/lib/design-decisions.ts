import type { ColorRole, ColorToken, DesignModel, ScalarToken } from "./model";
import { contrastRatio, hexToRgb, relativeLuminance } from "./accessibility";
import { isUsableValue } from "./token-value";

/**
 * Turns a scan into decisions.
 *
 * A scan produces inventories: twenty-eight colors, sixteen font sizes, sixteen
 * spacing values, sixteen radii. Handed that, a reader (and every code model)
 * picks nothing and falls back to defaults, which is exactly how a design
 * system becomes a white page with text on it. Every export in here answers a
 * question instead of listing options: which color is the page background, what
 * size is body text, what is the default corner.
 *
 * Kept apart from the Markdown so the reasoning is testable on its own, and so
 * the writer stays a formatter with no judgment of its own.
 */

/**
 * How far a color is from grey, 0 to 1.
 *
 * Decided on this rather than on the token's own `isNeutral` flag, which is set
 * upstream by hue bucketing and calls near-black slate a color. Harmless in a
 * palette listing, wrong here: it would hand the brand row to the body-text
 * navy and bury the actual brand.
 */
export function chroma(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  return (Math.max(rgb.r, rgb.g, rgb.b) - Math.min(rgb.r, rgb.g, rgb.b)) / 255;
}

/**
 * Above this, a color reads as a color; below it, as a shade.
 *
 * It sits high on purpose. Stripe's navy `#0a2540` scores 0.21, and at a lower
 * cutoff it took the brand row from the actual purple while body text fell
 * through to `#000000`, a value that exists only inside rgba shadows.
 */
const VIVID_CHROMA = 0.3;

export type RoleId = ColorRole;

export interface RoleAssignment {
  id: RoleId;
  hex: string;
}

/**
 * Best-effort mapping from raw palette to the roles a stylesheet is written in.
 *
 * Frequency alone cannot say which color is the page background and which is
 * body text, but luminance and contrast can: the ground is whichever neutral
 * sits at a luminance extreme and is used most, and body text is whatever
 * clears AA against it. Roles that cannot be resolved are left out rather than
 * guessed, so a row never claims something the CSS did not say.
 */
export function assignRoles(colors: DesignModel["tokens"]["colors"]): RoleAssignment[] {
  const all = [...colors.primary, ...colors.neutral].filter((c) => hexToRgb(c.hex) !== null);
  type Swatch = Pick<ColorToken, "hex">;
  const lum = (c: Swatch) => relativeLuminance(hexToRgb(c.hex)!);
  const ratio = (a: Swatch, b: Swatch) => contrastRatio(hexToRgb(a.hex)!, hexToRgb(b.hex)!);

  const preferred = (role: RoleId, valid: (candidate: Swatch) => boolean = () => true): Swatch | undefined => {
    const grouped = new Map<string, { score: number; count: number }>();
    for (const item of colors.evidence ?? []) {
      if (item.role !== role || !hexToRgb(item.hex)) continue;
      const previous = grouped.get(item.hex);
      grouped.set(item.hex, { score: Math.max(previous?.score ?? 0, item.score), count: (previous?.count ?? 0) + (item.count ?? 1) });
    }
    return [...grouped.entries()]
      .sort((a, b) => b[1].score - a[1].score || b[1].count - a[1].count)
      .map(([hex]) => ({ hex }))
      .find((candidate) => !taken.has(candidate.hex) && valid(candidate));
  };

  const shades = all.filter((c) => chroma(c.hex) < VIVID_CHROMA).sort((a, b) => b.usage - a.usage);
  /* Ties on usage are common and meaningless, so the more saturated color wins
     them: between two equally used candidates, the vivid one is the brand. */
  const vivid = all
    .filter((c) => chroma(c.hex) >= VIVID_CHROMA)
    .sort((a, b) => b.usage - a.usage || chroma(b.hex) - chroma(a.hex));

  const out: RoleAssignment[] = [];
  const taken = new Set<string>();
  const claim = (id: RoleId, token: Swatch | undefined) => {
    if (!token || taken.has(token.hex)) return;
    taken.add(token.hex);
    out.push({ id, hex: token.hex });
  };

  /* A page ground is near-white or near-black. Anything between is a surface,
     not the canvas, so the extremes are the only candidates. */
  const bg = preferred("background") ??
    shades.find((c) => lum(c) >= 0.85 || lum(c) <= 0.12) ??
    shades.slice().sort((a, b) => Math.abs(lum(b) - 0.5) - Math.abs(lum(a) - 0.5))[0];
  claim("background", bg);

  if (bg) {
    /* Nearly the ground but not quite: cards, headers, wells. */
    claim(
      "surface",
      preferred("surface", (c) => ratio(c, bg) > 1.02 && ratio(c, bg) < 1.7) ??
        shades.find((c) => !taken.has(c.hex) && ratio(c, bg) > 1.02 && ratio(c, bg) < 1.7),
    );
    /* Visible as a line, unreadable as text. That gap is what a border is. */
    claim(
      "border",
      preferred("border", (c) => ratio(c, bg) >= 1.7 && ratio(c, bg) < 4.5) ??
        shades.find((c) => !taken.has(c.hex) && ratio(c, bg) >= 1.7 && ratio(c, bg) < 4.5),
    );
    claim(
      "text",
      preferred("text", (c) => ratio(c, bg) >= 4.5) ??
        shades.find((c) => !taken.has(c.hex) && ratio(c, bg) >= 4.5),
    );
    /* Secondary text: still legible, deliberately quieter than the body. */
    claim(
      "muted",
      preferred("muted", (c) => ratio(c, bg) >= 3 && ratio(c, bg) < 12) ??
        shades.find((c) => !taken.has(c.hex) && ratio(c, bg) >= 3 && ratio(c, bg) < 12),
    );
  }

  claim("brand", preferred("brand") ?? vivid[0]);
  claim("brandAlt", preferred("brandAlt") ?? vivid.find((c) => !taken.has(c.hex)));

  return out;
}

export interface ContrastPair {
  combo: [RoleId, RoleId];
  fg: string;
  bg: string;
  ratio: number;
}

/**
 * The contrast checks a rebuild will actually run into.
 *
 * Not taken from the accessibility report: that pass assumes the single
 * most-used color is the text color, which on a light site is the background,
 * so it produces pages of white-on-near-white pairs that exist nowhere. Pairing
 * resolved roles gives a handful of combinations the reader is about to write,
 * and only failures are returned, so an empty result is a real all-clear.
 */
export function failingPairs(roles: RoleAssignment[]): ContrastPair[] {
  const by = new Map(roles.map((r) => [r.id, r.hex]));
  const wanted: Array<[RoleId, RoleId]> = [
    ["text", "background"],
    ["text", "surface"],
    ["muted", "background"],
    ["brand", "background"],
    /* Label on a filled brand button: the pair a brand color most often fails
       and the one nobody checks before shipping it. */
    ["background", "brand"],
  ];

  const out: ContrastPair[] = [];
  for (const combo of wanted) {
    const fg = by.get(combo[0]);
    const bg = by.get(combo[1]);
    if (!fg || !bg) continue;
    const a = hexToRgb(fg);
    const b = hexToRgb(bg);
    if (!a || !b) continue;
    const ratio = contrastRatio(a, b);
    if (ratio >= 4.5) continue;
    out.push({ combo, fg, bg, ratio });
  }
  return out;
}

export type TypeRoleId = "display" | "h1" | "h2" | "h3" | "body" | "small" | "caption";

export interface TypeStep {
  id: TypeRoleId;
  raw: string;
  px: number;
  weight: number | null;
}

/**
 * Six or seven steps with names, out of however many sizes the scan found.
 *
 * Sixteen unlabelled sizes is not a scale, it is a census, and nothing in it
 * says which one a paragraph uses. Body is anchored first because every other
 * step is defined relative to it: headings are what sit above, supporting text
 * is what sits below.
 */
export function typeScale(typography: DesignModel["tokens"]["typography"]): TypeStep[] {
  const sizes = typography.sizes.filter((s) => isUsableValue(s.raw) && s.px > 0);
  if (sizes.length === 0) return [];

  /* Deduplicate by rendered size: `1rem` and `16px` are one step, and keeping
     both would spend two names on the same decision. */
  const byPx = new Map<number, (typeof sizes)[number]>();
  for (const s of sizes) {
    const prev = byPx.get(s.px);
    if (!prev || s.usage > prev.usage) byPx.set(s.px, s);
  }
  const unique = [...byPx.values()];

  const readable = unique.filter((s) => s.px >= 13 && s.px <= 18);
  const body =
    readable.sort((a, b) => b.usage - a.usage)[0] ??
    unique.slice().sort((a, b) => Math.abs(a.px - 16) - Math.abs(b.px - 16))[0];

  const above = unique.filter((s) => s.px > body.px).sort((a, b) => b.px - a.px);
  const below = unique.filter((s) => s.px < body.px).sort((a, b) => b.px - a.px);

  /* Four heading steps at most. A site with eight larger sizes is using them
     for one-off treatments, not for a hierarchy anyone can follow. */
  const headingIds: TypeRoleId[] = above.length >= 4 ? ["display", "h1", "h2", "h3"] : ["h1", "h2", "h3"];

  const weights = [...typography.weights].sort((a, b) => a.value - b.value);
  const heavy = weights[weights.length - 1]?.value ?? 700;
  /* Body is never bold. Sites usually declare `font-weight` only where it
     departs from normal, so the most-used declared weight on a heading-only
     stylesheet is 700, and handing that to body would set the whole page in
     bold. The lightest declared text weight wins, and 400 stands in when every
     declared weight is a heading weight, which is what the CSS default says
     anyway. */
  const regular = weights.find((w) => w.value <= 500)?.value ?? 400;

  const steps: TypeStep[] = [];
  above.slice(0, headingIds.length).forEach((s, i) => {
    steps.push({ id: headingIds[i], raw: s.raw, px: s.px, weight: heavy });
  });
  steps.push({ id: "body", raw: body.raw, px: body.px, weight: regular });
  below.slice(0, 2).forEach((s, i) => {
    steps.push({ id: i === 0 ? "small" : "caption", raw: s.raw, px: s.px, weight: regular });
  });

  return steps;
}

/**
 * The handful of spacing steps a layout is actually built on.
 *
 * Ranked by use, then re-sorted small to large: the most-used values are the
 * rhythm, and the order they are read in is the scale.
 */
export function spacingScale(spacing: ScalarToken[]): ScalarToken[] {
  const byPx = new Map<number, ScalarToken>();
  for (const s of spacing) {
    if (s.px === null || s.px <= 0) continue;
    const prev = byPx.get(s.px);
    if (!prev || s.usage > prev.usage) byPx.set(s.px, s);
  }
  return [...byPx.values()]
    .sort((a, b) => b.usage - a.usage)
    .slice(0, 6)
    .sort((a, b) => a.px! - b.px!);
}

export interface ShapeDecision {
  /* The corner every box gets unless it is a pill. */
  defaultRadius: ScalarToken | null;
  /* A large or fully-round value, if the design uses one at all. */
  pillRadius: ScalarToken | null;
  shadows: string[];
}

export function shapeDecisions(tokens: DesignModel["tokens"]): ShapeDecision {
  const radii = tokens.radius.filter((r) => isUsableValue(r.raw));
  /* `50%` and four-digit pixel values are the pill idiom, not a corner size, so
     they are never the default no matter how often they appear. */
  const isPill = (r: ScalarToken) => r.raw.includes("%") || (r.px !== null && r.px >= 100);
  const boxes = radii.filter((r) => !isPill(r) && r.px !== null && r.px > 0);

  return {
    defaultRadius: [...boxes].sort((a, b) => b.usage - a.usage)[0] ?? null,
    pillRadius: radii.find(isPill) ?? null,
    shadows: tokens.shadows
      .filter((s) => isUsableValue(s.raw))
      .sort((a, b) => b.count - a.count)
      .slice(0, 2)
      .map((s) => s.raw),
  };
}

/** Width queries only, smallest first: the points where the layout changes. */
export function widthBreakpoints(tokens: DesignModel["tokens"]): Array<{ raw: string; px: number }> {
  return tokens.breakpoints
    .filter((b) => b.feature.includes("width") && b.px !== null)
    .map((b) => ({ raw: b.raw, px: b.px! }))
    .sort((a, b) => a.px - b.px)
    .filter((b, i, arr) => i === 0 || arr[i - 1].px !== b.px);
}
