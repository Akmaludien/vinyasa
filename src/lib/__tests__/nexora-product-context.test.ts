import { describe, it, expect } from "vitest";
import { parseNexoraProductContext } from "@/lib/nexora-product-context";

describe("parseNexoraProductContext", () => {
  it("returns null for null and non-object input", () => {
    expect(parseNexoraProductContext(null)).toBeNull();
    expect(parseNexoraProductContext(undefined)).toBeNull();
    expect(parseNexoraProductContext("nope")).toBeNull();
    expect(parseNexoraProductContext(42)).toBeNull();
    expect(parseNexoraProductContext([])).toBeNull();
  });

  it("returns null when the project envelope is missing key or name", () => {
    expect(parseNexoraProductContext({})).toBeNull();
    expect(parseNexoraProductContext({ project: {} })).toBeNull();
    expect(parseNexoraProductContext({ project: { key: "api" } })).toBeNull();
    expect(parseNexoraProductContext({ project: { name: "API" } })).toBeNull();
    expect(parseNexoraProductContext({ project: { key: "", name: "" } })).toBeNull();
  });

  it("parses a full product context and orders pages by artifact kind", () => {
    const raw = {
      project: { key: "e-commerce", name: "E-Commerce", description: "d" },
      productContext: {
        userFlows: [{ id: "uf-1", title: "Checkout", kind: "flow" }],
        features: [{ id: "f-1", title: "Cart" }],
        userStories: [{ id: "us-1", title: "Add item" }],
        requirements: [{ id: "r-1", title: "Must load < 1s" }],
        architecture: [{ id: "a-1", title: "Monolith" }],
      },
    };

    const ctx = parseNexoraProductContext(raw);
    expect(ctx).not.toBeNull();
    expect(ctx!.source).toBe("nexora");
    expect(ctx!.projectKey).toBe("e-commerce");
    expect(ctx!.projectName).toBe("E-Commerce");
    expect(ctx!.description).toBe("d");

    // pages come order: user-flow, feature, user-story
    expect(ctx!.structure.pages.map((p) => `${p.kind}:${p.id}`)).toEqual([
      "user-flow:uf-1",
      "feature:f-1",
      "user-story:us-1",
    ]);
    expect(ctx!.structure.features).toEqual(["Cart"]);
    expect(ctx!.structure.requirements).toEqual(["Must load < 1s"]);
    expect(ctx!.structure.userFlows).toEqual(["Checkout"]);
    expect(ctx!.structure.architecture).toEqual(["Monolith"]);

    // context reflect the project envelope
    expect(ctx!.context.projectId).toBe("e-commerce");
    expect(ctx!.context.projectName).toBe("E-Commerce");
    expect(ctx!.context.designerNote).toBe("d");
  });

  it("drops artifacts without an id and skips non-string fields", () => {
    const raw = {
      project: { key: "p", name: "P" },
      productContext: {
        userFlows: [{ title: "no-id" }, { id: "ok", title: "OK", kind: 99 }],
        features: [{ id: "", title: "empty id" }, "not-an-object", null],
        requirements: [{ id: "r", title: "" }],
      },
    };

    const ctx = parseNexoraProductContext(raw);
    expect(ctx!.structure.pages).toEqual([{ id: "ok", title: "OK", kind: "user-flow" }]);
    expect(ctx!.structure.features).toEqual([]);
    // empty title still yields the id as the title fallback
    expect(ctx!.structure.requirements).toEqual(["r"]);
  });

  it("caps page artifacts at 60 entries", () => {
    const many = Array.from({ length: 75 }, (_, i) => ({ id: `id-${i}`, title: `T${i}` }));
    const ctx = parseNexoraProductContext({
      project: { key: "p", name: "P" },
      productContext: { userFlows: many },
    });
    expect(ctx!.structure.pages.length).toBe(60);
  });

  it("provides undefined description and designerNote when absent", () => {
    const ctx = parseNexoraProductContext({ project: { key: "p", name: "P" } });
    expect(ctx!.description).toBeUndefined();
    expect(ctx!.context.designerNote).toBeUndefined();
  });
});