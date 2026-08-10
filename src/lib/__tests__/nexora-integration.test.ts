import { describe, it, expect, vi, beforeEach } from "vitest";

// --- nexora-connection (client state model) -------------------------------

// Vitest runs in "node" env without localStorage. Provide a minimal stub so we
// can exercise persistence round-trips.
function installLocalStorage() {
  const store = new Map<string, string>();
  const localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
  (globalThis as Record<string, unknown>).window = {};
  (globalThis as Record<string, unknown>).localStorage = localStorage;
  return { store };
}

import {
  emptyConnection,
  connectToNexora,
  setNexoraSyncing,
  completeNexoraSync,
  recordNexoraError,
  disconnectNexora,
  loadNexoraConnection,
  isValidProjectKey,
  type NexoraConnection,
} from "@/lib/nexora-connection";

describe("nexora-connection", () => {
  beforeEach(() => {
    installLocalStorage();
  });

  it("starts empty and not connected", () => {
    const c = emptyConnection();
    expect(c).toEqual({ status: "not_connected", projectKey: null });
    expect(loadNexoraConnection()).toEqual({ status: "not_connected", projectKey: null });
  });

  it("validates project key slug format", () => {
    expect(isValidProjectKey("e-commerce-api")).toBe(true);
    expect(isValidProjectKey("a")).toBe(false);
    expect(isValidProjectKey("a1")).toBe(true);
    expect(isValidProjectKey("1abc")).toBe(true);
    expect(isValidProjectKey("has_underscore")).toBe(false);
    expect(isValidProjectKey("UPPER")).toBe(false);
    expect(isValidProjectKey("")).toBe(false);
  });

  it("connects and persists only the key projection (no token)", () => {
    const c: NexoraConnection = connectToNexora("e-commerce-api", "E-Commerce API");
    expect(c.status).toBe("connected");
    expect(c.projectKey).toBe("e-commerce-api");
    expect(loadNexoraConnection().projectKey).toBe("e-commerce-api");
    expect(loadNexoraConnection().projectName).toBe("E-Commerce API");
  });

  it("rejects an invalid key on connect", () => {
    const c = connectToNexora("bad key!", "X");
    expect(c.status).toBe("error");
    expect(c.projectKey).toBeNull();
  });

  it("moves through syncing -> synced and records version + timestamp", () => {
    let c = connectToNexora("app", "App");
    c = setNexoraSyncing(c);
    expect(c.status).toBe("syncing");
    c = completeNexoraSync(c, { version: 4, synchronizedAt: "2026-01-01T00:00:00Z" });
    expect(c.status).toBe("synced");
    expect(c.version).toBe(4);
    expect(c.lastSyncedAt).toBe("2026-01-01T00:00:00Z");
    // persisted
    expect(loadNexoraConnection().version).toBe(4);
  });

  it("records an error but keeps the project key", () => {
    let c = connectToNexora("api", "API");
    c = recordNexoraError(c, "upstream");
    expect(c.status).toBe("error");
    expect(c.error).toBe("upstream");
    expect(c.projectKey).toBe("api");
  });

  it("disconnects back to empty", () => {
    connectToNexora("api", "API");
    const c = disconnectNexora();
    expect(c).toEqual({ status: "not_connected", projectKey: null });
    expect(loadNexoraConnection().status).toBe("not_connected");
  });

  it("round-trips a full lifecycle through storage", () => {
    let c = connectToNexora("api", "API");
    c = setNexoraSyncing(c);
    c = completeNexoraSync(c, { version: 2 });
    const restored = loadNexoraConnection();
    expect(restored.status).toBe("synced");
    expect(restored.projectKey).toBe("api");
    expect(restored.version).toBe(2);
  });
});

// --- /api/nexora/connect route -------------------------------------------

const clientMock = vi.hoisted(() => ({
  getProject: vi.fn(),
  getProjectContext: vi.fn(),
  getDesignContext: vi.fn(),
  updateDesignContext: vi.fn(),
}));

vi.mock("@/lib/nexora-client", () => {
  return {
    nexoraClient: clientMock,
    NexoraError: class NexoraError extends Error {
      kind: string;
      status?: number;
      constructor(kind: string, message: string, status?: number) {
        super(message);
        this.kind = kind;
        this.status = status;
      }
    },
  };
});

import { GET as connectGET } from "@/app/api/nexora/connect/route";
import { POST as syncPOST } from "@/app/api/nexora/sync/route";
import { NextRequest } from "next/server";

function getReq(url = "http://localhost/api/nexora/connect?project=e-commerce-api") {
  return new NextRequest(url, { method: "GET" });
}

function postReq(body: unknown) {
  return new NextRequest("http://localhost/api/nexora/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("api/nexora/connect", () => {
  beforeEach(() => {
    installLocalStorage();
    clientMock.getProject.mockReset();
  });

  it("rejects a missing/invalid project key", async () => {
    const res = await connectGET(getReq("http://localhost/api/nexora/connect"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
  });

  it("rejects malformed project key", async () => {
    const res = await connectGET(getReq("http://localhost/api/nexora/connect?project=bad%20key"));
    expect(res.status).toBe(400);
  });

  it("returns project info on success", async () => {
    clientMock.getProject.mockResolvedValue({
      key: "e-commerce-api",
      name: "E-Commerce API",
      description: "desc",
      complexity: "medium",
      completeness: 70,
    });
    const res = await connectGET(getReq());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.project.name).toBe("E-Commerce API");
  });

  it("maps not-found errors to 404", async () => {
    const { NexoraError } = await import("@/lib/nexora-client");
    clientMock.getProject.mockRejectedValue(new NexoraError("not_found", "nope"));
    const res = await connectGET(getReq());
    expect(res.status).toBe(404);
  });

  it("maps not-configured errors to 503", async () => {
    const { NexoraError } = await import("@/lib/nexora-client");
    clientMock.getProject.mockRejectedValue(new NexoraError("not_configured", "none"));
    const res = await connectGET(getReq());
    expect(res.status).toBe(503);
  });
});

describe("api/nexora/sync", () => {
  beforeEach(() => {
    installLocalStorage();
    clientMock.getProject.mockReset();
  });

  it("rejects invalid body JSON", async () => {
    const req = new NextRequest("http://localhost/api/nexora/sync", {
      method: "POST",
      body: "{not-json",
    });
    const res = await syncPOST(req);
    expect(res.status).toBe(400);
  });

  it("rejects missing project key", async () => {
    const res = await syncPOST(postReq({ payload: {} }));
    expect(res.status).toBe(400);
  });

  it("rejects a non-canonical design payload", async () => {
    const res = await syncPOST(postReq({ projectKey: "api", payload: { schema: "nexora.design-context", designSystem: {} } }));
    expect(res.status).toBe(422);
  });

  it("rejects an empty design payload (no colors/fonts)", async () => {
    const payload = {
      schema: "nexora.design-context",
      designSystem: { colors: [], neutralColors: [], fontFamilies: [] },
    };
    const res = await syncPOST(postReq({ projectKey: "api", payload }));
    expect(res.status).toBe(422);
  });

  it("returns ok with version on a successful update", async () => {
    const payload = {
      schema: "nexora.design-context",
      sourceUrl: "https://example.com",
      designSystem: { colors: [{ name: "x", hex: "#000", usage: 1 }], neutralColors: [], fontFamilies: ["Inter"] },
    };
    clientMock.updateDesignContext.mockResolvedValue({ ok: true, artifactKey: "DESIGN-001", version: 2, checksum: "abc", synchronizedAt: "2026-01-01T00:00:00Z" });
    const res = await syncPOST(postReq({ projectKey: "api", payload }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.result.version).toBe(2);
    expect(clientMock.updateDesignContext).toHaveBeenCalledTimes(1);
  });

  it("surfaces a failed update as an error response", async () => {
    const payload = {
      schema: "nexora.design-context",
      sourceUrl: "https://example.com",
      designSystem: { colors: [{ name: "x", hex: "#000", usage: 1 }], neutralColors: [], fontFamilies: ["Inter"] },
    };
    clientMock.updateDesignContext.mockResolvedValue({ ok: false, errorKind: "upstream", error: "boom" });
    const res = await syncPOST(postReq({ projectKey: "api", payload }));
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.ok).toBe(false);
  });
});