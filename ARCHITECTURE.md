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

- `NEXORA_INTEGRATION_TOKEN` hanya di server (`nexora-client.ts` bertanda
  `server-only`) dan hanya dipasang sebagai header `Authorization: Bearer` pada
  panggilan Vinyasa → Nexora. Token tidak pernah dikirim ke browser, tidak
  pernah masuk localStorage, dan tidak pernah muncul di response/error message.
- Route proxy Vinyasa (`/api/nexora/*`) memerlukan **caller authentication**
  tersendiri, terpisah dari token integrasi (lihat "Caller authentication").
- Klien hanya mengirim `projectKey`, payload design context, dan proxy access key.
- Vinyasa **membaca** Product Context & **menulis** Design Context ke Nexora.

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
| `VINYASA_PROXY_KEY` | — | Kredensial pemanggil route proxy Vinyasa (bukan token Nexora) |

`NEXORA_BASE_URL` kosong ⇒ integrasi nonaktif (`enabled=false`).
`NEXORA_INTEGRATION_TOKEN` atau `VINYASA_PROXY_KEY` kosong ⇒ semua route proxy
menolak dengan `503` (fail closed).

Koneksi:
```bash
NEXORA_BASE_URL=http://localhost:3000 NEXORA_INTEGRATION_TOKEN=shared npm run dev -- -p 3001
```

## Alur round-trip

```
1. Klien hubungkan:  GET  Vinyasa /api/nexora/connect?project=<key>
                      header x-vinyasa-proxy-key: <VINYASA_PROXY_KEY>
2. Vinyasa baca:      GET Nexora /api/integration/project?project=<key>   (getProjectContext)
                      → NexoraProductContext (canonical field: `product`)
3. Scan website → DesignModel → DesignSpecification
4. Adaptasi:         adaptDesign(spec, productContext)
5. Sinkronisasi:     POST Vinyasa /api/nexora/sync {projectKey, payload, source}
                      header x-vinyasa-proxy-key: <VINYASA_PROXY_KEY>
                      └─ POST Nexora /api/design-context {projectKey, payload, source, sourceUrl}  (updateDesignContext)
6. Klien simpan status koneksi di localStorage (projectKey + status projection saja).
```

## Kontrak canonical Product Context

Field canonical adalah **`product`** (bukan `productContext`).
`parseNexoraProductContext()` membaca `o.product` dan mempertahankan
`project.key/name/description/complexity/completeness` plus `userFlows`,
`features`, `userStories`, `requirements`, `architecture`. `project.key` adalah
project ID canonical (bukan `project_id`). Envelope tanpa `project.key`/
`project.name` menghasilkan `null`. Tidak ada fallback ke `productContext`.

## Kontrak canonical Design Context

`buildNexoraDesignContext(model, spec?, adaptation?)` selalu menghasilkan:

```text
schema: "nexora.design-context"   version: 1
generatedBy, sourceVersion?, sourceUrl, sourceTitle, generatedAt
designSystem.{colors, neutralColors, fontFamilies, fontSizes, spacing, radius}
health.overall
accessibility.{critical, warning, pass}
components.{total, blocks}
design.{pages, components, interactions, responsiveRules, layout,
        visualLanguage, implementationHints, adaptation?}
```

`spec` default-nya `buildDesignSpecification(model)`; `design.adaptation` hanya
disertakan bila adaptation diberikan. `isCanonicalDesignContext()` menolak
non-object, schema selain `nexora.design-context`, `designSystem` non-object, dan
payload tanpa token yang dikenali (colors/neutralColors/fontFamilies kosong
semua); blok `design` diperlakukan opaque dan tidak di-reinterpretasi.

## Endpoint HTTP Nexora yang dipakai Vinyasa

Semua mengembalikan JSON; mutasi dari origin lain wajib Bearer.

| Metode & path | Request | Respons |
| --- | --- | --- |
| `GET /api/integration/project?project=<key>` | query `project` (slug) | Product Context: `schema_version`, `project_id`, `project { key, name, description, complexity, completeness }`, `product { prd, requirements, features, userStories, userFlows, businessRules, architecture, decisions, api, database }`, `relationships`, `design` |
| `GET /api/design-context?project=<key>` | query `project` (slug) | `{ design: { ctx } }` design context tersimpan |
| `POST /api/design-context` | JSON `{ projectKey, payload, sourceUrl, source }` | `{ result, design }`; status 201/200 (duplicate), 400/403/422/500 |

Status error umum: `400` invalid project/payload, `403` unauthorised-origin/
forbidden, `404` not found, `422` payload tanpa token design yang dikenali,
`401/403` token salah (Vinyasa memetakan ke `unauthorized`).

## Endpoint Vinyasa (internal)

| Metode & path | Fungsi |
| --- | --- |
| `GET /api/nexora/connect?project=<key>` | Baca project + Product Context; petakan error ke status (400/401/403/404/502/503/504) |
| `POST /api/nexora/sync` | Validasi payload canonical lalu tulis ke Nexora; petakan error (400/401/403/422/502/503) |

Kedua route **protected**: `connect` juga dilindungi karena membuka Product Context.

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

## Caller authentication route proxy (`lib/nexora-route-security.ts`)

`authorizeNexoraProxy(request)` menerapkan dua gate yang keduanya wajib lulus:

1. **Caller authentication** — pemanggil wajib menyertakan header
   `x-vinyasa-proxy-key` yang dibandingkan secara constant-time (`timingSafeEqual`)
   dengan `VINYASA_PROXY_KEY` di env server. Vinyasa tidak memiliki sistem
   identity/login, sehingga shared secret ini berperan sebagai kredensial sesi:
   operator memasukkannya di panel Nexora dan nilainya hanya hidup di component
   state (tidak pernah dipersist, tidak pernah di-log).
2. **CSRF / origin** — `sec-fetch-site: cross-site` ditolak; `Origin` yang ada
   wajib sama dengan origin aplikasi; bila `Origin` absen, `Referer` (jika ada)
   wajib same-origin.

Hasil: `{ ok: true }`, atau denial bertipe `401 unauthenticated`,
`403 cross_origin`, `503 not_configured`. `denialMessage()` menghasilkan pesan
generik dan tidak pernah menyertakan nilai kredensial apa pun.

Matriks yang teruji (`__tests__/nexora-route-security.test.ts`,
`__tests__/nexora-integration.test.ts`):

| Request | Hasil |
| --- | --- |
| Tanpa proxy key, tanpa origin | 401 |
| Tanpa proxy key, same-origin | 401 |
| Proxy key salah | 401 |
| Proxy key valid, same-origin | allowed |
| Proxy key valid, cross-site mutation | 403 |
| Proxy key valid, project key invalid | 400 |
| Proxy key valid, payload non-canonical | 422 |
| Proxy key valid, Nexora gagal/unavailable | 502 |
| `VINYASA_PROXY_KEY`/token server kosong | 503 |

## Semantik `sourceUrl`

`payload.sourceUrl` adalah **satu-satunya** source of truth. `sourceUrl` di level
request hanya boleh mengonfirmasi nilai tersebut: bila berbeda, route menolak
dengan `400` daripada memilih nilai secara implisit. Payload diteruskan ke
Nexora tanpa perubahan, dan response meng-echo `payload.sourceUrl`.

## Live sync vs generic export

- **Live sync** (`components/NexoraPanel.tsx`): `buildNexoraDesignContext(model,
  spec, adaptation)` menyertakan `design.adaptation` **hanya** bila Product
  Context sudah dimuat dari Nexora.
- **Generic export** (`lib/export.ts` → `nexora.json`): deterministik dan selalu
  tanpa `adaptation`; hasil dua build identik.
- Token design (`designSystem`) identik pada kedua permukaan — adaptasi tidak
  memutasi `DesignModel`.

## Keamanan

- SSRF guard pada `NEXORA_BASE_URL` (`isSafeBaseUrl` — hanya http/https).
- Token integrasi hanya di server (`server-only`), tidak pernah dikirim ke
  klien, tidak pernah masuk localStorage, tidak pernah muncul di response.
- Caller authentication + CSRF/origin pada semua route proxy; fail closed.
- Validasi slug project dan payload canonical schema sebelum panggilan keluar.
- localStorage klien hanya menyimpan `projectKey` dan safe status projection
  (`status`, `projectName`, `version`, `lastSyncedAt`, `error`).

## Verifikasi

```bash
npx vitest run     # full suite: 15 files / 167 tests PASS
npx tsc --noEmit   # PASS
npm run build      # PASS
```

### HTTP round-trip (dua repo hidup)

```bash
# Nexora
cd Nexora && npm run db:dev            # embedded PostgreSQL 127.0.0.1:55432
cd Nexora && npx next dev -p 3421 -H 127.0.0.1

# Vinyasa
cd design-md && NEXORA_BASE_URL=http://127.0.0.1:3421 \
  VINYASA_PROXY_KEY=<key> npx next dev -p 3401 -H 127.0.0.1

# Verifikasi sisi Vinyasa (guard + Product Context + sync)
cd design-md && VINYASA_BASE_URL=http://127.0.0.1:3401 \
  VINYASA_PROXY_KEY=<key> E2E_PROJECT=nexora-demo \
  node scripts/verify-nexora-http.mjs

# Verifikasi sisi Nexora
cd Nexora && E2E_BASE_URL=http://127.0.0.1:3421 npm run test:http
```

Catatan lingkungan: `npm run db:dev` gagal (`undefined`) bila masih ada
`postgres.exe` lama memegang `.postgres-data/postmaster.pid`. Hentikan dulu
(`pg_ctl stop -m immediate -D <data-dir>`), pastikan tidak ada proses
`postgres.exe` tersisa, lalu start ulang.

Catatan: `npm run lint`/`eslint` dapat hang saat *load config* di lingkungan
tertentu (eslint-config-next 16 / telemetry); gunakan `tsc` + `vitest` sebagai
pengganti verifikasi. Ini masalah tooling, bukan bug kode.

## CI integration gate

`.github/workflows/nexora-integration.yml` menjalankan cross-repository gate:
checkout Nexora, embedded PostgreSQL + migrations, Nexora unit/type/build/
`test:http`, Vinyasa unit/type/build, lalu `verify-nexora-http.mjs`. CI wajib
menyediakan `NEXORA_INTEGRATION_TOKEN` dan `VINYASA_PROXY_KEY` sebagai GitHub
Actions Secrets; workflow menolak secret kosong atau secret yang sama.

## Runtime hardening

`POST /api/nexora/sync` menolak body di atas 2 MiB (`413`) dan `sourceUrl` selain
URL `http`/`https` (`422`). Contract payload tidak berubah. Local
`VINYASA_PROXY_KEY` hanya berada di ignored `.env.local`; production harus
memasangnya melalui secret manager/deployment environment.