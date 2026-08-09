import { describe, it, expect } from "vitest";
import { cssColorToRgb, toHex, isNeutral, extractAllColors, hexToName } from "@/lib/colors";

describe("cssColorToRgb", () => {
  it("parses hex", () => {
    expect(cssColorToRgb("#ff0000")).toEqual({ r: 255, g: 0, b: 0 });
  });
  it("parses short hex", () => {
    expect(cssColorToRgb("#0f0")).toEqual({ r: 0, g: 255, b: 0 });
  });
  it("parses rgb()", () => {
    expect(cssColorToRgb("rgb(10, 20, 30)")).toEqual({ r: 10, g: 20, b: 30 });
  });
  it("parses rgba()", () => {
    expect(cssColorToRgb("rgba(255, 255, 255, 0.5)")).toEqual({ r: 255, g: 255, b: 255 });
  });
  it("parses hsl()", () => {
    const rgb = cssColorToRgb("hsl(0, 100%, 50%)");
    expect(rgb).not.toBeNull();
    expect(rgb!.r).toBeGreaterThan(250);
    expect(rgb!.g).toBeLessThan(10);
  });
  it("parses named colors", () => {
    expect(cssColorToRgb("red")).toEqual({ r: 255, g: 0, b: 0 });
    expect(cssColorToRgb("white")).toEqual({ r: 255, g: 255, b: 255 });
  });
  it("rejects transparent/currentColor/invalid", () => {
    expect(cssColorToRgb("transparent")).toBeNull();
    expect(cssColorToRgb("currentColor")).toBeNull();
    expect(cssColorToRgb("not-a-color")).toBeNull();
  });
});

describe("toHex", () => {
  it("formats channels", () => {
    expect(toHex({ r: 0, g: 0, b: 0 })).toBe("#000000");
    expect(toHex({ r: 255, g: 255, b: 255 })).toBe("#ffffff");
    expect(toHex({ r: 99, g: 102, b: 241 })).toBe("#6366f1");
  });
});

describe("isNeutral", () => {
  it("detects grayscale", () => {
    expect(isNeutral(128, 128, 128)).toBe(true);
    expect(isNeutral(0, 0, 0)).toBe(true);
    expect(isNeutral(255, 255, 255)).toBe(true);
    expect(isNeutral(99, 102, 241)).toBe(false);
  });
});

describe("extractAllColors", () => {
  it("finds hex + fn + named in one value", () => {
    const colors = extractAllColors("#ff0000 rgba(0,255,0,0.8) blue");
    expect(colors.length).toBe(3);
  });
});

describe("hexToName", () => {
  it("names hues and neutrals", () => {
    expect(hexToName("#ff0000")).toBe("red");
    expect(hexToName("#ffffff")).toBe("white");
    expect(hexToName("#000000")).toBe("black");
  });
});