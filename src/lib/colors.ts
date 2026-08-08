import type { Rgb } from "./types";

const NAMED: Record<string, [number, number, number]> = {
  black: [0, 0, 0],
  silver: [192, 192, 192],
  gray: [128, 128, 128],
  grey: [128, 128, 128],
  white: [255, 255, 255],
  maroon: [128, 0, 0],
  red: [255, 0, 0],
  purple: [128, 0, 128],
  fuchsia: [255, 0, 255],
  green: [0, 128, 0],
  lime: [0, 255, 0],
  olive: [128, 128, 0],
  yellow: [255, 255, 0],
  navy: [0, 0, 128],
  blue: [0, 0, 255],
  teal: [0, 128, 128],
  aqua: [0, 255, 255],
  aliceblue: [240, 248, 255],
  antiquewhite: [250, 235, 215],
  aquamarine: [127, 255, 212],
  azure: [240, 255, 255],
  beige: [245, 245, 220],
  bisque: [255, 228, 196],
  blanchedalmond: [255, 235, 205],
  blueviolet: [138, 43, 226],
  brown: [165, 42, 42],
  burlywood: [222, 184, 135],
  cadetblue: [95, 158, 160],
  chartreuse: [127, 255, 0],
  chocolate: [210, 105, 30],
  coral: [255, 127, 80],
  cornflowerblue: [100, 149, 237],
  cornsilk: [255, 248, 220],
  crimson: [220, 20, 60],
  cyan: [0, 255, 255],
  darkblue: [0, 0, 139],
  darkcyan: [0, 139, 139],
  darkgoldenrod: [184, 134, 11],
  darkgray: [169, 169, 169],
  darkgreen: [0, 100, 0],
  darkgrey: [169, 169, 169],
  darkkhaki: [189, 183, 107],
  darkmagenta: [139, 0, 139],
  darkolivegreen: [85, 107, 47],
  darkorange: [255, 140, 0],
  darkorchid: [153, 50, 204],
  darkred: [139, 0, 0],
  darksalmon: [233, 150, 122],
  darkseagreen: [143, 188, 143],
  darkslateblue: [72, 61, 139],
  darkslategray: [47, 79, 79],
  darkslategrey: [47, 79, 79],
  darkturquoise: [0, 206, 209],
  darkviolet: [148, 0, 211],
  deeppink: [255, 20, 147],
  deepskyblue: [0, 191, 255],
  dimgray: [105, 105, 105],
  dimgrey: [105, 105, 105],
  dodgerblue: [30, 144, 255],
  firebrick: [178, 34, 34],
  floralwhite: [255, 250, 240],
  forestgreen: [34, 139, 34],
  gainsboro: [220, 220, 220],
  ghostwhite: [248, 248, 255],
  gold: [255, 215, 0],
  goldenrod: [218, 165, 32],
  greenyellow: [173, 255, 47],
  honeydew: [240, 255, 240],
  hotpink: [255, 105, 180],
  indianred: [205, 92, 92],
  indigo: [75, 0, 130],
  ivory: [255, 255, 240],
  khaki: [240, 230, 140],
  lavender: [230, 230, 250],
  lavenderblush: [255, 240, 245],
  lawngreen: [124, 252, 0],
  lemonchiffon: [255, 250, 205],
  lightblue: [173, 216, 230],
  lightcoral: [240, 128, 128],
  lightcyan: [224, 255, 255],
  lightgoldenrodyellow: [250, 250, 210],
  lightgray: [211, 211, 211],
  lightgreen: [144, 238, 144],
  lightgrey: [211, 211, 211],
  lightpink: [255, 182, 193],
  lightsalmon: [255, 160, 122],
  lightseagreen: [32, 178, 170],
  lightskyblue: [135, 206, 250],
  lightslategray: [119, 136, 153],
  lightslategrey: [119, 136, 153],
  lightsteelblue: [176, 196, 222],
  lightyellow: [255, 255, 224],
  limegreen: [50, 205, 50],
  linen: [250, 240, 230],
  magenta: [255, 0, 255],
  mediumaquamarine: [102, 205, 170],
  mediumblue: [0, 0, 205],
  mediumorchid: [186, 85, 211],
  mediumpurple: [147, 112, 219],
  mediumseagreen: [60, 179, 113],
  mediumslateblue: [123, 104, 238],
  mediumspringgreen: [0, 250, 154],
  mediumturquoise: [72, 209, 204],
  mediumvioletred: [199, 21, 133],
  midnightblue: [25, 25, 112],
  mintcream: [245, 255, 250],
  mistyrose: [255, 228, 225],
  moccasin: [255, 228, 181],
  navajowhite: [255, 222, 173],
  oldlace: [253, 245, 230],
  olivedrab: [107, 142, 35],
  orange: [255, 165, 0],
  orangered: [255, 69, 0],
  orchid: [218, 112, 214],
  palegoldenrod: [238, 232, 170],
  palegreen: [152, 251, 152],
  paleturquoise: [175, 238, 238],
  palevioletred: [219, 112, 147],
  papayawhip: [255, 239, 213],
  peachpuff: [255, 218, 185],
  peru: [205, 133, 63],
  pink: [255, 192, 203],
  plum: [221, 160, 221],
  powderblue: [176, 224, 230],
  rosybrown: [188, 143, 143],
  royalblue: [65, 105, 225],
  saddlebrown: [139, 69, 19],
  salmon: [250, 128, 114],
  sandybrown: [244, 164, 96],
  seagreen: [46, 139, 87],
  seashell: [255, 245, 238],
  sienna: [160, 82, 45],
  skyblue: [135, 206, 235],
  slateblue: [106, 90, 205],
  slategray: [112, 128, 144],
  slategrey: [112, 128, 144],
  snow: [255, 250, 250],
  springgreen: [0, 255, 127],
  steelblue: [70, 130, 180],
  tan: [210, 180, 140],
  thistle: [216, 191, 216],
  tomato: [255, 99, 71],
  turquoise: [64, 224, 208],
  violet: [238, 130, 238],
  wheat: [245, 222, 179],
  whitesmoke: [245, 245, 245],
  yellowgreen: [154, 205, 50],
};

export function clamp(n: number, min = 0, max = 255): number {
  return Math.min(max, Math.max(min, n));
}

export function isNeutral(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max - min <= 18;
}

export function toHex(rgb: Rgb): string {
  const to = (n: number) =>
    clamp(Math.round(n))
      .toString(16)
      .padStart(2, "0");
  return `#${to(rgb.r)}${to(rgb.g)}${to(rgb.b)}`;
}

function hexToRgb(hex: string): Rgb | null {
  const h = hex.replace(/^#/, "");
  if (!/^(#?)([0-9a-fA-F]{3,8})$/.test(h)) return null;
  let full = h;
  if (h.length === 3 || h.length === 4) {
    full = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (full.length < 6) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const hue = ((h % 360) + 360) % 360;
  const sat = clamp(s, 0, 1);
  const lum = clamp(l, 0, 1);
  const c = (1 - Math.abs(2 * lum - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lum - c / 2;
  let rgb: [number, number, number] = [0, 0, 0];
  if (hue < 60) rgb = [c, x, 0];
  else if (hue < 120) rgb = [x, c, 0];
  else if (hue < 180) rgb = [0, c, x];
  else if (hue < 240) rgb = [0, x, c];
  else if (hue < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  return {
    r: (rgb[0] + m) * 255,
    g: (rgb[1] + m) * 255,
    b: (rgb[2] + m) * 255,
  };
}

function channels(parts: string[]): number[] {
  const out: number[] = [];
  for (const p of parts) {
    const s = p.trim();
    if (!s) continue;
    const n = parseFloat(s);
    if (Number.isNaN(n)) return [];
    if (s.endsWith("%")) out.push(n / 100);
    else out.push(n);
  }
  return out;
}

function parseRgb(content: string): Rgb | null {
  const parts = content.split(/[,\s/]+/);
  const nums = channels(parts);
  if (nums.length < 3) return null;
  const to255 = (n: number, isPct: boolean) => (isPct ? n * 255 : n);
  const channelsList = content.split(/[,\s/]+/);
  const pct = channelsList.map((p) => p.trim().endsWith("%"));
  return {
    r: to255(nums[0], pct[0]),
    g: to255(nums[1], pct[1]),
    b: to255(nums[2], pct[2]),
  };
}

function parseHsl(content: string): Rgb | null {
  const nums = channels(content.split(/[,\s/]+/));
  if (nums.length < 3) return null;
  const h = nums[0];
  const s = content.includes("%") ? nums[1] : nums[1] / 100;
  const l = content.includes("%") ? nums[2] : nums[2] / 100;
  return hslToRgb(h, s, l);
}

function fnColorToRgb(value: string): Rgb | null {
  const m = value.match(/^\s*(rgb|rgba|hsl|hsla|hwb)\(\s*(.+?)\s*\)\s*$/i);
  if (!m) return null;
  const fn = m[1].toLowerCase();
  const content = m[2];
  if (fn === "rgb" || fn === "rgba") return parseRgb(content);
  if (fn === "hsl" || fn === "hsla") return parseHsl(content);
  return null;
}

export function cssColorToRgb(value: string): Rgb | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (
    v === "transparent" ||
    v === "currentcolor" ||
    v === "inherit" ||
    v === "initial" ||
    v === "unset" ||
    v === "revert" ||
    v === "var("
  ) {
    return null;
  }
  if (v.startsWith("#")) return hexToRgb(v);
  if (/^\w+\s*\(/.test(v)) return fnColorToRgb(v);
  const named = NAMED[v.trim()];
  if (named) return { r: named[0], g: named[1], b: named[2] };
  return null;
}

export function extractAllColors(value: string): Rgb[] {
  const out: Rgb[] = [];
  const hexRe = /#[0-9a-fA-F]{3,8}/g;
  const cleaned = value.replace(hexRe, (hex) => {
    const rgb = hexToRgb(hex);
    if (rgb) out.push(rgb);
    return " ";
  });
  const fnRe = /\b(?:rgb|rgba|hsl|hsla|hwb)\(\s*[^)]*\s*\)/gi;
  cleaned.replace(fnRe, (fn) => {
    const rgb = fnColorToRgb(fn);
    if (rgb) out.push(rgb);
    return " ";
  });
  const words = cleaned.split(/[\s,]+/);
  for (const w of words) {
    if (!w) continue;
    const named = NAMED[w.toLowerCase().trim()];
    if (named) out.push({ r: named[0], g: named[1], b: named[2] });
  }
  return out;
}

export function classifyRgb(rgb: Rgb): "pure" | "neutral" {
  return isNeutral(rgb.r, rgb.g, rgb.b) ? "neutral" : "pure";
}

const HUE_NAMES: Array<[number, string]> = [
  [15, "red"],
  [40, "orange"],
  [65, "amber"],
  [85, "yellow"],
  [140, "lime"],
  [165, "green"],
  [190, "teal"],
  [205, "cyan"],
  [230, "sky"],
  [245, "blue"],
  [280, "indigo"],
  [310, "violet"],
  [330, "purple"],
  [350, "pink"],
  [11, "rose"],
];

export function hexToName(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const { r, g, b } = rgb;
  if (isNeutral(r, g, b)) {
    const max = Math.max(r, g, b);
    if (max <= 45) return "black";
    if (max >= 225) return "white";
    const lum = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
    const hue = "gray";
    return lum > 0.5 ? `light-${hue}` : `dark-${hue}`;
  }
  const [hr, hg, hb] = [r / 255, g / 255, b / 255];
  const max = Math.max(hr, hg, hb);
  const min = Math.min(hr, hg, hb);
  let hue = 0;
  if (max === hr) hue = ((hg - hb) / (max - min || 1)) % 6;
  else if (max === hg) hue = (hb - hr) / (max - min || 1) + 2;
  else hue = (hr - hg) / (max - min || 1) + 4;
  hue = ((hue * 60) % 360 + 360) % 360;
  for (const [maxHue, name] of HUE_NAMES) {
    if (hue <= maxHue) return name;
  }
  return "rose";
}