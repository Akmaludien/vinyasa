const OPAQUE_KEYWORDS = new Set([
  "inherit", "initial", "unset", "revert", "none", "auto", "currentcolor",
]);

export function isUsableValue(raw: string): boolean {
  const value = raw.trim().toLowerCase();
  return Boolean(value) && !OPAQUE_KEYWORDS.has(value) && !value.startsWith("var(");
}
