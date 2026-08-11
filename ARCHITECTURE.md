# Vinyasa — Architecture

Design Intelligence Platform: mengubah website menjadi *Design System* yang
terstruktur, dianalisis, diaudit, dibandingkan, dan diekspor.

## Pipeline inti

```
Scan → Discover → Extract → Normalize → Canonical DesignModel
      → Analysis (Health × WCAG × Responsive × Dark) → Component Detection
      → AI → Playground → Export → Diff/Drift
```

Lapisan data: `DesignModel` (canonical, versi, serializable) adalah single
source of truth; semua downstream diambil darinya.

## Lapisan utama

| Lapisan | Modul | Tanggung jawab |
| --- | --- | --- |
| Fetch | `lib/fetcher.ts` | Ambil HTML + kumpulkan CSS, SSRF guard, limit |
| Scan | `lib/scan.ts` | Discovery URL, Scope, prioritas, batas aman |
| Ekstraksi | `lib/extractor.ts`, `colors.ts`, `units.ts`, `cssvars.ts` | CSS → token dengan provenance |
| Model | `lib/model.ts` | Canonical DesignModel + tipe bersama |
| Analisis | `lib/health.ts`, `lib/accessibility.ts` | Skor kesehatan & WCAG |
| Spek | `lib/spec.ts` | DesignSpecification deterministik |
| Komponen | `lib/components.ts` | Deteksi + klasifikasi heuristik |
| Adaptasi | `lib/adapt.ts` | Selaraskan ke target stack & produk |
| Native connector | `lib/nexora-*.ts` | Integrasi server-to-server dengan Nexora |

## DesignModel sebagai single source of truth

Semua downstream (health, a11y, responsive, dark mode, components, export,
AI, playground) mengonsumsi `DesignModel` yang sama sehingga output konsisten.
`DesignSpecification` (`lib/spec.ts`) adalah snapshot kanonik deterministik yang
dapat diff, versi, dan ekspor.

## Adaptasi product-aware (`lib/adapt.ts`)

`adaptDesign(spec, input)` memakai **input** sebagai kontrak pengarahan:

- `NexoraProductContext` (dari `parseNexoraProductContext`, `nexora-product-
  context.ts`) — struktur produk Nexora (pages/features/requirements/userFlows/
  architecture) **plus** `context` (stack target: framework, styling, brand,
  conventions).
- `NexoraProjectContext` (fallback) — hanya stack target.

Token tetap authoritative (plants/detection tidak diubah); yang diubah adalah
permukaan konsumsi: nama selector (di-re-key ke produk & prefiks class), dan
implementation hints (framework/library/naming).

# Nexora Integration Contract

Integrasi **server-to-server** antara dua repo: **Vinyasa** (penulis design)
dan **Nexora** (pemilik produk). Token integrasi hanya tinggal di server.

## Prinsip

- Token hanya di server; klien hanya mengirim `projectKey`.
- Vinyasa **membaca** product context & **menulis** design context ke Nexora.
- Semua panggilan memakai Bearer token atau sesi Nexora; mutation antarsitus
  wajib Bearer (CSRF).

## Menjalankan dua repo (dev lokal)

```bash
# Repo 1 — Nexora (default http://localhost:3000)
cd Nexora
cp .env.example .env            # set DATABASE_URL, AUTH_SECRET, seed, NEXORA_INTEGRATION_TOKEN
npm install
npx prisma migrate deploy       # / prisma db push untuk dev
npm run dev

# Repo 2 — Vinyasa (port berbeda, mis. http://localhost:3001)
cd design-md
npm install
# .env.local /.env — lihat .env.example
npm run dev -- -p 3001
```

### Env yang diselaraskan

| Variabel Vinyasa | Variabel Nexora | Fungsi |
| --- | --- | --- |
| `NEXORA_BASE_URL` (atau `NEXORA_API_URL`) | — | URL Nexora yang berjalan |
| `NEXORA_INTEGRATION_TOKEN` | `NEXORA_INTEGRATION_TOKEN` | Shared secret (harus SAMA) |
| `NEXORA_TIMEOUT_MS` | — | Timeout baca/tulis (default 15000) |

Token kosong ⇒ integrasi nonaktif (Vinyasa `enabled=false`).

Koneksi:
```bash
NEXORA_BASE_URL=http://localhost:3000 NEXORA_INTEGRATION_TOKEN=shared npm run dev -- -p 3001
```

## Alur round-trip

```
1. Klien hubungkan:  GET  Vinyasa /api/nexora/connect?project=<key>
2. Vinyasa verifikasi: GET Nexora /api/integration/project?project=<key>   (getProject)
3. Scan website → DesignModel → DesignSpecification
4. Adaptasi:         adaptDesign(spec, productContext)   (getProjectContext → NexoraProductContext)
5. Sinkronisasi:     POST Vinyasa /api/nexora/sync {projectKey, payload, sourceUrl}
                      └─ POST Nexora /api/design-context {projectKey, payload, source, sourceUrl}  (updateDesignContext)
6. Klien simpan status koneksi di localStorage (projectKey saja, tanpa token).
```

## Endpoint HTTP Nexora yang dipakai Vinyasa

Semua mengembalikan JSON; mutasi dari origin lain wajib Bearer.

| Metode & path | Request | Respons |
| --- | --- | --- |
| `GET /api/integration/project?project=<key>` | query `project` (slug) | Product Context: `project { key, name, description, complexity, completeness }`, `productContext { userFlows, features, userStories, requirements, architecture }` |
| `GET /api/design-context?project=<key>` | query `project` (slug) | `{ design: { ctx } }` design context tersimpan |
| `POST /api/design-context` | JSON `{ projectKey, payload, sourceUrl, source }` | `{ result, design }`; status 201/200 (duplicate), 400/403/422/500 |

Status error umum: `400` invalid project/payload, `403` unauthorised-origin/
forbidden, `404` not found, `422` payload tanpa token design yang dikenali,
`401/403` token salah (Vinyasa memetakan ke `unauthorized`).

## Endpoint Vinyasa (internal)

| Metode & path | Fungsi |
| --- | --- |
| `GET /api/nexora/connect?project=<key>` | Verifikasi project & kembalikan info; petakan error ke status (404/502/503) |
| `POST /api/nexora/sync` | Validasi payload canonical lalu tulis ke Nexora; petakan error (400/422/502) |

## Model koneksi klien (`lib/nexora-connection.ts`)

Status: `not_connected → connected → syncing → synced`, dengan `error` pada
jalur gagal. **Persistensi hanya `projectKey`** (client projection) — token dan
rahasia tidak pernah ditulis ke localStorage. `safeWrite` memproyeksikan subset
aman.

## Mapping error (`lib/nexora-client.ts` `NexoraErrorKind`)

`not_configured`, `invalid_url`, `timeout`, `network`, `unauthorized`,
`not_found`, `malformed`, `upstream`, `unavailable` — dipetakan ke HTTP status
oleh route (`/api/nexora/connect`, `/api/nexora/sync`). Integrasi tidak pernah
melempar ke crash Vinyasa; `NexoraError` menormalisasi reason.

## Keamanan

- SSRF guard pada `NEXORA_BASE_URL` (`isSafeBaseUrl` — hanya http/https).
- Token hanya di server; tidak ada pengiriman ke klien (`server-only`).
- Validasi slug project dan payload canonical schema sebelum panggilan keluar.
- Mutation lintas-origin di sisi Nexora membutuhkan Bearer token (CSRF).

## Verifikasi

```bash
npx tsc --noEmit
npx vitest run        # full suite (14 files / 124 tests)
```

Catatan: `npm run lint`/`eslint` dapat hang saat *load config* di lingkungan
tertentu (eslint-config-next 16 / telemetry); gunakan `tsc` + `vitest` sebagai
pengganti verifikasi. Ini masalah tooling, bukan bug kode.