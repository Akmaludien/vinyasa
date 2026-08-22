import type { DesignModel } from "./model";

export interface ComparisonResult {
  urlA: string;
  urlB: string;
  health: {
    scoreA: number;
    scoreB: number;
    delta: number;
    accessibilityA: { pass: number; warning: number; critical: number };
    accessibilityB: { pass: number; warning: number; critical: number };
  };
  colors: {
    totalA: number;
    totalB: number;
    shared: Array<{ hex: string; nameA?: string; nameB?: string }>;
    uniqueA: Array<{ hex: string; name?: string }>;
    uniqueB: Array<{ hex: string; name?: string }>;
    overlapPercentage: number;
  };
  typography: {
    familiesA: string[];
    familiesB: string[];
    sharedFamilies: string[];
    sizesCountA: number;
    sizesCountB: number;
  };
  components: {
    totalA: number;
    totalB: number;
    typesA: string[];
    typesB: string[];
  };
  summary: string;
}

export function compareDesignModels(a: DesignModel, b: DesignModel): ComparisonResult {
  const scoreA = a.health?.overall ?? 0;
  const scoreB = b.health?.overall ?? 0;
  const delta = scoreB - scoreA;

  // Colors comparison
  const colorsA = [...a.tokens.colors.primary, ...a.tokens.colors.neutral];
  const colorsB = [...b.tokens.colors.primary, ...b.tokens.colors.neutral];

  const mapA = new Map(colorsA.map((c) => [c.hex.toLowerCase(), c.name]));
  const mapB = new Map(colorsB.map((c) => [c.hex.toLowerCase(), c.name]));

  const shared: Array<{ hex: string; nameA?: string; nameB?: string }> = [];
  const uniqueA: Array<{ hex: string; name?: string }> = [];
  const uniqueB: Array<{ hex: string; name?: string }> = [];

  for (const [hex, name] of mapA.entries()) {
    if (mapB.has(hex)) {
      shared.push({ hex, nameA: name, nameB: mapB.get(hex) });
    } else {
      uniqueA.push({ hex, name });
    }
  }

  for (const [hex, name] of mapB.entries()) {
    if (!mapA.has(hex)) {
      uniqueB.push({ hex, name });
    }
  }

  const allDistinct = new Set([...mapA.keys(), ...mapB.keys()]).size;
  const overlapPercentage = allDistinct > 0 ? Math.round((shared.length / allDistinct) * 100) : 0;

  // Typography comparison
  const getFamilies = (m: DesignModel) => {
    const list: string[] = [];
    for (const f of m.tokens.typography.families) {
      if (Array.isArray(f.families) && f.families.length > 0) {
        list.push(...f.families);
      } else {
        list.push(...f.raw.split(","));
      }
    }
    return Array.from(new Set(list.map((s) => s.trim().toLowerCase()))).map((s) => s.replace(/['"]/g, ""));
  };

  const familiesA = getFamilies(a);
  const familiesB = getFamilies(b);
  const sharedFamilies = familiesA.filter((f) => familiesB.includes(f));

  // Components comparison
  const compsA = a.components ?? [];
  const compsB = b.components ?? [];
  const totalA = compsA.length;
  const totalB = compsB.length;
  const typesA = compsA.map((i: { name: string }) => i.name);
  const typesB = compsB.map((i: { name: string }) => i.name);

  const summary = `Comparison between ${a.source.url} (${scoreA}/100) and ${b.source.url} (${scoreB}/100): ${overlapPercentage}% color token overlap, ${sharedFamilies.length} shared font families.`;

  return {
    urlA: a.source.url,
    urlB: b.source.url,
    health: {
      scoreA,
      scoreB,
      delta,
      accessibilityA: {
        pass: a.accessibility?.wcagAA?.pass ?? 0,
        warning: a.accessibility?.wcagAA?.warning ?? 0,
        critical: a.accessibility?.wcagAA?.critical ?? 0,
      },
      accessibilityB: {
        pass: b.accessibility?.wcagAA?.pass ?? 0,
        warning: b.accessibility?.wcagAA?.warning ?? 0,
        critical: b.accessibility?.wcagAA?.critical ?? 0,
      },
    },
    colors: {
      totalA: colorsA.length,
      totalB: colorsB.length,
      shared,
      uniqueA,
      uniqueB,
      overlapPercentage,
    },
    typography: {
      familiesA,
      familiesB,
      sharedFamilies,
      sizesCountA: a.tokens.typography.sizes.length,
      sizesCountB: b.tokens.typography.sizes.length,
    },
    components: {
      totalA,
      totalB,
      typesA,
      typesB,
    },
    summary,
  };
}
