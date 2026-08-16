# Vinyasa Production Deployment

## Topology

```text
Browser (HTTPS, origin vinyasa.<domain>)
   |
   v
Vinyasa (Next.js, serverless)  --server-to-server (Bearer)-->  Nexora production (nexora.<domain>)
```

- Vinyasa **tidak punya database, session, atau worker** - semua state di browser (client projection) dan di Nexora.
- Integrasi token (`NEXORA_INTEGRATION_TOKEN`) hanya hidup di **server Vinyasa** (env) dan server Nexora. Diinjeksi server-side oleh `nexoraClient`; tidak pernah dikirim ke browser.
- Kunci akses proxy (`VINYASA_PROXY_KEY`) hanya di server Vinyasa (env) + diinput operator lewat UI, dan hanya dikirim ke **same-origin** proxy routes. Tidak pernah ke localStorage, tidak pernah ke Nexora.

## Target hosting (rekomendasi)

| Komponen | Rekomendasi | Alternatif |
|---|---|---|
| Web (Next.js) | Vercel | VPS/Docker, Railway, Cloud Run |
| Domain | **BELUM DITETAPKAN - keputusan user sebelum deploy** | - |
| Database | Tidak diperlukan (state di Nexora) | - |
| Secrets | Vercel Environment Variables (production scope) | systemd EnvironmentFile / Docker secrets |

> **Gate Phase 6:** deployment aktual belum dilakukan. Domain production dan account hosting adalah keputusan user. Placeholder `<domain>` di dokumen ini WAJIB diganti sebelum deploy.

## Environment production

| Variable | Wajib | Catatan |
|---|---|---|
| `NEXORA_BASE_URL` | Ya | URL **production Nexora** (mis. `https://nexora.<domain>`). JANGAN menunjuk domain/port Vinyasa sendiri - error `POST /api/auth/login 404` sebelumnya terjadi karena request login Nexora masuk ke Vinyasa. |
| `NEXORA_INTEGRATION_TOKEN` | Ya | Nilai yang SAMA dengan `NEXORA_INTEGRATION_TOKEN` server Nexora. Server-only; jangan pernah `NEXT_PUBLIC_*`. |
| `VINYASA_PROXY_KEY` | Ya | Kunci akses proxy untuk caller (operator) di sisi Vinyasa. Bukan `NEXORA_INTEGRATION_TOKEN`. Kosong = semua panggilan proxy ditolak (fail closed, 503 `not_configured`). |
| `NEXORA_TIMEOUT_MS` | Disarankan | `15000` (default client bila tidak di-set). |

### Aturan secret

- `NEXORA_INTEGRATION_TOKEN`: server Vinyasa + server Nexora (nilai identik).
- `VINYASA_PROXY_KEY`: server Vinyasa + input browser operator saat memakai proxy. **Bukan** token Nexora.
- Dilarang: `NEXT_PUBLIC_NEXORA_INTEGRATION_TOKEN`, `NEXT_PUBLIC_VINYASA_PROXY_KEY`, commit `.env*` (sudah di-ignore, `.env.example` dikecualikan), dan pengiriman `NEXORA_INTEGRATION_TOKEN` ke browser.

## Deployment (Vercel)

```bash
# Lokal sebelum push:
npm ci
npm test
npm exec tsc -- --noEmit
npm run build

# Vercel: hubungkan repo, set environment variables production (lihat matrix di atas).
# Vercel otomatis menjalankan build (Next.js auto-detected).
```

Untuk target non-Vercel (VPS): `npm ci && npm run build && npm run start` di belakang reverse proxy dengan TLS (teruskan `x-forwarded-proto=https` agar origin check cocok).

## Verifikasi production

Script `scripts/verify-nexora-http.mjs` sudah didukung env - jalankan terhadap URL production:

```bash
VINYASA_BASE_URL=https://vinyasa.<domain> \
VINYASA_PROXY_KEY=<proxy-key> \
node scripts/verify-nexora-http.mjs
```

9 checks yang dijalankan (harus semua PASS):

| # | Skenario | Ekspektasi |
|---|---|---|
| 1 | `GET /api/nexora/connect` tanpa proxy key | 401, response tidak mem-echo kredensial |
| 2 | Proxy key salah | 401 |
| 3 | Project key tidak valid | 400 |
| 4 | Product Context via proxy (terautentikasi) | 200, `productContext.source === "nexora"`, struktur tidak kosong, tanpa kebocoran key |
| 5 | `POST /api/nexora/sync` anonim | 401 |
| 6 | Sync cross-site (origin asing) | 403 |
| 7 | `sourceUrl` request tidak cocok dengan payload | 400 |
| 8 | Payload tanpa design tokens | 422 |
| 9 | Sync terautentikasi | 200, versi artifact ter-echo, `sourceUrl` dari payload |

Verifikasi tambahan Phase 9 yang dijalankan dari sisi Nexora (`npm run test:http`, 20 checks: duplicate -> 200 `duplicate=true`, payload berubah -> 201 versi naik, read-back lossless, denial Bearer, CSRF session) - lihat `docs/deployment.md` repo Nexora.

## Keamanan (hasil audit, status 2026-08)

| Item | Status | Bukti |
|---|---|---|
| Token tidak muncul di response browser | PASS | Uji 1 dan 4 di atas (no credential echo) |
| Token tidak di localStorage | PASS | `nexora-connection.ts` hanya persist client projection (status/projectKey/version/timestamp); proxy key hanya di component state |
| Error response tidak membocorkan secret | PASS | Pesan denial generik (`denialMessage`), tanpa nilai kredensial |
| `.env*` tidak tracked | PASS (setelah perbaikan) | gitignore diperluas; hanya `.env.example` yang boleh tracked |
| Rate limit proxy | n/a | Proteksi = shared secret constant-time + origin check; Vinyasa tanpa user identity |
| Body size limit | PASS | 2 MiB di route sync (413), dicek via content-length dan byte aktual |
| SSRF | PASS | `sourceUrl` divalidasi http/https dan **disimpan, tidak pernah di-fetch** server-side; `NEXORA_BASE_URL` adalah env operator, bukan input user |
| Origin/CSRF | PASS | `sec-fetch-site: cross-site` ditolak; Origin/Referer host harus match Host (403) |
| Constant-time compare | PASS | `timingSafeEqual` untuk proxy key |

## Rotasi secret (procedure)

### `VINYASA_PROXY_KEY` (dampak: operator harus re-enter key di UI)

1. Generate key baru (UI secret generator Vinyasa atau generator eksternal).
2. Set nilai baru di env server Vinyasa, deploy.
3. Operator memakai key baru di panel; key lama langsung tidak berlaku setelah deploy.

### `NEXORA_INTEGRATION_TOKEN` (dampak: sync gagal sementara selama jendela rotasi)

Kedua server harus memegang nilai yang sama, dan kode saat ini **tidak mendukung dual-token** (satu nilai aktif di Nexora). Urutan dengan jendela gangguan minimal:

1. Siapkan nilai token baru (generate di kedua repo, nilai identik).
2. Set token baru di server **Vinyasa** + deploy. (Sync mulai gagal: Vinyasa mengirim token baru, Nexora masih mengharapkan token lama.)
3. Segera set token baru di server **Nexora** + deploy. Jendela gangguan = durasi langkah 2-3; jadwalkan di luar jam sibuk.
4. Verifikasi: jalankan round-trip production (`test:http` + `verify-nexora-http.mjs`) sampai PASS.

Catatan: bila gangguan nol wajib, tambahkan dukungan dual-token (terima token lama + baru) di sisi Nexora sebelum rotasi - perubahan fitur, belum diimplementasikan.

## Rollback

- Vinyasa stateless (tanpa DB): rollback = deploy ulang build sebelumnya (Vercel: Promote deployment lama; VPS: artifact build per release).
- Tidak ada migrasi untuk di-rollback. Kontrak payload design-context ke Nexora bersifat aditif (schema `nexora.design-context` v1); versi lama Vinyasa tetap kompatibel dengan Nexora yang lebih baru selama token sama.

## Observability minimal

- `GET /` 200 sebagai smoke test; route proxy menghasilkan denial 401/403 yang bisa dipantau dari akses log platform (status 4xx/5xx per path `/api/nexora/*`).
- 502 dari route proxy = kegagalan upstream Nexora (auth/timeout/malformed) - alarm pada spike 502 untuk path `/api/nexora/*`.
- Latensi Vinyasa - Nexora: pantau p99 duration function `/api/nexora/sync` (target < `NEXORA_TIMEOUT_MS`).
- Log platform: jangan pernah log isi header `x-vinyasa-proxy-key` atau `Authorization` (audit: tidak ada `console.*` di code Vinyasa yang mencetak keduanya).

## Status dokumen

- Kode integration: sudah di main (`96da356`).
- Perbaikan gitignore (`!.env.example`): perubahan siap commit (lihat laporan deployment readiness).
- Deployment aktual: **BELUM** - menunggu domain, hosting, dan production env dari user; serta deploy Nexora production lebih dulu (urutan: Nexora - DB/seed - Vinyasa).