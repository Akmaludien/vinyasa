import "server-only";
import { getNexoraConfig, isSafeBaseUrl, type NexoraConfig } from "./nexora-config";
import {
  parseNexoraProductContext,
  type NexoraProductContext,
} from "./nexora-product-context";
import type { NexoraDesignContext } from "./nexora";
import { isCanonicalDesignContext } from "./validate-design-context";

export type NexoraErrorKind =
  | "not_configured"
  | "invalid_url"
  | "timeout"
  | "network"
  | "unauthorized"
  | "not_found"
  | "malformed"
  | "upstream"
  | "unavailable";

export class NexoraError extends Error {
  kind: NexoraErrorKind;
  status?: number;
  constructor(kind: NexoraErrorKind, message: string, status?: number) {
    super(message);
    this.name = "NexoraError";
    this.kind = kind;
    this.status = status;
  }
}

export interface NexoraProject {
  key: string;
  name: string;
  description: string;
  complexity: string;
  completeness: number;
}

export interface DesignSyncResult {
  ok: boolean;
  artifactKey?: string;
  version?: number;
  checksum?: string;
  synchronizedAt?: string;
  errorKind?: NexoraErrorKind;
  error?: string;
}

interface ClientRequest {
  path: string;
  method?: "GET" | "POST";
  body?: unknown;
  cfg: NexoraConfig;
}

async function request({ path, method = "GET", body, cfg }: ClientRequest): Promise<unknown> {
  if (!cfg.enabled) throw new NexoraError("not_configured", "NEXORA_BASE_URL tidak dikonfigurasi.");
  if (!isSafeBaseUrl(cfg.baseUrl)) throw new NexoraError("invalid_url", "Base URL Nexora tidak valid.");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);

  const headers: Record<string, string> = { accept: "application/json" };
  if (cfg.apiToken) headers.authorization = `Bearer ${cfg.apiToken}`;
  if (body !== undefined) headers["content-type"] = "application/json";

  try {
    const res = await fetch(`${cfg.baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      cache: "no-store",
    });

    if (res.status === 401 || res.status === 403) {
      throw new NexoraError("unauthorized", "Otentikasi Nexora ditolak.", res.status);
    }
    if (res.status === 404) {
      throw new NexoraError("not_found", "Proyek Nexora tidak ditemukan.", res.status);
    }
    if (!res.ok) {
      throw new NexoraError("upstream", `Nexora mengembalikan status ${res.status}.`, res.status);
    }

    let data: unknown;
    try {
      data = await res.json();
    } catch {
      throw new NexoraError("malformed", "Respons Nexora bukan JSON yang valid.");
    }
    return data;
  } catch (cause) {
    if (cause instanceof NexoraError) throw cause;
    const err = cause instanceof Error ? cause : new Error(String(cause));
    if (err.name === "AbortError") throw new NexoraError("timeout", "Nexora tidak merespons dalam batas waktu.");
    throw new NexoraError("network", `Gagal terhubung ke Nexora: ${err.message}`);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Typed, resilient, server-only Nexora integration client. Handles timeout,
 * unavailable Nexora, invalid project ids, malformed responses, auth failures,
 * and schema validation - and never lets an integration error crash Vinyasa.
 */
export const nexoraClient = {
  async getProject(projectKey: string): Promise<NexoraProject> {
    const cfg = getNexoraConfig();
    if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(projectKey)) {
      throw new NexoraError("invalid_url", "Project key Nexora tidak valid.");
    }
    const data = await request({ path: `/api/integration/project?project=${encodeURIComponent(projectKey)}`, cfg });
    return parseProjectEnvelope(data).project;
  },

  async getProjectContext(projectKey: string): Promise<NexoraProductContext> {
    const cfg = getNexoraConfig();
    if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(projectKey)) {
      throw new NexoraError("invalid_url", "Project key Nexora tidak valid.");
    }
    const data = await request({ path: `/api/integration/project?project=${encodeURIComponent(projectKey)}`, cfg });
    const parsed = parseNexoraProductContext(data);
    if (!parsed) throw new NexoraError("malformed", "Project context Nexora tidak dapat diparsing.");
    return parsed;
  },

  async getDesignContext(projectKey: string): Promise<{ ctx: NexoraDesignContext | null; synchronizedAt: string | null; artifactVersion?: number }> {
    const cfg = getNexoraConfig();
    if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(projectKey)) {
      throw new NexoraError("invalid_url", "Project key Nexora tidak valid.");
    }
    const data = await request({ path: `/api/design-context?project=${encodeURIComponent(projectKey)}`, cfg });
    const design = readDesignWrapper(data);
    return design ?? { ctx: null, synchronizedAt: null };
  },

  async updateDesignContext(
    projectKey: string,
    ctx: NexoraDesignContext,
    source: "VINYASA" | "MANUAL" = "VINYASA",
  ): Promise<DesignSyncResult> {
    const cfg = getNexoraConfig();
    if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(projectKey)) {
      return { ok: false, errorKind: "invalid_url", error: "Project key Nexora tidak valid." };
    }
    if (!isCanonicalDesignContext(ctx)) {
      return { ok: false, errorKind: "malformed", error: "Design context tidak lolos validasi schema." };
    }
    try {
      const data = await request({
        path: "/api/design-context",
        method: "POST",
        body: { projectKey, payload: ctx, sourceUrl: ctx.sourceUrl, source },
        cfg,
      });
      const result = (data as { result?: { artifactKey?: string; version?: number; checksum?: string; synchronizedAt?: string } }).result;
      return {
        ok: true,
        artifactKey: result?.artifactKey,
        version: result?.version,
        checksum: result?.checksum,
        synchronizedAt: result?.synchronizedAt,
      };
    } catch (cause) {
      if (cause instanceof NexoraError) {
        return { ok: false, errorKind: cause.kind, error: cause.message };
      }
      return { ok: false, errorKind: "network", error: cause instanceof Error ? cause.message : "Unknown error" };
    }
  },
};

function parseProjectEnvelope(data: unknown): { project: NexoraProject } {
  if (typeof data !== "object" || data === null) throw new NexoraError("malformed", "Respons Nexora tidak valid.");
  const o = data as Record<string, unknown>;
  const project = (o.project ?? {}) as Record<string, unknown>;
  const key = typeof project.key === "string" ? project.key : "";
  const name = typeof project.name === "string" ? project.name : "";
  if (!key || !name) throw new NexoraError("malformed", "Envelope proyek Nexora tidak lengkap.");
  return {
    project: {
      key,
      name,
      description: typeof project.description === "string" ? project.description : "",
      complexity: typeof project.complexity === "string" ? project.complexity : "",
      completeness: typeof project.completeness === "number" ? project.completeness : 0,
    },
  };
}

function readDesignWrapper(data: unknown): { ctx: NexoraDesignContext | null; synchronizedAt: string | null; artifactVersion?: number } | null {
  if (typeof data !== "object" || data === null) return null;
  const design = (data as { design?: unknown }).design as
    | { ctx?: unknown; synchronizedAt?: string | null; artifactKey?: string; artifactVersion?: number }
    | null
    | undefined;
  if (!design) return null;
  const ctx = design.ctx;
  return {
    ctx: isCanonicalDesignContext(ctx) ? ctx : null,
    synchronizedAt: typeof design.synchronizedAt === "string" ? design.synchronizedAt : null,
    artifactVersion: typeof design.artifactVersion === "number" ? design.artifactVersion : undefined,
  };
}