# Vinyasa

Tempel URL situs apa pun → dapatkan `DESIGN.md` berisi **warna, tipografi, radius**, audit sumber CSS, dan pratinjau HTML — semua diekstrak dari CSS yang benar-benar dimuat halaman.

Cocok untuk riset kompetitor, membangun ulang gaya visual produk, atau memberi konteks desain ke asisten AI.

## Fitur

- **Ekstraksi CSS asli** — membaca stylesheet eksternal, blok `<style>`, dan atribut `style` (bukan tebakan AI)
- **Token warna otomatis** — frekuensi dihitung, dipisah jadi warna primer & netral, siap pakai sebagai hex
- **Skala tipografi & radius** — font family, ukuran, weight, line-height per elemen + daftar border-radius
- **Audit & skor akurasi** — tiap sumber CSS dilaporkan: ukuran, jumlah rule, dan skor akurasi warna/tipografi
- **Mode multi-page** — pindai beberapa URL sekaligus dan gabungkan tokennya
- **DESIGN.md + preview HTML** — salin/turunkan DESIGN.md, atau lihat pratinjau token sebagai halaman contoh
- **Opsional: AI** — tempel API key OpenAI / Gemini / Claude (disimpan di localStorage), generate README atau tinjauan desain

## Tech stack

- Next.js 16 (App Router, TypeScript, Tailwind CSS v4)
- `css-tree` untuk parsing CSS
- Fetch halaman + stylesheet berjalan di server (`/api/extract`) supaya tidak diblokir CORS

## Menjalankan

```bash
npm install
npm run dev
```

Buka `http://localhost:3000`, tempel URL, tekan **Buat DESIGN.md**.

## Struktur

```
src/
  app/
    page.tsx           # halaman utama + form
    report.tsx         # tampilan hasil (tab warna/tipografi/radius/audit/DESIGN.md/preview/AI)
    api/extract/       # route handler: fetch halaman + stylesheet, jalankan ekstraksi
  lib/
    fetcher.ts         # fetch HTML + kumpulkan sumber CSS
    extractor.ts       # engine ekstraksi design token (css-tree)
    colors.ts          # parse & klasifikasi warna (hex/rgb/hsl/named)
    design-md.ts       # generator DESIGN.md
    preview.ts         # generator preview HTML
    ai.ts              # klien AI (OpenAI/Gemini/Claude) + localStorage config
  components/
    AiSettings.tsx     # modal pengaturan API key AI
```

## Catatan teknis

- Skor akurasi = proporsi deklarasi yang berhasil diparsing terhadap total deklarasi per kategori.
- URL server-side fetch dibatasi (timeout 12s, ukuran HTML 4MB, CSS 2MB) untuk keandalan.
- API key AI tidak pernah dikirim ke server aplikasi — dipanggil langsung dari browser ke provider.
