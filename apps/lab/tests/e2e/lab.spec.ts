import { expect, test, type Page } from "@playwright/test";

const CAPTION = "This is Holocore. It listens, it thinks, and it speaks.";
const frames = (page: Page) => page.evaluate(() => Number(document.getElementById("orb")?.dataset.holocoreFrames ?? 0));
const peak = (page: Page) => page.evaluate(() => Number(document.getElementById("orb")?.dataset.levelPeak ?? 0));

async function paints(page: Page, engine: "lite" | "webgl") {
  await page.waitForFunction(
    (e) => { const el = document.getElementById("orb"); return el?.dataset.holocoreEngine === e && Number(el.dataset.holocoreFrames ?? 0) > 0; },
    engine, { timeout: 30_000, polling: 100 },
  );
}
async function advances(page: Page) {
  const before = await frames(page);
  await expect.poll(() => frames(page), { timeout: 10_000 }).toBeGreaterThan(before);
}
async function useMode(page: Page, engine: "lite" | "webgl") {
  await page.check(`input[name="mode"][value="${engine}"]`);
  await paints(page, engine);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("the orb moves on load, and no permission is asked", async ({ page }) => {
  let asked = false;
  page.on("dialog", () => { asked = true; });
  await paints(page, "webgl");
  await advances(page);
  expect(asked).toBe(false);
});

test("the orb paints in both engines", async ({ page }) => {
  await useMode(page, "lite");
  await advances(page);
  await useMode(page, "webgl");
  await advances(page);
});

test("each control changes the orb, and the config follows", async ({ page }) => {
  await paints(page, "webgl");
  const orb = page.locator("#orb");
  await page.selectOption("#preset", "mono");
  await expect(orb).toHaveAttribute("data-preset", "mono");
  await advances(page);
  await page.locator("#accent").fill("#ff0000");
  await expect(orb).toHaveAttribute("data-accent", "#FF0000");
  await advances(page);
  await page.locator("#rings").fill("6");
  await expect(orb).toHaveAttribute("data-rings", "6");
  await advances(page);
  await page.check('input[name="activity"][value="busy"]');
  await expect(orb).toHaveAttribute("data-activity", "busy");
  await advances(page);
  await expect(page.locator("#config")).toContainText('theme: { preset: "mono", accent: "#FF0000" }');
  await expect(page.locator("#config")).toContainText('activity: "busy"');
});

test("Copy this config copies the snippet on screen", async ({ page, context, browserName }) => {
  if (browserName === "chromium") await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await paints(page, "webgl");
  await page.selectOption("#preset", "neutral");
  await page.click("#copy");
  await expect(page.locator("#copy-status")).toHaveText("Copied");
  const shown = await page.locator("#config").textContent();
  expect(shown).toContain('theme: "neutral"');
  // WebKit in Playwright cannot be granted clipboard-read; its "Copied" is the resolved write.
  // Windows normalises \n to \r\n on the system clipboard, so the round trip is compared with that undone.
  if (browserName === "chromium") {
    expect((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, "\n")).toBe(shown);
  }
});

for (const engine of ["lite", "webgl"] as const) {
  test(`Play a sample moves the ${engine} orb and shows its caption`, async ({ page, browserName }) => {
    test.skip(browserName === "webkit" && process.platform === "win32", "Playwright's Windows WebKit has no Web Audio");
    await useMode(page, engine);
    await page.click("#sample");
    await expect(page.locator("#caption")).toHaveText(CAPTION);
    await expect.poll(() => peak(page), { timeout: 10_000 }).toBeGreaterThan(0.05);
    await expect(page.locator("#caption")).toBeHidden({ timeout: 15_000 });
  });
}

test("a sample that fails to play shows a status and hides the caption", async ({ page, browserName }) => {
  test.skip(browserName === "webkit" && process.platform === "win32", "Playwright's Windows WebKit has no Web Audio");
  const errors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.addInitScript(() => {
    HTMLMediaElement.prototype.play = () => Promise.reject(new DOMException("stubbed for the test", "NotSupportedError"));
  });
  await page.goto("/");
  await paints(page, "webgl");
  await page.click("#sample");
  await expect(page.locator("#sample-status")).toHaveText("Sample could not play");
  await expect(page.locator("#caption")).toBeHidden();
  expect(errors.some((e) => e.includes("the sample could not play"))).toBe(true);
});

test("on a phone the orb fits, the controls stack under it, and nothing scrolls sideways", async ({ page }) => {
  const width = page.viewportSize()?.width ?? 0;
  test.skip(width > 500, "phone widths only");
  await paints(page, "webgl");
  const orb = await page.locator("#orb").boundingBox();
  const panel = await page.locator(".panel").boundingBox();
  expect(orb && orb.x >= 0 && orb.x + orb.width <= width).toBe(true);
  expect(panel && orb && panel.y >= orb.y + orb.height - 1).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("?fps shows a live frame rate for the engine on screen", async ({ page }) => {
  await page.goto("/?fps");
  const meter = page.locator("#fps");
  await expect(meter).toBeVisible();
  await expect(meter).toHaveText(/^\d+ fps, (lite|webgl)$/, { timeout: 15_000 });
});

test("without ?fps there is no frame rate on the page", async ({ page }) => {
  await page.waitForTimeout(1500);
  await expect(page.locator("#fps")).toHaveCount(0);
});
