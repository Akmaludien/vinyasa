import { describe, it, expect } from "vitest";
import { isSafeUrl, isPrivateHost } from "@/lib/fetcher";
import { parseScanScope, shouldExcludeUrl, prioritizePaths, parseSitemapXml } from "@/lib/scan";

describe("SSRF protection", () => {
  it("blocks http", () => {
    expect(isPrivateHost("localhost")).toBe(true);
    expect(isPrivateHost("127.0.0.1")).toBe(true);
    expect(isPrivateHost("10.0.0.1")).toBe(true);
    expect(isPrivateHost("192.168.1.1")).toBe(true);
    expect(isPrivateHost("127.0.0.1.dev")).toBe(true);
  });

  it("isSafeUrl rejects private schemes and hosts", () => {
    expect(isSafeUrl("http://localhost:3000")).toBe(false);
    expect(isSafeUrl("http://127.0.0.1/x")).toBe(false);
    expect(isSafeUrl("http://10.0.0.1")).toBe(false);
    expect(isSafeUrl("http://192.168.1.10")).toBe(false);
    expect(isSafeUrl("https://example.com")).toBe(true);
    expect(isSafeUrl("ftp://example.com")).toBe(false);
  });

  it("rejects invalid URLs", () => {
    expect(isSafeUrl("not a url")).toBe(false);
  });
});

describe("Scan scope", () => {
  it("landing scope keeps first url", () => {
    const scope = parseScanScope({ kind: "landing" }, ["https://a.com", "https://b.com"], 1);
    expect(scope.urls).toHaveLength(1);
    expect(scope.urls[0]).toBe("https://a.com");
  });

  it("custom scope respects maxPages", () => {
    const scope = parseScanScope({ kind: "custom", maxPages: 2, customUrls: ["https://a.com", "https://b.com", "https://c.com"] }, [], 1);
    expect(scope.urls).toEqual(["https://a.com", "https://b.com"]);
  });

  it("excludes non-http urls", () => {
    const scope = parseScanScope({ kind: "pages" }, ["https://a.com", "ftp://b.com", "javascript:void(0)"], 1);
    expect(scope.urls).toEqual(["https://a.com"]);
  });
});

describe("URL exclusions", () => {
  it("excludes login/legal/assets", () => {
    expect(shouldExcludeUrl("https://a.com/login")).toBe(true);
    expect(shouldExcludeUrl("https://a.com/pricing")).toBe(false);
    expect(shouldExcludeUrl("https://a.com/img.svg")).toBe(true);
    expect(shouldExcludeUrl("https://a.com/features")).toBe(false);
  });

  it("matches an extension at the end of the path, not anywhere in the URL", () => {
    /* Substring matching threw away articles whose slug merely named a format,
       which on a design blog is a lot of them. */
    expect(shouldExcludeUrl("https://a.com/blog/perbandingan-png-dan-svg")).toBe(false);
    expect(shouldExcludeUrl("https://a.com/guides/pdf-export")).toBe(false);

    /* A query string is not part of the filename. */
    expect(shouldExcludeUrl("https://a.com/logo.png?v=2")).toBe(true);
    expect(shouldExcludeUrl("https://a.com/sitemap.xml")).toBe(true);
  });
});

describe("parseSitemapXml", () => {
  it("tells a sitemap index apart from a list of pages", () => {
    /* Both shapes use <loc>. Reading an index as a page list is what queued
       Supabase's child sitemaps as if they were pages to scan. */
    const index = parseSitemapXml(
      `<?xml version="1.0"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
         <sitemap><loc>https://a.com/sitemap_www.xml</loc></sitemap>
         <sitemap><loc>https://a.com/docs/sitemap.xml</loc></sitemap>
       </sitemapindex>`,
    );
    expect(index.kind).toBe("index");
    expect(index.locs).toEqual(["https://a.com/sitemap_www.xml", "https://a.com/docs/sitemap.xml"]);

    const pages = parseSitemapXml(
      `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
         <url><loc>https://a.com/pricing</loc></url>
       </urlset>`,
    );
    expect(pages.kind).toBe("urlset");
    expect(pages.locs).toEqual(["https://a.com/pricing"]);
  });

  it("returns nothing for a document that is not a sitemap", () => {
    expect(parseSitemapXml("<html><body>404</body></html>").locs).toEqual([]);
    expect(parseSitemapXml("").locs).toEqual([]);
  });
});

describe("prioritizePaths", () => {
  it("prioritizes landing, about, pricing over random", () => {
    const sorted = prioritizePaths(["/random-x", "/", "/about"]);
    expect(sorted[0]).toBe("/");
    expect(sorted[1]).toBe("/about");
    expect(sorted[2]).toBe("/random-x");
  });
});