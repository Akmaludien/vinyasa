import { extractDesignSystem } from "../src/lib/extractor";
import type { CssSourceInput } from "../src/lib/model";

const CSS = `
:root {
  --brand: #6366f1;
  --space-md: 16px;
  --radius: 12px;
  --dur: 300ms;
}
* { box-sizing: border-box; }
body {
  color: var(--brand);
  background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
  font-family: "Inter", sans-serif;
  margin: var(--space-md) 24px;
  padding: 16px 8px;
  gap: 12px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15), 0 1px 2px rgba(0,0,0,0.05);
  border-radius: var(--radius);
  transition-duration: 300ms;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  letter-spacing: 0.01em;
}
.card { margin: 24px; padding: 4px 6px; gap: 16px; border-radius: 8px; }
.btn { padding: 12px 20px; gap: 8px; border-radius: 9999px; box-shadow: 0 2px 6px rgba(0,0,0,0.2); }
@media (min-width: 768px) { .card { gap: 24px; } }
@media (max-width: 480px) { .btn { padding: 8px; } }
.hero { background: radial-gradient(circle, #fff 0%, #e2e8f0 60%); }
`;

async function main() {
  const sources: CssSourceInput[] = [{ url: "https://site.test/css", kind: "inline", content: CSS }];
  const result = extractDesignSystem(sources, "https://site.test/", "Fixture Site");
  console.log("Primary:", result.tokens.colors.primary.slice(0, 4).map((c) => `${c.hex}${c.name ? `(${c.name})` : ""}`));
  console.log("Spacing:", result.tokens.spacing.map((s) => `${s.raw}[${s.px}px]`).slice(0, 8));
  console.log("Radius:", result.tokens.radius.map((r) => `${r.raw}[${r.px}px]`));
  console.log("Shadows:", result.tokens.shadows.length);
  console.log("Gradients:", result.tokens.gradients.length);
  console.log("Borders:", result.tokens.borders.map((b) => `${b.raw}`).slice(0, 4));
  console.log("Breakpoints:", result.tokens.breakpoints.map((b) => `${b.feature}:${b.raw}`));
  console.log("Durations:", result.tokens.durations.map((d) => `${d.raw}[${d.ms}ms]`));
  console.log("Easings:", result.tokens.easings.length);
  console.log("LetterSpacing:", result.tokens.typography.letterSpacings.map((l) => l.raw));
  console.log("Scores:", result.pages[0]?.scores);
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});