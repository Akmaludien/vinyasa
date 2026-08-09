import { chromium } from "playwright";
import { isSafeUrl } from "./fetcher";
import type { CssSourceInput } from "./model";

export interface DeepScanComputed {
  bodyBackground: string | null;
  primaryColor: string | null;
  fontSize: string | null;
  fontFamily: string | null;
  viewport: { width: number; height: number };
  computedColors: Array<{ hex: string; count: number }>;
  runtimeStylesheetCount: number;
  title: string;
}

export interface DeepScanResult {
  ok: boolean;
  error?: string;
  screenshots: string[];
  computed: DeepScanComputed;
}

const COMPUTE_JS = `(() => {
  function parseColor(c) {
    if (typeof c !== 'string') return null;
    var m = c.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
    if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
    var h = c.match(/^#([0-9a-fA-F]{6})$/);
    if (h) { var v = h[1]; return [parseInt(v.slice(0,2),16), parseInt(v.slice(2,4),16), parseInt(v.slice(4,6),16)]; }
    return null;
  }
  function hex(rgb) {
    function t(n) { return Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0'); }
    return '#' + t(rgb[0]) + t(rgb[1]) + t(rgb[2]);
  }
  function pushColor(map, c) {
    var rgb = parseColor(c);
    if (rgb) { var h = hex(rgb); map.set(h, (map.get(h) || 0) + 1); }
  }
  var body = document.body;
  var bs = body ? getComputedStyle(body) : null;
  function collectAll() {
    var counts = new Map();
    var all = document.querySelectorAll('*');
    all.forEach(function (el) {
      var cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
      pushColor(counts, cs.color);
      pushColor(counts, cs.backgroundColor);
    });
    return Array.from(counts.entries()).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 20);
  }
  function primary() {
    var counts = new Map();
    var all = document.querySelectorAll('button, [role=button], .btn, a, h1, h2, h3');
    all.forEach(function (el) {
      var cs = getComputedStyle(el);
      pushColor(counts, cs.color);
      pushColor(counts, cs.backgroundColor);
    });
    var top = Array.from(counts.entries()).sort(function (a, b) { return b[1] - a[1]; });
    return top.length ? top[0][0] : null;
  }
  return {
    bodyBackground: bs ? bs.backgroundColor : null,
    primaryColor: primary(),
    fontSize: bs ? bs.fontSize : null,
    fontFamily: bs ? bs.fontFamily : null,
    title: document.title,
    runtimeStylesheetCount: document.styleSheets.length,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    computedColors: collectAll()
  };
})()`;

export async function deepScan(url: string, viewport = { width: 1280, height: 900 }): Promise<DeepScanResult> {
  const base: DeepScanResult = {
    ok: false,
    screenshots: [],
    computed: {
      bodyBackground: null,
      primaryColor: null,
      fontSize: null,
      fontFamily: null,
      viewport,
      computedColors: [],
      runtimeStylesheetCount: 0,
      title: "",
    },
  };

  if (!isSafeUrl(url)) {
    return { ...base, error: "Alamat pribadi/tidak aman tidak diizinkan untuk Deep Scan." };
  }

  let browser;
  try {
    browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  } catch (e) {
    return {
      ...base,
      error: `Browser headless tidak tersedia: ${e instanceof Error ? e.message : "unknown"}. Jalankan 'npx playwright install chromium' lalu coba lagi.`,
    };
  }

  const context = await browser.newContext({
    viewport,
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  });
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(1500);

    const screenshot = await page.screenshot({ type: "jpeg", quality: 70, fullPage: false });
    base.screenshots.push(`data:image/jpeg;base64,${screenshot.toString("base64")}`);

    const computed = (await page.evaluate(COMPUTE_JS)) as {
      bodyBackground: string | null;
      primaryColor: string | null;
      fontSize: string | null;
      fontFamily: string | null;
      title: string;
      runtimeStylesheetCount: number;
      viewport: { width: number; height: number };
      computedColors: Array<{ hex: string; count: number }>;
    };

    base.ok = true;
    base.computed = {
      bodyBackground: computed.bodyBackground,
      primaryColor: computed.primaryColor,
      fontSize: computed.fontSize,
      fontFamily: computed.fontFamily,
      viewport: computed.viewport,
      computedColors: computed.computedColors,
      runtimeStylesheetCount: computed.runtimeStylesheetCount,
      title: computed.title,
    };
  } catch (e) {
    base.error = `Deep scan gagal: ${e instanceof Error ? e.message : "unknown"}`;
  } finally {
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
  return base;
}

export interface DeepScanStylesResult {
  title: string;
  sources: CssSourceInput[];
}

export async function deepScanStyles(url: string): Promise<DeepScanStylesResult> {
  let browser;
  try {
    browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  } catch {
    return { title: "", sources: [] };
  }
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    const { title, css } = await page.evaluate(() => {
      const out: Array<{ url: string; content: string }> = [];
      for (const sheet of Array.from(document.styleSheets)) {
        let text = "";
        try {
          text = Array.from(sheet.cssRules)
            .map((r) => r.cssText)
            .join("\n");
        } catch {
          text = "";
        }
        if (text.trim()) out.push({ url: sheet.href ?? "#runtime", content: text });
      }
      return { title: document.title, css: out };
    });
    return {
      title,
      sources: css.map((c) => ({ url: c.url, kind: "external" as const, content: c.content })),
    };
  } finally {
    await browser.close().catch(() => undefined);
  }
}