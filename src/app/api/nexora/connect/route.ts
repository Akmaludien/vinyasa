import { NextRequest, NextResponse } from "next/server";
import {
  nexoraClient,
  NexoraError,
  type NexoraProject,
} from "@/lib/nexora-client";

export const runtime = "nodejs";

/**
 * Server-to-server connect endpoint. The integration token lives only in the
 * Nexora env and is injected here — the client only ever sends a project key.
 */
export async function GET(request: NextRequest) {
  const projectKey = request.nextUrl.searchParams.get("project") ?? "";
  if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(projectKey)) {
    return NextResponse.json(
      { ok: false, error: "Project key Nexora tidak valid." },
      { status: 400 },
    );
  }

  try {
    const project: NexoraProject = await nexoraClient.getProject(projectKey);
    return NextResponse.json({
      ok: true,
      project: {
        key: project.key,
        name: project.name,
        description: project.description,
        complexity: project.complexity,
        completeness: project.completeness,
      },
    });
  } catch (cause) {
    const err = cause instanceof NexoraError ? cause : new NexoraError("network", String((cause as Error)?.message ?? cause));
    const status =
      err.kind === "not_configured" || err.kind === "invalid_url"
        ? 503
        : err.kind === "unauthorized"
          ? 502
          : err.kind === "not_found"
            ? 404
            : 502;
    return NextResponse.json(
      { ok: false, error: err.message, kind: err.kind },
      { status },
    );
  }
}