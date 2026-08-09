"use client";

import { useState } from "react";

export type AiProviderId = "openai" | "gemini" | "claude" | "custom";

export interface AiConfig {
  provider: AiProviderId;
  model: string;
  apiKey: string;
  label?: string;
  baseUrl?: string;
  autoSwitch?: boolean;
}

export interface BuiltinProviderDef {
  id: Extract<AiProviderId, "openai" | "gemini" | "claude">;
  label: string;
  placeholder: string;
  models: string[];
  endpoint: (model: string) => string;
}

const STORAGE_KEY = "vinyasa-ai-config";

export const PROVIDERS: BuiltinProviderDef[] = [
  {
    id: "openai",
    label: "OpenAI",
    placeholder: "sk-...",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini"],
    endpoint: () => "https://api.openai.com/v1/chat/completions",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    placeholder: "AIza...",
    models: ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-2.5-flash"],
    endpoint: (model) =>
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${""}`,
  },
  {
    id: "claude",
    label: "Anthropic Claude",
    placeholder: "sk-ant-...",
    models: ["claude-3-5-haiku-latest", "claude-3-5-sonnet-latest", "claude-3-7-sonnet-latest"],
    endpoint: () => "https://api.anthropic.com/v1/messages",
  },
];

export function providerLabel(cfg: AiConfig): string {
  if (cfg.provider === "custom") return cfg.label ?? "Custom";
  return PROVIDERS.find((p) => p.id === cfg.provider)?.label ?? cfg.provider;
}

export function endpointName(cfg: AiConfig): string {
  if (cfg.provider === "custom") return cfg.baseUrl ?? "custom endpoint";
  return PROVIDERS.find((p) => p.id === cfg.provider)?.label ?? "provider";
}

export function loadConfig(): AiConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AiConfig;
    if (!parsed.apiKey) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveConfig(cfg: AiConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

export function clearConfig() {
  localStorage.removeItem(STORAGE_KEY);
}

export interface AiError extends Error {
  status?: number;
  retryable?: boolean;
}

function aiError(status: number, message: string, retryable = false): AiError {
  const err = new Error(message) as AiError;
  err.status = status;
  err.retryable = retryable;
  return err;
}

function isRateLimited(err: AiError): boolean {
  return [429, 500, 502, 503, 504].includes(err.status ?? 0) || err.retryable === true;
}

function providerTimeout(): AbortController {
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), 60000);
  return ctrl;
}

async function callOpenAi(cfg: AiConfig, prompt: string, system: string): Promise<string> {
  const ctrl = providerTimeout();
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${cfg.apiKey}` },
    signal: ctrl.signal,
    body: JSON.stringify({
      model: cfg.model,
      messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw aiError(res.status, data.error?.message ?? `OpenAI error ${res.status}`, res.status === 429);
  }
  return data.choices?.[0]?.message?.content ?? "";
}

async function callGemini(cfg: AiConfig, prompt: string, system: string): Promise<string> {
  const ctrl = providerTimeout();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal: ctrl.signal,
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw aiError(res.status, data.error?.message ?? `Gemini error ${res.status}`, res.status === 429);
  }
  return (
    data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? ""
  );
}

async function callClaude(cfg: AiConfig, prompt: string, system: string): Promise<string> {
  const ctrl = providerTimeout();
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": cfg.apiKey,
      "anthropic-version": "2023-06-01",
    },
    signal: ctrl.signal,
    body: JSON.stringify({ model: cfg.model, max_tokens: 4096, system, messages: [{ role: "user", content: prompt }] }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw aiError(res.status, data.error?.message ?? `Claude error ${res.status}`, res.status === 429);
  }
  return (
    data.content?.filter((b: { type: string }) => b.type === "text").map((b: { text?: string }) => b.text ?? "").join("") ?? ""
  );
}

async function callCustom(cfg: AiConfig, prompt: string, system: string): Promise<string> {
  const base = cfg.baseUrl?.trim() || "https://api.openai.com/v1/chat/completions";
  const url = base.endsWith("/chat/completions") || base.includes("/chat/completions")
    ? base
    : `${base.replace(/\/$/, "")}/chat/completions`;
  const ctrl = providerTimeout();
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${cfg.apiKey}` },
    signal: ctrl.signal,
    body: JSON.stringify({
      model: cfg.model,
      messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw aiError(
      res.status,
      data.error?.message ?? data.message ?? `Custom endpoint error ${res.status}`,
      res.status === 429,
    );
  }
  if (data.choices?.[0]?.message?.content) return data.choices[0].message.content;
  if (data.content) return String(data.content);
  if (data.data?.content) return String(data.data.content);
  return "";
}

function singleCall(cfg: AiConfig, prompt: string, system?: string): Promise<string> {
  const sys = system ?? "Kamu adalah asisten desain sistem yang ringkas dan akurat, merespons dalam Bahasa Indonesia.";
  switch (cfg.provider) {
    case "openai":
      return callOpenAi(cfg, prompt, sys);
    case "gemini":
      return callGemini(cfg, prompt, sys);
    case "claude":
      return callClaude(cfg, prompt, sys);
    case "custom":
      return callCustom(cfg, prompt, sys);
    default:
      return callOpenAi(cfg, prompt, sys);
  }
}

export async function callAi(cfg: AiConfig, prompt: string, system?: string): Promise<string> {
  const sys = system ?? "Kamu adalah asisten desain sistem yang ringkas dan akurat, merespons dalam Bahasa Indonesia.";
  return singleCall(cfg, prompt, sys);
}

export async function streamAi(
  cfg: AiConfig,
  prompt: string,
  onDelta: (chunk: string) => void,
  system?: string,
): Promise<void> {
  const sys = system ?? "Kamu adalah asisten desain sistem yang ringkas dan akurat, merespons dalam Bahasa Indonesia.";
  const ctrl = providerTimeout();

  if (cfg.provider === "gemini") {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(cfg.apiKey)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: sys }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      }),
    });
    if (!res.ok) throw new Error(`Gemini error ${res.status}`);
    const reader = res.body?.getReader();
    if (!reader) return;
    const decoder = new TextDecoder();
    let buf = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        const sse = line.trim();
        if (!sse.startsWith("data:")) continue;
        const payload = sse.slice(5).trim();
        if (!payload) continue;
        try {
          const json = JSON.parse(payload);
          const text = json.candidates?.[0]?.content?.parts
            ?.map((p: { text?: string }) => p.text ?? "")
            .join("");
          if (text) onDelta(text);
        } catch {
          // skip partial
        }
      }
    }
    return;
  }

  const endpoint =
    cfg.provider === "openai"
      ? "https://api.openai.com/v1/chat/completions"
      : cfg.provider === "claude"
        ? "https://api.anthropic.com/v1/messages"
        : cfg.baseUrl?.trim()
          ? (cfg.baseUrl.includes("/chat/completions") ? cfg.baseUrl : `${cfg.baseUrl.replace(/\/$/, "")}/chat/completions`)
          : "https://api.openai.com/v1/chat/completions";

  const body =
    cfg.provider === "claude"
      ? JSON.stringify({ model: cfg.model, max_tokens: 4096, system: sys, messages: [{ role: "user", content: prompt }], stream: true })
      : JSON.stringify({
          model: cfg.model,
          stream: true,
          messages: [{ role: "system", content: sys }, { role: "user", content: prompt }],
        });

  const headers: Record<string, string> = { "content-type": "application/json" };
  if (cfg.provider === "claude") {
    headers["x-api-key"] = cfg.apiKey;
    headers["anthropic-version"] = "2023-06-01";
  } else {
    headers.authorization = `Bearer ${cfg.apiKey}`;
  }

  const res = await fetch(endpoint, { method: "POST", headers, signal: ctrl.signal, body });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message ?? `AI error ${res.status}`);
  }
  const reader = res.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const sse = line.trim();
      if (!sse.startsWith("data:")) continue;
      const payload = sse.slice(5).trim();
      if (payload === "[DONE]") return;
      if (!payload) continue;
      try {
        const json = JSON.parse(payload);
        if (cfg.provider === "claude") {
          const text = json.delta?.text;
          if (text) onDelta(text);
        } else {
          const text = json.choices?.[0]?.delta?.content ?? json.choices?.[0]?.message?.content;
          if (text) onDelta(text);
        }
      } catch {
        // skip partial
      }
    }
  }
}

export async function streamAiWithAutoSwitch(
  cfg: AiConfig,
  prompt: string,
  onDelta: (chunk: string) => void,
  system?: string,
  onSwitch?: (from: string, to: string) => void,
): Promise<void> {
  const models = PROVIDERS.find((p) => p.id === cfg.provider)?.models ?? [];
  const candidates = [cfg.model, ...models.filter((m) => m !== cfg.model)];
  let lastError: AiError | null = null;

  for (const model of candidates) {
    const attempt: AiConfig = { ...cfg, model };
    try {
      await streamAi(attempt, prompt, onDelta, system);
      if (model !== cfg.model) onSwitch?.(cfg.model, model);
      return;
    } catch (e) {
      const err = e as AiError;
      lastError = err;
      if (!cfg.autoSwitch || !isRateLimited(err)) throw err;
    }
  }
  if (lastError) throw lastError;
}

export async function testConnection(cfg: AiConfig): Promise<void> {
  const res = await callAi(cfg, "Balas hanya satu kata: oke");
  if (!res.trim()) throw new Error("Tidak ada respons dari model");
}

export function useAiConfig() {
  const [cfg, setCfg] = useState<AiConfig | null>(() =>
    typeof window === "undefined" ? null : loadConfig(),
  );
  return {
    config: cfg,
    setConfig: (next: AiConfig) => {
      saveConfig(next);
      setCfg(next);
    },
    clear: () => {
      clearConfig();
      setCfg(null);
    },
  };
}

export type ModelContextSection =
  | "tokens"
  | "health"
  | "accessibility"
  | "responsive"
  | "components"
  | "darkmode";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildModelContext(m: any, sections?: ModelContextSection[]): string {
  const wanted = new Set(sections ?? (["tokens", "health", "accessibility", "responsive", "components", "darkmode"] as ModelContextSection[]));
  const t = m.tokens;
  const lines: string[] = [];
  lines.push(`URL: ${m.source.url}`);
  lines.push(`Judul: ${m.source.title}`);

  if (wanted.has("tokens")) {
    lines.push(
      `Warna primer: ${t.colors.primary.slice(0, 5).map((c: { name: string; hex: string; usage: number }) => `${c.name}=${c.hex}(${c.usage}%)`).join(", ")}`,
    );
    lines.push(
      `Warna netral: ${t.colors.neutral.slice(0, 5).map((c: { name: string; hex: string; usage: number }) => `${c.name}=${c.hex}(${c.usage}%)`).join(", ")}`,
    );
    lines.push(`Font family: ${t.typography.families.slice(0, 4).map((f: { raw: string }) => f.raw).join(" | ")}`);
    lines.push(`Ukuran font (px): ${t.typography.sizes.slice(0, 6).map((s: { px: number }) => s.px).join(", ")}`);
    lines.push(`Spacing: ${t.spacing.slice(0, 8).map((s: { raw: string }) => s.raw).join(", ")}`);
    lines.push(`Radius: ${t.radius.slice(0, 5).map((r: { raw: string }) => r.raw).join(", ")}`);
    lines.push(`Breakpoints: ${t.breakpoints.map((b: { feature: string; raw: string }) => `${b.feature} ${b.raw}`).join(", ") || "tidak terdeteksi"}`);
    lines.push(`Gradient: ${t.gradients.length} · Shadow: ${t.shadows.length} · Motion: ${t.durations.length}`);
  }

  if (wanted.has("health") && m.health) {
    lines.push(`Design Health overall: ${m.health.overall}/100`);
    if (m.health.spacing?.outliers?.length) {
      lines.push(`Spacing outliers: ${m.health.spacing.outliers.join(", ")}`);
    }
  }
  if (wanted.has("accessibility") && m.accessibility?.issues?.length) {
    lines.push(`A11y issues: ${m.accessibility.issues.length}`);
    for (const i of m.accessibility.issues.slice(0, 3)) {
      lines.push(`  [${i.severity}] ${i.message}`);
    }
  }
  if (wanted.has("responsive") && m.responsive) {
    lines.push(`Responsive: M${m.responsive.mobile}/T${m.responsive.tablet}/D${m.responsive.desktop}`);
  }
  if (wanted.has("components") && m.components?.length) {
    lines.push(`Komponen: ${m.components.map((c: { name: string; confidence: number }) => `${c.name}(${c.confidence}%)`).slice(0, 8).join(", ")}`);
  }
  if (wanted.has("darkmode") && m.darkMode) {
    lines.push(`Dark mode: ${m.darkMode.detected ? "terdeteksi" : "tidak"}`);
  }
  return lines.join("\n");
}