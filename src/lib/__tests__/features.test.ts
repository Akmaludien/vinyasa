import { describe, it, expect, beforeEach } from "vitest";
import { extractDesignSystem } from "@/lib/extractor";
import { buildExports, buildZip } from "@/lib/export";
import type { CssSourceInput } from "@/lib/model";
import { listSessions, saveSession, deleteSession, renameSession, loadSession, clearAllSessions } from "@/lib/sessions";

function model() {
  const src: CssSourceInput[] = [{ url: "a.css", kind: "inline", content: "body{color:#123456}" }];
  return extractDesignSystem(src, "https://t.test/", "Test");
}

describe("export", () => {
  it("builds a valid zip with all files", () => {
    const m = model();
    const zip = buildZip(m);
    expect(zip.name.endsWith(".zip")).toBe(true);
    expect(zip.data.byteLength).toBeGreaterThan(0);
  });

  it("exports DTCG-compatible tokens.json", () => {
    const m = model();
    const ex = buildExports(m);
    const tokens = JSON.parse(ex.files["tokens.json"]);
    expect(tokens.$metadata.schemaVersion).toBe("1.0.0");
    expect(typeof tokens.vinyasa).toBe("object");
  });
});

describe("sessions (localStorage shim)", () => {
  beforeEach(() => {
    // minimal localStorage shim for node env
    const store = new Map<string, string>();
    (globalThis as Record<string, unknown>).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
      key: (_i: number) => null,
      length: 0,
    };
    clearAllSessions();
  });

  it("saves and lists sessions", () => {
    const m = model();
    saveSession(m);
    expect(listSessions()).toHaveLength(1);
    expect(listSessions()[0].url).toBe("https://t.test/");
  });

  it("renames and deletes sessions", () => {
    const m = model();
    const s = saveSession(m);
    renameSession(s.id, "Renamed");
    expect(loadSession(s.id)?.name).toBe("Renamed");
    deleteSession(s.id);
    expect(listSessions()).toHaveLength(0);
  });

  it("deduplicates by url, keeping newest", () => {
    saveSession(model());
    saveSession(model());
    const list = listSessions();
    expect(list.filter((s) => s.url === "https://t.test/")).toHaveLength(1);
  });
});