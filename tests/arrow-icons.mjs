import { createRequire } from "node:module";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { chromium, webkit, devices } from "playwright";

const require = createRequire(import.meta.url);
const { createApp } = require("../server/app");
const dir = mkdtempSync(path.join(os.tmpdir(), "bosye-arrows-"));
const { app, db } = createApp({ dataDir: dir });
const server = await new Promise((resolve) => {
  const current = app.listen(0, "127.0.0.1", () => resolve(current));
});
const base =
  process.env.ICON_TEST_ORIGIN || "http://127.0.0.1:" + server.address().port;
mkdirSync("test-results", { recursive: true });

try {
  for (const engine of [chromium, webkit]) {
    const browser = await engine.launch();
    try {
      for (const mobile of [false, true]) {
        const context = await browser.newContext(
          mobile
            ? devices[engine === webkit ? "iPhone 13" : "Pixel 7"]
            : { viewport: { width: 1440, height: 1000 } },
        );
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        for (const route of ["/", "/contact", "/library", "/news"]) {
          await page.goto(base + route);
          if (route === "/") {
            // A tab created by app.js confirms the client rerender has finished.
            await page.locator('#productTabs [data-product-index="1"]').click();
            await page
              .locator("#productName")
              .filter({ hasText: "白发养护系列" })
              .waitFor();
          }
          assert.ok(
            !(await page.locator("body").innerText()).includes("↗"),
            `${engine.name()} ${route}: font arrow remains`,
          );
          const icons = await page
            .locator("svg.icon-arrow-up-right")
            .evaluateAll((nodes) =>
              nodes.map((svg) => ({
                width: getComputedStyle(svg).width,
                height: getComputedStyle(svg).height,
                source: svg.querySelector("use").getAttribute("href"),
                hidden: svg.getAttribute("aria-hidden"),
              })),
            );
          assert.ok(icons.length > 0, `${route}: missing SVG arrows`);
          for (const icon of icons) {
            assert.equal(icon.width, "18px");
            assert.equal(icon.height, "18px");
            assert.equal(icon.source, "/assets/icons.svg#arrow-up-right");
            assert.equal(icon.hidden, "true");
          }
          assert.ok(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
            `${route}: horizontal overflow`,
          );
          if (route === "/") {
            // Verify the external SVG actually paints, including on WebKit.
            await page.waitForFunction(
              () =>
                document.querySelector(".service-arrow svg use").getBBox()
                  .width > 0,
            );
            const icon = page.locator(".service-arrow svg").first();
            const before = await icon.evaluate((svg) => {
              const box = svg.querySelector("use").getBBox();
              return {
                x: box.x,
                y: box.y,
                width: box.width,
                height: box.height,
              };
            });
            await page
              .locator(".service-arrow")
              .first()
              .evaluate((el) => {
                el.style.fontFamily = "serif";
                el.style.fontWeight = "900";
                el.style.fontSize = "48px";
              });
            assert.deepEqual(
              await icon.evaluate((svg) => {
                const box = svg.querySelector("use").getBBox();
                return {
                  x: box.x,
                  y: box.y,
                  width: box.width,
                  height: box.height,
                };
              }),
              before,
              "font changes must not change arrow geometry",
            );
            assert.equal((await icon.boundingBox()).width, 18);
            await icon.screenshot({
              path: `test-results/arrow-${engine.name()}-${mobile ? "mobile" : "desktop"}.png`,
              scale: "css",
            });
            await page
              .locator(".service-card")
              .first()
              .screenshot({
                path: `test-results/arrow-card-${engine.name()}-${mobile ? "mobile" : "desktop"}.png`,
              });
          }
        }
        assert.deepEqual(errors, []);
        await context.close();
      }
      const context = await browser.newContext({
        ...devices["iPhone 13"],
        javaScriptEnabled: false,
      });
      const page = await context.newPage();
      await page.goto(base);
      assert.ok(
        !(await page.locator("body").innerText()).includes("↗"),
        "server-rendered arrows must also use SVG",
      );
      assert.ok((await page.locator(".service-arrow svg").count()) > 0);
      await context.close();
    } finally {
      await browser.close();
    }
  }
  console.log(
    "SVG arrows verified on desktop Chromium, Android emulation, desktop WebKit and iPhone emulation, including server and client rendering.",
  );
} finally {
  await new Promise((resolve) => server.close(resolve));
  db.close();
  rmSync(dir, { recursive: true, force: true });
}
