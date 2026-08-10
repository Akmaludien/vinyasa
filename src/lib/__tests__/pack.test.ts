import { describe, it, expect } from "vitest";
import { extractDesignSystem } from "@/lib/extractor";
import { computeReadiness } from "@/lib/readiness";
import { buildDesignPack, buildDesignPackZip, buildPackFiles } from "@/lib/pack";
import { buildDesignSpecification } from "@/lib/spec";
import { parseProjectContext, emptyProjectContext, type NexoraProjectContext } from "@/lib/project-context";
import { adaptDesign } from "@/lib/adapt";
import { createProject, newProjectId, addDesignVersion } from "@/lib/project";
import type { CssSourceInput } from "@/lib/model";

function model(css: string, url = "https://design.example/") {
  const src: CssSourceInput[] = [{ url: "a.css", kind: "inline", content: css }];
  return extractDesignSystem(src, url, "Design Fixture");
}

const FIXTURE_CSS = `
:root { --p: #2563eb; }
body { color: #0f172a; background: #ffffff; font-family: "Inter", sans-serif; font-size: 16px; padding: 16px; }
.btn:hover { border-radius: 8px; color: #2563eb; }
@media (min-width: 768px) { .card { display: grid; } }
`;

describe("computeReadiness", () => {
  it("returns a 0-100 score with dimensions and a summary", () => {
    const m = model(FIXTURE_CSS);
    const r = computeReadiness(m);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.dimensions.length).toBeGreaterThan(0);
    expect(r.dimensions.every((d) => d.ratio >= 0 && d.ratio <= 1)).toBe(true);
    expect(["complete", "partial", "missing"]).toContain(r.dimensions[0].state);
    expect(typeof r.summary).toBe("string");
  });

  it("counts assets across pages", () => {
    const m = model(FIXTURE_CSS);
    m.pages[0].assets = [{ name: "logo", type: "image", source: "logo.png", page: m.pages[0].url }];
    const r = computeReadiness(m);
    const assets = r.dimensions.find((d) => d.key === "assets");
    expect(assets?.detail).toContain("1/2");
  });
});

describe("buildDesignPack", () => {
  it("assembles spec + readiness into a pack", () => {
    const m = model(FIXTURE_CSS);
    const pack = buildDesignPack(m);
    expect(pack.schema).toBe("vinyasa.design-pack");
    expect(pack.spec.schema).toBe("design-specification");
    expect(typeof pack.readiness.score).toBe("number");
    expect(pack.source.url).toBe("https://design.example/");
  });

  it("accepted supplied spec and readiness", () => {
    const m = model(FIXTURE_CSS);
    const spec = buildDesignSpecification(m);
    const readiness = computeReadiness(m);
    const pack = buildDesignPack(m, { spec, readiness });
    expect(pack.spec).toBe(spec);
    expect(pack.readiness).toBe(readiness);
  });

  it("builds named files and a downloadable zip", () => {
    const m = model(FIXTURE_CSS);
    const pack = buildDesignPack(m);
    const files = buildPackFiles(m, pack);
    expect(files["pack.json"]).toBeTruthy();
    expect(files["spec.json"]).toBeTruthy();
    expect(files["readiness.json"]).toBeTruthy();
    const spec = JSON.parse(files["spec.json"]) as { schema: string };
    expect(spec.schema).toBe("design-specification");
    const zip = buildDesignPackZip(m);
    expect(zip.name.endsWith("-pack.zip")).toBe(true);
    expect(zip.data.byteLength).toBeGreaterThan(0);
  });
});

describe("project-context", () => {
  it("parses a well-formed NexoraProjectContext", () => {
    const raw = {
      schema: "nexora.project-context",
      version: 1,
      projectName: "Acme",
      framework: "next",
      language: "tsx",
      styling: { approach: "tailwind", prefix: "acme" },
      brand: { primaryColor: "#123456" },
      conventions: { namingConvention: "kebab" },
    };
    const ctx = parseProjectContext(raw);
    expect(ctx).not.toBeNull();
    expect(ctx?.projectName).toBe("Acme");
    expect(ctx?.styling?.prefix).toBe("acme");
    expect(ctx?.brand?.primaryColor).toBe("#123456");
  });

  it("rejects payloads lacking a projectName", () => {
    expect(parseProjectContext({ schema: "nexora.project-context", version: 1 })).toBeNull();
    expect(parseProjectContext("not an object")).toBeNull();
  });

  it("produces a usable empty context", () => {
    const ctx = emptyProjectContext();
    expect(ctx.projectName).toBe("Untitled Project");
    const typed: NexoraProjectContext = parseProjectContext({
      schema: "nexora.project-context",
      version: 1,
      projectName: "Any",
    }) as NexoraProjectContext;
    expect(typed.schema).toBe("nexora.project-context");
  });
});

describe("adaptDesign", () => {
  it("applies brand overrides and prefix hints", () => {
    const m = model(FIXTURE_CSS);
    const spec = buildDesignSpecification(m);
    const ctx = parseProjectContext({
      schema: "nexora.project-context",
      version: 1,
      projectName: "Acme",
      brand: { primaryColor: "#ff0000" },
      styling: { prefix: "acme" },
      framework: "next",
    }) as NexoraProjectContext;
    const adapted = adaptDesign(spec, ctx);
    expect(adapted.applied.length).toBeGreaterThan(0);
    expect(adapted.visual_language.colors.primary[0]?.value).toBe("#ff0000");
    expect(adapted.implementation_hints.some((h) => h.code === "target_framework")).toBe(true);
    expect(() => JSON.parse(adaptedDesignJsonSafe(adapted))).not.toThrow();
  });
});

function adaptedDesignJsonSafe(adapted: ReturnType<typeof adaptDesign>): string {
  return JSON.stringify(adapted, null, 2);
}

describe("project", () => {
  it("creates a project and records a design version", () => {
    const m = model(FIXTURE_CSS);
    const p = createProject({ seed: "acme", name: "Acme", url: m.source.url, title: m.source.title });
    expect(p.id).toBe("prj-acme");
    const v = addDesignVersion(p, m);
    expect(p.versions).toHaveLength(1);
    expect(p.latestModelId).toBe(v.id);
    expect(newProjectId()).toMatch(/^prj-/);
  });
});