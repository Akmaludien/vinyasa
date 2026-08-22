"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const builtin = PROVIDERS.find((p) => p.id === provider);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    // Stop the page behind the dialog from scrolling with it.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    const trigger = triggerRef.current;
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      // Send focus back to the chip that opened this, not to <body>.
      trigger?.focus();
    };
  }, [open]);

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

  const allProviders: Array<{ id: AiProviderId; label: string }> = [
    ...PROVIDERS.map((p) => ({ id: p.id, label: p.label })),
    { id: "custom", label: "Custom" },
  ];

  // Portalled to <body> on purpose. The trigger lives inside the app bar, and
  // that header carries backdrop-blur; a backdrop-filter makes an element the
  // containing block for its position:fixed descendants, so an inline dialog
  // would resolve "fixed inset-0" against the 56px header instead of the
  // viewport, leaving it clipped and its backdrop unclickable.
  return (
    <>
      <button
        ref={triggerRef}
        onClick={openModal}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={config ? "AI aktif, buka pengaturan AI" : "Atur AI"}
        className={`chip ${
          config ? "border-success-border bg-success-bg text-success" : ""
        }`}
      >
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${config ? "bg-success" : "bg-border-strong"}`}
          aria-hidden="true"
        />
        <span className="hidden sm:inline">{config ? "AI aktif" : "Atur AI"}</span>
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#0d1210]/55 p-4 backdrop-blur-sm sm:items-center"
            onClick={() => setOpen(false)}
          >
            {/* Column layout with its own scroll area: the form is taller than a short
                viewport, and a plain block would run off the bottom of the screen. */}
            <div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="ai-settings-title"
              tabIndex={-1}
              onClick={(e) => e.stopPropagation()}
              className="animate-fade-up my-auto flex max-h-[calc(100vh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-xl border border-border-strong bg-surface shadow-pop"
            >
              <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-3.5">
                <h3 id="ai-settings-title" className="text-md font-semibold text-fg">
                  Pengaturan AI
                </h3>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Tutup pengaturan AI"
                  className="btn btn-ghost btn-sm px-2"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                <div className="label mb-1.5">Provider</div>
                <div className="mb-4 grid grid-cols-4 gap-1.5">
                  {allProviders.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setProvider(p.id);
                        const info = PROVIDERS.find((x) => x.id === p.id);
                        setModel(info?.models[0] ?? "");
                      }}
                      aria-pressed={provider === p.id}
                      className={`rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
                        provider === p.id
                          ? "border-fg bg-fg text-canvas"
                          : "border-border text-muted hover:border-border-strong hover:text-fg"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {provider === "custom" && (
                  <>
                    <label htmlFor="ai-label" className="label mb-1.5">
                      Nama provider
                    </label>
                    <input
                      id="ai-label"
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      placeholder="My Custom AI"
                      className="field mb-4"
                    />
                    <label htmlFor="ai-base-url" className="label mb-1.5">
                      Base URL (OpenAI-compatible)
                    </label>
                    <input
                      id="ai-base-url"
                      value={baseUrl}
                      onChange={(e) => setBaseUrl(e.target.value)}
                      placeholder="https://api.example.com/v1"
                      className="field mb-4"
                    />
                  </>
                )}

                <label htmlFor="ai-model" className="label mb-1.5">
                  Model
                </label>
                {builtin ? (
                  <select
                    id="ai-model"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="field mb-4"
                  >
                    {builtin.models.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id="ai-model"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="model-name"
                    className="field mb-4"
                  />
                )}

                <label htmlFor="ai-key" className="label mb-1.5">
                  API key
                </label>
                <input
                  id="ai-key"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={builtin?.placeholder ?? "sk-... / api-key"}
                  className="field mb-2"
                />
                <p className="mb-4 text-xs text-faint">
                  Key hanya disimpan di localStorage browser Anda dan dikirim langsung ke{" "}
                  <span className="text-fg">
                    {provider === "custom"
                      ? label.trim() || "endpoint custom Anda"
                      : endpointName({ provider, model, apiKey })}
                  </span>{" "}
                  saat menekan tombol AI, tidak pernah menyentuh server kami.
                </p>

                <label className="flex items-center gap-2 text-sm text-muted">
                  <input
                    type="checkbox"
                    checked={autoSwitch}
                    onChange={(e) => setAutoSwitch(e.target.checked)}
                    className="accent-brand-500"
                  />
                  Auto-switch model saat rate limit (429)
                </label>

                {status && (
                  <p
                    role="status"
                    className={`mt-3 text-sm ${status.type === "ok" ? "text-success" : "text-danger"}`}
                  >
                    {status.msg}
                  </p>
                )}
              </div>

              <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-5 py-3.5">
                <button onClick={handleClear} className="btn btn-ghost">
                  Hapus key
                </button>
                <button
                  onClick={handleSave}
                  disabled={
                    busy || !apiKey.trim() || !model || (provider === "custom" && !baseUrl.trim())
                  }
                  className="btn btn-primary"
                >
                  {busy ? "Menguji..." : "Uji & Simpan"}
                </button>
              </footer>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
