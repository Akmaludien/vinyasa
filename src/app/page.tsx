"use client";

import { useState } from "react";
import type { ExtractResponse } from "@/lib/types";
import { FullReport } from "./report";

const SUGGESTIONS = [
  "https://apple.com",
  "https://stripe.com",
  "https://linear.app",
  "https://vercel.com",
  "https://tailwindcss.com",
];

export default function HomePage() {
  const [urls, setUrls] = useState("");
  const [multiPage, setMultiPage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [response, setResponse] = useState<ExtractResponse | null>(null);

  function parseUrls(): string[] {
    return urls
      .split(/[\n,]/)
      .map((u) => u.trim())
      .filter(Boolean);
  }

  async function handleExtract() {
    const list = parseUrls();
    if (list.length === 0) {
      setError("Masukkan satu atau lebih URL terlebih dahulu.");
      return;
    }
    if (!multiPage && list.length > 1) {
      setError("Mode multi-page mati — hanya URL pertama yang dipakai. Aktifkan toggle bila ingin memindai banyak halaman.");
      return;
    }
    setError("");
    setLoading(true);
    setResponse(null);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ urls: multiPage ? list : list.slice(0, 1) }),
      });
      const data: ExtractResponse = await res.json();
      setResponse(data);
    } catch {
      setError("Terjadi kesalahan jaringan.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-4 pb-24 pt-14">
      <section className="text-center">
        <p className="mb-3 inline-block rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-300">
          Vinyasa · Website design system extractor
        </p>
        <h1 className="text-4xl font-bold tracking-tight">
          Ekstrak design system dari URL mana pun
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-zinc-400">
          Tempel URL, Vinyasa membaca seluruh CSS yang benar-benar dimuat halaman —
          warna, tipografi, radius — lalu menyusun DESIGN.md yang siap dipakai.
        </p>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
        <textarea
          value={urls}
          onChange={(e) => {
            setUrls(e.target.value);
            if (error) setError("");
          }}
          rows={multiPage ? 3 : 1}
          placeholder="https://example.com  (pisahkan lebih dari satu URL dengan koma atau baris baru)"
          className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm outline-none placeholder:text-zinc-500 focus:border-zinc-500"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => setMultiPage((m) => !m)}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors ${
              multiPage
                ? "border-zinc-500 bg-zinc-700 text-white"
                : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                multiPage ? "bg-emerald-400" : "bg-zinc-600"
              }`}
            />
            Multi-page
          </button>
          <button
            onClick={handleExtract}
            disabled={loading}
            className="rounded-xl bg-zinc-100 px-5 py-2.5 text-sm font-semibold text-zinc-900 transition-colors hover:bg-white disabled:opacity-60"
          >
            {loading ? "Memindai…" : "Buat DESIGN.md"}
          </button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          <span>Coba:</span>
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setUrls(s)}
              className="rounded-full border border-zinc-800 px-2.5 py-1 hover:border-zinc-600 hover:text-zinc-300"
            >
              {s.replace("https://", "")}
            </button>
          ))}
        </div>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </section>

      {loading && (
        <section className="rounded-2xl border border-zinc-800 p-8 text-center text-sm text-zinc-400">
          Mengambil halaman, mengurai CSS, menghitung token…
        </section>
      )}

      {response && response.errors.length > 0 && (
        <section className="rounded-2xl border border-red-900/50 bg-red-950/30 p-4 text-sm">
          {response.errors.map((e, i) => (
            <p key={i} className="text-red-300">
              <span className="font-mono">{e.url || "(tanpa URL)"}</span> — {e.message}
            </p>
          ))}
        </section>
      )}

      {response && response.results.length > 0 && <FullReport response={response} />}
    </main>
  );
}