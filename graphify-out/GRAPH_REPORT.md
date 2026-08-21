# Graph Report - Vinyasa (design-md)  (2026-08-15)

## Corpus Check
- 69 files - ~44,556 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 77 nodes (69 code + 8 packages) - 202 edges - 7 areas
- Extraction: 100% EXTRACTED (static import/export parsing) - 0% INFERRED - 0% AMBIGUOUS

## Areas
| Area | Files | Out-edges |
|---|---|---|
| lib | 50 | 134 |
| app | 3 | 29 |
| scripts | 6 | 10 |
| api/extract | 1 | 9 |
| components | 2 | 9 |
| api/nexora | 2 | 8 |
| root | 5 | 3 |

## God Nodes (most connected)
1. `src/lib/model.ts` - 37 edges (in 32 / out 5)
2. `src/lib/extractor.ts` - 20 edges (in 10 / out 10)
3. `src/app/report.tsx` - 20 edges (in 1 / out 19)
4. `src/lib/spec.ts` - 12 edges (in 10 / out 2)
5. `src/lib/nexora.ts` - 10 edges (in 7 / out 3)
6. `src/app/api/extract/route.ts` - 10 edges (in 1 / out 9)
7. `src/lib/adapt.ts` - 9 edges (in 5 / out 4)
8. `src/lib/export.ts` - 9 edges (in 5 / out 4)
9. `src/lib/__tests__/nexora.test.ts` - 9 edges (in 0 / out 9)
10. `src/lib/__tests__/pack.test.ts` - 9 edges (in 0 / out 9)
11. `src/lib/fetcher.ts` - 8 edges (in 7 / out 1)
12. `src/lib/pack.ts` - 8 edges (in 3 / out 5)
13. `src/components/NexoraPanel.tsx` - 8 edges (in 1 / out 7)
14. `src/app/page.tsx` - 8 edges (in 0 / out 8)
15. `src/lib/nexora-product-context.ts` - 7 edges (in 6 / out 1)

## Entry Points
- scripts/test-deepscan.ts  [scripts]
- scripts/test-engine.ts  [scripts]
- scripts/test-features.ts  [scripts]
- scripts/test-live.ts  [scripts]
- src/app/api/extract/route.ts  [api/extract]
- src/app/api/nexora/connect/route.ts  [api/nexora]
- src/app/api/nexora/sync/route.ts  [api/nexora]
- src/app/layout.tsx  [app]
- src/app/page.tsx  [app]

## Import Cycles
- src/lib/darkmode.ts -> src/lib/responsive.ts -> src/lib/accessibility.ts -> src/lib/health.ts -> src/lib/components.ts -> src/lib/model.ts -> src/lib/darkmode.ts

## Surprising Connections
- None detected.

## Integration Subgraph (Vinyasa / Nexora contract)
- 17 files match the integration pattern, 25 internal edges.
  - scripts/generate-integration-secrets.mjs
  - scripts/verify-nexora-http.mjs
  - src/app/api/nexora/connect/route.ts
  - src/app/api/nexora/sync/route.ts
  - src/components/NexoraPanel.tsx
  - src/lib/nexora-client.ts
  - src/lib/nexora-config.ts
  - src/lib/nexora-connection.ts
  - src/lib/nexora-product-context.ts
  - src/lib/nexora-route-security.ts
  - src/lib/nexora.ts
  - src/lib/validate-design-context.ts
  - src/lib/__tests__/nexora-client.test.ts
  - src/lib/__tests__/nexora-integration.test.ts
  - src/lib/__tests__/nexora-product-context.test.ts
  - src/lib/__tests__/nexora-route-security.test.ts
  - src/lib/__tests__/nexora.test.ts

HTTP calls made by this repo (server-side, token injected by nexoraClient):
- GET {NEXORA_BASE_URL}/api/integration/project?project=<key>
- POST {NEXORA_BASE_URL}/api/design-context

## Changed-File Impact (uncommitted local changes)
- No code files in the changed set (docs/config only), or changed files not part of the code graph.
## Unresolved Imports
- None.
