import * as csstree from "css-tree";

export interface VarResolver {
  resolve(value: string): string;
  has(name: string): boolean;
  size(): number;
}

export function createVarResolver(sources: Array<{ content: string }>): VarResolver {
  const vars = new Map<string, string>();

  for (const source of sources) {
    let ast: csstree.CssNode | null = null;
    try {
      ast = csstree.parse(source.content);
    } catch {
      continue;
    }
    if (!ast) continue;

    csstree.walk(ast, {
      visit: "Rule",
      enter(node) {
        let isRoot = false;
        try {
          const selector = csstree.generate(node.prelude).replace(/\s+/g, " ").trim();
          isRoot = /^(:root|html|\*|body|\$)\s*(,|$)/.test(selector) || selector.startsWith(":root");
        } catch {
          isRoot = false;
        }
        if (!isRoot) return;
        csstree.walk(node.block, {
          visit: "Declaration",
          enter(decl) {
            if (!decl.property.startsWith("--")) return;
            let value = "";
            try {
              value = csstree.generate(decl.value);
            } catch {
              value = "";
            }
            if (value) vars.set(decl.property, value.trim());
          },
        });
      },
    });
  }

  function resolveInner(value: string, depth: number, seen: Set<string>): string {
    if (depth > 6) return value;
    const re = /var\(\s*(--[\w-]+)(?:\s*,\s*([^)]*))?\)/g;
    return value.replace(re, (full, name: string, fallback?: string) => {
      if (seen.has(name)) return fallback?.trim() || "";
      const resolved = vars.get(name);
      if (resolved === undefined) return fallback?.trim() || full;
      const next = new Set(seen);
      next.add(name);
      return resolveInner(resolved, depth + 1, next);
    });
  }

  return {
    resolve(value: string): string {
      if (!value.includes("var(")) return value;
      return resolveInner(value, 0, new Set());
    },
    has(name: string): boolean {
      return vars.has(name);
    },
    size(): number {
      return vars.size;
    },
  };
}