import type { DesignModel } from "./model";

export interface DiffGroup {
  category: string;
  added: Array<{ label: string; value: string }>;
  removed: Array<{ label: string; value: string }>;
  changed: Array<{ label: string; before: string; after: string }>;
  unchangedCount: number;
}

export interface DiffResult {
  a: string;
  b: string;
  groups: DiffGroup[];
  summary: { added: number; removed: number; changed: number };
}

function collect(
  mapA: Map<string, { label: string; value: string }>,
  mapB: Map<string, { label: string; value: string }>,
): Omit<DiffGroup, "category"> {
  const added: Array<{ label: string; value: string }> = [];
  const removed: Array<{ label: string; value: string }> = [];
  const changed: Array<{ label: string; before: string; after: string }> = [];
  let unchanged = 0;

  for (const [k, va] of mapA) {
    const vb = mapB.get(k);
    if (!vb) removed.push(va);
    else if (va.value !== vb.value) changed.push({ label: vb.label, before: va.value, after: vb.value });
    else unchanged++;
  }
  for (const [k, vb] of mapB) {
    if (!mapA.has(k)) added.push(vb);
  }
  return { added, removed, changed, unchangedCount: unchanged };
}

function mapFrom<T>(items: T[], keyOf: (x: T) => string, labelOf: (x: T) => string, valueOf: (x: T) => string): Map<string, { label: string; value: string }> {
  return new Map(items.map((x) => [keyOf(x), { label: labelOf(x), value: valueOf(x) }]));
}

export function diffModels(a?: DesignModel | null, b?: DesignModel | null): DiffResult | null {
  if (!a || !b) return null;
  const groups: DiffGroup[] = [];

  groups.push({
    category: "colors",
    ...collect(
      mapFrom(a.tokens.colors.primary, (x) => x.hex, (x) => x.name, (x) => x.hex),
      mapFrom(b.tokens.colors.primary, (x) => x.hex, (x) => x.name, (x) => x.hex),
    ),
  });

  groups.push({
    category: "font-families",
    ...collect(
      mapFrom(a.tokens.typography.families, (x) => x.raw, () => "font-family", (x) => x.raw),
      mapFrom(b.tokens.typography.families, (x) => x.raw, () => "font-family", (x) => x.raw),
    ),
  });

  groups.push({
    category: "font-sizes",
    ...collect(
      mapFrom(a.tokens.typography.sizes, (x) => String(x.px), () => "font-size", (x) => x.raw),
      mapFrom(b.tokens.typography.sizes, (x) => String(x.px), () => "font-size", (x) => x.raw),
    ),
  });

  groups.push({
    category: "spacing",
    ...collect(
      mapFrom(a.tokens.spacing, (x) => x.raw, () => "spacing", (x) => x.raw),
      mapFrom(b.tokens.spacing, (x) => x.raw, () => "spacing", (x) => x.raw),
    ),
  });

  groups.push({
    category: "radius",
    ...collect(
      mapFrom(a.tokens.radius, (x) => x.raw, () => "radius", (x) => x.raw),
      mapFrom(b.tokens.radius, (x) => x.raw, () => "radius", (x) => x.raw),
    ),
  });

  groups.push({
    category: "shadows",
    ...collect(
      mapFrom(a.tokens.shadows, (x) => x.raw, () => "shadow", (x) => x.raw),
      mapFrom(b.tokens.shadows, (x) => x.raw, () => "shadow", (x) => x.raw),
    ),
  });

  groups.push({
    category: "components",
    ...collect(
      mapFrom(a.components, (x) => x.name, () => "component", (x) => String(x.confidence)),
      mapFrom(b.components, (x) => x.name, () => "component", (x) => String(x.confidence)),
    ),
  });

  const summary = groups.reduce(
    (acc, g) => {
      acc.added += g.added.length;
      acc.removed += g.removed.length;
      acc.changed += g.changed.length;
      return acc;
    },
    { added: 0, removed: 0, changed: 0 },
  );

  return {
    a: a.source.url,
    b: b.source.url,
    groups,
    summary,
  };
}