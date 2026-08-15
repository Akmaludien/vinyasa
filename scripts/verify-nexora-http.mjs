/**
 * Cross-repo HTTP round-trip check for the Vinyasa side of the integration.
 * Drives the real Vinyasa proxy routes over HTTP against a running Nexora.
 *
 * Env: VINYASA_BASE_URL (default http://127.0.0.1:3401), VINYASA_PROXY_KEY,
 *      E2E_PROJECT (default nexora-demo).
 */
const base = process.env.VINYASA_BASE_URL ?? "http://127.0.0.1:3401";
const proxyKey = process.env.VINYASA_PROXY_KEY ?? "";
const project = process.env.E2E_PROJECT ?? "nexora-demo";

function check(value, message) {
  if (!value) throw new Error(`FAIL: ${message}`);
}
const pass = (m) => console.log(`  ok  ${m}`);

const sameOrigin = { origin: base, "sec-fetch-site": "same-origin" };
const authed = { ...sameOrigin, "x-vinyasa-proxy-key": proxyKey };

async function main() {
  check(proxyKey, "VINYASA_PROXY_KEY is not set");

  console.log("Proxy guard — GET /api/nexora/connect");
  const anon = await fetch(`${base}/api/nexora/connect?project=${project}`, { headers: sameOrigin });
  check(anon.status === 401, `anonymous connect returned ${anon.status}`);
  const anonBody = JSON.stringify(await anon.json());
  check(!anonBody.includes(proxyKey), "denial response echoed the proxy key");
  pass("anonymous connect → 401, no credential echoed");

  const wrong = await fetch(`${base}/api/nexora/connect?project=${project}`, {
    headers: { ...sameOrigin, "x-vinyasa-proxy-key": `${proxyKey}x` },
  });
  check(wrong.status === 401, `wrong key returned ${wrong.status}`);
  pass("wrong proxy key → 401");

  const badKey = await fetch(`${base}/api/nexora/connect?project=NOT_A_KEY`, { headers: authed });
  check(badKey.status === 400, `invalid project key returned ${badKey.status}`);
  pass("invalid project key → 400");

  console.log("Product Context — GET /api/nexora/connect");
  const connect = await fetch(`${base}/api/nexora/connect?project=${project}`, { headers: authed });
  check(connect.status === 200, `authenticated connect returned ${connect.status}`);
  const data = await connect.json();
  check(data.ok === true, "connect envelope not ok");
  check(data.project.key === project, `project.key mismatch: ${data.project.key}`);
  check(data.productContext?.source === "nexora", "productContext missing");
  const structure = data.productContext.structure;
  check(Array.isArray(structure.features), "structure.features missing");
  check(
    structure.features.length + structure.requirements.length + structure.userFlows.length > 0,
    "product structure is empty — Nexora `product` field not parsed",
  );
  check(!JSON.stringify(data).includes(proxyKey), "connect response leaked the proxy key");
  pass(
    `product parsed from \`product\`: ${structure.features.length} features, ` +
      `${structure.requirements.length} requirements, ${structure.userFlows.length} user flows`,
  );

  console.log("Design Context — POST /api/nexora/sync");
  const payload = {
    schema: "nexora.design-context",
    version: 1,
    generatedBy: "vinyasa http round-trip",
    sourceVersion: "1.0.0",
    sourceUrl: "https://vinyasa-roundtrip.example/",
    sourceTitle: "Vinyasa HTTP Round-trip",
    generatedAt: new Date().toISOString(),
    designSystem: {
      colors: [{ name: "brand", hex: "#2563eb", usage: 55 }],
      neutralColors: [{ name: "ink", hex: "#111827", usage: 40 }],
      fontFamilies: ['"Inter", sans-serif'],
      fontSizes: [{ raw: "16px", px: 16 }],
      spacing: [{ raw: "8px", px: 8 }],
      radius: [{ raw: "8px", px: 8 }],
    },
    health: { overall: 82 },
    accessibility: { critical: 0, warning: 2, pass: 8 },
    components: { total: 1, blocks: [{ id: "hero" }] },
    design: {
      pages: [{ url: "/", title: "Home", sections: [], layout: [], components: [] }],
      components: [],
      interactions: [],
      responsiveRules: [],
      layout: { containers: [], grid: { breakpoints: 0 }, navigation: [], sections: [] },
      visualLanguage: { colors: { primary: [], neutral: [] } },
      implementationHints: [],
      adaptation: { product_structure: structure },
    },
  };

  const anonSync = await fetch(`${base}/api/nexora/sync`, {
    method: "POST",
    headers: { ...sameOrigin, "content-type": "application/json" },
    body: JSON.stringify({ projectKey: project, payload }),
  });
  check(anonSync.status === 401, `anonymous sync returned ${anonSync.status}`);
  pass("anonymous sync → 401");

  const crossSite = await fetch(`${base}/api/nexora/sync`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-vinyasa-proxy-key": proxyKey,
      origin: "https://evil.test",
      "sec-fetch-site": "cross-site",
    },
    body: JSON.stringify({ projectKey: project, payload }),
  });
  check(crossSite.status === 403, `cross-site sync returned ${crossSite.status}`);
  pass("cross-site mutation → 403");

  const mismatch = await fetch(`${base}/api/nexora/sync`, {
    method: "POST",
    headers: { ...authed, "content-type": "application/json" },
    body: JSON.stringify({ projectKey: project, payload, sourceUrl: "https://spoofed.example/" }),
  });
  check(mismatch.status === 400, `sourceUrl mismatch returned ${mismatch.status}`);
  pass("sourceUrl mismatch → 400");

  const empty = await fetch(`${base}/api/nexora/sync`, {
    method: "POST",
    headers: { ...authed, "content-type": "application/json" },
    body: JSON.stringify({
      projectKey: project,
      payload: { schema: "nexora.design-context", designSystem: { colors: [], neutralColors: [], fontFamilies: [] } },
    }),
  });
  check(empty.status === 422, `empty payload returned ${empty.status}`);
  pass("payload without tokens → 422");

  const sync = await fetch(`${base}/api/nexora/sync`, {
    method: "POST",
    headers: { ...authed, "content-type": "application/json" },
    body: JSON.stringify({ projectKey: project, payload, sourceUrl: payload.sourceUrl }),
  });
  const syncBody = await sync.json();
  check(sync.status === 200, `sync returned ${sync.status}: ${JSON.stringify(syncBody)}`);
  check(syncBody.ok === true, `sync not ok: ${JSON.stringify(syncBody)}`);
  check(syncBody.sourceUrl === payload.sourceUrl, `sourceUrl echo mismatch: ${syncBody.sourceUrl}`);
  check(!JSON.stringify(syncBody).includes(proxyKey), "sync response leaked the proxy key");
  pass(`authenticated sync → 200, version ${syncBody.result.version}, sourceUrl from payload`);

  console.log("\nVinyasa HTTP round-trip verification PASSED");
}

main().catch((error) => {
  console.error(String(error.message ?? error));
  process.exit(1);
});
