import type { NexoraDesignContext } from "./nexora";

/**
 * Structural validation for the `nexora.design-context` payload that Vinyasa
 * sends to - and reads back from - Nexora. Mirrors Nexora's own canonical
 * guard so both sides agree on what a valid design context looks like.
 */
export function isCanonicalDesignContext(value: unknown): value is NexoraDesignContext {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  if (c.schema !== "nexora.design-context") return false;
  const ds = c.designSystem;
  if (typeof ds !== "object" || ds === null) return false;
  // A design context must carry a usable design system (colors, fonts, or
  // spacing) to be considered valid for persistence.
  const d = ds as Record<string, unknown>;
  const colors = Array.isArray(d.colors) ? d.colors : [];
  const neutral = Array.isArray(d.neutralColors) ? d.neutralColors : [];
  const families = Array.isArray(d.fontFamilies) ? d.fontFamilies : [];
  return colors.length + neutral.length + families.length > 0;
}