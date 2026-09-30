import { expect, test } from "@playwright/test";

const glFrames = (page: import("@playwright/test").Page) =>
  page.evaluate(() => Number(document.querySelector<HTMLElement>(".probe-root [data-holocore-engine='webgl']")?.dataset.holocoreFrames ?? 0));

test("the wrapper shows the lite orb at once, then hands over to WebGL", async ({ page }) => {
  await page.goto("/react.html");
  const root = page.locator(".probe-root");
  await expect(root).toHaveAttribute("data-holocore-engine", "webgl", { timeout: 30_000 });
  const seen = await page.evaluate(() => (window as any).seen as string[]);
  expect(seen[0]).toBe("lite");
  expect(seen.at(-1)).toBe("webgl");
  await expect(root.locator("canvas")).toHaveCount(1); // the lite orb was destroyed
  await expect.poll(() => glFrames(page)).toBeGreaterThan(0);
});

test("a prop change after the handover reaches the WebGL orb, which keeps drawing", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/react.html");
  await expect(page.locator(".probe-root")).toHaveAttribute("data-holocore-engine", "webgl", { timeout: 30_000 });
  await page.evaluate(() => (window as any).setLevel(0.9));
  const before = await glFrames(page);
  await expect.poll(() => glFrames(page)).toBeGreaterThan(before);
  expect(errors).toEqual([]);
});

test("without a WebGL loader the wrapper stays on the lite orb and never loads three", async ({ page }) => {
  const scripts: string[] = [];
  page.on("request", (r) => { if (/three/.test(r.url())) scripts.push(r.url()); });
  await page.goto("/react.html?lite-only");
  const root = page.locator(".probe-root");
  await expect(root).toHaveAttribute("data-holocore-engine", "lite");
  await page.waitForTimeout(1500); // time a handover would have needed
  await expect(root).toHaveAttribute("data-holocore-engine", "lite");
  expect(scripts).toEqual([]);
});
