/**
 * Block splitter for the DESIGN.md preview.
 *
 * Every construct buildDesignMd emits is line level, so one forward walk that
 * groups runs of table rows and list items covers the whole document. This is
 * not a general Markdown parser and is not meant to become one: it handles
 * exactly what design-md.ts produces, which is why it fits in one pass with no
 * nesting and no inline HTML.
 *
 * Kept out of the component so it is plain data the tests can assert on
 * directly, rather than something reachable only through rendered JSX.
 */

export type MdBlock =
  | { kind: "h1" | "h2" | "h3" | "quote" | "p"; text: string }
  | { kind: "hr" }
  | { kind: "list"; items: string[] }
  | { kind: "table"; head: string[]; body: string[][] }
  | { kind: "code"; lang: string; text: string };

const SEPARATOR = /^:?-{2,}:?$/;

export function splitMdBlocks(md: string): MdBlock[] {
  const lines = md.split("\n");
  const out: MdBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i += 1;
      continue;
    }

    /* A fence swallows everything up to the closing fence, blank lines and
       pipes included, so it has to be tested before any other construct. An
       unclosed fence runs to the end of the document rather than falling back
       to line parsing, which is what a Markdown reader would show too. */
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith("```")) {
        body.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      out.push({ kind: "code", lang, text: body.join("\n") });
      continue;
    }

    /* Table rows always open and close with a pipe, so the outer two
       characters are dropped before splitting on the inner boundaries. */
    if (line.startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        const cells = lines[i]
          .slice(1, -1)
          .split("|")
          .map((c) => c.trim());
        /* The |---|---| row carries alignment, not data. */
        if (!cells.every((c) => SEPARATOR.test(c))) rows.push(cells);
        i += 1;
      }
      const [head, ...body] = rows;
      if (head) out.push({ kind: "table", head, body });
      continue;
    }

    if (line.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith("- ")) {
        items.push(lines[i].slice(2));
        i += 1;
      }
      out.push({ kind: "list", items });
      continue;
    }

    /* Every remaining branch consumes exactly one line, so advancing here
       keeps the loop guaranteed to terminate. */
    i += 1;

    if (line.startsWith("### ")) out.push({ kind: "h3", text: line.slice(4) });
    else if (line.startsWith("## ")) out.push({ kind: "h2", text: line.slice(3) });
    else if (line.startsWith("# ")) out.push({ kind: "h1", text: line.slice(2) });
    else if (line.startsWith("> ")) out.push({ kind: "quote", text: line.slice(2) });
    else if (/^-{3,}$/.test(line.trim())) out.push({ kind: "hr" });
    else out.push({ kind: "p", text: line });
  }

  return out;
}
