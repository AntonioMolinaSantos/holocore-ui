import { expect, test } from "@playwright/test";
import { probe } from "./probe";

test("the webgl entry draws the lite orb where WebGL is refused", async ({ page }) => {
  // Refusing only webgl2: webglAvailable() still finds webgl1 and says
  // WebGL works, so chooseEngine picks "webgl"; three r170's WebGLRenderer
  // only ever asks for webgl2, so it throws in the engine's constructor and
  // the entry's try/catch is what actually falls back to lite here.
  await page.addInitScript(() => {
    const real = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      if (type === "webgl2") return null;
      return (real as (...a: unknown[]) => unknown).call(this, type, ...rest);
    } as typeof real;
  });
  await page.goto("/");
  await page.waitForFunction(() => "harness" in window, null, { polling: 50 });
  expect(await page.evaluate(() => (window as any).harness.mount("webgl") as string)).toBe("lite");
  await expect.poll(() => page.evaluate(() => (window as any).harness.frames() as number), { timeout: 20_000 }).toBeGreaterThan(0);
  await expect(page.locator("#orb")).toHaveAttribute("data-holocore-engine", "lite");
});

test("the webgl entry asked for lite never opens a WebGL context", async ({ page }) => {
  await page.addInitScript(probe);
  await page.goto("/");
  await page.waitForFunction(() => "harness" in window, null, { polling: 50 });
  expect(await page.evaluate(() => (window as any).harness.mountWebglEntry({ engine: "lite" }) as string)).toBe("lite");
  await expect.poll(() => page.evaluate(() => (window as any).harness.frames() as number), { timeout: 20_000 }).toBeGreaterThan(0);
  // liveContexts() alone would pass even without the fix: webglAvailable()'s
  // own probe context releases itself at once. created() counts every
  // getContext("webgl"|"webgl2") call regardless of what happens to it after,
  // so it is the assertion that actually tells "lite" skipped the probe.
  expect(await page.evaluate(() => (window as any).__probe.created() as number)).toBe(0);
});
