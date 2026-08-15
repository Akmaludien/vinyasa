import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { authorizeNexoraProxy, denialMessage } from "@/lib/nexora-route-security";

const PROXY_KEY = "proxy-key-abcdef";

function req(
  headers: Record<string, string> = {},
  url = "http://localhost/api/nexora/connect?project=shop",
  method: "GET" | "POST" = "GET",
) {
  return new NextRequest(url, { method, headers });
}

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env.NEXORA_BASE_URL = "https://nexora.test";
  process.env.NEXORA_INTEGRATION_TOKEN = "integration-secret";
  process.env.VINYASA_PROXY_KEY = PROXY_KEY;
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("authorizeNexoraProxy caller authentication", () => {
  it("denies a request with no proxy key at all", () => {
    const r = authorizeNexoraProxy(req());
    expect(r).toEqual({ ok: false, status: 401, reason: "unauthenticated" });
  });

  it("denies an incorrect proxy key", () => {
    const r = authorizeNexoraProxy(req({ "x-vinyasa-proxy-key": "wrong-key-abcdef" }));
    expect(r.ok).toBe(false);
    expect(r).toMatchObject({ status: 401 });
  });

  it("denies a proxy key of a different length (no timingSafeEqual throw)", () => {
    expect(() => authorizeNexoraProxy(req({ "x-vinyasa-proxy-key": "x" }))).not.toThrow();
    expect(authorizeNexoraProxy(req({ "x-vinyasa-proxy-key": "x" })).ok).toBe(false);
  });

  it("allows a valid proxy key on a same-origin request", () => {
    const r = authorizeNexoraProxy(
      req({ "x-vinyasa-proxy-key": PROXY_KEY, origin: "http://localhost", "sec-fetch-site": "same-origin" }),
    );
    expect(r).toEqual({ ok: true });
  });

  it("allows a valid proxy key when no Origin header is present (server-side call)", () => {
    expect(authorizeNexoraProxy(req({ "x-vinyasa-proxy-key": PROXY_KEY })).ok).toBe(true);
  });
});

describe("authorizeNexoraProxy CSRF / origin", () => {
  it("denies a cross-site request even with a valid key", () => {
    const r = authorizeNexoraProxy(
      req(
        { "x-vinyasa-proxy-key": PROXY_KEY, origin: "https://evil.test", "sec-fetch-site": "cross-site" },
        "http://localhost/api/nexora/sync",
        "POST",
      ),
    );
    expect(r).toEqual({ ok: false, status: 403, reason: "cross_origin" });
  });

  it("denies a foreign Origin without a sec-fetch-site hint", () => {
    const r = authorizeNexoraProxy(req({ "x-vinyasa-proxy-key": PROXY_KEY, origin: "https://evil.test" }));
    expect(r).toMatchObject({ ok: false, status: 403 });
  });

  it("denies a foreign Referer when Origin is absent", () => {
    const r = authorizeNexoraProxy(req({ "x-vinyasa-proxy-key": PROXY_KEY, referer: "https://evil.test/page" }));
    expect(r).toMatchObject({ ok: false, status: 403 });
  });

  it("allows a same-origin Referer when Origin is absent", () => {
    const r = authorizeNexoraProxy(req({ "x-vinyasa-proxy-key": PROXY_KEY, referer: "http://localhost/report" }));
    expect(r.ok).toBe(true);
  });

  it("matches the Host header rather than the normalised nextUrl origin", () => {
    // Next can normalise 127.0.0.1 to localhost in nextUrl; the Origin the
    // browser sends matches Host, so host comparison must win.
    const r = authorizeNexoraProxy(
      req(
        { "x-vinyasa-proxy-key": PROXY_KEY, host: "127.0.0.1:3401", origin: "http://127.0.0.1:3401" },
        "http://127.0.0.1:3401/api/nexora/connect?project=shop",
      ),
    );
    expect(r.ok).toBe(true);
  });
});

describe("authorizeNexoraProxy fails closed on configuration", () => {
  it("denies when VINYASA_PROXY_KEY is unset", () => {
    delete process.env.VINYASA_PROXY_KEY;
    const r = authorizeNexoraProxy(req({ "x-vinyasa-proxy-key": PROXY_KEY }));
    expect(r).toEqual({ ok: false, status: 503, reason: "not_configured" });
  });

  it("denies when the Nexora integration token is unset", () => {
    process.env.NEXORA_INTEGRATION_TOKEN = "";
    const r = authorizeNexoraProxy(req({ "x-vinyasa-proxy-key": PROXY_KEY }));
    expect(r).toEqual({ ok: false, status: 503, reason: "not_configured" });
  });
});

describe("denialMessage never leaks credentials", () => {
  it("returns a generic message for each denial reason", () => {
    const messages = [
      denialMessage({ ok: false, status: 401, reason: "unauthenticated" }),
      denialMessage({ ok: false, status: 403, reason: "cross_origin" }),
      denialMessage({ ok: false, status: 503, reason: "not_configured" }),
    ];
    for (const m of messages) {
      expect(m).toBeTruthy();
      expect(m).not.toContain(PROXY_KEY);
      expect(m).not.toContain("integration-secret");
    }
  });
});
