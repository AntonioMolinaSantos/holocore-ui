import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// The CDN file must work from a plain <script type="module">, with no other
// file: every request but the page and the file is refused and recorded.
test("the lite CDN file draws the orb with no other file", async ({ page }) => {
  const js = readFileSync(new URL("../../dist/cdn/holocore-lite.min.js", import.meta.url));
  const others: string[] = [];
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (url === "https://page.example/") {
      return route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><body style="margin:0;background:#000"><div id="orb" style="width:320px;height:320px"></div>
<script type="module">import { mount } from "https://cdn.example/holocore-lite.min.js"; mount(document.getElementById("orb"), { theme: "holo" });</script></body>`,
      });
    }
    if (url === "https://cdn.example/holocore-lite.min.js") {
      return route.fulfill({ body: js, contentType: "text/javascript", headers: { "access-control-allow-origin": "*" } });
    }
    // A favicon is the browser's own request, not the page's.
    if (!url.endsWith("/favicon.ico")) others.push(url);
    return route.abort();
  });
  await page.goto("https://page.example/");
  await expect.poll(() => page.evaluate(() => Number(document.getElementById("orb")?.dataset.holocoreFrames ?? 0)), { timeout: 20_000 }).toBeGreaterThan(0);
  expect(others).toEqual([]);
});
