import { expect, test } from "@playwright/test";

// Against the public web, so it runs only with LAB_LIVE=1 (Task 14): the
// GitHub link answers 200 only once the repository is public.
test("every footer link resolves without a redirect @live", async ({ page, request }) => {
  await page.goto("/");
  const hrefs = await page.locator("footer a").evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href));
  expect(hrefs.length).toBeGreaterThanOrEqual(3);
  for (const href of new Set(hrefs)) {
    const r = await request.get(href, { maxRedirects: 0 });
    expect(r.status(), href).toBe(200);
  }
});
