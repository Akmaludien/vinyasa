import type { CssSourceInput } from "./model";

export interface DarkModeReport {
  detected: boolean;
  mediaQuery: boolean;
  prefersColorScheme: boolean;
  themeVariables: string[];
  hardcoded: string[];
  note: string;
}

export function detectDarkMode(sources: CssSourceInput[]): DarkModeReport {
  let mediaQuery = false;
  let prefersColorScheme = false;
  const themeVariables: string[] = [];
  const hardcoded: string[] = [];

  for (const source of sources) {
    const css = source.content;
    if (/@media\s*\(prefers-color-scheme\s*:\s*dark\)/i.test(css)) {
      mediaQuery = true;
      prefersColorScheme = true;
    }
    if (/@media\s*\(prefers-color-scheme\s*:\s*light\)/i.test(css)) {
      prefersColorScheme = true;
    }
    if (/\.dark\s*[,{:]|\[data-theme=["']dark["']\]|html\.dark/.test(css)) {
      mediaQuery = true;
    }
    const themeRe = /(--[a-z0-9-]*theme[a-z0-9-]*|--color-scheme|--bg[a-z0-9-]*)/gi;
    let m: RegExpExecArray | null;
    while ((m = themeRe.exec(css)) !== null) {
      const name = m[0].toLowerCase();
      if (!themeVariables.includes(name)) themeVariables.push(name);
    }
    const hardRe = /(background|color)\s*:\s*(#[0-9a-fA-F]{3,8}|rgb|hsl|white|black)\b/g;
    const hardSet = new Set<string>();
    while ((m = hardRe.exec(css)) !== null) {
      hardSet.add(`${m[1]} ${m[2].slice(0, 12)}`);
    }
    for (const h of hardSet) hardcoded.push(h);
  }

  return {
    detected: mediaQuery || themeVariables.length > 0,
    mediaQuery,
    prefersColorScheme,
    themeVariables,
    hardcoded: hardcoded.slice(0, 8),
    note:
      "Deteksi dark mode berbasis heuristik (media query prefers-color-scheme, class .dark, [data-theme], dan variabel tema).",
  };
}