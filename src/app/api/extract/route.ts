import { NextRequest, NextResponse } from "next/server";
import { fetchPageDocs, hydrateSources, isSafeUrl } from "@/lib/fetcher";
import { extractDesignSystem } from "@/lib/extractor";
import { deepScanStyles } from "@/lib/deepscan";
import type { DesignModel, ExtractResponse, ScanScopeRequest } from "@/lib/model";
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
        hydrated = await deepScanStyles(url);
        if (hydrated.length === 0) {
          errors.push({ url, message: "Deep scan tidak menghasilkan stylesheet (browser mungkin belum terinstal)." });
          continue;
        }
        pageTitle = `Deep: ${url}`;
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
  for (const other of results.slice(1)) {
    primary.pages.push(...other.pages);
    primary.scan.warnings.push(...other.scan.warnings);
    primary.scan.errors.push(...other.scan.errors);
  }
  primary.scan.pageCount = primary.pages.length;
  primary.statistics.totalDeclarations = primary.pages.reduce(
    (sum, p) => sum + p.sources.reduce((s, src) => s + src.declarationCount, 0),
    0,
  );
  primary.statistics.totalRules = primary.pages.reduce(
    (sum, p) => sum + p.sources.reduce((s, src) => s + src.ruleCount, 0),
    0,
  );
  return primary;
}