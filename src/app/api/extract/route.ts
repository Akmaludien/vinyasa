import { NextRequest, NextResponse } from "next/server";
import { fetchPageDocs, hydrateSources, isSafeUrl, type RawAsset } from "@/lib/fetcher";
import { extractDesignSystem } from "@/lib/extractor";
import type { DesignModel, DesignStatistics, ExtractResponse, ScanScopeRequest, AssetSpec } from "@/lib/model";
import { parseScanScope, discoverUrls } from "@/lib/scan";
import { buildDesignSpecification } from "@/lib/spec";
import { computeReadiness } from "@/lib/readiness";
import { buildDesignPack } from "@/lib/pack";
import { createProject, addDesignVersion, type ProjectRecord } from "@/lib/project";

/**
 * What a person types is not a URL.
 *
 * `stripe.com` is how everyone writes an address, and it fails `new URL()`, so
 * it was dropped by the safety filter and reported back as "URL tidak boleh
 * kosong" while the user stared at the domain they had just entered. Anything
 * without a scheme gets https, which is also the right default for any site
 * worth cloning.
 */
function normalizeUrl(raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) return v;
  /* A scheme we do not serve is left intact so the route rejects it by name
     rather than turning it into a web address. Matching on `://` alone would
     not catch these, and matching on any colon would break `example.com:8080`. */
  if (/^(mailto|javascript|data|file|tel|blob):/i.test(v)) return v;
  return `https://${v.replace(/^\/+/, "")}`;
}

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  let body: { urls?: string[]; url?: string; scope?: ScanScopeRequest; mode?: "fast" | "deep" };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, results: [], errors: [{ url: "", message: "Body JSON tidak valid" }] },
      { status: 400 },
    );
  }

  const rawUrls = (body.urls ?? (body.url ? [body.url] : []))
    .map((u: string) => normalizeUrl(String(u)))
    .filter(Boolean);
  const scope = parseScanScope(body.scope, rawUrls, 1);
  let urls = scope.urls.slice(0, scope.maxUrls ?? 5);

  if (urls.length > 0 && (scope.kind === "smart" || scope.kind === "all")) {
    const { urls: discovered } = await discoverUrls(urls[0], scope.kind, scope.maxUrls);
    if (discovered.length > 0) urls = discovered;
  }

  if (urls.length === 0) {
    /* Two different failures used to share one message. An empty box is the
       caller's mistake; an address that survived normalisation and was still
       rejected is a bad address, and saying "URL tidak boleh kosong" while the
       user looks at what they typed reads as a bug. */
    const message =
      rawUrls.length === 0
        ? "Masukkan alamat website yang ingin dipindai"
        : "Alamat website tidak bisa dipindai. Periksa ejaannya, dan pastikan bukan alamat lokal.";
    return NextResponse.json(
      { ok: false, results: [], errors: [{ url: rawUrls[0] ?? "", message }] },
      { status: 400 },
    );
  }

  const results: DesignModel[] = [];
  const errors: Array<{ url: string; message: string }> = [];

  for (const url of urls) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      errors.push({ url, message: "Format URL tidak valid" });
      continue;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      errors.push({ url, message: "Hanya mendukung skema http/https" });
      continue;
    }
    if (!isSafeUrl(url)) {
      errors.push({ url, message: "Alamat pribadi/tidak aman tidak diizinkan untuk dipindai" });
      continue;
    }

    try {
      let hydrated;
      let pageTitle = url;
      let pageAssets: AssetSpec[] | undefined;
      if (body.mode === "deep") {
        let deep;
        try {
          const mod = await import("@/lib/deepscan");
          deep = await mod.deepScanStyles(url);
        } catch {
          deep = { title: "", sources: [], assets: [] };
        }
        hydrated = deep.sources;
        if (hydrated.length === 0) {
          errors.push({ url, message: "Deep scan tidak menghasilkan stylesheet yang bisa dibaca" });
          continue;
        }
        pageTitle = deep.title || url;
        pageAssets = deep.assets?.map(rawToAsset) ?? [];
      } else {
        const doc = await fetchPageDocs(url);
        hydrated = await hydrateSources(doc.sources);
        if (hydrated.length === 0) {
          errors.push({ url, message: "Tidak ada stylesheet yang bisa dibaca di halaman tersebut" });
          continue;
        }
        pageTitle = doc.title;
        pageAssets = doc.assets?.map(rawToAsset) ?? [];
      }
      const result = extractDesignSystem(hydrated, url, pageTitle, {
        mode: body.mode ?? "fast",
        scope,
        assets: pageAssets,
      });
      results.push(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Gagal mengambil halaman";
      errors.push({
        url,
        message: msg.includes("fetch")
          ? "Terjadi kesalahan jaringan saat mengambil halaman"
          : msg.startsWith("HTTP")
            ? `Halaman mengembalikan ${msg}`
            : msg,
      });
    }
  }

  const merged = mergeDesignModels(results);
  const response: ExtractResponse = {
    ok: merged !== null,
    results: merged ? [merged] : results,
    errors,
  };

  if (merged && merged !== null) {
    const specification = buildDesignSpecification(merged);
    const readiness = computeReadiness(merged);
    const project = buildProject(merged);
    response.specification = specification;
    response.readiness = readiness;
    response.project = project;
    response.pack = buildDesignPack(merged, { spec: specification, readiness });
  }

  return NextResponse.json(response);
}

function buildProject(model: DesignModel): ProjectRecord {
  const project = createProject({
    seed: model.source.url,
    name: model.source.title || model.source.url,
    description: "Desain diekstrak secara otomatis oleh Vinyasa.",
    url: model.source.url,
    title: model.source.title,
  });
  addDesignVersion(project, model);
  return project;
}

function mergeDesignModels(results: DesignModel[]): DesignModel | null {
  if (results.length === 0) return null;
  if (results.length === 1) return results[0];

  const primary = results[0];
  primary.scan.pageCount = results.length;
  for (const other of results.slice(1)) {
    primary.pages.push(...other.pages);
    primary.scan.warnings.push(...other.scan.warnings);
    primary.scan.errors.push(...other.scan.errors);
  }
  primary.scan.totalRequests = primary.pages.length + results.length;

  primary.tokens = aggregateTokens(results.map((r) => r.tokens));
  primary.statistics = aggregateStatistics(results);
  return primary;
}

function aggregateStatistics(results: DesignModel[]): DesignStatistics {
  const agg: DesignStatistics = {
    totalDeclarations: 0,
    totalRules: 0,
    totalAtRules: 0,
    uniqueColors: 0,
    uniqueFontFamilies: 0,
    uniqueSpacingValues: 0,
    uniqueRadiusValues: 0,
    hardcodedColorCount: 0,
  };
  for (const r of results) {
    agg.totalDeclarations += r.statistics.totalDeclarations;
    agg.totalRules += r.statistics.totalRules;
    agg.totalAtRules += r.statistics.totalAtRules;
    agg.uniqueColors = Math.max(agg.uniqueColors, r.statistics.uniqueColors);
    agg.uniqueFontFamilies = Math.max(agg.uniqueFontFamilies, r.statistics.uniqueFontFamilies);
    agg.uniqueSpacingValues = Math.max(agg.uniqueSpacingValues, r.statistics.uniqueSpacingValues);
    agg.uniqueRadiusValues = Math.max(agg.uniqueRadiusValues, r.statistics.uniqueRadiusValues);
    agg.hardcodedColorCount += r.statistics.hardcodedColorCount;
  }
  return agg;
}

type TokenSet = DesignModel["tokens"];

interface MergeableToken {
  raw?: string;
  hex?: string;
  value?: number;
  count: number;
}

function aggregateTokens(all: TokenSet[]): TokenSet {
  const mergeByRaw = <T extends MergeableToken>(cat: (t: TokenSet) => T[]): T[] => {
    const map = new Map<string, T>();
    for (const t of all) {
      for (const item of cat(t)) {
        const key = String(item.raw ?? item.hex ?? item.value ?? "");
        const existing = map.get(key);
        if (existing) existing.count += item.count;
        else map.set(key, { ...item });
      }
    }
    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 16);
  };

  const colorMap = new Map<string, (typeof all)[number]["colors"]["primary"][number]>();
  for (const t of all) {
    for (const c of [...t.colors.primary, ...t.colors.neutral]) {
      const hex = c.hex.toLowerCase();
      const existing = colorMap.get(hex);
      if (existing) existing.count += c.count;
      else colorMap.set(hex, { ...c, hex: c.hex });
    }
  }
  const rawColors = [...colorMap.values()].sort((a, b) => b.count - a.count);
  const total = rawColors.reduce((s, c) => s + c.count, 0);
  for (const c of rawColors) c.usage = total ? Math.round((c.count / total) * 1000) / 10 : 0;
  const primary = rawColors.filter((c) => !c.isNeutral).slice(0, 16);
  const neutral = rawColors.filter((c) => c.isNeutral).slice(0, 12);
  const evidence = all.flatMap((tokens) => tokens.colors.evidence ?? []);

  return {
    colors: { primary, neutral, hardcoded: [], evidence },
    typography: {
      families: mergeByRaw((t) => t.typography.families),
      sizes: mergeByRaw((t) => t.typography.sizes) as TokenSet["typography"]["sizes"],
      weights: mergeByRaw((t) => t.typography.weights) as TokenSet["typography"]["weights"],
      lineHeights: mergeByRaw((t) => t.typography.lineHeights) as TokenSet["typography"]["lineHeights"],
      letterSpacings: mergeByRaw((t) => t.typography.letterSpacings) as TokenSet["typography"]["letterSpacings"],
    },
    textStyles: [],
    spacing: mergeByRaw((t) => t.spacing),
    radius: mergeByRaw((t) => t.radius) as TokenSet["radius"],
    borders: mergeByRaw((t) => t.borders) as TokenSet["borders"],
    shadows: mergeByRaw((t) => t.shadows) as TokenSet["shadows"],
    gradients: mergeByRaw((t) => t.gradients) as TokenSet["gradients"],
    breakpoints: mergeByRaw((t) => t.breakpoints) as TokenSet["breakpoints"],
    durations: mergeByRaw((t) => t.durations) as TokenSet["durations"],
    easings: mergeByRaw((t) => t.easings) as TokenSet["easings"],
  };
}

function rawToAsset(a: RawAsset): AssetSpec {
  return {
    name: a.name,
    type: a.type,
    source: a.source,
    dimensions: a.dimensionsHint,
    usage: a.usage,
    isExternal: true,
  };
}
