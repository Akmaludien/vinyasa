import { NextRequest, NextResponse } from "next/server";
import { fetchPageDocs, hydrateSources } from "@/lib/fetcher";
import { extractDesignSystem } from "@/lib/extractor";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let urls: string[];
  try {
    const body = await req.json();
    urls = (body.urls ?? []).map((u: string) => String(u).trim()).filter(Boolean);
  } catch {
    return NextResponse.json(
      { ok: false, results: [], errors: [{ url: "", message: "Body JSON tidak valid" }] },
      { status: 400 },
    );
  }

  urls = urls.slice(0, 5);

  if (urls.length === 0) {
    return NextResponse.json(
      { ok: false, results: [], errors: [{ url: "", message: "URL tidak boleh kosong" }] },
      { status: 400 },
    );
  }

  const results = [];
  const errors = [];

  for (const url of urls) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      errors.push({ url, message: "Format URL tidak valid" });
      continue;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      errors.push({ url, message: "Hanya mendukung skema http/https" });
      continue;
    }

    try {
      const { title, sources } = await fetchPageDocs(url);
      const hydrated = await hydrateSources(sources);
      if (hydrated.length === 0) {
        errors.push({ url, message: "Tidak ada stylesheet yang bisa dibaca di halaman tersebut" });
        continue;
      }
      const result = extractDesignSystem(hydrated, url, title, urls.length);
      results.push(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Gagal mengambil halaman";
      errors.push({ url, message: msg.includes("fetch") ? "Terjadi kesalahan jaringan saat mengambil halaman" : msg });
    }
  }

  return NextResponse.json({ ok: results.length > 0, results, errors });
}