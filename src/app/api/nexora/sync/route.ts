import { NextRequest, NextResponse } from "next/server";
import {
  nexoraClient,
  type DesignSyncResult,
} from "@/lib/nexora-client";
import { isCanonicalDesignContext } from "@/lib/validate-design-context";
import type { NexoraDesignContext } from "@/lib/nexora";
import { authorizeNexoraProxy, denialMessage } from "@/lib/nexora-route-security";

export const runtime = "nodejs";

const MAX_SYNC_BODY_BYTES = 2 * 1024 * 1024;

function isSafeSourceUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Server-to-server sync endpoint. The integration token lives only in the
 * Vinyasa server env and is injected by `nexoraClient`; the client sends the
 * project key, the bounded design-context payload, and the Vinyasa proxy
 * access key.
 *
 * `sourceUrl` has a single source of truth: `payload.sourceUrl`. A request-level
 * `sourceUrl` is accepted only when it agrees with the payload - a mismatch is
 * rejected rather than silently resolved.
 */
export async function POST(request: NextRequest) {
  const authz = authorizeNexoraProxy(request);
  if (!authz.ok) {
    return NextResponse.json({ ok: false, error: denialMessage(authz) }, { status: authz.status });
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_SYNC_BODY_BYTES) {
    return NextResponse.json(
      { ok: false, error: "Payload sync terlalu besar." },
      { status: 413 },
    );
  }
  let body: { projectKey?: unknown; payload?: unknown; sourceUrl?: unknown; source?: unknown };
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_SYNC_BODY_BYTES) {
      return NextResponse.json(
        { ok: false, error: "Payload sync terlalu besar." },
        { status: 413 },
      );
    }
    body = JSON.parse(raw) as typeof body;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Body JSON tidak valid." },
      { status: 400 },
    );
  }

  const projectKey = typeof body.projectKey === "string" ? body.projectKey : "";
  if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(projectKey)) {
    return NextResponse.json(
      { ok: false, error: "Project key Nexora tidak valid." },
      { status: 400 },
    );
  }

  if (!isCanonicalDesignContext(body.payload)) {
    return NextResponse.json(
      { ok: false, error: "Design context tidak lolos validasi schema." },
      { status: 422 },
    );
  }

  const payload = body.payload as NexoraDesignContext;
  if (!isSafeSourceUrl(payload.sourceUrl)) {
    return NextResponse.json(
      { ok: false, error: "payload.sourceUrl harus berupa URL http/https yang valid." },
      { status: 422 },
    );
  }
  // Canonical: the payload owns sourceUrl. A request-level value may only
  // confirm it.
  if (typeof body.sourceUrl === "string" && body.sourceUrl && body.sourceUrl !== payload.sourceUrl) {
    return NextResponse.json(
      { ok: false, error: "sourceUrl request tidak cocok dengan payload.sourceUrl." },
      { status: 400 },
    );
  }
  const sourceUrl = payload.sourceUrl;
  const source = body.source === "MANUAL" ? "MANUAL" : "VINYASA";

  const result: DesignSyncResult = await nexoraClient.updateDesignContext(
    projectKey,
    payload,
    source,
  );

  if (!result.ok) {
    const status = result.errorKind === "invalid_url" ? 400 : result.errorKind === "malformed" ? 422 : 502;
    return NextResponse.json(
      { ok: false, error: result.error ?? "Sync ke Nexora gagal.", kind: result.errorKind },
      { status },
    );
  }

  return NextResponse.json({
    ok: true,
    result: {
      artifactKey: result.artifactKey,
      version: result.version,
      checksum: result.checksum,
      synchronizedAt: result.synchronizedAt,
    },
    sourceUrl,
  });
}
