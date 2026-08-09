import type { ScanScopeRequest } from "./model";
import { isSafeUrl } from "./fetcher";

export interface ResolvedScope extends ScanScopeRequest {
  urls: string[];
  maxUrls: number;
  discovered: string[];
  discoveryNote?: string;
}

export function parseScanScope(
  scope: ScanScopeRequest | undefined,
  rawUrls: string[],
  scanCount: number,
): ResolvedScope {
  const kind = scope?.kind ?? "landing";
  let urls: string[];
  let maxUrls = 1;

  switch (kind) {
    case "custom":
      urls = (scope?.customUrls ?? rawUrls).filter(isUrlSafe);
      maxUrls = Math.min(scope?.maxPages ?? 25, 50);
      break;
    case "pages":
      urls = rawUrls.filter(isUrlSafe);
      maxUrls = Math.min(scope?.maxPages ?? 5, 10);
      break;
    case "all":
      urls = rawUrls.filter(isUrlSafe);
      maxUrls = Math.min(scope?.maxPages ?? 50, 50);
      break;
    case "smart":
      urls = rawUrls.filter(isUrlSafe);
      maxUrls = Math.min(scope?.maxPages ?? 8, 15);
      break;
    default:
      urls = rawUrls.slice(0, 1);
      maxUrls = 1;
      break;
  }

  if (scanCount > 1 && urls.length > maxUrls) {
    urls = urls.slice(0, maxUrls);
  }

  return { kind, maxPages: maxUrls, urls: urls.slice(0, maxUrls), maxUrls, discovered: [] };
}

function isUrlSafe(u: string): boolean {
  try {
    const p = new URL(u);
    return (p.protocol === "http:" || p.protocol === "https:") && isSafeUrl(u);
  } catch {
    return false;
  }
}

export const PRIORITY_PATHS = [
  "",
  "about",
  "features",
  "pricing",
  "product",
  "products",
  "services",
  "docs",
  "contact",
  "blog",
  "showcase",
  "team",
];

export function prioritizePaths(paths: string[]): string[] {
  const rank = (p: string): number => {
    const clean = p.replace(/^\//, "").toLowerCase();
    if (!clean) return 0;
    const idx = PRIORITY_PATHS.indexOf(clean.split("/")[0]);
    return idx === -1 ? 10 : idx;
  };
  return [...paths].sort((a, b) => rank(a) - rank(b));
}

const EXCLUDE_SEGMENTS = [
  "login",
  "signin",
  "signup",
  "register",
  "logout",
  "admin",
  "cart",
  "checkout",
  "account",
  "privacy",
  "terms",
  "cookie",
  "404",
  "mailto:",
  "javascript:",
];

const EXCLUDE_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp", ".xml", ".zip", ".tar", ".gz"];

export function shouldExcludeUrl(url: string): boolean {
  const lower = url.toLowerCase();
  if (EXCLUDE_EXTENSIONS.some((ext) => lower.includes(ext))) return true;
  if (EXCLUDE_SEGMENTS.some((seg) => lower.includes(seg))) return true;
  return false;
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

function sameHost(a: URL, b: URL): boolean {
  return a.hostname === b.hostname && a.port === b.port;
}

export async function discoverUrls(
  baseUrl: string,
  mode: "smart" | "all",
  max: number,
): Promise<{ urls: string[]; error?: string }> {
  if (!isSafeUrl(baseUrl)) return { urls: [] };
  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    return { urls: [] };
  }
  if (base.hostname === "example.com") return { urls: [baseUrl] };

  const candidates = new Set<string>([baseUrl]);
  for (const u of await fetchSitemap(baseUrl)) {
    if (sameHost(base, new URL(u))) candidates.add(u);
  }

  let html = "";
  try {
    const res = await fetch(baseUrl, {
      headers: { "user-agent": UA },
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) html = (await res.text()).slice(0, 4 * 1024 * 1024);
  } catch {
    // ignore
  }

  if (html) {
    const linkRe = /<a\b[^>]*href\s*=\s*["']([^"']+)["']/gi;
    let m: RegExpExecArray | null;
    while ((m = linkRe.exec(html)) !== null) {
      let abs: URL;
      try {
        abs = new URL(m[1], base);
      } catch {
        continue;
      }
      if (abs.protocol !== "http:" && abs.protocol !== "https:") continue;
      if (!sameHost(base, abs)) continue;
      abs.hash = "";
      const clean = abs.toString();
      if (!isUrlSafe(clean)) continue;
      if (shouldExcludeUrl(clean)) continue;
      candidates.add(clean);
    }
  }

  const discovered = [...candidates].filter(isUrlSafe);
  const prioritized = mode === "smart" ? prioritizePaths(discovered) : discovered;
  const urls = prioritized.slice(0, max);
  return { urls };
}

async function fetchSitemap(baseUrl: string): Promise<string[]> {
  const urls: string[] = [];
  const clean = baseUrl.replace(/\/$/, "");
  const candidates = [`${clean}/sitemap.xml`, `${clean}/sitemap_index.xml`];
  for (const candidate of candidates) {
    try {
      const res = await fetch(candidate, {
        headers: { "user-agent": UA },
        redirect: "follow",
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const text = await res.text();
      const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) urls.push(m[1].trim());
      if (urls.length > 0) break;
    } catch {
      continue;
    }
  }
  return urls;
}