import { NextRequest, NextResponse } from "next/server";
import {
  nexoraClient,
  NexoraError,
} from "@/lib/nexora-client";
import { authorizeNexoraProxy, denialMessage } from "@/lib/nexora-route-security";

export const runtime = "nodejs";

/**
 * Server-side proxy for reading a Nexora project + its Product Context. The
 * integration token lives only in the Vinyasa server env and is injected by
 * `nexoraClient` — the client only ever sends a project key plus the Vinyasa
 * proxy access key. This route exposes Product Context, so it is protected.
 */
export async function GET(request: NextRequest) {
  const authz = authorizeNexoraProxy(request);
  if (!authz.ok) {
    return NextResponse.json({ ok: false, error: denialMessage(authz) }, { status: authz.status });
  }
  const projectKey = request.nextUrl.searchParams.get("project") ?? "";
  if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(projectKey)) {
    return NextResponse.json(
      { ok: false, error: "Project key Nexora tidak valid." },
      { status: 400 },
    );
  }

  try {
    const productContext = await nexoraClient.getProjectContext(projectKey);
    return NextResponse.json({
      ok: true,
      project: {
        key: productContext.projectKey,
        name: productContext.projectName,
        description: productContext.description ?? "",
        complexity: productContext.complexity ?? "",
        completeness: productContext.completeness ?? 0,
      },
      productContext,
    });
  } catch (cause) {
    const err = cause instanceof NexoraError ? cause : new NexoraError("network", String((cause as Error)?.message ?? cause));
    const status =
      err.kind === "not_found" ? 404
      : err.kind === "unauthorized" ? 502
      : err.kind === "not_configured" || err.kind === "invalid_url" ? 503
      : err.kind === "timeout" ? 504
      : 502;
    return NextResponse.json(
      { ok: false, error: err.message, kind: err.kind },
      { status },
    );
  }
}
