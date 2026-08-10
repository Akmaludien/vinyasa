export const PROJECT_CONTEXT_SCHEMA_VERSION = "1.0.0";

/**
 * NexoraProjectContext is the *input* contract Nexora sends to Vinyasa so the
 * design generation can be aligned to an existing product/project (framework,
 * stack, brand, conventions). This is distinct from `NexoraDesignContext`
 * (./nexora.ts) which is the *output* design snapshot Vinyasa produces after
 * analysis.
 */
export interface NexoraProjectContext {
  schema: "nexora.project-context";
  version: 1;
  projectName: string;
  projectId?: string;
  framework?: string;
  frameworkVersion?: string;
  language?: "ts" | "tsx" | "js" | "jsx" | "css" | "scss" | "tailwind" | "other";
  styling?: {
    approach?: "css-variables" | "tailwind" | "css-modules" | "styled-components" | "emotion" | "scss" | "other";
    prefix?: string;
    componentLibrary?: string;
  };
  platforms?: string[];
  brand?: {
    primaryColor?: string;
    accentColor?: string;
    fontFamily?: string;
  };
  conventions?: {
    namingConvention?: "bem" | "kebab" | "camel" | "pascal" | "other";
    importAlias?: string;
    variants?: "postfix" | "modifier-class" | "data-attribute";
  };
  designerNote?: string;
}

/**
 * Asserts and coerces an unknown JSON payload into a NexoraProjectContext.
 * Returns null when the payload does not conform to the expected schema so
 * callers can fall back to a bare-minimum context instead of throwing in the
 * request pipeline.
 */
export function parseProjectContext(raw: unknown): NexoraProjectContext | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (o.schema !== "nexora.project-context") return null;

  const projectName = typeof o.projectName === "string" ? o.projectName : "";
  if (!projectName) return null;

  const boolStr = (v: unknown): string | undefined =>
    typeof v === "string" && v.length ? v : undefined;

  const ctx: NexoraProjectContext = {
    schema: "nexora.project-context",
    version: 1,
    projectName,
    projectId: boolStr(o.projectId),
    framework: boolStr(o.framework),
    frameworkVersion: boolStr(o.frameworkVersion),
    language: (typeof o.language === "string" ? o.language : undefined) as
      | NexoraProjectContext["language"]
      | undefined,
    platforms: Array.isArray(o.platforms)
      ? o.platforms.filter((p): p is string => typeof p === "string")
      : undefined,
    designerNote: boolStr(o.designerNote),
  };

  if (typeof o.styling === "object" && o.styling !== null) {
    const s = o.styling as Record<string, unknown>;
    ctx.styling = {
      approach: typeof s.approach === "string" ? (s.approach as NonNullable<NexoraProjectContext["styling"]>["approach"]) : undefined,
      prefix: boolStr(s.prefix),
      componentLibrary: boolStr(s.componentLibrary),
    };
  }

  if (typeof o.brand === "object" && o.brand !== null) {
    const b = o.brand as Record<string, unknown>;
    ctx.brand = {
      primaryColor: boolStr(b.primaryColor),
      accentColor: boolStr(b.accentColor),
      fontFamily: boolStr(b.fontFamily),
    };
  }

  if (typeof o.conventions === "object" && o.conventions !== null) {
    const c = o.conventions as Record<string, unknown>;
    ctx.conventions = {
      namingConvention:
        typeof c.namingConvention === "string"
          ? (c.namingConvention as NonNullable<NexoraProjectContext["conventions"]>["namingConvention"])
          : undefined,
      importAlias: boolStr(c.importAlias),
      variants:
        typeof c.variants === "string"
          ? (c.variants as NonNullable<NexoraProjectContext["conventions"]>["variants"])
          : undefined,
    };
  }

  return ctx;
}

/**
 * Produces a normalized context that lets the rest of the pipeline behave even
 * when no explicit NexoraProjectContext was provided.
 */
export function emptyProjectContext(projectName?: string): NexoraProjectContext {
  return {
    schema: "nexora.project-context",
    version: 1,
    projectName: projectName || "Untitled Project",
  };
}

export function projectContextToJson(ctx: NexoraProjectContext): string {
  return JSON.stringify(ctx, null, 2);
}