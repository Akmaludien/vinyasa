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

  const components: DetectedComponent[] = [];
  for (const [name, g] of grouped) {
    const count = g.selectors.size;
    if (count === 0) continue;
    const props: Record<string, string[]> = {};
    for (const [p, vals] of g.properties) props[p] = [...vals].slice(0, 4);
    const confidence = Math.min(100, Math.round(35 + count * 15 + g.variants.size * 2));
    components.push({
      name,
      confidence,
      selectors: [...g.selectors].slice(0, 8),
      count,
      variantCount: g.variants.size,
      properties: props,
      pages: [pageUrl],
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