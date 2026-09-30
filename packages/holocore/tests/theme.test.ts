import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { renderThemeValues } from "../../../scripts/holo-theme.mjs";
import { PRESETS, ROLES, mix, normalizeHex, resolveTheme, rgba, sameTheme } from "../src/theme";

describe("presets", () => {
  test("three presets, every role a six-digit hex, all frozen", () => {
    expect(Object.keys(PRESETS).sort()).toEqual(["holo", "mono", "neutral"]);
    for (const [name, t] of Object.entries(PRESETS)) {
      expect(Object.isFrozen(t), name).toBe(true);
      for (const r of ROLES) expect(t[r], `${name}.${r}`).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  test("the default is Neutral, which is not the Holo palette", () => {
    expect(resolveTheme(undefined)).toBe(PRESETS.neutral);
    expect(PRESETS.neutral.core).not.toBe(PRESETS.holo.core);
    expect(PRESETS.neutral.accent).not.toBe(PRESETS.holo.accent);
  });

  test("Holo is the design-tokens values, inlined by scripts/holo-theme.mjs", () => {
    const committed = readFileSync(new URL("../src/theme-values.ts", import.meta.url), "utf8").replace(/\r\n/g, "\n");
    expect(committed).toBe(renderThemeValues());
    expect(PRESETS.holo).toEqual({ core: "#14A0E6", rim: "#5CC8FF", accent: "#DD5A1E", glow: "#E8F4FB", ground: "#030B14" });
  });
});

describe("resolving a theme", () => {
  test("a preset name picks that preset; an unknown name keeps the base", () => {
    expect(resolveTheme("mono")).toBe(PRESETS.mono);
    expect(resolveTheme("nope" as never, PRESETS.holo)).toBe(PRESETS.holo);
  });

  test("roles override their preset, in #RGB or #RRGGBB, any case", () => {
    const t = resolveTheme({ preset: "mono", accent: "#f80" });
    expect(t.accent).toBe("#FF8800");
    expect(t.core).toBe(PRESETS.mono.core);
    expect(resolveTheme({ rim: "#abcdef" }).rim).toBe("#ABCDEF");
  });

  test("a role that is not a hex colour is ignored", () => {
    expect(resolveTheme({ accent: "red", core: "#12345" })).toEqual(PRESETS.neutral);
  });

  test("an object without a preset builds on the base it is given", () => {
    const t = resolveTheme({ accent: "#000000" }, PRESETS.holo);
    expect(t.core).toBe(PRESETS.holo.core);
    expect(t.accent).toBe("#000000");
  });

  test("two themes with the same roles are the same theme", () => {
    expect(sameTheme(resolveTheme({ preset: "holo" }), PRESETS.holo)).toBe(true);
    expect(sameTheme(PRESETS.mono, PRESETS.holo)).toBe(false);
  });
});

describe("colours at draw time", () => {
  test("rgba() for Canvas 2D", () => {
    expect(rgba("#14A0E6", 0.5)).toBe("rgba(20,160,230,0.5)");
  });

  test("mix() between two colours", () => {
    expect(mix("#000000", "#FFFFFF", 0.5)).toBe("#808080");
    expect(mix("#102030", "#102030", 0.3)).toBe("#102030");
    expect(mix("#000000", "#FF0000", 1)).toBe("#FF0000");
  });

  test("normalizeHex()", () => {
    expect(normalizeHex("#abc")).toBe("#AABBCC");
    expect(normalizeHex("#A1B2C3")).toBe("#A1B2C3");
    for (const bad of ["abc", "#abcd", "#GGGGGG", "", 12, null]) expect(normalizeHex(bad), String(bad)).toBeUndefined();
  });
});
