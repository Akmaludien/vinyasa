"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

export type Lang = "id" | "en";

const dict = {
  id: {
    "app.tagline": "Vinyasa · Design Intelligence",
    "app.subtag": "Design system extractor",
    "scan.placeholder":
      "https://example.com  (pisahkan lebih dari satu URL dengan koma atau baris baru)",
    "scan.scope": "Cakupan scan",
    "scan.mode": "Mode:",
    "scan.max": "Maks halaman",
    "scan.start": "Mulai Scan",
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
    "show_ai": "AI",
    "nav.overview": "Overview",
    "nav.pages": "Pages",
    "nav.tokens": "Tokens",
    "nav.components": "Components",
    "nav.responsive": "Responsive",
    "nav.analysis": "Analysis",
    "nav.ai": "AI",
    "nav.edit": "Edit",
    "nav.compare": "Compare",
    "nav.export": "Export",
    "nav.drift": "Drift",
    "nav.overall": "Keseluruhan",
    "hero.lead": "Ubah website menjadi design system yang ",
    "hero.gradient": "cerdas",
    "hero.tail": ".",
    "hero.subtitle":
      "Vinyasa mengekstrak, menganalisis, dan mengaudit design system dari website mana pun — token, komponen, health, aksesibilitas, responsif — untuk dipahami, dibandingkan, dan diekspor.",
    "home.urlLabel": "URL website",
    "home.scopeLabel": "Cakupan scan",
    "home.modeLabel": "Mode",
    "home.maxPages": "Maks pages",
    "home.start": "Analisis Website",
    "home.capabilities": "Yang bisa Vinyasa lakukan",
    "home.how": "Cara kerjanya",
    "home.recent": "Scan terbaru",
    "home.recentEmpty": "Website yang anda analisis akan muncul di sini.",
    "scan.analyzing": "Menganalisis website",
    "scan.modeFast": "HTML & CSS statis",
    "scan.modeDeep": "Headless browser + computed styles",
    "scan.loading": "Menganalisis…",
    "cap.tokens": "Tokens",
    "cap.tokensDesc": "Warna, tipografi, spacing, radius, shadow — diekstrak dari CSS asli.",
    "cap.components": "Components",
    "cap.componentsDesc": "Pola komponen terdeteksi dari selector heuristik.",
    "cap.responsive": "Responsive",
    "cap.responsiveDesc": "Skor & isu per viewport mobile, tablet, desktop.",
    "cap.health": "Health",
    "cap.healthDesc": "Skor deterministik & explainable per kategori desain.",
    "cap.a11y": "Accessibility",
    "cap.a11yDesc": "Kontras WCAG AA/AAA dengan isu berperingkat.",
    "cap.export": "Export",
    "cap.exportDesc": "tokens.json, tokens.css, Tailwind, DESIGN.md, ZIP.",
    "step1": "Website",
    "step1Desc": "Tempel URL situs yang ingin dianalisis.",
    "step2": "Discovery & DesignModel",
    "step2Desc": "Vinyasa menemukan halaman, mengurai CSS, dan membangun model desain kanonik.",
    "step3": "Intelligence",
    "step3Desc": "Health, aksesibilitas, responsif, komponen, dan AI — lalu ekspor.",
    "scope.smart": "Otomatis pilih halaman representatif dari seluruh situs.",
    "scope.landing": "Analisis hanya halaman utama (homepage).",
    "scope.pages": "Analisis hingga 5 halaman representatif.",
    "scope.all": "Analisis seluruh halaman yang terdeteksi dalam batas aman.",
    "scope.custom": "Daftar URL yang anda tentukan sendiri.",
    "ld.discover": "Menemukan halaman",
    "ld.collect": "Mengumpulkan CSS",
    "ld.extract": "Ekstraksi token",
    "ld.analyze": "Analisis health & aksesibilitas",
    "ld.build": "Membangun DesignModel",
    "lang.id": "ID",
    "lang.en": "EN",
  },
  en: {
    "app.tagline": "Vinyasa · Design Intelligence",
    "app.subtag": "Design system extractor",
    "scan.placeholder":
      "https://example.com  (separate multiple URLs with commas or new lines)",
    "scan.scope": "Scan scope",
    "scan.mode": "Mode:",
    "scan.max": "Max pages",
    "scan.start": "Start Scan",
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
    "show_ai": "AI",
    "nav.overview": "Overview",
    "nav.pages": "Pages",
    "nav.tokens": "Tokens",
    "nav.components": "Components",
    "nav.responsive": "Responsive",
    "nav.analysis": "Analysis",
    "nav.ai": "AI",
    "nav.edit": "Edit",
    "nav.compare": "Compare",
    "nav.export": "Export",
    "nav.drift": "Drift",
    "nav.overall": "Overview",
    "hero.lead": "Turn any website into a smart design system: ",
    "hero.gradient": "smart",
    "hero.tail": ".",
    "hero.subtitle":
      "Vinyasa extracts, analyzes, and audits design systems from any website — tokens, components, health, accessibility, responsive — to understand, compare, and export.",
    "home.urlLabel": "Website URL",
    "home.scopeLabel": "Scan scope",
    "home.modeLabel": "Mode",
    "home.maxPages": "Max pages",
    "home.start": "Analyze Website",
    "home.capabilities": "What Vinyasa can do",
    "home.how": "How it works",
    "home.recent": "Recent scans",
    "home.recentEmpty": "Websites you analyze will show up here.",
    "scan.analyzing": "Analyzing website",
    "scan.modeFast": "Static HTML & CSS",
    "scan.modeDeep": "Headless browser + computed styles",
    "scan.loading": "Analyzing…",
    "cap.tokens": "Tokens",
    "cap.tokensDesc": "Colors, typography, spacing, radius, shadow — extracted from original CSS.",
    "cap.components": "Components",
    "cap.componentsDesc": "Component patterns detected from heuristic selectors.",
    "cap.responsive": "Responsive",
    "cap.responsiveDesc": "Mobile, tablet, desktop viewport scores & issues.",
    "cap.health": "Health",
    "cap.healthDesc": "Deterministic & explainable per design category.",
    "cap.a11y": "Accessibility",
    "cap.a11yDesc": "WCAG AA/AAA contrast with ranked issues.",
    "cap.export": "Export",
    "cap.exportDesc": "tokens.json, tokens.css, Tailwind, DESIGN.md, ZIP.",
    "step1": "Website",
    "step1Desc": "Paste the URL of the site you want to analyze.",
    "step2": "Discovery & DesignModel",
    "step2Desc": "Vinyasa discovers pages, parses CSS, and builds a canonical design model.",
    "step3": "Intelligence",
    "step3Desc": "Health, accessibility, responsive, components, and AI — then export.",
    "scope.smart": "Automatically pick representative pages across the whole site.",
    "scope.landing": "Analyze only the homepage.",
    "scope.pages": "Analyze up to 5 representative pages.",
    "scope.all": "Analyze all detected pages within safe limits.",
    "scope.custom": "A list of URLs you specify yourself.",
    "ld.discover": "Discovering pages",
    "ld.collect": "Collecting CSS",
    "ld.extract": "Extracting tokens",
    "ld.analyze": "Analyzing health & accessibility",
    "ld.build": "Building DesignModel",
    "lang.id": "ID",
    "lang.en": "EN",
  },
} as const;

export type DictKey = keyof (typeof dict)["id"];

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