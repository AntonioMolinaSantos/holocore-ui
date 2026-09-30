// The README's frame rates. The lab's e2e preview build (npm run build:e2e,
// then npm run preview:e2e), in Chromium with Playwright's Moto G4 profile and
// the CPU slowed four times through the DevTools protocol. Per mode: 2 seconds
// of warm-up, then the orb's own frame counter over 10 seconds, timed at each
// update of data-holocore-frames. Headless Chromium draws WebGL in software
// (SwiftShader), so a real phone's GPU does better than the WebGL figure.
// A Playwright trace per mode goes to apps/lab/fps/ (not committed).
//   node scripts/measure-fps.mjs [base URL, default http://localhost:4317]
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium, devices } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:4317";
const out = fileURLToPath(new URL("../fps/", import.meta.url));
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--ignore-gpu-blocklist"] });
console.log(`measured ${new Date().toISOString().slice(0, 10)}, Chromium ${browser.version()}, Moto G4 profile, CPU 4x slower`);

for (const engine of ["lite", "webgl"]) {
  const context = await browser.newContext({ ...devices["Moto G4"] });
  await context.tracing.start({ screenshots: true, snapshots: false });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.goto(base);
  await page.check(`input[name="mode"][value="${engine}"]`);
  await page.waitForFunction(
    (e) => { const el = document.getElementById("orb"); return el?.dataset.holocoreEngine === e && Number(el.dataset.holocoreFrames ?? 0) > 0; },
    engine, { timeout: 60_000, polling: 100 },
  );
  await page.waitForTimeout(2000);
  await page.evaluate(() => {
    const el = document.getElementById("orb");
    const log = [];
    window.__fpsLog = log;
    new MutationObserver(() => log.push([performance.now(), Number(el.dataset.holocoreFrames)])).observe(el, { attributes: true, attributeFilter: ["data-holocore-frames"] });
  });
  await page.waitForTimeout(10_000);
  const log = await page.evaluate(() => window.__fpsLog);
  await context.tracing.stop({ path: `${out}trace-${engine}.zip` });
  await context.close();
  const [t0, f0] = log[0];
  const [t1, f1] = log[log.length - 1];
  console.log(`${engine}: ${((f1 - f0) / ((t1 - t0) / 1000)).toFixed(1)} fps`);
}
await browser.close();
