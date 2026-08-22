import type { DesignModel, ColorToken } from "./model";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function swatchRow(title: string, tokens: ColorToken[]): string {
  if (tokens.length === 0) return "";
  const chips = tokens
    .map(
      (t) => `
      <div class="swatch">
        <div class="chip" style="background:${t.hex}"></div>
        <div class="label">${esc(t.name)}</div>
        <div class="hex">${t.hex}</div>
      </div>`,
    )
    .join("");
  return `<h3>${title}</h3><div class="grid">${chips}</div>`;
}

function pickTextColor(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length < 6) return "#ffffff";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lum = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
  return lum > 0.55 ? "#171717" : "#ffffff";
}

export function buildPreviewHtml(r: DesignModel): string {
  const bestFamily = r.tokens.typography.families[0]?.raw ?? "system-ui, sans-serif";
  const bodyBg = r.tokens.colors.neutral[0]?.hex ?? "#ffffff";
  const fg = r.tokens.colors.neutral.find((c) => c.hex !== bodyBg)?.hex ?? "#1a1a1a";
  const primary = r.tokens.colors.primary[0]?.hex ?? "#3b82f6";
  const radiusTok = r.tokens.radius[0]?.raw ?? "8px";
  const btnText = pickTextColor(primary);
  const scores = r.pages[0]?.scores ?? { overall: 0 };

  const typeRows = r.tokens.textStyles
    .slice(0, 5)
    .map((t) => {
      return `
      <div class="type-row">
        <div class="type-meta">
          <div>${esc(t.fontSize)}</div>
          <div>weight ${esc(t.fontWeight)} · lh ${esc(t.lineHeight)}</div>
        </div>
        <div class="type-demo" style="font-size:${esc(t.fontSize)};font-weight:${esc(
          t.fontWeight,
        )};line-height:${esc(t.lineHeight)};font-family:${esc(bestFamily)}">
          Aa Desain dan Tipografi
        </div>
      </div>`;
    })
    .join("");

  const radiusRows = r.tokens.radius
    .slice(0, 6)
    .map(
      (rad) => `
      <div class="radius-demo">
        <div class="radius-box" style="border-radius:${esc(rad.raw)}"></div>
        <div class="radius-label">${esc(rad.raw)}</div>
      </div>`,
    )
    .join("");

  const famChips = r.tokens.typography.families
    .map((f) => `<code>${esc(f.raw)}</code>`)
    .join(" ");

  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Pratinjau Token: ${esc(r.source.title)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: ${esc(bestFamily)}; background: ${bodyBg}; color: ${fg}; padding: 40px 24px; }
  h1, h2, h3 { margin: 0 0 8px; }
  h1 { font-size: 28px }
  h2 { font-size: 20px; margin-top: 40px }
  h3 { font-size: 15px; margin-top: 20px; opacity: .75 }
  .muted { opacity: .7 }
  .grid { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 12px }
  .swatch { width: 110px }
  .chip { height: 64px; border-radius: 12px; border: 1px solid rgba(0,0,0,.08); margin-bottom: 6px }
  .label { font-size: 12px; font-weight: 600 }
  .hex { font-size: 11px; opacity: .8 }
  .type { margin-top: 12px; display: flex; flex-direction: column; gap: 4px }
  .type-row { display: flex; gap: 16px; align-items: baseline; border-bottom: 1px solid rgba(0,0,0,.08); padding: 10px 0 }
  .type-meta { width: 150px; font-size: 12px; opacity: .7; flex-shrink: 0 }
  .radius-s { display: flex; flex-wrap: wrap; gap: 16px; margin-top: 12px }
  .radius-demo { width: 110px; }
  .radius-box { height: 90px; background: ${primary}22; border: 2px solid ${primary}66; }
  .radius-label { font-size: 11px; opacity: .8; margin-top: 6px; text-align: center; color: inherit }
  .btn-row { display: flex; gap: 12px; margin-top: 12px; flex-wrap: wrap }
  .btn { border-radius: ${esc(radiusTok)}; padding: 12px 20px; font-weight: 600; border: none; cursor: pointer; font-size: 14px }
  .btn-primary { background: ${primary}; color: ${btnText} }
  .btn-ghost { background: transparent; border: 1px solid ${primary}; color: ${primary} }
  .card { border-radius: ${esc(radiusTok)}; border: 1px solid rgba(0,0,0,.08); padding: 20px; max-width: 340px; margin-top: 12px; background: ${primary}0f }
  .cap { font-size: 10px; letter-spacing: 1px; text-transform: uppercase; opacity: .6 }
  code { background: rgba(0,0,0,.06); padding: 2px 6px; border-radius: 4px; font-size: 12px; color: inherit }
</style>
</head>
<body>
  <div class="cap">Design system preview · ${esc(r.source.url)}</div>
  <h1>${esc(r.source.title)}</h1>
  <p class="muted">Skor akurasi: ${scores.overall}/100</p>

  <h2>Warna</h2>
  ${swatchRow("Primer", r.tokens.colors.primary)}
  ${swatchRow("Netral", r.tokens.colors.neutral)}

  <h2>Tipografi</h2>
  <h3>Font family yang terdeteksi</h3>
  <p>${famChips || "Tidak terdeteksi"}</p>
  <h3>Skala teks</h3>
  <div class="type">${typeRows || "<p class='muted'>Tidak ada gaya teks dengan font-size.</p>"}</div>

  <h2>Border radius</h2>
  <div class="radius-s">${radiusRows || "<p class='muted'>Tidak terdeteksi.</p>"}</div>

  <h2>Contoh komponen</h2>
  <div class="btn-row">
    <button class="btn btn-primary">Tombol primer</button>
    <button class="btn btn-ghost">Tombol sekunder</button>
  </div>
  <div class="card">
    <div class="cap">Card</div>
    <h3 style="margin-top:6px">Judul card</h3>
    <p class="muted" style="font-size:14px">Contoh elemen yang dirender dari token diekstrak dari CSS halaman asli.</p>
  </div>
</body>
</html>`;
}