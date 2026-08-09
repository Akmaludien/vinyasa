import type { DesignModel, ColorToken } from "./model";

export interface PlaygroundState {
  colors: Record<string, string>;
  radius: Record<string, string>;
}

export function playgroundFromModel(m: DesignModel): PlaygroundState {
  const colors: Record<string, string> = {};
  for (const c of [...m.tokens.colors.primary, ...m.tokens.colors.neutral].slice(0, 24)) {
    colors[c.hex] = c.hex;
  }
  const radius: Record<string, string> = {};
  for (const r of m.tokens.radius.slice(0, 6)) {
    radius[r.raw] = r.raw;
  }
  return { colors, radius };
}

export function applyPlayground(m: DesignModel, state: PlaygroundState): DesignModel {
  const clone: DesignModel = JSON.parse(JSON.stringify(m));
  for (const c of clone.tokens.colors.primary) {
    if (state.colors[c.hex]) c.hex = state.colors[c.hex];
  }
  for (const c of clone.tokens.colors.neutral) {
    if (state.colors[c.hex]) c.hex = state.colors[c.hex];
  }
  for (const r of clone.tokens.radius) {
    if (state.radius[r.raw]) r.raw = state.radius[r.raw];
  }
  return clone;
}

export function diffTokens(a: ColorToken[], b: ColorToken[]): number {
  let changed = 0;
  const mapB = new Map(b.map((x) => [x.hex, x]));
  for (const ta of a) {
    const tb = mapB.get(ta.hex);
    if (tb && tb.hex !== ta.hex) changed++;
  }
  return changed;
}