import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/extract/route";
import type { CssSourceInput } from "@/lib/model";
import { extractDesignSystem } from "@/lib/extractor";

function req(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/extract", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("api/extract route", () => {
  it("rejects empty body", async () => {
    const res = await POST(new NextRequest("http://x/api/extract", { method: "POST" }));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.ok).toBe(false);
  });

  it("rejects malformed json", async () => {
    const r = new NextRequest("http://x/api/extract", {
      method: "POST",
      body: "{not-json",
    });
    const res = await POST(r);
    expect(res.status).toBe(400);
  });

  it("rejects missing urls", async () => {
    const res = await POST(req({ urls: [] }));
    expect(res.status).toBe(400);
  });

  it("rejects private/localhost URLs via SSRF guard", async () => {
    const res = await POST(req({ urls: ["http://localhost:3000"], mode: "fast" }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(false);
    expect(json.errors.some((e: { message: string }) => e.message.includes("pribadi/tidak aman"))).toBe(true);
  });

  it("rejects non-http schemes", async () => {
    const res = await POST(req({ urls: ["ftp://example.com"], mode: "fast" }));
    const json = await res.json();
    expect(json.errors.some((e: { message: string }) => e.message.includes("skema http/https"))).toBe(true);
  });
});

describe("extraction contract", () => {
  it("handles JS-rendered SPA with no inline CSS (needs deep scan)", () => {
    const src: CssSourceInput[] = [];
    const m = extractDesignSystem(src, "https://spa.test/", "SPA");
    expect(m.schemaVersion).toBe("1.0.0");
    expect(m.tokens.colors.primary).toEqual([]);
    expect(m.statistics.totalDeclarations).toBe(0);
  });
});