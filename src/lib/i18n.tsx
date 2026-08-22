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
    "hero.lead": "Bedah design system ",
    "hero.gradient": "situs mana pun",
    "hero.tail": ".",
    "hero.subtitle":
      "Tempel URL. Token, komponen, skor health, dan audit WCAG, siap diekspor.",
    "home.urlLabel": "URL website",
    "home.scopeLabel": "Cakupan scan",
    "home.modeLabel": "Mode",
    "home.maxPages": "Maks pages",
    "home.start": "Analisis Website",
    "home.how": "Cara kerjanya",
    "home.recent": "Scan terbaru",
    "home.recentEmpty": "Website yang anda analisis akan muncul di sini.",
    "scan.analyzing": "Menganalisis website",
    "scan.modeFast": "HTML & CSS statis (ringan)",
    "scan.modeDeep": "Snapshot CSS dalam, lebih banyak stylesheet & @import",
    "scan.loading": "Menganalisis…",
    "flow.1": "Ekstrak",
    "flow.1Desc":
      "Vinyasa membaca CSS asli situs, lalu mengumpulkan warna, ukuran teks, jarak, dan komponen yang dipakai.",
    "flow.2": "Nilai",
    "flow.2Desc":
      "Tiap bagian desain diberi skor, dan anda langsung tahu bagian mana yang bermasalah, bukan cuma angkanya.",
    "flow.3": "Ekspor",
    "flow.3Desc":
      "Hasilnya siap dibawa ke proyek anda dalam format standar, tanpa perlu menyalin ulang satu per satu.",
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
    "hero.lead": "Reverse-engineer the design system of ",
    "hero.gradient": "any website",
    "hero.tail": ".",
    "hero.subtitle":
      "Paste a URL. Tokens, components, health scores, and a WCAG audit, ready to export.",
    "home.urlLabel": "Website URL",
    "home.scopeLabel": "Scan scope",
    "home.modeLabel": "Mode",
    "home.maxPages": "Max pages",
    "home.start": "Analyze Website",
    "home.how": "How it works",
    "home.recent": "Recent scans",
    "home.recentEmpty": "Websites you analyze will show up here.",
    "scan.analyzing": "Analyzing website",
    "scan.modeFast": "Lightweight static HTML & CSS",
    "scan.modeDeep": "Deep CSS snapshot, more stylesheets & @import",
    "scan.loading": "Analyzing…",
    "flow.1": "Extract",
    "flow.1Desc":
      "Vinyasa reads the site's own CSS and collects the colors, text sizes, spacing, and components in use.",
    "flow.2": "Score",
    "flow.2Desc":
      "Every part of the design gets a score, and you see exactly which part is at fault, not just the number.",
    "flow.3": "Export",
    "flow.3Desc":
      "Take the result straight into your project in standard formats, with nothing to copy by hand.",
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
    <div className="inline-flex shrink-0 rounded-md border border-border p-0.5">
      {(["id", "en"] as Lang[]).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={`rounded-sm px-2 py-0.5 text-2xs font-bold uppercase transition-colors ${
            lang === l ? "bg-fg text-canvas" : "text-faint hover:text-fg"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}