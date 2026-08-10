# Vinyasa

**Design Intelligence Platform** — mengubah website menjadi *Design System* yang terstruktur, dianalisis, diaudit, dipahami dengan AI, dibandingkan, dan diekspor untuk kerja pengembangan nyata.

## Alur inti

```
SCAN → UNDERSTAND → ANALYZE → INTELLIGENTLY INTERACT → EDIT → EXPORT → COMPARE
```

```
Website → Discovery → Extraction → Normalization → Canonical Design Model
        → Analysis (Health × WCAG) → AI → Playground → Export → Diff/Drift
```

## Fitur

**Scan engine (Fast & Deep)**
- Fast Scan: ekstraksi dari HTML + CSS (stylesheet eksternal, `<style>`, inline `style=""`)
- Deep Scan (roadmap): headless browser, computed styles, runtime CSS
- Resolusi `var()`/CSS custom properties → nilai komputasi nyata

**Scan Scope** — Smart / Landing / 5 Pages / All Pages / Custom, dengan discovery via sitemap + link internal, prioritas halaman, dan batas aman.

**Canonical Design Model (DesignModel v1.0)**
- Single source of truth untuk semua downstream
- Token dilengkapi provenance (source, selector, frekuensi, usage)
- Schema ber-versi, serializable, deterministic, diffable, exportable

**Token yang diekstrak**: warna (primer/netral/hardcoded) · tipografi (family/getar/weight/line-height/letter-spacing) · spacing · radius · borders · shadows · gradients · breakpoints · motion (duration/easing) · text styles per selector

**Design Health** — skor deterministik & *explainable* per kategori: Color, Typography, Spacing, Radius, Components + overall.

**Accessibility / WCAG** — kontras fg/bg, AA & AAA, isu berperingkat (critical/warning/suggestion), label sebagai analisis otomatis (bukan sertifikasi).

**Responsive Intelligence** — skor Mobile/Tablet/Desktop, analisis breakpoints & ukuran font, isu per viewport.

**Dark Mode Intelligence** — deteksi `prefers-color-scheme`, class `.dark`, `[data-theme]`, dan variabel tema.

**Component Detection** — heuristik selector untuk 20+ pola (button, card, navbar, modal, dll.) dengan confidence & properti.

**Playground** — ubah warna & radius token, pratinjau langsung, reset, salin modifikasi (layer terpisah dari data asli).

**i18n** — toggle Bahasa Indonesia / English.

**Diff** — bandingkan baseline vs scan saat ini: ditambah/dihapus/berubah per kategori token.

**Riwayat scan (Session)** — simpan/muat/rename/hapus scan di localStorage (fondasi Design Drift).

**Deep Scan** — Playwright headless browser: render halaman, computed styles, warna runtime, screenshot.

**Export Engine** — satu aksi menghasilkan: `tokens.json` (DTCG-compatible), `tokens.css`, `tailwind.css`, `DESIGN.md`, `raw.json`, `README.md`, plus **unduh semua sebagai ZIP**.

**AI (opsional, no-server-key)** — OpenAI / Gemini / Claude / Custom, key di localStorage, generate README/review, **AI Chat streaming (SSE) grounded di DesignModel**, **konteks selektif per bagian**, test connection, auto-switch model saat 429 (transparan).

## Tech stack

- Next.js 16 (App Router, React 19, TypeScript strict, Tailwind v4)
- `css-tree` untuk parsing CSS; fetch + parsing di server (`/api/extract`)
- Generator: `design-md.ts`, `preview.ts`, `export.ts`

## Menjalankan

```bash
npm install
npm run dev
```

Buka `http://localhost:3000`, tempel URL, pilih cakupan & mode, tekan **Mulai Scan**.

Untuk Deep Scan, pastikan browser headless terinstal:
```bash
npx playwright install chromium
```

Test & verifikasi:
```bash
npm test          # vitest (38 unit test)
npm run lint      # eslint
npm run build     # production build
```

## Struktur

```
src/
  app/
    page.tsx           # halaman utama + Scan Scope + Scan Mode
    report.tsx         # dashboard hasil (12 tab)
    api/extract/       # route handler scan pipeline
  lib/
    model.ts           # Canonical DesignModel + tipe bersama
    fetcher.ts         # fetch HTML + kumpulkan CSS + SSRF guard
    scan.ts            # discovery URL, Scan Scope, prioritization
    extractor.ts       # engine ekstraksi (css-tree) → DesignModel
    colors.ts          # parse & klasifikasi warna
    units.ts           # konversi unit (px/rem/durasi/berat)
    cssvars.ts         # resolusi var()/CSS custom properties
    design-md.ts       # generator DESIGN.md
    preview.ts         # generator preview HTML
    export.ts          # export DTCG JSON / CSS / Tailwind
    health.ts          # Design Health scoring deterministic
    accessibility.ts   # WCAG contrast + laporan
    ai.ts              # klien AI (provider + localStorage)
  components/
    AiSettings.tsx     # modal pengaturan AI
```

## Keamanan

- **SSRF guard**: blokir localhost, IP privat, network internal, validasi redirect
- Limit: timeout 12s, HTML 4MB, CSS 2MB
- API key AI tidak pernah dikirim ke server Vinyasa (langsung ke provider dari browser)

## Status fase roadmap

| Fase | Status |
| --- | --- |
| 0. Audit | ✅ |
| 1. DesignModel + normalisasi | ✅ |
| 2. Scan Scope + discovery | ✅ |
| 3. Ekstraksi lengkap (spacing/shadows/gradients/borders/motion) | ✅ |
| 4. Export Engine | ✅ |
| 5. Design Health | ✅ |
| 6. Accessibility/WCAG | ✅ |
| 7. Responsive Intelligence | ✅ (CSS-heuristic; visual via Deep Scan) |
| 8. Deep Scan (Playwright) | ✅ computed styles + screenshot |
| 9. Component detection | ✅ (heuristik selector) |
| 10. AI (Custom provider, chat) | ✅ |
| 11. Playground | ✅ |
| 12. Diff | ✅ (baseline vs sekarang) |
| 13. Dark Mode / Drift | ✅ dark mode; drift (timeline otomatis) |
| 14. Hardening | ✅ SSRF, limits, lint/build |
| 15. Produk UI (shell, homepage entry, overview) | ✅ |
| 16. Page Explorer + Source Inspector | ✅ |
| 17. AI rekomendasi → Playground | ✅ |
| 18. Ekspor DESIGN.md customizable | ✅ |