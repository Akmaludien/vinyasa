"use client";

import { useState } from "react";
import {
  type AiConfig,
  type AiProviderId,
  PROVIDERS,
  saveConfig,
  clearConfig,
  testConnection,
  endpointName,
} from "@/lib/ai";

export function AiSettingsButton({
  config,
  onChange,
}: {
  config: AiConfig | null;
  onChange: (c: AiConfig | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<AiProviderId>(config?.provider ?? "openai");
  const [model, setModel] = useState(config?.model ?? "");
  const [apiKey, setApiKey] = useState(config?.apiKey ?? "");
  const [label, setLabel] = useState(config?.label ?? "");
  const [baseUrl, setBaseUrl] = useState(config?.baseUrl ?? "");
  const [autoSwitch, setAutoSwitch] = useState(config?.autoSwitch ?? false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  const builtin = PROVIDERS.find((p) => p.id === provider);

  function openModal() {
    const startProvider = config?.provider ?? "openai";
    const startInfo = PROVIDERS.find((p) => p.id === startProvider);
    setProvider(startProvider);
    setModel(config?.model ?? (startInfo?.models[0] ?? ""));
    setApiKey(config?.apiKey ?? "");
    setLabel(config?.label ?? "");
    setBaseUrl(config?.baseUrl ?? "");
    setAutoSwitch(config?.autoSwitch ?? false);
    setStatus(null);
    setOpen(true);
  }

  async function handleSave() {
    setBusy(true);
    setStatus(null);
    try {
      const next: AiConfig = {
        provider,
        model,
        apiKey: apiKey.trim(),
        autoSwitch,
        ...(provider === "custom" ? { label: label.trim() || undefined, baseUrl: baseUrl.trim() || undefined } : {}),
      };
      await testConnection(next);
      saveConfig(next);
      onChange(next);
      setStatus({ type: "ok", msg: `Koneksi berhasil, konfigurasi disimpan di browser.` });
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

  const allProviders: Array<{ id: AiProviderId; label: string }> = [
    ...PROVIDERS.map((p) => ({ id: p.id, label: p.label })),
    { id: "custom", label: "Custom" },
  ];

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
        <div className="mb-3 grid grid-cols-4 gap-2">
          {allProviders.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setProvider(p.id);
                const info = PROVIDERS.find((x) => x.id === p.id);
                setModel(info?.models[0] ?? "");
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

        {provider === "custom" && (
          <>
            <label className="mb-1 block text-xs text-zinc-400">Nama provider</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="My Custom AI"
              className="mb-3 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none placeholder:text-zinc-600 focus:border-zinc-500"
            />
            <label className="mb-1 block text-xs text-zinc-400">Base URL (OpenAI-compatible)</label>
            <input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.example.com/v1"
              className="mb-3 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none placeholder:text-zinc-600 focus:border-zinc-500"
            />
          </>
        )}

        <label className="mb-1 block text-xs text-zinc-400">Model</label>
        {builtin ? (
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="mb-3 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-500"
          >
            {builtin.models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        ) : (
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="model-name"
            className="mb-3 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none placeholder:text-zinc-600 focus:border-zinc-500"
          />
        )}

        <label className="mb-1 block text-xs text-zinc-400">API key</label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={builtin?.placeholder ?? "sk-... / api-key"}
          className="mb-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none placeholder:text-zinc-600 focus:border-zinc-500"
        />
        <p className="mb-3 text-[11px] leading-4 text-zinc-500">
          Key hanya disimpan di localStorage browser Anda dan dikirim langsung ke{" "}
          <span className="text-zinc-300">
            {provider === "custom" ? (label.trim() || "endpoint custom Anda") : endpointName({ provider, model, apiKey })}
          </span>{" "}
          saat menekan tombol AI — tidak pernah menyentuh server kami.
        </p>

        <label className="mb-4 flex items-center gap-2 text-xs text-zinc-400">
          <input
            type="checkbox"
            checked={autoSwitch}
            onChange={(e) => setAutoSwitch(e.target.checked)}
            className="accent-zinc-200"
          />
          Auto-switch model saat rate limit (429)
        </label>

        {status && (
          <p className={`mb-3 text-xs ${status.type === "ok" ? "text-emerald-400" : "text-red-400"}`}>
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
            disabled={busy || !apiKey.trim() || !model || (provider === "custom" && !baseUrl.trim())}
            className="rounded-lg bg-zinc-100 px-4 py-2 text-xs font-semibold text-zinc-900 hover:bg-white disabled:opacity-50"
          >
            {busy ? "Menguji…" : "Uji & Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}