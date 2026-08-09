import { describe, it, expect, vi } from "vitest";
import { expandImports, extractSources, hydrateSources } from "@/lib/fetcher";

describe("expandImports", () => {
  it("finds url() and string imports", () => {
    const css = `@import url("a.css"); @import 'b.css'; @import url(c.css) screen;`;
    const found = expandImports(css, "https://x.test/main.css");
    expect(found.map((f) => f.url)).toEqual([
      "https://x.test/a.css",
      "https://x.test/b.css",
      "https://x.test/c.css",
    ]);
  });

  it("resolves relative against base url", () => {
    const found = expandImports(`@import "./theme.css";`, "https://x.test/sub/main.css");
    expect(found[0].url).toBe("https://x.test/sub/theme.css");
  });
});

describe("extractSources", () => {
  it("captures external, inline, and attribute styles", () => {
    const html = `<html><head>
      <link rel="stylesheet" href="/a.css">
      <style>.x{color:red}</style>
    </head><body style="background:#fff"></body></html>`;
    const { sources, title } = extractSources(html, "https://x.test/");
    expect(sources.some((s) => s.kind === "external" && s.url === "https://x.test/a.css")).toBe(true);
    expect(sources.some((s) => s.kind === "inline")).toBe(true);
    expect(sources.some((s) => s.kind === "attribute")).toBe(true);
    expect(title).toBe("");
  });

  it("deduplicates repeated stylesheets", () => {
    const html = `<link rel="stylesheet" href="/a.css"><link rel="stylesheet" href="/a.css">`;
    const { sources } = extractSources(html, "https://x.test/");
    expect(sources.filter((s) => s.url === "https://x.test/a.css")).toHaveLength(1);
  });
});

describe("hydrateSources", () => {
  it("fetches external css and nested @imports", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("main.css")) {
          return new Response(`@import "./theme.css"; .a{color:red}`, { status: 200 });
        }
        if (String(url).includes("theme.css")) {
          return new Response(`.b{color:blue}`, { status: 200 });
        }
        return new Response("", { status: 404 });
      }),
    );
    const sources = [{ url: "https://x.test/main.css", kind: "external" as const, content: "" }];
    const hydrated = await hydrateSources(sources);
    expect(hydrated.length).toBe(2);
    expect(hydrated.some((s) => s.url.includes("theme.css"))).toBe(true);
    expect(hydrated.every((s) => s.content.length > 0)).toBe(true);
    vi.unstubAllGlobals();
  });

  it("respects import depth limit and skips unsafe urls", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("main.css")) {
          return new Response(`@import "http://localhost:3000/evil.css"; .a{}`, { status: 200 });
        }
        return new Response("", { status: 404 });
      }),
    );
    const sources = [{ url: "https://x.test/main.css", kind: "external" as const, content: "" }];
    const hydrated = await hydrateSources(sources);
    expect(hydrated.some((s) => s.url.includes("evil.css"))).toBe(false);
    vi.unstubAllGlobals();
  });
});