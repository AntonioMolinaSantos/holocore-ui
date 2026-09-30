// The README's animated capture: the lab's e2e preview build in WebGL, Holo,
// three busy rings, 6 seconds at 480 by 480, recorded by Playwright and turned
// into docs/holocore.gif by ffmpeg, which must be on PATH.
//   node scripts/capture.mjs [base URL, default http://localhost:4317]
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:4317";
const dir = fileURLToPath(new URL("../capture/", import.meta.url));
const docs = fileURLToPath(new URL("../../../docs/", import.meta.url));
const gif = `${docs}holocore.gif`;
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
mkdirSync(docs, { recursive: true });

const browser = await chromium.launch({ args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--ignore-gpu-blocklist"] });
const context = await browser.newContext({ viewport: { width: 480, height: 480 }, recordVideo: { dir, size: { width: 480, height: 480 } } });
const t0 = Date.now();
const page = await context.newPage();
await page.goto(base);
await page.check('input[name="mode"][value="webgl"]');
await page.check('input[name="activity"][value="busy"]');
await page.waitForFunction(
  () => { const el = document.getElementById("orb"); return el?.dataset.holocoreEngine === "webgl" && Number(el.dataset.holocoreFrames ?? 0) > 0; },
  null, { timeout: 60_000, polling: 100 },
);
// Only the orb in frame.
await page.addStyleTag({ content: ".panel, .install, footer, .caption { display: none !important; } .lab { padding: 0 !important; } .stage-wrap { height: 480px !important; min-height: 0 !important; }" });
await page.waitForTimeout(1000);
const start = (Date.now() - t0) / 1000;
await page.waitForTimeout(6000);
const video = page.video();
await context.close();
await browser.close();
const webm = await video.path();
execFileSync("ffmpeg", [
  "-y", "-loglevel", "error", "-ss", start.toFixed(2), "-t", "6", "-i", webm,
  "-vf", "fps=20,scale=360:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer",
  "-loop", "0", gif,
], { stdio: "inherit" });
console.log(`wrote docs/holocore.gif, ${(statSync(gif).size / 1024 / 1024).toFixed(1)} MB`);
