import type { NexoraProjectContext } from "./project-context";

/**
 * Normalized product structure derived from a Nexora project. Nexora's product
 * intelligence (requirements, features, user flows, architecture) is turned
 * into the product surface that Vinyasa's design adaptation must map onto —
 * NOT the reference website's structure.
 */
export interface ProductStructure {
  pages: Array<{ id: string; title: string; kind: string }>;
  features: string[];
  requirements: string[];
  userFlows: string[];
  architecture?: string[];
}

export interface NexoraProductContext {
  source: "nexora";
  projectKey: string;
  projectName: string;
  description?: string;
  complexity?: string;
  completeness?: number;
  structure: ProductStructure;
  context: NexoraProjectContext;
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const strArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(str).filter(Boolean) : [];

function artifactItems(value: unknown): Array<{ id: string; title: string; kind: string }> {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 60).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const id = str((item as { id?: unknown }).id);
    const title = str((item as { title?: unknown }).title);
    return id ? [{ id, title: title || id, kind: str((item as { kind?: unknown }).kind) }] : [];
  });
}

/**
 * Validates and coerces the response of Nexora's GET /api/integration/project
 * into a typed, shape-safe NexoraProductContext. Returns null when the payload
 * does not carry a recognizable project envelope so callers fail softly instead
 * of throwing on malformed external JSON.
 */
export function parseNexoraProductContext(raw: unknown): NexoraProductContext | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const project = (o.project ?? {}) as Record<string, unknown>;
  const projectKey = str(project.key);
  const projectName = str(project.name);
  if (!projectKey || !projectName) return null;

  const pc = (o.product ?? {}) as Record<string, unknown>;

  const pages = [
    ...artifactItems(pc.userFlows).map((a) => ({ ...a, kind: "user-flow" })),
    ...artifactItems(pc.features).map((a) => ({ ...a, kind: "feature" })),
    ...artifactItems(pc.userStories).map((a) => ({ ...a, kind: "user-story" })),
  ];

  const context: NexoraProjectContext = {
    schema: "nexora.project-context",
    version: 1,
    projectId: projectKey,
    projectName,
    designerNote: str(project.description) || undefined,
  };

  return {
    source: "nexora",
    projectKey,
    projectName,
    description: str(project.description) || undefined,
    complexity: str(project.complexity) || undefined,
    completeness: typeof project.completeness === "number" ? project.completeness : undefined,
    structure: {
      pages,
      features: artifactItems(pc.features).map((a) => a.title),
      requirements: artifactItems(pc.requirements).map((a) => a.title),
      userFlows: artifactItems(pc.userFlows).map((a) => a.title),
      architecture: artifactItems(pc.architecture).map((a) => a.title),
    },
    context,
  };
}
