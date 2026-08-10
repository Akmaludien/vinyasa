import type { CssSourceInput } from "./model";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const MAX_HTML_BYTES = 4 * 1024 * 1024;
const MAX_CSS_BYTES = 2 * 1024 * 1024;
const FETCH_TIMEOUT = 12000;

export function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\[|\]|\.$/g, "");
  if (h === "localhost" || h === "::1" || h.endsWith(".localhost")) return true;
  if (/\.local$/.test(h)) return true;
  if (/^0\.|^10\.|^127\.|^169\.254\.|^172\.(1[6-9]|2\d|3[01])\.|^192\.168\./.test(h)) return true;
  const ipv6 = h.toLowerCase();
  if (ipv6.startsWith("fe80") || ipv6.startsWith("fc") || ipv6.startsWith("fd") || ipv6 === "::1") return true;
  return false;
}

export function isSafeUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  return !isPrivateHost(u.hostname);
}

export async function fetchUrl(url: string): Promise<{ status: number; html: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, {
      headers: {
        "user-agent": UA,
        accept: "text/html,application/xhtml+xml,*/*;q=0.8",
      },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const buf = await res.arrayBuffer();
    const html = new TextDecoder("utf-8", { fatal: false })
      .decode(buf)
      .slice(0, MAX_HTML_BYTES);
    if (!html.length) throw new Error("Respons kosong");
    return { status: res.status, html };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchCss(href: string, maxBytes = MAX_CSS_BYTES, timeout = FETCH_TIMEOUT): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(href, {
      headers: { "user-agent": UA },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return new TextDecoder("utf-8", { fatal: false })
      .decode(buf)
      .slice(0, maxBytes);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export interface RawAsset {
  name: string;
  type: "image" | "icon" | "video" | "audio" | "font";
  source: string;
  dimensionsHint?: string;
  usage: string;
}

export interface PageDocs {
  title: string;
  sources: CssSourceInput[];
  assets: RawAsset[];
}

export async function fetchPageDocs(url: string): Promise<PageDocs> {
  const { html } = await fetchUrl(url);
  return extractSources(html, url);
}

export function extractSources(html: string, baseUrl: string): PageDocs {
  const sources: CssSourceInput[] = [];
  const seen = new Set<string>();
  const base = new URL(baseUrl);

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim().replace(/\s+/g, " ") : "";

  const linkRe = /<link\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html)) !== null) {
    const tag = m[0];
    const rel = (tag.match(/\brel\s*=\s*["']([^"']*)["']/i) ?? [])[1] ?? "";
    const href = (tag.match(/\bhref\s*=\s*["']([^"']*)["']/i) ?? [])[1] ?? "";
    const as = (tag.match(/\bas\s*=\s*["']([^"']*)["']/i) ?? [])[1] ?? "";
    const isStyle =
      rel.toLowerCase().includes("stylesheet") ||
      (as.toLowerCase() === "style" && href);
    if (isStyle && href) {
      let abs: string;
      try {
        abs = new URL(href, base).href;
      } catch {
        continue;
      }
      if (seen.has(abs)) continue;
      seen.add(abs);
      sources.push({ url: abs, kind: "external", content: "" });
    }
  }

  const styleRe = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  const inlineContainers: string[] = [];
  while ((m = styleRe.exec(html)) !== null) {
    const css = m[1];
    if (css.trim().length === 0) continue;
    inlineContainers.push(css);
  }
  for (let i = 0; i < inlineContainers.length; i++) {
    sources.push({
      url: `${base.origin}#style${i + 1}`,
      kind: "inline",
      content: inlineContainers[i],
    });
  }

  const attrRe = /style\s*=\s*["']([^"']{1,1200})["']/gi;
  const attrDecls: string[] = [];
  while ((m = attrRe.exec(html)) !== null) {
    const decl = m[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&");
    if (!/[:;]/.test(decl)) continue;
    attrDecls.push(decl);
  }
  if (attrDecls.length > 0) {
    const unique = [...new Set(attrDecls)].slice(0, 300);
    const css = unique
      .map((decl, i) => `[data-style-${i}] { ${decl} }`)
      .join("\n");
    sources.push({
      url: `${base.origin}#inline-attrs`,
      kind: "attribute",
      content: css,
    });
  }

  return { title, sources: sources.filter((s) => s.content.length > 0 || s.kind === "external"), assets: extractAssets(html, base) };
}

function dedupeAssets(list: RawAsset[]): RawAsset[] {
  const seen = new Set<string>();
  const out: RawAsset[] = [];
  for (const a of list) {
    if (!a.source) continue;
    if (seen.has(a.source)) continue;
    seen.add(a.source);
    out.push(a);
  }
  return out.slice(0, 60);
}

export function extractAssets(html: string, base: URL): RawAsset[] {
  const assets: RawAsset[] = [];
  const abs = (u: string): string => {
    try {
      return new URL(u, base).href;
    } catch {
      return "";
    }
  };

  const imgRe = /<img\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = imgRe.exec(html)) !== null) {
    const tag = m[0];
    const src = (tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i) ?? [])[1] ?? "";
    const alt = (tag.match(/\balt\s*=\s*["']([^"']*)["']/i) ?? [])[1] ?? "";
    if (!src) continue;
    const u = abs(src);
    if (!u) continue;
    const ext = (u.split("?")[0].split(".").pop() ?? "").toLowerCase();
    if (/^(svg|webp|png|jpe?g|gif|avif|ico)$/.test(ext) || /\.(svg|webp|png|jpe?g|gif|avif)(\?|$)/i.test(u)) {
      assets.push({
        name: (u.split("/").pop()?.split("?")[0] ?? "img").slice(0, 80),
        type: "image",
        source: u,
        usage: alt ? `img alt="${alt.slice(0, 40)}"` : "img",
      });
    }
  }

  const iconRe = /<link\b[^>]*rel\s*=\s*["']?([^"'\s>]+)["']?[^>]*>/gi;
  while ((m = iconRe.exec(html)) !== null) {
    const tag = m[0];
    if (!/icon/i.test(m[1] ?? "")) continue;
    const href = (tag.match(/\bhref\s*=\s*["']([^"']+)["']/i) ?? [])[1] ?? "";
    const sizes = (tag.match(/\bsizes\s*=\s*["']([^"']+)["']/i) ?? [])[1] ?? "";
    const u = abs(href);
    if (!u) continue;
    assets.push({
      name: (u.split("/").pop()?.split("?")[0] ?? "icon").slice(0, 80),
      type: "icon",
      source: u,
      dimensionsHint: sizes || undefined,
      usage: "site icon",
    });
  }

  const mediaRe = /<(video|audio|source)\b[^>]*>/gi;
  while ((m = mediaRe.exec(html)) !== null) {
    const tag = m[0];
    const src = (tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i) ?? [])[1] ?? "";
    if (!src) continue;
    const u = abs(src);
    if (!u) continue;
    assets.push({
      name: (u.split("/").pop()?.split("?")[0] ?? "media").slice(0, 80),
      type: tag.toLowerCase().startsWith("<source") ? "video" : tag.toLowerCase().startsWith("<audio")
        ? "audio"
        : "video",
      source: u,
      usage: tag.toLowerCase().replace(/\s+/g, " ").slice(0, 40),
    });
  }

  const ogRe = /<meta\b[^>]*property\s*=\s*["']og:image["'][^>]*content\s*=\s*["']([^"']+)["']/i;
  const m2 = ogRe.exec(html);
  if (m2) {
    const u = abs(m2[1]);
    if (u) assets.push({ name: "og-image", type: "image", source: u, usage: "social preview" });
  }

  return dedupeAssets(assets);
}

export async function hydrateSources(
  sources: CssSourceInput[],
  opts: { maxDepth?: number; maxCssBytes?: number; timeout?: number } = {},
): Promise<CssSourceInput[]> {
  const out: CssSourceInput[] = [];
  const seen = new Set<string>();
  const maxDepth = opts.maxDepth ?? 3;
  const maxCssBytes = opts.maxCssBytes ?? MAX_CSS_BYTES;
  const timeout = opts.timeout ?? FETCH_TIMEOUT;

  async function collect(src: CssSourceInput, depth: number) {
    if (depth > maxDepth) return;
    if (src.kind === "external") {
      if (seen.has(src.url)) return;
      seen.add(src.url);
      const css = await fetchCss(src.url, maxCssBytes, timeout);
      if (!css) return;
      out.push({ url: src.url, kind: src.kind, content: css });
      for (const imp of expandImports(css, src.url)) {
        if (!isSafeUrl(imp.url)) continue;
        await collect({ url: imp.url, kind: "external", content: "" }, depth + 1);
      }
    } else {
      out.push(src);
    }
  }

  for (const src of sources) {
    await collect(src, 0);
  }
  return out;
}

export function expandImports(css: string, baseUrl: string): Array<{ url: string; css: string }> {
  const found: Array<{ url: string; css: string }> = [];
  const re = /@import\s+(?:url\((["']?)([^)"']+)\1\)|(["'])([^"']+)\3)([^;]*);/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    const rawUrl = m[2] || m[4];
    if (!rawUrl) continue;
    let abs: string;
    try {
      abs = new URL(rawUrl, baseUrl).href;
    } catch {
      continue;
    }
    found.push({ url: abs, css: "" });
  }
  return found;
}