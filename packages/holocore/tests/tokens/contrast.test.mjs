import { expect, test } from "vitest";
import { contrast } from "../../tokens/src/contrast.mjs";

// From review: a shorthand colour used to return NaN, and `NaN < 4.5` is
// false, so a guard written that way silently accepted the pair.
test("expands three-digit hex, in either case", () => {
  expect(contrast("#fff", "#000")).toBeCloseTo(21, 5);
  expect(contrast("#FFF", "#000000")).toBeCloseTo(contrast("#FFFFFF", "#000000"), 10);
});

test("reads six-digit hex in either case", () => {
  expect(contrast("#16283f", "#FCFCFD")).toBeCloseTo(contrast("#16283F", "#fcfcfd"), 10);
});

test("rejects anything else with a clear error instead of returning NaN", () => {
  for (const bad of ["fff", "#ffff", "#12345", "#GGGGGG", "rgb(0,0,0)", "", undefined, null, 123]) {
    expect(() => contrast(bad, "#000000"), String(bad)).toThrow(/six-digit or three-digit hex/);
    expect(() => contrast("#000000", bad), String(bad)).toThrow(/six-digit or three-digit hex/);
  }
});
