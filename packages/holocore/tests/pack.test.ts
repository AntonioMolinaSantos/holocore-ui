import { execSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, expect, test } from "vitest";

// Packs the package, installs the tarball in a scratch project with the peers
// a user would add, and imports every entry from there. Needs the registry.
const pkgDir = fileURLToPath(new URL("..", import.meta.url));
const tsc = fileURLToPath(new URL("../../../node_modules/typescript/bin/tsc", import.meta.url));
let scratch = "";
let files: string[] = [];

beforeAll(() => {
  scratch = mkdtempSync(path.join(tmpdir(), "holocore-pack-"));
  const packed = JSON.parse(execSync(`npm pack --json --pack-destination "${scratch}"`, { cwd: pkgDir, encoding: "utf8" }))[0];
  files = packed.files.map((f: { path: string }) => f.path).sort();
  writeFileSync(path.join(scratch, "package.json"), JSON.stringify({ name: "scratch", private: true, type: "module" }));
  execSync(
    `npm install --no-audit --no-fund --loglevel=error "./${packed.filename}" three@0.170.0 @types/three@0.170.0 react@19.3.0 react-dom@19.3.0 @types/react@19.3.0`,
    { cwd: scratch, stdio: "pipe" },
  );
}, 300_000);

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true });
});

test("the tarball holds the build, the tokens, the README and the licence, nothing else", () => {
  expect(files.filter((f) => !f.startsWith("dist/") && !f.startsWith("tokens/"))).toEqual(["LICENSE", "README.md", "package.json"]);
  for (const f of ["tokens/src/index.mjs", "tokens/src/index.d.mts", "tokens/src/tokens.mjs", "tokens/src/contrast.mjs", "tokens/css/antonio-molina.css", "tokens/css/jarvis.css", "tokens/css/tokens.css"]) expect(files).toContain(f);
  for (const f of ["dist/lite.js", "dist/webgl.js", "dist/react.js", "dist/lite.d.ts", "dist/webgl.d.ts", "dist/react.d.ts", "dist/cdn/holocore-lite.min.js"]) {
    expect(files).toContain(f);
  }
});

test("installed from the tarball, every entry imports", () => {
  writeFileSync(path.join(scratch, "check.mjs"), [
    'const lite = await import("holocore-ui/lite");',
    'const webgl = await import("holocore-ui/webgl");',
    'const react = await import("holocore-ui/react");',
    'const tokens = await import("holocore-ui/tokens");',
    "console.log(JSON.stringify([typeof lite.mount, typeof webgl.mount, typeof react.Holocore, Object.keys(lite.PRESETS).sort(), typeof tokens.brand, tokens.TOKENS[\"antonio-molina\"] !== undefined]));",
  ].join("\n"));
  const out = execSync("node check.mjs", { cwd: scratch, encoding: "utf8" }).trim();
  expect(JSON.parse(out)).toEqual(["function", "function", "function", ["holo", "mono", "neutral"], "function", true]);
}, 60_000);

test("a TypeScript consumer gets the declared types of every entry", () => {
  writeFileSync(path.join(scratch, "consumer.ts"), [
    'import { mount } from "holocore-ui/lite";',
    'import { mount as mountGl, type WebglOptions } from "holocore-ui/webgl";',
    'import type { HolocoreProps } from "holocore-ui/react";',
    'import { contrast } from "holocore-ui/tokens";',
    'const ratio: number = contrast("#FFFFFF", "#000000");',
    'const el = document.createElement("div");',
    'const a = mount(el, { theme: { preset: "holo", accent: "#FF0000" }, rings: 3, activity: "busy", level: 0.5 });',
    "a.update({ level: 1 });",
    'const opts: WebglOptions = { engine: "auto" };',
    'const engine: "lite" | "webgl" = mountGl(el, opts).engine;',
    'const props: HolocoreProps = { engine: "lite", level: 0.2 };',
    "// @ts-expect-error rings is a number",
    'mount(el, { rings: "3" });',
    "export { a, engine, props };",
  ].join("\n"));
  execSync(`node "${tsc}" --noEmit --strict --target es2022 --module esnext --moduleResolution bundler --lib es2022,dom --skipLibCheck consumer.ts`, { cwd: scratch, stdio: "pipe" });
}, 60_000);
