import { describe, it, expect } from "vitest";
import { extractDesignSystem } from "@/lib/extractor";
import { buildDesignMd } from "@/lib/design-md";
import {
  assignRoles,
  shapeDecisions,
  spacingScale,
  typeScale,
  widthBreakpoints,
} from "@/lib/design-decisions";
import type { CssSourceInput, DesignModel } from "@/lib/model";

/**
 * Shaped after what a real scan of a large site returns, because that is where
 * the output went wrong: a dark navy the palette files as a color, greys that
 * exist only inside rgba shadows, media queries that are not breakpoints, font
 * values that defer to something the reader does not have, and far more sizes,
 * spacings and radii than any hierarchy actually uses.
 */
const CSS = `
body { background: #ffffff; color: #0a2540; font-family: "sohne-var", sans-serif; font-size: 16px; line-height: 1.5; }
h1 { font-size: 48px; font-weight: 700; }
h2 { font-size: 32px; font-weight: 700; }
h3 { font-size: 24px; font-weight: 600; }
.lead { font-size: 16px; color: #425466; padding: 24px; }
.small { font-size: 14px; padding: 4px; }
.tiny { font-size: 11px; }
.micro { font-size: 9px; }
.a { color: #533afd; background: #533afd; padding: 8px; }
.b { color: #635bff; background: #635bff; }
.panel { background: #f6f9fc; border: 1px solid #e5edf5; border-radius: 8px; padding: 16px; }
.panel--wide { padding: 16px; border-radius: 8px; }
.divider { border-color: #cfd7df; }
.btn { border-radius: 8px; padding: 12px; background: #533afd; color: #ffffff; box-shadow: 0 2px 5px rgba(0,0,0,.1); }
.btn--ghost { border-radius: 8px; background: none; font-family: inherit; }
.badge { border-radius: 999px; padding: 4px; }
.avatar { border-radius: 50%; }
.card { border-radius: 8px; background: #f6f9fc; box-shadow: var(--cardShadow); }
.reset { box-shadow: none; font-family: var(--fontFamily); }
@media (min-width: 900px) { .panel { padding: 32px; } }
@media (min-width: 600px) { .panel { padding: 24px; } }
@media (pointer: fine) { .btn { padding: 12px; } }
@media (prefers-reduced-motion: reduce) { .card { box-shadow: none; } }
`;

function model(): DesignModel {
  const src: CssSourceInput[] = [{ url: "a.css", kind: "inline", content: CSS }];
  return extractDesignSystem(src, "https://stripe.example/", "Fixture");
}

function build(lang?: "id" | "en") {
  return buildDesignMd(model(), lang ? { lang } : undefined);
}

function section(md: string, heading: string): string {
  const start = md.indexOf(`## ${heading}`);
  expect(start, `section "${heading}" is missing`).toBeGreaterThan(-1);
  const next = md.indexOf("\n---", start);
  return md.slice(start, next === -1 ? undefined : next);
}

describe("design decisions", () => {
  it("gives the brand role to the vivid color, not to the darkest one", () => {
    const roles = assignRoles(model().tokens.colors);
    const brand = roles.find((r) => r.id === "brand");

    /* #0a2540 is dark navy: the palette files it as a color, but it is body
       text. Handing it the brand role buries the actual purple. */
    expect(brand?.hex).toBe("#533afd");
  });

  it("resolves the roles a page is actually built from", () => {
    const roles = new Map(assignRoles(model().tokens.colors).map((r) => [r.id, r.hex]));

    expect(roles.get("background")).toBe("#ffffff");
    expect(roles.get("text")).toBe("#0a2540");
    expect(roles.get("surface")).toBe("#f6f9fc");
  });

  it("names a type step for each level instead of listing every size", () => {
    const steps = typeScale(model().tokens.typography);
    const ids = steps.map((s) => s.id);

    expect(ids).toContain("body");
    expect(ids.filter((id) => id === "body")).toHaveLength(1);
    /* Seven sizes in the fixture, and a scale nobody can follow is exactly the
       failure this replaced, so the count stays capped. */
    expect(steps.length).toBeLessThanOrEqual(7);

    const body = steps.find((s) => s.id === "body")!;
    expect(body.px).toBe(16);
    /* Headings sit above body, supporting text below, in that order. */
    const order = steps.map((s) => s.px);
    expect(order.indexOf(body.px)).toBeGreaterThan(0);
    expect(Math.max(...order)).toBe(order[0]);
  });

  it("keeps the spacing scale short and in ascending order", () => {
    const steps = spacingScale(model().tokens.spacing).map((s) => s.px!);

    expect(steps.length).toBeLessThanOrEqual(6);
    expect([...steps].sort((a, b) => a - b)).toEqual(steps);
  });

  it("separates the default corner from the pill idiom", () => {
    const shape = shapeDecisions(model().tokens);

    expect(shape.defaultRadius?.raw).toBe("8px");
    /* `50%` and `999px` are round-thing markers, never a box corner, however
       often they appear. */
    expect(shape.pillRadius?.raw).toMatch(/999px|50%/);
    expect(shape.shadows.every((s) => !s.startsWith("var(") && s !== "none")).toBe(true);
    expect(shape.shadows.length).toBeLessThanOrEqual(2);
  });

  it("keeps only width queries as breakpoints, smallest first", () => {
    const bps = widthBreakpoints(model().tokens);

    expect(bps.map((b) => b.px)).toEqual([600, 900]);
  });

});

describe("buildDesignMd", () => {
  it("carries no prose about the design, only its values", () => {
    /* Adjectives like "dense" or "several accents" came out of declaration
       counts, which measure a stylesheet rather than a layout, and were wrong
       on the first real site they met. */
    for (const md of [build("id"), build("en")]) {
      expect(md).not.toContain("## Karakter desain");
      expect(md).not.toContain("## Design character");
      expect(md).not.toContain("## Cara memakai dokumen ini");
      expect(md).not.toContain("## How to use this document");
    }
  });

  it("states a rule beside every scale it hands over", () => {
    const md = build();

    for (const heading of ["Warna", "Skala teks", "Skala jarak"]) {
      expect(section(md, heading)).toContain("> ");
    }
  });

  it("gives every color a stated job", () => {
    const colors = section(build(), "Warna");

    expect(colors).toContain("Latar seluruh halaman.");
    expect(colors).toContain("Tombol utama");
    /* Percentages are extraction trivia and were the reason this table used to
       read as data rather than as instructions. */
    expect(colors).not.toContain("%");
  });

  it("carries no inventory of its own scan", () => {
    for (const md of [build("id"), build("en")]) {
      for (const gone of ["Audit", "akurasi", "accuracy", "Health", "Frekuensi", "Use count"]) {
        expect(md).not.toContain(gone);
      }
      /* A palette table of every hex found is what made a model pick nothing. */
      expect(md).not.toContain("Palet lengkap");
      expect(md).not.toContain("Full palette");
    }
  });

  it("emits both paste-ready blocks in either language", () => {
    for (const md of [build("id"), build("en")]) {
      expect(md).toContain("```css");
      expect(md).toContain(":root {");
      expect(md).toContain("@theme {");
    }
  });

  it("never declares a token whose value defers to something else", () => {
    /* A reader who copies the block must not end up with `--font-family-2:
       inherit`, so the prose and the block have to agree. */
    const md = build();
    expect(md).not.toContain(": inherit;");
    expect(md).not.toContain(": none;");
    expect(md).not.toMatch(/^\s+--[a-z-]+\d*: var\(/m);
  });

  it("never reports a contrast pair that passes AA", () => {
    const md = build();
    if (!md.includes("## Kontras yang gagal")) return;

    const rows = section(md, "Kontras yang gagal")
      .split("\n")
      .filter((l) => /\d+\.\d+:1/.test(l));
    for (const row of rows) {
      expect(Number(/(\d+\.\d+):1/.exec(row)![1])).toBeLessThan(4.5);
    }
  });

  it("stays short enough to be read as a brief", () => {
    /* The version this replaced ran past 250 lines of tables for a real site,
       and length is the symptom the rewrite exists to fix. The paste-ready
       blocks are excluded: they are machine input, not reading. */
    const prose = build().split("## Token siap tempel")[0];
    expect(prose.split("\n").length).toBeLessThan(120);

    /* And no table long enough to make the reader do the choosing. */
    let longestTable = 0;
    let run = 0;
    for (const line of prose.split("\n")) {
      run = line.startsWith("|") ? run + 1 : 0;
      longestTable = Math.max(longestTable, run);
    }
    expect(longestTable).toBeLessThanOrEqual(22);
  });

  it("does not set body text in a heading weight", () => {
    /* A stylesheet that declares font-weight only on headings makes 700 the
       most-used weight, and taking that literally sets the whole page bold. */
    const row = section(build(), "Skala teks")
      .split("\n")
      .find((l) => l.startsWith("| Teks isi"));

    expect(row).toBeDefined();
    expect(Number(/\|\s*(\d+)\s*\|$/.exec(row!)![1])).toBeLessThanOrEqual(500);
  });
});
