import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

// The public repository's content rules, checked on every file git would
// publish (tracked, or new and not ignored). This file names what it bans,
// so it is the one file the content checks skip.
const SELF = "tests/repo-rules.test.mjs";
const TEXT = /\.(md|ts|tsx|mjs|js|json|html|css|yml|yaml|txt)$|(^|\/)(LICENSE|\.nvmrc|\.gitignore|\.gitattributes)$/;
const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { encoding: "utf8" })
  .split("\n")
  .filter((f) => f && TEXT.test(f) && !f.endsWith("package-lock.json") && f !== SELF);
const read = (f) => readFileSync(f, "utf8");
const offenders = (list, re) => list.filter((f) => re.test(read(f)));

test("no em dash or en dash in any file", () => {
  expect(offenders(files, /[\u2013\u2014]/)).toEqual([]);
});

test("no private path, no private console and no booking link", () => {
  // Private repository names are checked by the scan that runs before this
  // repository turns public, never listed here.
  const banned = /private console|apps\/jarvis|components\/hub|Desktop[\\/]Business|C:[\\/]Users|book a call|\/en\/book/i;
  expect(offenders(files, banned)).toEqual([]);
});

test("the orb and the lab never name the private console", () => {
  // The brand tokens carry a brand named jarvis (and the manifest and README list its
  // stylesheet); the orb's code and the lab never name it.
  const scoped = files.filter((f) => f.startsWith("packages/holocore/src/") || f.startsWith("apps/lab/"));
  expect(offenders(scoped, /jarvis/i)).toEqual([]);
});

test("no pricing and no phone number", () => {
  expect(offenders(files, /[€£]\s?\d|\$\s?\d{2,}|\+\d{2}[\s\d]{8,}/)).toEqual([]);
});

test("every measurement in the README is filled in", () => {
  expect(read("README.md")).not.toMatch(/@@[A-Z_]+@@/);
});

test("the README ends with the one byline", () => {
  expect(read("README.md").trimEnd().endsWith("Made by Antonio Molina, [antonio-molina.fr](https://www.antonio-molina.fr/en)")).toBe(true);
});
