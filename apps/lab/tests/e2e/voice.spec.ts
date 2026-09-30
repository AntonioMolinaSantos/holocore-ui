import { expect, test, type Page } from "@playwright/test";
import { micProbe } from "./mic-probe";

// A grant's own liveness is not the claim under test in most of these: give it room.
const GRANT_TIMEOUT = { timeout: 15_000 };

const count = (page: Page) => page.evaluate(() => (window as any).__mic.streams.length as number);
const anyLive = (page: Page) =>
  page.evaluate(() => ((window as any).__mic.streams as MediaStream[]).some((s) => s.getTracks().some((t) => t.readyState === "live")));
const allEnded = (page: Page) =>
  page.evaluate(() => ((window as any).__mic.streams as MediaStream[]).every((s) => s.getTracks().every((t) => t.readyState === "ended")));

async function pressTalk(page: Page) {
  const b = await page.locator("#talk").boundingBox();
  if (!b) throw new Error("#talk is not on screen");
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(micProbe);
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("#talk")).toBeEnabled();
});

test("the orb moves while the button is held, and every track stops on release", async ({ page }) => {
  await pressTalk(page);
  await expect.poll(() => anyLive(page), GRANT_TIMEOUT).toBe(true);
  await expect(page.locator("#talk")).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => page.evaluate(() => Number(document.getElementById("orb")?.dataset.levelPeak ?? 0)), { timeout: 10_000 }).toBeGreaterThan(0.05);
  await page.mouse.up();
  expect(await allEnded(page)).toBe(true); // stop() is synchronous: no poll needed
  await expect(page.locator("#talk")).toHaveAttribute("aria-pressed", "false");
});

const endings: [string, (page: Page) => Promise<unknown>][] = [
  ["a pointer cancel", (p) => p.locator("#talk").dispatchEvent("pointercancel", { pointerId: 1, bubbles: true })],
  ["losing pointer capture", (p) => p.locator("#talk").dispatchEvent("lostpointercapture", { pointerId: 1, bubbles: true })],
  ["the pointer leaving the button", (p) => p.locator("#talk").dispatchEvent("pointerleave", { pointerId: 1, bubbles: true })],
  ["the window losing focus", (p) => p.evaluate(() => window.dispatchEvent(new Event("blur")))],
  ["the tab hidden", (p) => p.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  })],
];
for (const [name, end] of endings) {
  test(`every track stops on ${name}, with the button still down`, async ({ page }) => {
    await pressTalk(page);
    await expect.poll(() => anyLive(page), GRANT_TIMEOUT).toBe(true);
    await end(page);
    expect(await allEnded(page)).toBe(true); // stop() is synchronous: no poll needed
    await page.mouse.up();
  });
}

test("the space bar holds to talk: no scroll, auto-repeat ignored, released anywhere ends it", async ({ page }) => {
  // Make the page tall enough that a scroll would be visible if one happened.
  await page.evaluate(() => {
    const spacer = document.createElement("div");
    spacer.style.height = "4000px";
    document.body.appendChild(spacer);
  });
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  expect(await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight)).toBe(true);
  const y = await page.evaluate(() => window.scrollY);
  await page.keyboard.down("Space");
  await expect.poll(() => anyLive(page), GRANT_TIMEOUT).toBe(true);
  await page.keyboard.down("Space"); // auto-repeat
  await page.keyboard.down("Space");
  await page.keyboard.up("Space");
  expect(await allEnded(page)).toBe(true); // stop() is synchronous: no poll needed
  expect(await count(page)).toBe(1);
  expect(await page.evaluate(() => window.scrollY)).toBe(y);
});

test("a permission granted after release is stopped at once, never connected", async ({ page }) => {
  await page.evaluate(() => { (window as any).__mic.gated = true; });
  await pressTalk(page);
  await expect.poll(() => count(page), GRANT_TIMEOUT).toBe(1);
  await page.mouse.up();
  await expect(page.locator("#talk")).toHaveAttribute("aria-pressed", "false");
  // Open the gate, then let the grant's .then() callback run before asserting.
  await page.evaluate(() => { (window as any).__mic.open(); return new Promise((r) => setTimeout(r, 0)); });
  expect(await page.evaluate(() => (window as any).__mic.returned)).toBe(1); // the late grant really reached the page
  expect(await allEnded(page)).toBe(true);
  expect(await page.evaluate(() => (window as any).__mic.contexts)).toBe(0);
});

test("a hold ends by itself after 30 seconds", async ({ page }) => {
  await page.clock.install();
  await page.reload();
  await page.waitForLoadState("networkidle");
  await pressTalk(page);
  await expect.poll(() => anyLive(page), GRANT_TIMEOUT).toBe(true);
  await page.clock.fastForward(30_001);
  expect(await allEnded(page)).toBe(true); // stop() is synchronous: no poll needed
  await page.mouse.up();
});

test("no MediaRecorder, and no request leaves the page, while the button is held", async ({ page }) => {
  const requests: string[] = [];
  await page.route("**/*", (route) => { requests.push(route.request().url()); return route.abort(); });
  await pressTalk(page);
  await expect.poll(() => anyLive(page), GRANT_TIMEOUT).toBe(true);
  await page.waitForTimeout(2000);
  await page.mouse.up();
  expect(await allEnded(page)).toBe(true); // stop() is synchronous: no poll needed
  expect(requests).toEqual([]);
  expect(await page.evaluate(() => (window as any).__mic.recorders)).toBe(0);
  expect(await page.evaluate(() => (window as any).__mic.sockets)).toBe(0);
  expect(await page.evaluate(() => (window as any).__mic.peers)).toBe(0);
});

const denials: [string, string, string][] = [
  ["NotAllowedError", "permission denied", "Microphone blocked: allow it in the browser to talk"],
  ["NotFoundError", "no device present", "No microphone found"],
];
for (const [errName, why, label] of denials) {
  test(`a rejection named ${errName} (${why}) shows "${label}"`, async ({ page }) => {
    await page.evaluate((name) => {
      const md = navigator.mediaDevices;
      md.getUserMedia = () => Promise.reject(Object.assign(new Error(name), { name }));
    }, errName);
    await pressTalk(page);
    await expect.poll(() => page.evaluate(() => document.getElementById("talk")?.dataset.state)).toBe("denied");
    await expect(page.locator("#talk")).toHaveText(label);
    await expect(page.locator("#talk")).toHaveAttribute("aria-pressed", "false");
  });
}
