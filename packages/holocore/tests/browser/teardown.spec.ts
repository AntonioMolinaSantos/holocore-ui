import { expect, test } from "@playwright/test";
import { probe } from "./probe";

const ENGINES = ["lite", "webgl"] as const;

for (const engine of ENGINES) {
  test(`${engine}: 30 mount and destroy cycles leave no frame, listener, observer, context or canvas`, async ({ page }) => {
    // 30 WebGL cycles on software rendering take about two minutes on a slow machine: this is a
    // time budget for the work, not a claim under test, so it never hides a leak.
    test.setTimeout(300_000);
    const warnings: string[] = [];
    page.on("console", (m) => { if (/too many active webgl contexts/i.test(m.text())) warnings.push(m.text()); });
    await page.addInitScript(probe);
    await page.goto("/");
    await page.waitForFunction(() => "harness" in window, null, { polling: 50 });
    const state = () =>
      page.evaluate(() => {
        const p = (window as any).__probe;
        return { frames: p.pendingFrames(), listeners: p.listeners(), observing: p.observing(), contexts: p.liveContexts(), children: (window as any).harness.children() };
      });
    const before = await state();
    for (let i = 0; i < 30; i++) {
      await page.evaluate((e) => (window as any).harness.mount(e), engine);
      await page.waitForFunction(() => (window as any).harness.frames() > 0, null, { polling: 50, timeout: 20_000 });
      await page.evaluate(() => (window as any).harness.destroy());
    }
    await page.waitForTimeout(250);
    expect(await state()).toEqual({ ...before, contexts: 0, children: 0 });
    expect(warnings).toEqual([]);
    // Deterministic version of "every context is gone": every context this
    // engine ever created (created()) fired webglcontextlost (lost()), rather
    // than relying on isContextLost() polling, which only tells the JS
    // wrapper's own view and not whether the browser actually reclaimed it.
    const counts = await page.evaluate(() => {
      const p = (window as any).__probe;
      return { created: p.created(), lost: p.lost() };
    });
    expect(counts.lost).toBe(counts.created);
  });
}
