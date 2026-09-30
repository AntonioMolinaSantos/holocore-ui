// The gzipped size of each mode, as the README quotes it, and the lite budget.
//   node scripts/size.mjs               print, and fail when lite is over budget
//   node scripts/size.mjs --set-budget  print, and write size-budget.json: the measured lite size plus 10 percent
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { build } from "esbuild";

const here = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const gz = (buf) => gzipSync(buf, { level: 9 }).length;
const kb = (n) => `${(n / 1024).toFixed(1)} kB`;

const lite = gz(readFileSync(here("dist/cdn/holocore-lite.min.js")));
const bundled = await build({
  entryPoints: [here("src/webgl.ts")], bundle: true, minify: true, format: "esm",
  platform: "browser", target: "es2022", write: false, logLevel: "silent",
});
const webgl = gz(bundled.outputFiles[0].contents);

console.log(`lite, one file from a CDN: ${lite} B gzip (${kb(lite)})`);
console.log(`webgl, three.js bundled and tree-shaken: ${webgl} B gzip (${kb(webgl)})`);

if (process.argv.includes("--set-budget")) {
  const budget = { liteGzipBytes: Math.ceil(lite * 1.1), measuredBytes: lite, measuredOn: new Date().toISOString().slice(0, 10) };
  writeFileSync(here("size-budget.json"), `${JSON.stringify(budget, null, 2)}\n`);
  console.log(`budget set: ${budget.liteGzipBytes} B`);
} else {
  const budget = JSON.parse(readFileSync(here("size-budget.json"), "utf8"));
  if (lite > budget.liteGzipBytes) {
    console.error(`lite is ${lite} B, over its budget of ${budget.liteGzipBytes} B (${budget.measuredBytes} B measured on ${budget.measuredOn}, plus 10 percent)`);
    process.exit(1);
  }
  console.log(`within budget: ${lite} of ${budget.liteGzipBytes} B`);
}
