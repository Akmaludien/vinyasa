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
  const result = extractDesignSystem(hydrated, url, title);
  console.log("Scores:", result.pages[0]?.scores);
  console.log("Primary colors:", result.tokens.colors.primary.slice(0, 5).map((c) => c.hex));
  console.log("Neutral colors:", result.tokens.colors.neutral.slice(0, 5).map((c) => c.hex));
  console.log("Families:", result.tokens.typography.families.map((f) => f.raw));
  console.log("Sizes:", result.tokens.typography.sizes.slice(0, 5).map((s) => `${s.px}px`));
  console.log("Radius:", result.tokens.radius.slice(0, 5).map((r) => r.raw));
  console.log("Spacing:", result.tokens.spacing.slice(0, 5).map((s) => s.raw));
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