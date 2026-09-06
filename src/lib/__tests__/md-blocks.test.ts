import { describe, it, expect } from "vitest";
import { extractDesignSystem } from "@/lib/extractor";
import { buildDesignMd } from "@/lib/design-md";
import { splitMdBlocks } from "@/lib/md-blocks";
import type { CssSourceInput } from "@/lib/model";

const FIXTURE_CSS = `
:root { --p: #2563eb; --r: 8px; }
body { color: #0f172a; background: #ffffff; font-family: "Inter", sans-serif; font-size: 16px; padding: 16px; margin: 8px; line-height: 1.5; }
h1 { font-size: 32px; font-weight: 700; color: #111827; letter-spacing: -0.02em; }
.btn { border-radius: 8px; padding: 12px 20px; background: #2563eb; box-shadow: 0 1px 2px rgba(0,0,0,.08); }
.btn:hover { border-radius: 12px; color: #1d4ed8; }
.card { border-radius: 4px; gap: 24px; box-shadow: 0 4px 12px rgba(0,0,0,.12); }
@media (min-width: 768px) { .card { display: grid; gap: 32px; } }
`;

const src: CssSourceInput[] = [{ url: "a.css", kind: "inline", content: FIXTURE_CSS }];
const model = extractDesignSystem(src, "https://design.example/", "Design Fixture");

describe("splitMdBlocks", () => {
  it("recognises every construct design-md actually emits", () => {
    const blocks = splitMdBlocks(buildDesignMd(model));
    const kinds = new Set(blocks.map((b) => b.kind));

    for (const k of ["h1", "h2", "table", "list", "quote", "hr", "code"]) {
      expect(kinds).toContain(k);
    }
  });

  it("keeps a fenced block whole instead of parsing its lines", () => {
    const blocks = splitMdBlocks(buildDesignMd(model));
    const code = blocks.filter((b) => b.kind === "code");
    expect(code.length).toBe(2);

    for (const c of code) {
      expect(c.lang).toBe("css");
      /* The fence markers belong to the block, not to its text. */
      expect(c.text).not.toContain("```");
      /* A declaration block that lost its braces means the walker fell through
         to line parsing somewhere inside the fence. */
      expect(c.text).toContain("{");
      expect(c.text).toContain("}");
    }
  });

  it("does not let a blank line inside a fence split the block", () => {
    const blocks = splitMdBlocks("```css\na\n\nb\n```");
    expect(blocks).toEqual([{ kind: "code", lang: "css", text: "a\n\nb" }]);
  });

  it("runs an unclosed fence to the end of the document", () => {
    expect(splitMdBlocks("```\n| not | a | table |")).toEqual([
      { kind: "code", lang: "", text: "| not | a | table |" },
    ]);
  });

  for (const lang of ["id", "en"] as const) {
    it(`parses ${lang} tables into rectangular rows without the separator`, () => {
      const blocks = splitMdBlocks(buildDesignMd(model, { lang }));
      const tables = blocks.filter((b) => b.kind === "table");
      expect(tables.length).toBeGreaterThan(0);

      for (const t of tables) {
        expect(t.head.length).toBeGreaterThan(0);
        /* A ragged row means the cell split lost a boundary. That renders as
           misaligned columns rather than throwing, so it needs asserting. */
        for (const r of t.body) expect(r.length).toBe(t.head.length);
        /* The |---| alignment row must never survive into rendered output. */
        for (const c of [...t.head, ...t.body.flat()]) {
          expect(/^:?-{2,}:?$/.test(c)).toBe(false);
        }
      }
    });
  }

  it("terminates and drops blank lines on real output", () => {
    const md = buildDesignMd(model);
    const blocks = splitMdBlocks(md);
    expect(blocks.length).toBeGreaterThan(10);
    expect(blocks.length).toBeLessThanOrEqual(md.split("\n").length);
  });

  it("leaves inline code fences balanced inside table cells", () => {
    const blocks = splitMdBlocks(buildDesignMd(model));
    for (const t of blocks.filter((b) => b.kind === "table")) {
      for (const c of [...t.head, ...t.body.flat()]) {
        expect((c.match(/`/g) ?? []).length % 2).toBe(0);
      }
    }
  });

  it("handles an empty document and a document of only blank lines", () => {
    expect(splitMdBlocks("")).toEqual([]);
    expect(splitMdBlocks("\n\n   \n")).toEqual([]);
  });

  it("keeps a heading marker that is not followed by a space as a paragraph", () => {
    /* `#tag` is not a heading in Markdown, and treating it as one would eat
       the first character of the line. */
    expect(splitMdBlocks("#notaheading")).toEqual([{ kind: "p", text: "#notaheading" }]);
  });
});
