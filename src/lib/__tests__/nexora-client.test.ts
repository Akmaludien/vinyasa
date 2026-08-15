import { describe, it, expect, vi, afterEach } from "vitest";
import { nexoraClient, NexoraError, type NexoraErrorKind } from "@/lib/nexora-client";
import type { NexoraDesignContext } from "@/lib/nexora";

const BASE = "https://nexora.test";

function setEnv(overrides: Record<string, string | undefined> = {}) {
  process.env.NEXORA_BASE_URL = BASE;
  process.env.NEXORA_API_URL = "";
  process.env.NEXORA_INTEGRATION_TOKEN = "secret";
  process.env.NEXORA_TIMEOUT_MS = "5000";
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

/** Minimal fetch Response shape consumed by nexora-client's request(). */
function makeRes(status: number, body: unknown) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

const validProjectEnvelope = {
  project: {
    key: "e-commerce",
    name: "E-Commerce",
    description: "desc",
    complexity: "medium",
    completeness: 70,
  },
};

const validContextEnvelope = {
  schema_version: "1.0",
  project_id: "e-commerce",
  project: { key: "e-commerce", name: "E-Commerce", description: "desc" },
  product: {
    userFlows: [{ id: "uf-1", title: "Checkout" }],
    features: [{ id: "f-1", title: "Cart" }],
    requirements: [{ id: "r-1", title: "Req" }],
  },
};

function canonicalDesign(): NexoraDesignContext {
  return {
    schema: "nexora.design-context",
    version: 1,
    generatedBy: "vinyasa test",
    sourceTitle: "Fixture",
    sourceUrl: "https://example.com",
    generatedAt: "2026-01-01T00:00:00Z",
    designSystem: {
      colors: [{ name: "x", hex: "#000", usage: 1 }],
      neutralColors: [],
      fontFamilies: ["Inter"],
      fontSizes: [],
      spacing: [],
      radius: [],
    },
    health: { overall: 80 },
    accessibility: { critical: 0, warning: 0, pass: 0 },
    components: { total: 1, blocks: [] },
    design: {
      pages: [],
      components: [],
      interactions: [],
      responsiveRules: [],
      layout: { containers: [], grid: { breakpoints: 0 }, navigation: [], sections: [] },
      visualLanguage: {
        colors: { primary: [], neutral: [] },
        typography: { families: [], sizes: [], weights: [] },
        spacing: [],
        radius: [],
        shadows: [],
        borders: [],
        motion: { durations: [], easings: [] },
        breakpoints: [],
        darkMode: { detected: false, variables: [] },
      },
      implementationHints: [],
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("nexoraClient request error kinds", () => {
  it("throws not_configured when no base URL is set", async () => {
    setEnv({ NEXORA_BASE_URL: "", NEXORA_API_URL: "" });
    await expect(nexoraClient.getProject("e-commerce")).rejects.toMatchObject({ kind: "not_configured" });
  });

  it("throws invalid_url for a non-http base URL", async () => {
    setEnv({ NEXORA_BASE_URL: "file:///etc/passwd" });
    await expect(nexoraClient.getProject("e-commerce")).rejects.toMatchObject({ kind: "invalid_url" });
  });

  it("throws invalid_url for an invalid project key", async () => {
    setEnv();
    await expect(nexoraClient.getProject("BAD KEY!")).rejects.toMatchObject({ kind: "invalid_url" });
    await expect(nexoraClient.getProjectContext("UPPER")).rejects.toMatchObject({ kind: "invalid_url" });
    await expect(nexoraClient.getDesignContext("")).rejects.toMatchObject({ kind: "invalid_url" });
  });

  it("maps 401/403 to unauthorized", async () => {
    setEnv();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeRes(401, { error: "auth" })));
    await expect(nexoraClient.getProject("e-commerce")).rejects.toMatchObject({ kind: "unauthorized", status: 401 });
  });

  it("maps 404 to not_found", async () => {
    setEnv();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeRes(404, { error: "gone" })));
    await expect(nexoraClient.getProject("e-commerce")).rejects.toMatchObject({ kind: "not_found", status: 404 });
  });

  it("maps non-2xx to upstream", async () => {
    setEnv();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeRes(502, { error: "bad gateway" })));
    await expect(nexoraClient.getProject("e-commerce")).rejects.toMatchObject({ kind: "upstream", status: 502 });
  });

  it("maps a fetch AbortError to timeout", async () => {
    setEnv({ NEXORA_TIMEOUT_MS: "50" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("aborted", "AbortError")));
    await expect(nexoraClient.getProject("e-commerce")).rejects.toMatchObject({ kind: "timeout" });
  });

  it("maps other network errors to network", async () => {
    setEnv();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    await expect(nexoraClient.getProject("e-commerce")).rejects.toMatchObject({ kind: "network" });
  });

  it("maps non-JSON response to malformed", async () => {
    setEnv();
    const res = { status: 200, ok: true, json: vi.fn().mockRejectedValue(new SyntaxError("bad")) } as unknown as Response;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(res));
    await expect(nexoraClient.getProject("e-commerce")).rejects.toMatchObject({ kind: "malformed" });
  });

  it("maps an incomplete project envelope to malformed", async () => {
    setEnv();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeRes(200, { project: { key: "only-key" } })));
    await expect(nexoraClient.getProject("e-commerce")).rejects.toMatchObject({ kind: "malformed" });
  });

  it("maps an unparseable product context to malformed", async () => {
    setEnv();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeRes(200, { project: { key: "x" } })));
    await expect(nexoraClient.getProjectContext("e-commerce")).rejects.toMatchObject({ kind: "malformed" });
  });
});

describe("nexoraClient successful requests", () => {
  it("getProject parses and returns the project envelope", async () => {
    setEnv();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeRes(200, validProjectEnvelope)));
    const p = await nexoraClient.getProject("e-commerce");
    expect(p.key).toBe("e-commerce");
    expect(p.completeness).toBe(70);
    // request sent to the right path with auth header
    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({ authorization: "Bearer secret" });
    expect(init.cache).toBe("no-store");
  });

  it("getProjectContext returns a typed product context", async () => {
    setEnv();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeRes(200, validContextEnvelope)));
    const ctx = await nexoraClient.getProjectContext("e-commerce");
    expect(ctx.source).toBe("nexora");
    expect(ctx.structure.features).toEqual(["Cart"]);
    expect(ctx.structure.requirements).toEqual(["Req"]);
  });

  it("getDesignContext returns the ctx when canonical and null when invalid", async () => {
    setEnv();
    const good = { design: { ctx: canonicalDesign(), synchronizedAt: "2026-01-01T00:00:00Z", artifactVersion: 3 } };
    const bad = { design: { ctx: { schema: "nope" }, synchronizedAt: null } };
    const fn = vi
      .fn()
      .mockResolvedValueOnce(makeRes(200, good))
      .mockResolvedValueOnce(makeRes(200, bad))
      .mockResolvedValueOnce(makeRes(200, { noDesign: true }));
    vi.stubGlobal("fetch", fn);

    const a = await nexoraClient.getDesignContext("e-commerce");
    expect(a.ctx).not.toBeNull();
    expect(a.synchronizedAt).toBe("2026-01-01T00:00:00Z");
    expect(a.artifactVersion).toBe(3);

    const b = await nexoraClient.getDesignContext("e-commerce");
    expect(b.ctx).toBeNull();

    const c = await nexoraClient.getDesignContext("e-commerce");
    expect(c.ctx).toBeNull();
    expect(c.synchronizedAt).toBeNull();
  });

  it("updateDesignContext posts a canonical payload and maps the result", async () => {
    setEnv();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        makeRes(200, {
          result: { artifactKey: "DESIGN-001", version: 5, checksum: "abc", synchronizedAt: "2026-01-01T00:00:00Z" },
        }),
      ),
    );
    const r = await nexoraClient.updateDesignContext("e-commerce", canonicalDesign());
    expect(r.ok).toBe(true);
    expect(r.version).toBe(5);
    expect(r.artifactKey).toBe("DESIGN-001");

    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toMatchObject({ projectKey: "e-commerce", source: "VINYASA" });
  });
});

describe("nexoraClient.updateDesignContext failure paths (never throws)", () => {
  it("returns not_ok for an invalid project key", async () => {
    setEnv();
    const r = await nexoraClient.updateDesignContext("bad key", canonicalDesign());
    expect(r).toEqual({ ok: false, errorKind: "invalid_url", error: expect.any(String) });
  });

  it("returns not_ok for a non-canonical payload", async () => {
    setEnv();
    const r = await nexoraClient.updateDesignContext("e-commerce", { schema: "nexora.design-context", designSystem: {} } as unknown as NexoraDesignContext);
    expect(r.ok).toBe(false);
    expect(r.errorKind).toBe("malformed");
  });

  it.each<[NexoraErrorKind]>([["timeout"], ["network"], ["upstream"], ["unauthorized"], ["not_found"]])(
    "surfaces %s as not_ok without throwing",
    async (kind) => {
      setEnv();
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new NexoraError(kind, "boom")));
      const r = await nexoraClient.updateDesignContext("e-commerce", canonicalDesign());
      expect(r.ok).toBe(false);
      expect(r.errorKind).toBe(kind);
    },
  );
});