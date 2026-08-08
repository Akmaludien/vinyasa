import { fetchPageDocs, hydrateSources } from "../src/lib/fetcher";
import { extractDesignSystem } from "../src/lib/extractor";
import { buildDesignMd } from "../src/lib/design-md";
import { buildPreviewHtml } from "../src/lib/preview";

async function main() {
  const url = "https://example.com/";
  console.log("Fetching:", url);
  const { title, sources } = await fetchPageDocs(url);
  console.log("Title:", title, "| sources:", sources.length);
  const hydrated = await hydrateSources(sources);
  console.log("Hydrated sources:", hydrated.map((s) => `${s.kind}:${s.url.substring(0, 60)}`));
  const result = extractDesignSystem(hydrated, url, title, 1);
  console.log("Scores:", result.scores);
  console.log("Primary colors:", result.colors.primary.slice(0, 5).map((c) => c.hex));
  console.log("Neutral colors:", result.colors.neutral.slice(0, 5).map((c) => c.hex));
  console.log("Families:", result.fonts.families.map((f) => f.raw));
  console.log("Sizes:", result.fonts.sizes.slice(0, 5).map((s) => `${s.px}px`));
  console.log("Radius:", result.radius.slice(0, 5).map((r) => r.raw));
  const md = buildDesignMd(result);
  console.log("\n=== DESIGN.md (first 400 chars) ===");
  console.log(md.substring(0, 400));
  const preview = buildPreviewHtml(result);
  console.log("\n=== Preview html length:", preview.length);
  console.log("Preview starts:", preview.substring(0, 60));
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});