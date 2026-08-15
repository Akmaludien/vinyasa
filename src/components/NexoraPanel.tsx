"use client";

import { useMemo, useState } from "react";
import type { DesignModel } from "@/lib/model";
import { buildNexoraDesignContext } from "@/lib/nexora";
import { adaptDesign } from "@/lib/adapt";
import { buildDesignSpecification } from "@/lib/spec";
import type { NexoraProductContext } from "@/lib/nexora-product-context";
import {
  loadNexoraConnection,
  connectToNexora,
  setNexoraSyncing,
  completeNexoraSync,
  recordNexoraError,
  disconnectNexora,
  type NexoraConnection,
} from "@/lib/nexora-connection";

interface ProjectInfo {
  key: string;
  name: string;
  description?: string;
  complexity?: string;
  completeness?: number;
}

type ConnectResult = { ok: boolean; project?: ProjectInfo; productContext?: NexoraProductContext; error?: string };
type SyncResult = {
  ok: boolean;
  result?: { version?: number; synchronizedAt?: string };
  error?: string;
  kind?: string;
};

function statusBadge(conn: NexoraConnection): { label: string; className: string } {
  switch (conn.status) {
    case "connected":
      return { label: "Terhubung", className: "border-emerald-800 bg-emerald-950/40 text-emerald-300" };
    case "syncing":
      return { label: "Menyinkronkan…", className: "border-amber-700 bg-amber-950/40 text-amber-300" };
    case "synced":
      return { label: "Tersinkron", className: "border-emerald-800 bg-emerald-950/40 text-emerald-300" };
    case "pending":
      return { label: "Menunggu", className: "border-zinc-700 bg-zinc-900 text-zinc-400" };
    case "error":
      return { label: "Galat", className: "border-red-800 bg-red-950/40 text-red-300" };
    default:
      return { label: "Belum terhubung", className: "border-zinc-700 bg-zinc-900 text-zinc-400" };
  }
}

export function NexoraPanel({ result }: { result: DesignModel }) {
  const [conn, setConn] = useState<NexoraConnection>(() => loadNexoraConnection());
  const [keyInput, setKeyInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [project, setProject] = useState<ProjectInfo | null>(() => {
    const c = loadNexoraConnection();
    return c.projectKey
      ? { key: c.projectKey, name: c.projectName ?? c.projectKey } satisfies ProjectInfo
      : null;
  });
  const [fetchingProject, setFetchingProject] = useState(false);
  const [productError, setProductError] = useState("");
  const [productContext, setProductContext] = useState<NexoraProductContext | null>(null);
  // Vinyasa proxy access key. Held in component state only — never persisted to
  // localStorage and never sent anywhere but the same-origin proxy routes.
  const [proxyKey, setProxyKey] = useState("");

  const proxyHeaders = useMemo(
    () => ({ "x-vinyasa-proxy-key": proxyKey }),
    [proxyKey],
  );

  const syncPayload = useMemo(() => {
    try {
      const spec = buildDesignSpecification(result);
      const adaptation = productContext ? adaptDesign(spec, productContext) : undefined;
      return buildNexoraDesignContext(result, spec, adaptation);
    } catch {
      return null;
    }
  }, [productContext, result]);

  function flash(text: string) {
    setMsg(text);
    setTimeout(() => setMsg(""), 4000);
  }

  async function fetchProjectInfo(key: string) {
    setFetchingProject(true);
    setProductError("");
    try {
      const res = await fetch(`/api/nexora/connect?project=${encodeURIComponent(key)}`, {
        headers: proxyHeaders,
      });
      const data: ConnectResult = await res.json();
      if (data.ok && data.project) {
        setProject(data.project);
        setProductContext(data.productContext ?? null);
      } else {
        setProductError(data.error ?? "Tidak dapat mengambil proyek Nexora.");
        setProject(null);
        setProductContext(null);
      }
    } catch {
      setProductError("Gagal terhubung ke server Nexora.");
      setProject(null);
      setProductContext(null);
    } finally {
      setFetchingProject(false);
    }
  }

  async function handleConnect() {
    const key = keyInput.trim();
    if (!key) {
      flash("Masukkan project key Nexora dulu.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/nexora/connect?project=${encodeURIComponent(key)}`, {
        headers: proxyHeaders,
      });
      const data: ConnectResult = await res.json();
      if (data.ok && data.project) {
        const next = connectToNexora(key, data.project.name);
        setConn(next);
        setProject(data.project);
        setProductContext(data.productContext ?? null);
        flash(`Terhubung ke proyek "${data.project.name}".`);
        setKeyInput("");
      } else {
        setConn(recordNexoraError(conn, data.error ?? "Gagal terhubung."));
        flash(data.error ?? "Gagal terhubung ke Nexora.");
      }
    } catch {
      setConn(recordNexoraError(conn, "Gagal terhubung ke server Nexora."));
      flash("Gagal terhubung ke server Nexora.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSync() {
    if (!conn.projectKey || !syncPayload) {
      flash("Hubungkan proyek Nexora dan pastikan design tersedia.");
      return;
    }
    setBusy(true);
    const syncing = setNexoraSyncing(conn);
    setConn(syncing);
    setProductError("");
    try {
      const res = await fetch("/api/nexora/sync", {
        method: "POST",
        headers: { "content-type": "application/json", ...proxyHeaders },
        body: JSON.stringify({
          projectKey: conn.projectKey,
          payload: syncPayload,
          sourceUrl: syncPayload.sourceUrl,
          source: "VINYASA",
        }),
      });
      const data: SyncResult = await res.json();
      if (data.ok && data.result) {
        const next = completeNexoraSync(syncing, {
          version: data.result.version,
          synchronizedAt: data.result.synchronizedAt,
        });
        setConn(next);
        flash(
          data.result.version !== undefined
            ? `Tersinkron — versi ${data.result.version}.`
            : "Tersinkron ke Nexora.",
        );
      } else {
        const next = recordNexoraError(syncing, data.error ?? "Sync gagal.");
        setConn(next);
        setProductError(data.error ?? "Sync gagal.");
        flash(data.error ?? "Sync gagal ke Nexora.");
      }
    } catch {
      const next = recordNexoraError(syncing, "Gagal menghubungi server Nexora.");
      setConn(next);
      flash("Gagal menghubungi server Nexora.");
    } finally {
      setBusy(false);
    }
  }

  function handleDisconnect() {
    setConn(disconnectNexora());
    setProject(null);
    setProductContext(null);
    setProductError("");
    flash("Terputus dari Nexora.");
  }

  const badge = statusBadge(conn);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Nexora Integration</h2>
          <p className="text-sm text-zinc-500">
            Hubungkan proyek, baca konteks produk, dan sinkronkan design system ke Nexora.
          </p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-medium ${badge.className}`}>
          {badge.label}
        </span>
      </div>

      <div className="rounded-xl border border-zinc-800 p-4">
        <label
          htmlFor="vinyasa-proxy-key"
          className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500"
        >
          Vinyasa proxy access key
        </label>
        <input
          id="vinyasa-proxy-key"
          type="password"
          autoComplete="off"
          value={proxyKey}
          onChange={(e) => setProxyKey(e.target.value)}
          placeholder="VINYASA_PROXY_KEY"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none placeholder:text-zinc-600 focus:border-brand-500"
        />
        <p className="mt-2 text-[11px] text-zinc-500">
          Wajib untuk semua panggilan proxy Nexora. Hanya disimpan di memori sesi ini.
        </p>
      </div>

      {conn.projectKey ? (
        <div className="rounded-xl border border-zinc-800 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-zinc-200">
                {project?.name ?? conn.projectName ?? conn.projectKey}
              </div>
              <div className="truncate font-mono text-[11px] text-zinc-500">{conn.projectKey}</div>
              {conn.version !== undefined && (
                <div className="mt-1 text-[11px] text-zinc-500">Versi desain: {conn.version}</div>
              )}
              {conn.lastSyncedAt && (
                <div className="text-[11px] text-zinc-600">
                  Terakhir sinkron: {new Date(conn.lastSyncedAt).toLocaleString("id-ID")}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (conn.projectKey) void fetchProjectInfo(conn.projectKey);
                }}
                disabled={busy || fetchingProject}
                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:border-zinc-500 disabled:opacity-50"
              >
                {fetchingProject ? "Memuat…" : "Muat konteks"}
              </button>
              <button
                onClick={handleDisconnect}
                disabled={busy}
                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:border-zinc-500 disabled:opacity-50"
              >
                Putus
              </button>
              <button
                onClick={handleSync}
                disabled={busy || !syncPayload}
                className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-400 disabled:opacity-50"
              >
                {busy ? "Menyinkron…" : "Sync Design ke Nexora"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 p-4">
          <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500">
            Project key Nexora
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleConnect();
              }}
              placeholder="mis. e-commerce-api"
              className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none placeholder:text-zinc-600 focus:border-brand-500"
            />
            <button
              onClick={handleConnect}
              disabled={busy}
              className="rounded-lg bg-brand-500 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-400 disabled:opacity-50"
            >
              {busy ? "Menghubungkan…" : "Connect"}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-zinc-500">
            Key adalah slug proyek di Nexora (mis. <code className="text-zinc-400">e-commerce-api</code>).
          </p>
        </div>
      )}

      {fetchingProject && <p className="text-xs text-zinc-500">Memuat konteks produk…</p>}

      {project && (
        <div className="rounded-xl border border-zinc-800 p-4">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
            Konteks produk
          </div>
          <p className="text-sm text-zinc-300">{project.description || "Tidak ada deskripsi."}</p>
          <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
            <div className="rounded-lg border border-zinc-800 px-3 py-2">
              <span className="text-zinc-500">Kompleksitas: </span>
              <span className="text-zinc-200">{project.complexity || "—"}</span>
            </div>
            <div className="rounded-lg border border-zinc-800 px-3 py-2">
              <span className="text-zinc-500">Kelengkapan: </span>
              <span className="text-zinc-200">
                {project.completeness !== undefined ? `${project.completeness}%` : "—"}
              </span>
            </div>
          </div>
        </div>
      )}

      {productError && (
        <p className="rounded-lg border border-red-900/40 bg-red-950/20 px-3 py-2 text-xs text-red-300">
          {productError}
        </p>
      )}

      {msg && <p className="text-xs text-emerald-400">{msg}</p>}
      <p className="text-[11px] text-zinc-600">
        Token integrasi hanya berada di server Vinyasa; browser hanya mengirim project key dan payload desain.
      </p>
    </div>
  );
}
