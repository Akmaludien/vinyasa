"use client";

import { useState } from "react";

export interface AiConfig {
  provider: "openai" | "gemini" | "claude";
  model: string;
  apiKey: string;
}

const STORAGE_KEY = "designmd-ai-config";

export const PROVIDERS = [
  {
    id: "openai" as const,
    label: "OpenAI",
    placeholder: "sk-...",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini"],
  },
  {
    id: "gemini" as const,
    label: "Google Gemini",
    placeholder: "AIza...",
    models: ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-2.5-flash"],
  },
  {
    id: "claude" as const,
    label: "Anthropic Claude",
    placeholder: "sk-ant-...",
    models: ["claude-3-5-haiku-latest", "claude-3-5-sonnet-latest", "claude-3-7-sonnet-latest"],
  },
];

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

function loadAi(): AiConfig | null {
  return loadConfig();
}

export function saveConfig(cfg: AiConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

export function clearConfig() {
  localStorage.removeItem(STORAGE_KEY);
}

export function providerInfo(cfg: AiConfig) {
  return PROVIDERS.find((p) => p.id === cfg.provider) ?? PROVIDERS[0];
}

export async function callAi(cfg: AiConfig, prompt: string): Promise<string> {
  if (cfg.provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({
        model: cfg.model,
        messages: [
          {
            role: "system",
            content: "Kamu adalah asisten desain sistem yang ringkas dan akurat, merespons dalam Bahasa Indonesia.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message ?? `OpenAI error ${res.status}`);
    return data.choices?.[0]?.message?.content ?? "";
  }

  if (cfg.provider === "gemini") {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              { text: "Kamu adalah asisten desain yang ringkas dan akurat. Respons dalam Bahasa Indonesia." },
            ],
          },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
        }),
      },
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message ?? `Gemini error ${res.status}`);
    return data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
  }

  if (cfg.provider === "claude") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": cfg.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: cfg.model,
        max_tokens: 4096,
        system:
          "Kamu adalah asisten desain yang ringkas dan akurat. Merespons dalam Bahasa Indonesia.",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message ?? `Claude error ${res.status}`);
    return data.content?.filter((b: { type: string }) => b.type === "text").map((b: { text?: string }) => b.text ?? "").join("") ?? "";
  }

  throw new Error("Provider tidak dikenali");
}

export async function testConnection(cfg: AiConfig): Promise<void> {
  const res = await callAi(cfg, "Balas hanya satu kata: oke");
  if (!res.trim()) throw new Error("Tidak ada respons dari model");
}

export function useAiConfig() {
  const [cfg, setCfg] = useState<AiConfig | null>(() =>
    typeof window === "undefined" ? null : loadAi(),
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