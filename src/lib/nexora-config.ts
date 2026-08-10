/**
 * Environment-driven Nexora integration configuration.
 *
 * Vinyasa connects to a running Nexora instance over HTTP. No filesystem or
 * absolute Windows paths are used at runtime. In local development point
 * NEXORA_BASE_URL at the locally running Nexora; in production point it at a
 * secure, network-reachable Nexora endpoint.
 */
export interface NexoraConfig {
  /** Base URL of the Nexora instance, e.g. http://localhost:3000 */
  baseUrl: string;
  /** Optional shared secret sent as Bearer for server-to-server calls. */
  apiToken?: string;
  /** Read/write timeouts in milliseconds. */
  timeoutMs: number;
  /** Whether a Nexora integration is available at all. */
  enabled: boolean;
}

const DEFAULT_TIMEOUT_MS = 15_000;

function trim(url: string | undefined): string {
  return url?.trim().replace(/\/+$/, "") ?? "";
}

export function getNexoraConfig(): NexoraConfig {
  const baseUrl = trim(process.env.NEXORA_BASE_URL || process.env.NEXORA_API_URL);
  const apiToken = (process.env.NEXORA_INTEGRATION_TOKEN || "").trim();

  return {
    baseUrl,
    apiToken: apiToken || undefined,
    timeoutMs: Number(process.env.NEXORA_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
    enabled: Boolean(baseUrl),
  };
}

/**
 * Validates that a stored base URL is an http/https URL (SSRF guard). The
 * integration should never fetch arbitrary user-supplied filesystem paths.
 */
export function isSafeBaseUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}