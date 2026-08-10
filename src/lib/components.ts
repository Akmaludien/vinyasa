import type { CssSourceInput } from "./model";

export interface DetectedComponent {
  name: string;
  confidence: number;
  selectors: string[];
  count: number;
  variantCount: number;
  properties: Record<string, string[]>;
  pages: string[];
}

export interface ComponentSpec extends DetectedComponent {
  category: string;
  humanName?: string;
  purpose?: string;
  states?: string[];
  dimensions?: Record<string, string[]>;
  responsive?: string[];
  dependencies?: string[];
  implementation_hints?: string[];
}

export interface ComponentReport {
  components: DetectedComponent[];
  patterns: string[];
  note: string;
}

const COMPONENT_PATTERNS: Array<{ name: string; re: RegExp; keywords: string[] }> = [
  { name: "button", re: /(^|[-_:])(btn|button)([-_:$]|$)/i, keywords: ["btn", "button"] },
  { name: "card", re: /(^|[-_:])(card|panel|tile)([-_:$]|$)/i, keywords: ["card", "panel", "tile"] },
  { name: "input", re: /(^|[-_:])(input|field|control|textbox)([-_:$]|$)/i, keywords: ["input", "field"] },
  { name: "navbar", re: /(^|[-_:])(navbar|nav|menu|header)([-_:$]|$)/i, keywords: ["nav", "navbar", "header"] },
  { name: "footer", re: /(^|[-_:])(footer|footer-container)([-_:$]|$)/i, keywords: ["footer"] },
  { name: "badge", re: /(^|[-_:])(badge|pill|tag|chip)([-_:$]|$)/i, keywords: ["badge", "pill", "tag", "chip"] },
  { name: "alert", re: /(^|[-_:])(alert|notice|banner|toast)([-_:$]|$)/i, keywords: ["alert", "notice", "toast"] },
  { name: "dropdown", re: /(^|[-_:])(dropdown|select|menu-toggle)([-_:$]|$)/i, keywords: ["dropdown", "select"] },
  { name: "tabs", re: /(^|[-_:])(tabs?|pills|tab-panel)([-_:$]|$)/i, keywords: ["tabs", "tab"] },
  { name: "accordion", re: /(^|[-_:])(accordion|collapse|expander)([-_:$]|$)/i, keywords: ["accordion", "collapse"] },
  { name: "modal", re: /(^|[-_:])(modal|dialog|overlay|popup)([-_:$]|$)/i, keywords: ["modal", "dialog", "overlay"] },
  { name: "table", re: /(^|[-_:])(table|datagrid|grid-table)([-_:$]|$)/i, keywords: ["table"] },
  { name: "breadcrumb", re: /(^|[-_:])(breadcrumb|crumb)([-_:$]|$)/i, keywords: ["breadcrumb", "crumb"] },
  { name: "pagination", re: /(^|[-_:])(pagination|pager)([-_:$]|$)/i, keywords: ["pagination", "pager"] },
  { name: "pricing", re: /(^|[-_:])(pricing|price-card|plan)([-_:$]|$)/i, keywords: ["pricing", "price", "plan"] },
  { name: "search", re: /(^|[-_:])(search|searchbox|find)([-_:$]|$)/i, keywords: ["search"] },
  { name: "sidebar", re: /(^|[-_:])(sidebar|aside)([-_:$]|$)/i, keywords: ["sidebar", "aside"] },
  { name: "hero", re: /(^|[-_:])(hero|landing-hero)([-_:$]|$)/i, keywords: ["hero"] },
  { name: "form", re: /(^|[-_:])(form|form-group|login-form)([-_:$]|$)/i, keywords: ["form"] },
  { name: "loading", re: /(^|[-_:])(spinner|skeleton|loading|loader)([-_:$]|$)/i, keywords: ["spinner", "skeleton", "loading"] },
];

export function detectComponents(
  sources: CssSourceInput[],
  pageUrl: string,
): ComponentReport {
  const grouped = new Map<
    string,
    { selectors: Set<string>; variants: Set<string>; properties: Map<string, Set<string>> }
  >();

  for (const source of sources) {
    let css = source.content;
    if (source.kind === "attribute") continue;
    const commentRe = /\/\*[\s\S]*?\*\//g;
    css = css.replace(commentRe, " ");

    const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
    let m: RegExpExecArray | null;
    while ((m = ruleRe.exec(css)) !== null) {
      const selector = m[1].trim();
      const body = m[2].trim();
      if (!body || selector.startsWith("@")) continue;

      for (const pat of COMPONENT_PATTERNS) {
        const base = selector.split(/\s+|,/)[0].replace(/^[\\.#]/g, "").split("::")[0];
        if (!pat.re.test(base) && !pat.re.test(selector)) continue;
        let cur = grouped.get(pat.name);
        if (!cur) {
          cur = { selectors: new Set(), variants: new Set(), properties: new Map() };
          grouped.set(pat.name, cur);
        }
        cur.selectors.add(base);
        if (/:|_|--/.test(selector)) cur.variants.add(selector.slice(0, 60));

        const decls = body.split(";");
        for (const d of decls) {
          const idx = d.indexOf(":");
          if (idx < 0) continue;
          const prop = d.slice(0, idx).trim().toLowerCase();
          const val = d.slice(idx + 1).trim();
          if (!prop || !val) continue;
          if (!cur.properties.has(prop)) cur.properties.set(prop, new Set());
          cur.properties.get(prop)!.add(val);
        }
      }
    }
  }

  const components: ComponentSpec[] = [];
  for (const [name, g] of grouped) {
    const count = g.selectors.size;
    if (count === 0) continue;
    const props: Record<string, string[]> = {};
    for (const [p, vals] of g.properties) props[p] = [...vals].slice(0, 4);
    const confidence = Math.min(100, Math.round(35 + count * 15 + g.variants.size * 2));
    const selectors = [...g.selectors].slice(0, 8);
    components.push({
      name,
      category: categorizeComponent(name),
      confidence,
      selectors,
      count,
      variantCount: g.variants.size,
      properties: props,
      pages: [pageUrl],
      humanName: humanName(name),
      purpose: purposeFor(name),
      states: deriveStates(selectors, props),
      dimensions: dimensionsFor(props),
      responsive: responsiveHints(selectors),
      dependencies: dependenciesFor(name, selectors),
      implementation_hints: hintsFor(name, count, g.variants.size),
    });
  }

  components.sort((a, b) => b.count - a.count);
  const patterns = components
    .filter((c) => c.confidence >= 60)
    .map((c) => `${c.name} (x${c.count}, ${c.confidence}%)`);

  return {
    components: components.slice(0, 20),
    patterns,
    note:
      "Deteksi berbasis heuristik selector (nama class). Bukan kepastian — interpretasi manual tetap disarankan untuk tata letak yang kompleks.",
  };
}

const CATEGORY_MAP: Array<[string, string[]]> = [
  ["Navigation", ["navbar", "header", "nav", "sidebar", "menu", "footer", "breadcrumb", "pagination"]],
  ["Input", ["input", "form", "field", "search", "select", "dropdown", "searchbox"]],
  ["Feedback", ["badge", "alert", "notice", "toast", "banner", "modal", "loading", "spinner", "skeleton", "tooltip"]],
  ["Layout", ["card", "panel", "table", "grid", "section", "hero"]],
  ["Action", ["button", "tabs", "accordion", "pagination"]],
  ["Marketing", ["pricing", "price", "plan"]],
];

export function categorizeComponent(name: string): string {
  for (const [cat, names] of CATEGORY_MAP) {
    if (names.includes(name)) return cat;
  }
  return "Other";
}

const PURPOSE_MAP: Array<[string, string]> = [
  ["button", "Trigger a user action"],
  ["card", "Group related content in a bordered container"],
  ["input", "Capture user input"],
  ["form", "Collect structured data from the user"],
  ["navbar", "Provide top-level site navigation"],
  ["footer", "Show page footer / secondary links"],
  ["badge", "Mark status or short label"],
  ["alert", "Surface feedback or notification"],
  ["dropdown", "Reveal a menu on interaction"],
  ["tabs", "Switch between views"],
  ["accordion", "Expand/collapse grouped content"],
  ["modal", "Overlay requiring focus"],
  ["table", "Display tabular data"],
  ["hero", "Primary landing section"],
  ["pricing", "Present pricing tiers"],
  ["search", "Search within content"],
  ["sidebar", "Persistent secondary navigation or filters"],
  ["breadcrumb", "Show page hierarchy"],
  ["pagination", "Navigate across pages"],
  ["loading", "Indicate loading state"],
];

function humanName(name: string): string {
  return name.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function purposeFor(name: string): string | undefined {
  const found = PURPOSE_MAP.find(([n]) => n === name);
  return found?.[1];
}

const STATE_MARKERS = ["hover", "focus", "active", "disabled", "checked", "visited", "placeholder", "focus-within"];

function deriveStates(selectors: string[], props: Record<string, string[]>): string[] {
  const states = new Set<string>();
  for (const sel of selectors) {
    for (const s of STATE_MARKERS) {
      if (new RegExp(`:${s}(?:\\b|[-:(])`).test(sel)) states.add(s);
    }
  }
  const allSelText = selectors.join(" ");
  if (/transition|transform|animation/.test(allSelText)) states.add("transition");
  return [...states];
}

const DIMENSIONS_PROPS = [
  ["width", "minWidth", "maxWidth"],
  ["height", "lineHeight"],
  ["padding", "margin", "gap"],
  ["borderRadius"],
  ["fontSize"],
];

function dimensionsFor(props: Record<string, string[]>): Record<string, string[]> | undefined {
  const out: Record<string, string[]> = {};
  for (const key of ["width", "height", "padding", "margin", "gap", "borderRadius", "fontSize", "lineHeight"]) {
    const vals = props[key];
    if (vals && vals.length) out[key] = vals.slice(0, 3);
  }
  return Object.keys(out).length ? out : undefined;
}

function responsiveHints(selectors: string[]): string[] {
  const hints: string[] = [];
  const text = selectors.join(" ");
  if (/mobile|sm|--sm|xs|small/.test(text)) hints.push("mobile");
  if (/tablet|md|--md/.test(text)) hints.push("tablet");
  if (/desktop|lg|xl|--lg|--xl/.test(text)) hints.push("desktop");
  return hints;
}

function dependenciesFor(name: string, selectors: string[]): string[] {
  const deps: string[] = [];
  for (const sel of selectors) {
    for (const [dep, names] of CATEGORY_MAP) {
      for (const n of names) {
        if (n !== name && new RegExp(`(^|[-_]|\\s)${n}[-_$]?`, "i").test(sel) && !deps.includes(dep)) {
          deps.push(dep);
        }
      }
    }
  }
  return deps;
}

function hintsFor(name: string, count: number, variants: number): string[] {
  const hints: string[] = [];
  if (variants > 1) hints.push(`Gunakan varian (${variants} terdeteksi) sebagai modifier, bukan duplikasi.`);
  if (count === 1) hints.push("Muncul sekali — validasi apakah benar komponen atau halaman khusus.");
  return hints;
}