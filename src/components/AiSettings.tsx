"use client";

import { useState } from "react";
import { type AiConfig, PROVIDERS, saveConfig, clearConfig, testConnection } from "@/lib/ai";

export function AiSettingsButton({
  config,
  onChange,
}: {
  config: AiConfig | null;
  onChange: (c: AiConfig | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<AiConfig["provider"]>(config?.provider ?? "openai");
  const [model, setModel] = useState(config?.model ?? "");
  const [apiKey, setApiKey] = useState(config?.apiKey ?? "");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  const pInfo = PROVIDERS.find((p) => p.id === provider) ?? PROVIDERS[0];

  function openModal() {
    const startProvider = config?.provider ?? "openai";
    const startInfo = PROVIDERS.find((p) => p.id === startProvider) ?? PROVIDERS[0];
    setProvider(startProvider);
    setModel(config?.model ?? startInfo.models[0]);
    setApiKey(config?.apiKey ?? "");
    setStatus(null);
    setOpen(true);
  }

  async function handleSave() {
    setBusy(true);
    setStatus(null);
    try {
      const next: AiConfig = { provider, model, apiKey: apiKey.trim() };
      await testConnection(next);
      saveConfig(next);
      onChange(next);
      setStatus({ type: "ok", msg: "Koneksi berhasil, konfigurasi disimpan di browser." });
    } catch (e) {
      setStatus({
        type: "err",
        msg: e instanceof Error ? e.message : "Gagal menguji koneksi.",
      });
    } finally {
      setBusy(false);
    }
  }

  function handleClear() {
    clearConfig();
    onChange(null);
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        onClick={openModal}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
          config
            ? "border-emerald-700 bg-emerald-950/40 text-emerald-300"
            : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
        }`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${config ? "bg-emerald-400" : "bg-zinc-600"}`} />
        {config ? "AI aktif" : "Atur AI"}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setOpen(false)}>
      <div
        className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold">Pengaturan AI</h3>
          <button onClick={() => setOpen(false)} className="text-zinc-500 hover:text-zinc-200">
            ✕
          </button>
        </div>

        <label className="mb-1 block text-xs text-zinc-400">Provider</label>
        <div className="mb-3 grid grid-cols-3 gap-2">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setProvider(p.id);
                setModel(p.models[0]);
              }}
              className={`rounded-lg border px-2 py-2 text-xs transition-colors ${
                provider === p.id
                  ? "border-zinc-400 bg-zinc-700 text-white"
                  : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <label className="mb-1 block text-xs text-zinc-400">Model</label>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="mb-3 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-500"
        >
          {pInfo.models.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>

        <label className="mb-1 block text-xs text-zinc-400">API key</label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={pInfo.placeholder}
          className="mb-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none placeholder:text-zinc-600 focus:border-zinc-500"
        />
        <p className="mb-4 text-[11px] leading-4 text-zinc-500">
          Key hanya disimpan di localStorage browser Anda dan dikirim langsung ke{" "}
          {pInfo.label} saat menekan tombol AI — tidak pernah menyentuh server kami.
        </p>

        {status && (
          <p
            className={`mb-3 text-xs ${
              status.type === "ok" ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {status.msg}
          </p>
        )}

        <div className="flex items-center justify-between gap-2">
          <button
            onClick={handleClear}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-400 hover:border-zinc-500"
          >
            Hapus key
          </button>
          <button
            onClick={handleSave}
            disabled={busy || !apiKey.trim() || !model}
            className="rounded-lg bg-zinc-100 px-4 py-2 text-xs font-semibold text-zinc-900 hover:bg-white disabled:opacity-50"
          >
            {busy ? "Menguji…" : "Uji & Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}