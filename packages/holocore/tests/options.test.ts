import { expect, test } from "vitest";
import { DEFAULTS, resolveOptions } from "../src/options";
import { PRESETS } from "../src/theme";

test("defaults: Neutral, three calm rings, silent, moving", () => {
  expect(resolveOptions(undefined)).toEqual({ theme: PRESETS.neutral, rings: 3, activity: "calm", lit: null, level: 0, still: false });
  expect(Object.isFrozen(DEFAULTS)).toBe(true);
});

test("rings are floored and clamped to 0..8; anything else keeps the previous count", () => {
  expect(resolveOptions({ rings: 5.8 }).rings).toBe(5);
  expect(resolveOptions({ rings: -2 }).rings).toBe(0);
  expect(resolveOptions({ rings: 12 }).rings).toBe(8);
  const prev = resolveOptions({ rings: 6 });
  expect(resolveOptions({ rings: Number.NaN }, prev).rings).toBe(6);
  expect(resolveOptions({ rings: "4" as unknown as number }, prev).rings).toBe(6);
});

test("activity is calm or busy, nothing else", () => {
  expect(resolveOptions({ activity: "busy" }).activity).toBe("busy");
  expect(resolveOptions({ activity: "frantic" as never }).activity).toBe("calm");
});

test("level is clamped, and anything not a number keeps the previous level", () => {
  expect(resolveOptions({ level: 1.7 }).level).toBe(1);
  expect(resolveOptions({ level: -2 }).level).toBe(0);
  const prev = resolveOptions({ level: 0.3 });
  expect(resolveOptions({ level: "0.9" as unknown as number }, prev).level).toBe(0.3);
  expect(resolveOptions({ level: Number.NaN }, prev).level).toBe(0.3);
});

test("a theme equal by value keeps the same object, so an engine repaints only on a real change", () => {
  const a = resolveOptions({ theme: { preset: "holo", accent: "#FF0000" } });
  const b = resolveOptions({ theme: { preset: "holo", accent: "#ff0000" } }, a);
  expect(b.theme).toBe(a.theme);
  expect(resolveOptions({ theme: "mono" }, a).theme).toBe(PRESETS.mono);
  expect(resolveOptions({ level: 0.5 }, a).theme).toBe(a.theme);
});

test("reducedMotion sets a still orb", () => {
  expect(resolveOptions({ reducedMotion: true }).still).toBe(true);
  expect(resolveOptions({}, { ...DEFAULTS, still: true }).still).toBe(true);
});

test("lit is a count of rings, floored and at least 0; null hands the choice back to activity", () => {
  expect(resolveOptions({ lit: 2.7 }).lit).toBe(2);
  expect(resolveOptions({ lit: -1 }).lit).toBe(0);
  const prev = resolveOptions({ lit: 2 });
  expect(resolveOptions({ lit: Number.NaN }, prev).lit).toBe(2);
  expect(resolveOptions({ lit: "3" as unknown as number }, prev).lit).toBe(2);
  expect(resolveOptions({ level: 0.4 }, prev).lit).toBe(2);
  expect(resolveOptions({ lit: null }, prev).lit).toBeNull();
});
