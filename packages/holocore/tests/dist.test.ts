import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const dist = fileURLToPath(new URL("../dist/", import.meta.url));
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const STATIC = /\b(?:import|export)\b[^"'`;]*?\bfrom\s*["']([^"']+)["']|\bimport\s*["']([^"']+)["']/g;
const DYNAMIC = /\bimport\(\s*["']([^"']+)["']\s*\)/g;

/** Every module specifier a built file reaches, following its own chunks. */
function reach(file: string, dynamic: boolean, seen = new Set<string>()): string[] {
  if (seen.has(file)) return [];
  seen.add(file);
  const src = readFileSync(file, "utf8");
  const specs = [...src.matchAll(STATIC)].map((m) => m[1] ?? m[2]);
  if (dynamic) specs.push(...[...src.matchAll(DYNAMIC)].map((m) => m[1]));
  return specs.flatMap((s) => (s.startsWith(".") ? [s, ...reach(path.join(path.dirname(file), s), dynamic, seen)] : [s]));
}

describe("the built package", () => {
  test("has every entry, its declarations and the CDN file", () => {
    for (const f of ["lite.js", "webgl.js", "react.js", "lite.d.ts", "webgl.d.ts", "react.d.ts", "cdn/holocore-lite.min.js"]) {
      expect(existsSync(path.join(dist, f)), f).toBe(true);
    }
  });

  test("the lite entry pulls in no dependency: everything it reaches is its own file", () => {
    expect(reach(path.join(dist, "lite.js"), true).filter((s) => !s.startsWith("./"))).toEqual([]);
  });

  test("the package declares no runtime dependency; three and React are optional peers", () => {
    expect(pkg.dependencies).toBeUndefined();
    expect(pkg.peerDependenciesMeta).toEqual({ react: { optional: true }, three: { optional: true } });
  });

  test("three is reached from the webgl entry and never from the lite one", () => {
    expect(reach(path.join(dist, "webgl.js"), false)).toContain("three");
    expect(reach(path.join(dist, "lite.js"), true)).not.toContain("three");
  });

  test("the react entry never reaches the webgl entry or three, not even on demand", () => {
    // A bundler follows dynamic imports too: a React app on the lite orb must build without three.
    const all = reach(path.join(dist, "react.js"), true);
    expect(all).toContain("react");
    expect(all).not.toContain("three");
    expect(all.some((s) => /webgl/.test(s))).toBe(false);
  });

  test("the CDN file is one self-contained module", () => {
    const cdn = readFileSync(path.join(dist, "cdn/holocore-lite.min.js"), "utf8");
    expect([...cdn.matchAll(STATIC)].map((m) => m[1] ?? m[2])).toEqual([]);
    expect([...cdn.matchAll(DYNAMIC)]).toEqual([]);
    expect(cdn).toMatch(/export\s*\{/);
  });
});
