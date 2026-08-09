import { describe, it, expect } from "vitest";
import { pxFromSize, splitFamilies, cxToMs, normalizeValue, parseKeywordWeight } from "@/lib/units";

describe("pxFromSize", () => {
  it("converts common units", () => {
    expect(pxFromSize("16px")).toBe(16);
    expect(pxFromSize("1rem")).toBe(16);
    expect(pxFromSize("2.25rem")).toBe(36);
    expect(pxFromSize("12pt")).toBeCloseTo(16, 0);
  });
  it("returns null for non-lengths", () => {
    expect(pxFromSize("auto")).toBeNull();
    expect(pxFromSize("inherit")).toBeNull();
  });
});

describe("splitFamilies", () => {
  it("splits and strips quotes", () => {
    expect(splitFamilies('"Inter", "Segoe UI", sans-serif')).toEqual(["Inter", "Segoe UI", "sans-serif"]);
  });
});

describe("cxToMs", () => {
  it("converts durations", () => {
    expect(cxToMs("300ms")).toBe(300);
    expect(cxToMs("1s")).toBe(1000);
  });
});

describe("normalizeValue", () => {
  it("normalizes case and whitespace", () => {
    expect(normalizeValue("  SeGoE  UI ")).toBe("segoe ui");
  });
});

describe("parseKeywordWeight", () => {
  it("maps keywords", () => {
    expect(parseKeywordWeight("bold")).toBe(700);
    expect(parseKeywordWeight("normal")).toBe(400);
  });
});