import { describe, it, expect } from "vitest";
import { isSafeUrl, isPrivateHost } from "@/lib/fetcher";
import { parseScanScope, shouldExcludeUrl, prioritizePaths } from "@/lib/scan";

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
});

describe("prioritizePaths", () => {
  it("prioritizes landing, about, pricing over random", () => {
    const sorted = prioritizePaths(["/random-x", "/", "/about"]);
    expect(sorted[0]).toBe("/");
    expect(sorted[1]).toBe("/about");
    expect(sorted[2]).toBe("/random-x");
  });
});