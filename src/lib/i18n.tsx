"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

export type Lang = "id" | "en";

const dict = {
  id: {
    "app.tagline": "Vinyasa · Design Intelligence",
    "app.subtag": "Design system extractor",
    "hero.title": "Pindai website jadi design system yang dipahami",
    "hero.subtitle":
      "Tempel URL, pilih cakupan pemindaian. Vinyasa mengekstrak design token, menilai kesehatan desain, dan mengekspor artefak yang siap dipakai developer.",
    "scan.placeholder":
      "https://example.com  (pisahkan lebih dari satu URL dengan koma atau baris baru)",
    "scan.scope": "Cakupan scan",
    "scan.mode": "Mode:",
    "scan.max": "Maks halaman",
    "scan.start": "Mulai Scan",
    "scan.loading": "Memindai…",
    "scan.error.empty": "Masukkan satu atau lebih URL terlebih dahulu.",
    "scan.error.network": "Terjadi kesalahan jaringan.",
    "scan.try": "Coba:",
    "tab.colors": "Warna",
    "tab.typography": "Tipografi",
    "tab.spacing": "Spacing",
    "tab.shapes": "Shapes",
    "tab.effects": "Efek",
    "tab.components": "Komponen",
    "tab.responsive": "Responsif",
    "tab.darkmode": "Dark Mode",
    "tab.playground": "Playground",
    "tab.diff": "Diff",
    "tab.history": "Riwayat",
    "tab.health": "Health",
    "tab.accessibility": "Aksesibilitas",
    "tab.export": "Export",
    "tab.audit": "Audit",
    "tab.md": "DESIGN.md",
    "tab.preview": "Preview",
    "tab.ai": "AI",
    "lang.id": "ID",
    "lang.en": "EN",
  },
  en: {
    "app.tagline": "Vinyasa · Design Intelligence",
    "app.subtag": "Design system extractor",
    "hero.title": "Turn any website into an understandable design system",
    "hero.subtitle":
      "Paste a URL, choose scan scope. Vinyasa extracts design tokens, assesses design health, and exports developer-ready artifacts.",
    "scan.placeholder":
      "https://example.com  (separate multiple URLs with commas or new lines)",
    "scan.scope": "Scan scope",
    "scan.mode": "Mode:",
    "scan.max": "Max pages",
    "scan.start": "Start Scan",
    "scan.loading": "Scanning…",
    "scan.error.empty": "Enter one or more URLs first.",
    "scan.error.network": "A network error occurred.",
    "scan.try": "Try:",
    "tab.colors": "Colors",
    "tab.typography": "Typography",
    "tab.spacing": "Spacing",
    "tab.shapes": "Shapes",
    "tab.effects": "Effects",
    "tab.components": "Components",
    "tab.responsive": "Responsive",
    "tab.darkmode": "Dark Mode",
    "tab.playground": "Playground",
    "tab.diff": "Diff",
    "tab.history": "History",
    "tab.health": "Health",
    "tab.accessibility": "Accessibility",
    "tab.export": "Export",
    "tab.audit": "Audit",
    "tab.md": "DESIGN.md",
    "tab.preview": "Preview",
    "tab.ai": "AI",
    "lang.id": "ID",
    "lang.en": "EN",
  },
} as const;

type DictKey = keyof (typeof dict)["id"];

const LangContext = createContext<{
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: DictKey) => string;
}>({
  lang: "id",
  setLang: () => {},
  t: (key) => dict.id[key],
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("id");
  return (
    <LangContext.Provider value={{ lang, setLang, t: (key) => dict[lang][key] }}>
      {children}
    </LangContext.Provider>
  );
}

export function useI18n() {
  return useContext(LangContext);
}

export function LangToggle() {
  const { lang, setLang } = useI18n();
  return (
    <div className="inline-flex rounded-full border border-zinc-700 p-0.5">
      {(["id", "en"] as Lang[]).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase transition-colors ${
            lang === l ? "bg-zinc-100 text-zinc-900" : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}