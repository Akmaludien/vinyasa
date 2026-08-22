import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * No `icons` block on purpose. app/favicon.ico, app/icon.png and
 * app/apple-icon.png are file conventions: Next emits the <link> tags with the
 * right type and sizes, and fingerprints the URLs so a logo change is never
 * served from a stale cache.
 */
export const metadata: Metadata = {
  title: "Vinyasa · Design Intelligence Platform",
  description:
    "Ubah website apa pun menjadi design system yang cerdas, dapat digunakan kembali: token, komponen, health, aksesibilitas, responsif, dan AI.",
};

/**
 * Applied before paint so the stored theme never flashes the wrong palette.
 * Light is the product default: dark is opt-in through the toggle, not
 * inherited from the OS, so a first visit always looks the same.
 */
const themeBootstrap = `(function(){try{if(localStorage.getItem("vinyasa.theme")==="dark"){document.documentElement.classList.add("dark")}}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Inline in <head> on purpose: it must run before <body> is parsed so
            the stored theme is applied in the same frame as first paint. */}
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="min-h-full font-sans text-fg">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-brand-500 focus:px-3 focus:py-2 focus:text-xs focus:font-semibold focus:text-on-brand"
        >
          Lewati ke konten
        </a>
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
