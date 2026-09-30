import { describe, expect, test } from "vitest";
import { ATTACK, RELEASE, sanitizeLevel, smoothLevel } from "../src/level";

describe("a caller's level", () => {
  test("is clamped to 0..1", () => {
    expect(sanitizeLevel(0.4)).toBe(0.4);
    expect(sanitizeLevel(-1)).toBe(0);
    expect(sanitizeLevel(2)).toBe(1);
    expect(sanitizeLevel(Infinity)).toBe(1);
    expect(sanitizeLevel(-Infinity)).toBe(0);
  });

  test("is ignored when it is not a number", () => {
    for (const bad of [Number.NaN, "0.5", null, undefined, {}, [0.5], true]) expect(sanitizeLevel(bad), String(bad)).toBeUndefined();
  });
});

describe("smoothing", () => {
  test("rises about two thirds of the way in one attack time", () => {
    const v = smoothLevel(0, 1, ATTACK);
    expect(v).toBeGreaterThan(0.6);
    expect(v).toBeLessThan(0.66);
  });

  test("falls more slowly than it rises", () => {
    expect(smoothLevel(1, 0, ATTACK)).toBeGreaterThan(0.75);
    expect(smoothLevel(1, 0, RELEASE)).toBeLessThan(0.4);
  });

  test("never overshoots, and lands exactly on the target", () => {
    let v = 0;
    for (let i = 0; i < 600; i++) {
      v = smoothLevel(v, 0.8, 1 / 60);
      expect(v).toBeLessThanOrEqual(0.8);
    }
    expect(v).toBe(0.8);
  });

  test("a zero or negative step changes nothing", () => {
    expect(smoothLevel(0.3, 1, 0)).toBe(0.3);
    expect(smoothLevel(0.3, 1, -1)).toBe(0.3);
  });
});
