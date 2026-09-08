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
  /* Schemes live in this list too, so it is matched against the whole URL. */
  if (EXCLUDE_SEGMENTS.some((seg) => lower.includes(seg))) return true;

  /* An extension is the end of a path, not any substring of the URL. The
     `includes` this replaced threw away real pages whose slug merely mentioned
     a format, such as /blog/perbandingan-png-dan-svg. A query string is not
     part of the filename either, hence the parse. */
  let path: string;
  try {
    path = new URL(url).pathname.toLowerCase();
  } catch {
    path = lower.split(/[?#]/)[0];
  }
  return EXCLUDE_EXTENSIONS.some((ext) => path.endsWith(ext));
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
    let abs: URL;
    try {
      abs = new URL(u);
    } catch {
      continue;
    }
    /* Sitemap entries go through the same gate as links scraped from the page.
       They used to skip it, which is how two of Supabase's child sitemaps were
       queued as pages, fetched, and reported as having no stylesheet. */
    if (!sameHost(base, abs)) continue;
    if (!isUrlSafe(u)) continue;
    if (shouldExcludeUrl(u)) continue;
    candidates.add(u);
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

/**
 * What a sitemap document turned out to be.
 *
 * The two shapes carry the same `<loc>` tag but mean opposite things: a
 * `urlset` lists pages, a `sitemapindex` lists other sitemaps. Reading an
 * index as though it were a urlset is what put `sitemap_www.xml` in the scan
 * queue as if it were a page.
 */
export interface SitemapDoc {
  kind: "index" | "urlset";
  locs: string[];
}

export function parseSitemapXml(xml: string): SitemapDoc {
  const locs: string[] = [];
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) locs.push(m[1].trim());
  return { kind: /<sitemapindex[\s>]/i.test(xml) ? "index" : "urlset", locs };
}

/* A large site splits its sitemap into dozens of files. The first few already
   hold far more URLs than any scope will spend, and each one is a request the
   user waits through. */
const MAX_INDEX_CHILDREN = 3;
const MAX_SITEMAP_URLS = 300;

async function fetchXml(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA },
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  }
}

async function fetchSitemap(baseUrl: string): Promise<string[]> {
  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    return [];
  }

  const clean = baseUrl.replace(/\/$/, "");
  for (const candidate of [`${clean}/sitemap.xml`, `${clean}/sitemap_index.xml`]) {
    const doc = parseSitemapXml(await fetchXml(candidate));
    if (doc.locs.length === 0) continue;
    if (doc.kind === "urlset") return doc.locs;

    /* One level down only. Nesting deeper than that is rare, and each hop is
       another wait with no ceiling in sight. */
    const pages: string[] = [];
    for (const child of doc.locs.slice(0, MAX_INDEX_CHILDREN)) {
      /* The child URL decides what this server fetches next, so it passes the
         same host and safety checks as anything else before it is requested. */
      let childUrl: URL;
      try {
        childUrl = new URL(child);
      } catch {
        continue;
      }
      if (!sameHost(base, childUrl) || !isUrlSafe(child)) continue;

      pages.push(...parseSitemapXml(await fetchXml(child)).locs);
      if (pages.length >= MAX_SITEMAP_URLS) break;
    }
    if (pages.length > 0) return pages.slice(0, MAX_SITEMAP_URLS);
  }
  return [];
}