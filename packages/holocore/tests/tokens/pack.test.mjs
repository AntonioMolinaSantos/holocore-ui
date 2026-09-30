import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { TOKENS, brand, contrast } from "../../tokens/src/index.mjs";

test("the tokens entry exports the tokens, a brand lookup and contrast", () => {
  expect(brand("antonio-molina")).toBe(TOKENS["antonio-molina"]);
  expect(() => brand("acme")).toThrow(/unknown brand/);
  expect(contrast("#FFFFFF", "#000000")).toBeCloseTo(21, 0);
});

test("the manifest exports the tokens and their stylesheets, and keeps CSS imports as side effects", () => {
  const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
  expect(pkg.exports["./tokens"]).toEqual({ types: "./tokens/src/index.d.mts", import: "./tokens/src/index.mjs", default: "./tokens/src/index.mjs" });
  for (const css of ["antonio-molina.css", "jarvis.css", "tokens.css"]) expect(pkg.exports[`./tokens/${css}`]).toBe(`./tokens/css/${css}`);
  expect(pkg.files).toEqual(expect.arrayContaining(["tokens/src", "tokens/css"]));
  expect(pkg.sideEffects).toEqual(["*.css"]); // false would let a bundler drop an imported stylesheet
});
