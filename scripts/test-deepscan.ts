import { deepScan } from "../src/lib/deepscan";

async function main() {
  const r = await deepScan("https://example.com/");
  console.log("ok:", r.ok);
  console.log("error:", r.error ?? "(none)");
  if (r.ok) {
    console.log("title:", r.computed.title);
    console.log("primary:", r.computed.primaryColor);
    console.log("bg:", r.computed.bodyBackground);
    console.log("colors:", r.computed.computedColors.slice(0, 5));
    console.log("stylesheet count:", r.computed.runtimeStylesheetCount);
    console.log("screenshot len:", r.screenshots[0]?.length ?? 0);
  }
}

main().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});