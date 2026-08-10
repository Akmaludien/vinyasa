/**
 * Client-side Nexora connection state. Persists only the connected project key
 * (never the integration token — that stays in the server env) to localStorage.
 */

export type NexoraSyncStatus =
  | "not_connected"
  | "connected"
  | "syncing"
  | "synced"
  | "pending"
  | "error";

export interface NexoraConnection {
  status: NexoraSyncStatus;
  /** Connected Nexora project key (client projection — never a token). */
  projectKey: string | null;
  projectName?: string;
  /** Highest Nexora artifact version known to this client. */
  version?: number;
  /** ISO timestamp of the last successful sync. */
  lastSyncedAt?: string;
  /** Error detail surfaced only on status === "error". */
  error?: string;
}

const STORAGE_KEY = "vinyasa-nexora-connection";

const VALID_KEY = /^[a-z0-9][a-z0-9-]{1,39}$/;

export function isValidProjectKey(key: string): boolean {
  return VALID_KEY.test(key);
}

export function emptyConnection(): NexoraConnection {
  return { status: "not_connected", projectKey: null };
}

function safeRead(): NexoraConnection {
  if (typeof window === "undefined") return emptyConnection();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyConnection();
    const parsed = JSON.parse(raw) as Partial<NexoraConnection>;
    const status: NexoraSyncStatus =
      parsed.status && ["not_connected", "connected", "syncing", "synced", "pending", "error"].includes(parsed.status)
        ? parsed.status
        : "not_connected";
    return {
      status,
      projectKey: typeof parsed.projectKey === "string" && isValidProjectKey(parsed.projectKey) ? parsed.projectKey : null,
      projectName: typeof parsed.projectName === "string" ? parsed.projectName : undefined,
      version: typeof parsed.version === "number" ? parsed.version : undefined,
      lastSyncedAt: typeof parsed.lastSyncedAt === "string" ? parsed.lastSyncedAt : undefined,
      error: typeof parsed.error === "string" ? parsed.error : undefined,
    };
  } catch {
    return emptyConnection();
  }
}

function safeWrite(conn: NexoraConnection): void {
  if (typeof window === "undefined") return;
  // Only ever persist the client projection — never a token.
  const projection: NexoraConnection = {
    status: conn.status,
    projectKey: conn.projectKey,
    projectName: conn.projectName,
    version: conn.version,
    lastSyncedAt: conn.lastSyncedAt,
    error: conn.error,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projection));
  } catch {
    // Storage unavailable (private mode / quota) — fail soft.
  }
}

export function loadNexoraConnection(): NexoraConnection {
  return safeRead();
}

export function connectToNexora(key: string, projectName?: string): NexoraConnection {
  const next: NexoraConnection = {
    status: isValidProjectKey(key) ? "connected" : "error",
    projectKey: isValidProjectKey(key) ? key : null,
    projectName: projectName || undefined,
    error: isValidProjectKey(key) ? undefined : "Project key tidak valid.",
  };
  safeWrite(next);
  return next;
}

export function setNexoraSyncing(conn: NexoraConnection): NexoraConnection {
  const next: NexoraConnection = {
    ...conn,
    status: "syncing",
    error: undefined,
  };
  safeWrite(next);
  return next;
}

export function completeNexoraSync(
  conn: NexoraConnection,
  result: { version?: number; synchronizedAt?: string },
): NexoraConnection {
  const next: NexoraConnection = {
    ...conn,
    status: "synced",
    version: result.version ?? conn.version,
    lastSyncedAt: result.synchronizedAt ?? new Date().toISOString(),
    error: undefined,
  };
  safeWrite(next);
  return next;
}

export function recordNexoraError(conn: NexoraConnection, message: string): NexoraConnection {
  const next: NexoraConnection = {
    ...conn,
    status: conn.projectKey ? "error" : "not_connected",
    error: message,
  };
  safeWrite(next);
  return next;
}

export function disconnectNexora(): NexoraConnection {
  safeWrite(emptyConnection());
  return emptyConnection();
}