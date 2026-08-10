import type { DesignModel } from "./model";
import type { NexoraProjectContext } from "./project-context";

export interface ProjectMeta {
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectReferences {
  url: string;
  title?: string;
}

export interface ProjectVersion {
  id: string;
  createdAt: string;
  scanVersion: string;
  schemaVersion: string;
  scanMode: string;
  sourceUrl: string;
  summary?: { tokens: number; components: number; pages: number };
}

export interface ProjectRecord {
  id: string;
  meta: ProjectMeta;
  references: ProjectReferences[];
  versions: ProjectVersion[];
  scanIds: string[];
  // Anchors to the latest artifacts (bodies live in session storage / extracts).
  latestModelId?: string;
  latestSpecId?: string;
  nexoraContext?: NexoraProjectContext;
}

export function newProjectId(seed?: string): string {
  if (seed) {
    const slug = seed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
    return slug ? `prj-${slug}` : `prj-${randomSuffix()}`;
  }
  return `prj-${randomSuffix()}`;
}

export function newScanId(): string {
  return `scan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function newVersionId(): string {
  return `dsv-${Date.now()}`;
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function createProject(opts: {
  seed?: string;
  name: string;
  description?: string;
  url?: string;
  title?: string;
}): ProjectRecord {
  const now = new Date().toISOString();
  return {
    id: newProjectId(opts.seed),
    meta: {
      name: opts.name,
      description: opts.description,
      createdAt: now,
      updatedAt: now,
    },
    references: opts.url ? [{ url: opts.url, title: opts.title }] : [],
    versions: [],
    scanIds: [],
  };
}

export function addDesignVersion(
  project: ProjectRecord,
  model: DesignModel,
): ProjectVersion {
  const now = new Date().toISOString();
  const v: ProjectVersion = {
    id: newVersionId(),
    createdAt: now,
    scanVersion: model.schemaVersion,
    schemaVersion: model.schemaVersion,
    scanMode: model.metadata.scanMode,
    sourceUrl: model.source.url,
    summary: {
      tokens: Object.keys(model.tokens).length,
      components: model.components.length,
      pages: model.pages.length,
    },
  };
  project.versions = [v, ...project.versions].slice(0, 50);
  project.meta.updatedAt = now;
  project.latestModelId = v.id;
  project.latestSpecId = v.id;
  return v;
}

export function attachSpecReference(project: ProjectRecord, specId: string): void {
  project.latestSpecId = specId;
  project.meta.updatedAt = new Date().toISOString();
}

export function toProjectRecordJson(p: ProjectRecord): string {
  return JSON.stringify(p, null, 2);
}

export function buildDesignVersionStatus(project: ProjectRecord): "pending" | "running" | "completed" | "partial" | "failed" {
  if (project.versions.length === 0) return "pending";
  return "completed";
}