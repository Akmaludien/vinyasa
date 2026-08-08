import { extractSources, hydrateSources } from "../src/lib/fetcher";
import { extractDesignSystem } from "../src/lib/extractor";

const SAMPLE_HTML = `<!doctype html>
<html>
<head>
  <title>Test Site</title>
  <link rel="stylesheet" href="/styles/main.css">
  <link rel="stylesheet" href="https://cdn.example.com/theme.css">
  <style>
    :root {
      --brand: #2563eb;
      --bg: #0f172a;
    }
    body {
      font-family: "Inter", "Segoe UI", sans-serif;
      font-size: 16px;
      line-height: 1.5;
      color: #e2e8f0;
      background-color: #0f172a;
      border-radius: 8px;
    }
    .btn {
      background: #2563eb;
      color: #ffffff;
      border-radius: 6px;
      font-weight: 600;
    }
    .btn:hover { background: #1d4ed8; }
    .card {
      border: 1px solid #334155;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }
    h1 { font-size: 2.25rem; font-weight: 700; color: #ffffff; }
    p { font-size: 1rem; color: rgb(148, 163, 184); }
  </style>
</head>
<body style="margin:0;font-family:'Arial',sans-serif;color:#111;">
  <button class="btn" style="background:red;border-radius:4px">X</button>
</body>
</html>`;

const FAKE_EXTERNAL_CSS = `
:root { --accent: #10b981; }
.hero { background: hsl(200, 50%, 40%); color: #fff; border-radius: 0.5rem; font-family: "Poppins", sans-serif; font-size: 2rem; }
.input { border: 1px solid #94a3b8; border-radius: 0.375rem; }
a { color: rgba(37, 99, 235, 0.8); }
.tag { background-color: #f59e0b; border-radius: 9999px; font-size: 0.75rem; font-weight: 500; }
`;

async function main() {
  const { title, sources } = extractSources(SAMPLE_HTML, "https://example.com/");
  console.log("TITLE:", title);
  console.log("SOURCES:", sources.map((s) => `${s.kind}:${s.url}`));

  for (const src of sources) {
    if (src.kind === "external" && !src.content) {
      if (src.url === "https://example.com/styles/main.css" || src.url === "https://cdn.example.com/theme.css") {
        src.content = FAKE_EXTERNAL_CSS;
      }
    }
  }

  const hydrated = await hydrateSources(sources);
  const result = extractDesignSystem(hydrated, "https://example.com/", title, 1);

  console.log("\n=== COLORS PRIMARY ===");
  for (const c of result.colors.primary) console.log(`${c.name.padEnd(12)} ${c.hex}  x${c.count} (${c.usage}%)`);
  console.log("\n=== COLORS NEUTRAL ===");
  for (const c of result.colors.neutral) console.log(`${c.name.padEnd(12)} ${c.hex}  x${c.count} (${c.usage}%)`);
  console.log("\n=== FONTS ===");
  for (const f of result.fonts.families) console.log(`- ${f.raw} x${f.count}`);
  console.log("\n=== SIZES ===");
  for (const s of result.fonts.sizes) console.log(`- ${s.raw} -> ${s.px}px x${s.count}`);
  console.log("\n=== WEIGHTS ===");
  for (const w of result.fonts.weights) console.log(`- ${w.value} x${w.count}`);
  console.log("\n=== RADIUS ===");
  for (const r of result.radius) console.log(`- ${r.raw} x${r.count}`);
  console.log("\n=== TEXT STYLES ===");
  for (const t of result.textStyles) console.log(`- ${t.fontFamily} ${t.fontSize} ${t.fontWeight} ${t.lineHeight} x${t.count}`);
  console.log("\n=== SCORES ===");
  console.log(result.scores);
  console.log("\n=== AUDIT ===");
  for (const s of result.sources) console.log(`- ${s.url} ${s.kind} ${s.sizeBytes}B rules=${s.ruleCount} decl=${s.declarationCount} color=${s.colorScore}% typo=${s.typographyScore}% score=${s.accuracy}`);
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});