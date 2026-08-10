import { fetchUrl, extractSources, hydrateSources, isSafeUrl, type RawAsset } from "./fetcher";
import type { CssSourceInput } from "./model";

export interface DeepScanStylesResult {
  title: string;
  sources: CssSourceInput[];
  assets: RawAsset[];
}

export async function deepScanStyles(url: string): Promise<DeepScanStylesResult> {
  if (!isSafeUrl(url)) return { title: "", sources: [], assets: [] };

  const { html } = await fetchUrl(url);
  const { title, sources, assets } = extractSources(html, url);
  const hydrated = await hydrateSources(sources, {
    maxDepth: 6,
    maxCssBytes: 6 * 1024 * 1024,
    timeout: 20000,
  });
  return { title, sources: hydrated, assets };
}