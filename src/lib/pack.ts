import { zipSync, strToU8 } from "fflate";
import type { DesignModel } from "./model";
import type { DesignSpecification } from "./spec";
import { buildDesignSpecification } from "./spec";
import type { ReadinessResult } from "./readiness";
import { computeReadiness } from "./readiness";
import { buildExports, buildDownloadFolder } from "./export";

export const DESIGN_PACK_SCHEMA_VERSION = "1.0.0";

/**
 * A Design Pack is the bundle consumed by a downstream implementation layer
 * (Nexora / scaffolders). It aggregates the canonical spec, the raw design
 * model export, tokens, and a readiness report into one importable artifact.
 */
export interface DesignPack {
  schema: "vinyasa.design-pack";
  version: string;
  generatedAt: string;
  source: { url: string; title: string };
  spec: DesignSpecification;
  readiness: ReadinessResult;
}

export interface BuildPackOptions {
  spec?: DesignSpecification | null;
  readiness?: ReadinessResult | null;
}

/**
 * Builds the canonical DesignPack from a DesignModel, computing the
 * specification and readiness when they are not supplied explicitly.
 */
export function buildDesignPack(m: DesignModel, opts?: BuildPackOptions): DesignPack {
  const spec = opts?.spec ?? buildDesignSpecification(m);
  const readiness = opts?.readiness ?? computeReadiness(m);

  return {
    schema: "vinyasa.design-pack",
    version: DESIGN_PACK_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    source: { url: m.source.url, title: m.source.title },
    spec,
    readiness,
  };
}

export function buildDesignPackJson(pack: DesignPack): string {
  return JSON.stringify(pack, null, 2);
}

export interface PackFiles {
  "pack.json": string;
  "spec.json": string;
  "readiness.json": string;
  "tokens.json": string;
  "raw.json": string;
  "DESIGN.md": string;
  "nexora.json": string;
}

/**
 * Expands a DesignPack into a flat set of named files suitable for download or
 * scaffolding. Reuses the token/css/DESIGN.md exports from `./export`.
 */
export function buildPackFiles(m: DesignModel, pack: DesignPack): PackFiles {
  const ex = buildExports(m);
  return {
    "pack.json": JSON.stringify(pack, null, 2),
    "spec.json": buildDesignSpecificationJson(pack.spec),
    "readiness.json": JSON.stringify(pack.readiness, null, 2),
    "tokens.json": ex.files["tokens.json"],
    "raw.json": ex.files["raw.json"],
    "DESIGN.md": ex.files["DESIGN.md"],
    "nexora.json": ex.files["nexora.json"],
  };
}

function buildDesignSpecificationJson(spec: DesignSpecification): string {
  return JSON.stringify(spec, null, 2);
}

export function buildDesignPackZip(m: DesignModel, opts?: BuildPackOptions): { name: string; data: Uint8Array } {
  const pack = buildDesignPack(m, opts);
  const files = buildPackFiles(m, pack);
  const folder = buildDownloadFolder(m.source.url);
  const entries: Record<string, Uint8Array> = {};
  for (const [name, content] of Object.entries(files)) {
    entries[`${folder}/${name}`] = strToU8(content);
  }
  return { name: `${folder}-pack.zip`, data: zipSync(entries, { level: 6 }) };
}

export { buildDesignSpecification };