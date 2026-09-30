import { expect, test } from "vitest";
import { levelFromRms, rms } from "../../src/levels";

test("rms of a buffer", () => {
  expect(rms(new Float32Array([1, -1, 1, -1]))).toBe(1);
  expect(rms(new Float32Array(8))).toBe(0);
  expect(rms(new Float32Array(0))).toBe(0);
});

test("a level from rms: -60 dBFS and below is 0, -12 dBFS and above is 1, linear in decibels between", () => {
  expect(levelFromRms(0)).toBe(0);
  expect(levelFromRms(0.001)).toBeCloseTo(0, 6);
  expect(levelFromRms(10 ** (-36 / 20))).toBeCloseTo(0.5, 6);
  expect(levelFromRms(10 ** (-12 / 20))).toBeCloseTo(1, 6);
  expect(levelFromRms(1)).toBe(1);
  expect(levelFromRms(Number.NaN)).toBe(0);
});
