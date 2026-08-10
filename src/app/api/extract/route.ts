import { NextRequest, NextResponse } from "next/server";
import { fetchPageDocs, hydrateSources, isSafeUrl } from "@/lib/fetcher";
import { extractDesignSystem } from "@/lib/extractor";
import type { DesignModel, DesignStatistics, ExtractResponse, ScanScopeRequest } from "@/lib/model";
import { parseScanScope, discoverUrls } from "@/lib/scan";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  let body: { urls?: string[]; scope?: ScanScopeRequest; mode?: "fast" | "deep" };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, results: [], errors: [{ url: "", message: "Body JSON tidak valid" }] },
      { status: 400 },
    );
  }

  const rawUrls = (body.urls ?? []).map((u: string) => String(u).trim()).filter(Boolean);
  const scope = parseScanScope(body.scope, rawUrls, 1);
  let urls = scope.urls.slice(0, scope.maxUrls ?? 5);

  if (urls.length > 0 && (scope.kind === "smart" || scope.kind === "all")) {
    const { urls: discovered } = await discoverUrls(urls[0], scope.kind, scope.maxUrls);
    if (discovered.length > 0) urls = discovered;
  }

  if (urls.length === 0) {
    return NextResponse.json(
      { ok: false, results: [], errors: [{ url: "", message: "URL tidak boleh kosong" }] },
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
      if (body.mode === "deep") {
        let deep;
        try {
          const mod = await import("@/lib/deepscan");
          deep = await mod.deepScanStyles(url);
        } catch {
          deep = { title: "", sources: [] };
        }
        hydrated = deep.sources;
        if (hydrated.length === 0) {
          errors.push({ url, message: "Deep scan tidak menghasilkan stylesheet (browser mungkin belum terinstal)." });
          continue;
        }
        pageTitle = deep.title || url;
      } else {
        const { title, sources } = await fetchPageDocs(url);
        hydrated = await hydrateSources(sources);
        if (hydrated.length === 0) {
          errors.push({ url, message: "Tidak ada stylesheet yang bisa dibaca di halaman tersebut" });
          continue;
        }
        pageTitle = title;
      }
      const result = extractDesignSystem(hydrated, url, pageTitle, {
        mode: body.mode ?? "fast",
        scope,
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
  return NextResponse.json(response);
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

  return {
    colors: { primary, neutral, hardcoded: [] },
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