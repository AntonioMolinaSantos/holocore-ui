// Colour roles, turned into colours at draw time. Neutral is the default;
// Holo carries the design-tokens values, inlined at build time.
import { HOLO } from "./theme-values";

export type Role = "core" | "rim" | "accent" | "glow" | "ground";
export const ROLES: readonly Role[] = Object.freeze(["core", "rim", "accent", "glow", "ground"]);
export type Theme = Readonly<Record<Role, string>>;
export type PresetName = "neutral" | "holo" | "mono";
/** A preset name, or roles (hex colours) over a preset. */
export type ThemeInput = PresetName | ({ preset?: PresetName } & Partial<Record<Role, string>>);

export const PRESETS: Readonly<Record<PresetName, Theme>> = Object.freeze({
  neutral: Object.freeze({ core: "#9FB0C3", rim: "#E4EAF1", accent: "#E8A25C", glow: "#FFFFFF", ground: "#0A0D12" }),
  holo: HOLO,
  mono: Object.freeze({ core: "#8A8A8A", rim: "#E0E0E0", accent: "#FFFFFF", glow: "#FFFFFF", ground: "#000000" }),
});

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** "#abc" or "#aabbcc" to "#AABBCC"; undefined for anything else. */
export function normalizeHex(v: unknown): string | undefined {
  if (typeof v !== "string" || !HEX.test(v)) return undefined;
  const h = v.slice(1);
  const six = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return `#${six.toUpperCase()}`;
}

/**
 * The theme to draw with. A preset name picks that preset. An object starts
 * from its preset, or from `base` without one, and replaces the roles it
 * names. A role that is not a hex colour, or an unknown preset, is ignored.
 */
export function resolveTheme(input: ThemeInput | undefined, base: Theme = PRESETS.neutral): Theme {
  if (input === undefined) return base;
  if (typeof input === "string") return Object.hasOwn(PRESETS, input) ? PRESETS[input] : base;
  if (typeof input !== "object" || input === null) return base;
  const start = input.preset && Object.hasOwn(PRESETS, input.preset) ? PRESETS[input.preset] : base;
  const out: Record<Role, string> = { ...start };
  for (const role of ROLES) {
    const hex = normalizeHex(input[role]);
    if (hex) out[role] = hex;
  }
  return Object.freeze(out);
}

export function sameTheme(a: Theme, b: Theme): boolean {
  return a === b || ROLES.every((r) => a[r] === b[r]);
}

/** A role's colour with an alpha, as Canvas 2D takes it. */
export function rgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/** The colour `t` of the way from `a` to `b`. */
export function mix(a: string, b: string, t: number): string {
  const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((x >> s) & 255) * (1 - t) + ((y >> s) & 255) * t);
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}
