import "server-only";
import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { getNexoraConfig } from "./nexora-config";

/**
 * Caller authorisation for the Vinyasa → Nexora proxy routes.
 *
 * Two independent gates, both required:
 *
 * 1. Caller authentication — the caller must present the Vinyasa proxy access
 *    key (`x-vinyasa-proxy-key`) which is compared, in constant time, against
 *    `VINYASA_PROXY_KEY` in the server env. Vinyasa has no user/identity
 *    system, so this shared secret *is* the session credential: the operator
 *    enters it in the Nexora panel and it is held in component state only —
 *    never persisted, never bundled, never logged. Fails closed: when
 *    `VINYASA_PROXY_KEY` is unset every proxy call is denied.
 * 2. CSRF / origin — cross-site requests are rejected, and any request that
 *    carries an `Origin` must match the app's own origin.
 *
 * The Nexora integration token (`NEXORA_INTEGRATION_TOKEN`) is never involved
 * in caller authentication; it is only attached server-side by `nexoraClient`.
 */
export type NexoraProxyDenial =
  | { ok: false; status: 401; reason: "unauthenticated" }
  | { ok: false; status: 403; reason: "cross_origin" }
  | { ok: false; status: 503; reason: "not_configured" };

export type NexoraProxyAuthz = { ok: true } | NexoraProxyDenial;

const PROXY_KEY_HEADER = "x-vinyasa-proxy-key";

function constantTimeEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function sameOrigin(request: NextRequest): boolean {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;

  // Compare hosts, not full origins: `request.nextUrl.origin` is normalised by
  // Next (it can report `localhost` for a request served on 127.0.0.1), so
  // origin-string equality produces false 403s. The Host header is what the
  // browser actually addressed, which is what an Origin must match.
  const host = request.headers.get("host");
  const expected = host || request.nextUrl.host;

  const hostOf = (value: string): string | null => {
    try {
      return new URL(value).host;
    } catch {
      return null;
    }
  };

  const origin = request.headers.get("origin");
  if (origin) return hostOf(origin) === expected;

  // No Origin header (same-origin GET / non-browser server call): fall back to
  // Referer when present so a cross-site referer cannot slip through.
  const referer = request.headers.get("referer");
  if (!referer) return true;
  return hostOf(referer) === expected;
}

export function authorizeNexoraProxy(request: NextRequest): NexoraProxyAuthz {
  if (!getNexoraConfig().apiToken) return { ok: false, status: 503, reason: "not_configured" };

  const expected = (process.env.VINYASA_PROXY_KEY || "").trim();
  if (!expected) return { ok: false, status: 503, reason: "not_configured" };

  const presented = (request.headers.get(PROXY_KEY_HEADER) || "").trim();
  if (!presented || !constantTimeEquals(presented, expected)) {
    return { ok: false, status: 401, reason: "unauthenticated" };
  }

  if (!sameOrigin(request)) return { ok: false, status: 403, reason: "cross_origin" };

  return { ok: true };
}

/** Client-safe denial message. Never echoes any credential or token value. */
export function denialMessage(denial: NexoraProxyDenial): string {
  switch (denial.reason) {
    case "unauthenticated":
      return "Akses proxy Nexora memerlukan proxy access key yang valid.";
    case "cross_origin":
      return "Permintaan lintas origin ditolak.";
    case "not_configured":
      return "Integrasi Nexora belum dikonfigurasi di server.";
  }
}
