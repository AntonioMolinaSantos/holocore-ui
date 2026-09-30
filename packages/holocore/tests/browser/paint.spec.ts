import { expect, test, type Page } from "@playwright/test";

const ENGINES = ["lite", "webgl"] as const;

const orb = (page: Page) => ({
  mount: (engine: string, options: object = {}) =>
    page.evaluate(([e, o]) => (window as any).harness.mount(e, o) as string, [engine, options] as const),
  frames: () => page.evaluate(() => (window as any).harness.frames() as number),
  update: (options: object) => page.evaluate((o) => (window as any).harness.update(o), options),
});

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => "harness" in window, null, { polling: 50 });
});

for (const engine of ENGINES) {
  test(`${engine} paints and reports its frames on the container`, async ({ page }) => {
    const o = orb(page);
    expect(await o.mount(engine)).toBe(engine);
    await expect.poll(o.frames, { timeout: 20_000 }).toBeGreaterThan(0);
    await expect(page.locator("#orb")).toHaveAttribute("data-holocore-engine", engine);
    await expect.poll(async () => Number(await page.getAttribute("#orb", "data-holocore-frames"))).toBeGreaterThan(0);
    const before = await o.frames();
    await expect.poll(o.frames).toBeGreaterThan(before);
  });

  test(`${engine} under reduced motion draws once, then again only when the level changes`, async ({ page }) => {
    const o = orb(page);
    await o.mount(engine, { reducedMotion: true });
    await expect.poll(o.frames, { timeout: 20_000 }).toBeGreaterThan(0);
    await page.waitForTimeout(500);
    const still = await o.frames();
    await page.waitForTimeout(500);
    expect(await o.frames()).toBe(still);
    await o.update({ level: 0.8 });
    await expect.poll(o.frames).toBeGreaterThan(still);
    await page.waitForTimeout(300);
    const after = await o.frames();
    await page.waitForTimeout(500);
    expect(await o.frames()).toBe(after);
  });
}

test("webgl survives a theme change followed by a rings and activity change", async ({ page }) => {
  const errors: Error[] = [];
  page.on("pageerror", (e) => errors.push(e));
  const o = orb(page);
  expect(await o.mount("webgl")).toBe("webgl");
  await expect.poll(o.frames, { timeout: 20_000 }).toBeGreaterThan(0);

  await o.update({ theme: "holo" });
  const afterTheme = await o.frames();
  await expect.poll(o.frames).toBeGreaterThan(afterTheme);

  await o.update({ rings: 6, activity: "busy" });
  const afterRings = await o.frames();
  await expect.poll(o.frames).toBeGreaterThan(afterRings);

  expect(errors).toEqual([]);
});
