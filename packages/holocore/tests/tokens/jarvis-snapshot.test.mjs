import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { TOKENS } from "../../tokens/src/tokens.mjs";

// TOKENS.jarvis must never change silently: a change here must also update
// jarvis.snapshot.json, in the same pull request.
const snapshot = JSON.parse(readFileSync(new URL("./jarvis.snapshot.json", import.meta.url), "utf8"));

test("TOKENS.jarvis equals the committed snapshot", () => {
  expect(JSON.parse(JSON.stringify(TOKENS.jarvis))).toEqual(snapshot);
});
