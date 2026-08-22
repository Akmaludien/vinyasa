import type { DesignModel } from "./model";

export interface DriftReport {
  targetUrl: string;
  previousTimestamp: string;
  currentTimestamp: string;
  scoreChange: number;
  addedColors: Array<{ hex: string; name?: string }>;
  removedColors: Array<{ hex: string; name?: string }>;
  fontChanges: {
    addedFamilies: string[];
    removedFamilies: string[];
  };
  componentCountChange: number;
  summary: string;
}

export function detectDesignDrift(previous: DesignModel, current: DesignModel): DriftReport {
  const prevScore = previous.health?.overall ?? 0;
  const currScore = current.health?.overall ?? 0;
  const scoreChange = currScore - prevScore;

  const prevColors = new Map([...previous.tokens.colors.primary, ...previous.tokens.colors.neutral].map((c) => [c.hex.toLowerCase(), c.name]));
  const currColors = new Map([...current.tokens.colors.primary, ...current.tokens.colors.neutral].map((c) => [c.hex.toLowerCase(), c.name]));

  const addedColors: Array<{ hex: string; name?: string }> = [];
  const removedColors: Array<{ hex: string; name?: string }> = [];

  for (const [hex, name] of currColors.entries()) {
    if (!prevColors.has(hex)) {
      addedColors.push({ hex, name });
    }
  }

  for (const [hex, name] of prevColors.entries()) {
    if (!currColors.has(hex)) {
      removedColors.push({ hex, name });
    }
  }

  const prevFonts = new Set(previous.tokens.typography.families.map((f) => f.raw));
  const currFonts = new Set(current.tokens.typography.families.map((f) => f.raw));

  const addedFamilies = [...currFonts].filter((f) => !prevFonts.has(f));
  const removedFamilies = [...prevFonts].filter((f) => !currFonts.has(f));

  const componentCountChange = (current.components?.length ?? 0) - (previous.components?.length ?? 0);

  const summary = `Design drift analysis: ${scoreChange >= 0 ? "+" : ""}${scoreChange} health score change, ${addedColors.length} added colors, ${removedColors.length} removed colors.`;

  return {
    targetUrl: current.source.url,
    previousTimestamp: previous.metadata.generatedAt,
    currentTimestamp: current.metadata.generatedAt,
    scoreChange,
    addedColors,
    removedColors,
    fontChanges: {
      addedFamilies,
      removedFamilies,
    },
    componentCountChange,
    summary,
  };
}
