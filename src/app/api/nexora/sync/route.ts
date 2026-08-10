import { NextRequest, NextResponse } from "next/server";
import {
  nexoraClient,
  type DesignSyncResult,
} from "@/lib/nexora-client";
import { isCanonicalDesignContext } from "@/lib/validate-design-context";
import type { NexoraDesignContext } from "@/lib/nexora";

export const runtime = "nodejs";

/**
 * Server-to-server sync endpoint. The integration token lives only in the
 * Nexora env and is injected here; the client only sends the project key and
 * the bounded design-context payload.
 */
export async function POST(request: NextRequest) {
  let body: { projectKey?: unknown; payload?: unknown; sourceUrl?: unknown; source?: unknown };
  try {
    body = await request.json();
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
  const sourceUrl = typeof body.sourceUrl === "string" && body.sourceUrl ? body.sourceUrl : payload.sourceUrl;
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