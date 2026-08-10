import { deepScanStyles } from "../src/lib/deepscan";

async function main() {
  const url = process.argv[2] ?? "https://example.com/";
  const r = await deepScanStyles(url);
  console.log("title:", r.title);
  console.log("sources:", r.sources.length);
  for (const s of r.sources.slice(0, 5)) {
    console.log(" -", s.kind, s.url, `(${s.content.length} bytes)`);
  }
  if (r.sources.length === 0) {
    console.log("No CSS sources found.");
  }
}

main().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});