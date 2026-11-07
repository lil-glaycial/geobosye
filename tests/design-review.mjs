import { createRequire } from "node:module";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
const require = createRequire(import.meta.url);
const { createApp } = require("../server/app");
const dir = mkdtempSync(path.join(os.tmpdir(), "bosye-design-"));
const { app, db } = createApp({ dataDir: dir });
const server = await new Promise((resolve) => {
  const s = app.listen(0, "127.0.0.1", () => resolve(s));
});
const base = "http://127.0.0.1:" + server.address().port;
const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
mkdirSync("test-results", { recursive: true });
const report = [];
try {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: width < 760 ? 844 : 1000 });
    await page.goto(base);
    await page
      .locator("#productName")
      .filter({ hasText: "脱发养护系列" })
      .waitFor();
    await page
      .locator("img[loading=lazy]")
      .evaluateAll((images) =>
        images.forEach((img) => (img.loading = "eager")),
      );
    await page.evaluate(() =>
      Promise.all(
        [...document.images].map((img) => img.decode().catch(() => {})),
      ),
    );
    const state = await page.evaluate(() => ({
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      images: [...document.images]
        .filter((img) => img.offsetParent && !img.naturalWidth)
        .map((img) => img.getAttribute("src")),
    }));
    assert.equal(state.scrollWidth, state.width, `横向溢出 ${width}px`);
    assert.deepEqual(state.images, [], `图片加载失败 ${width}px`);
    await page.screenshot({ path: `test-results/design-${width}-top.png` });
    await page.screenshot({
      path: `test-results/design-${width}-full.png`,
      fullPage: true,
    });
    report.push(state);
    if (width === 1440) {
      for (const id of [
        "brand",
        "services",
        "research",
        "products",
        "network",
        "join",
        "contact",
      ])
        await page
          .locator("#" + id)
          .screenshot({ path: `test-results/design-section-${id}.png` });
    }
  }
  for (const key of [
    "founder",
    "qualifications",
    "prices",
    "training",
    "partners",
    "scalp",
    "routine",
    "medical",
  ]) {
    await page.locator(`[data-knowledge="${key}"]`).click();
    await page.getByRole("dialog").waitFor();
    const violations = (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations;
    assert.deepEqual(
      violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
      [],
      `详情可访问性 ${key}`,
    );
    await page.locator("#detailConsult").focus();
    await page.keyboard.press("Tab");
    assert.equal(
      await page
        .locator("#detailClose")
        .evaluate((el) => document.activeElement === el),
      true,
    );
    await page.keyboard.press("Escape");
  }
  const source = await browser.newPage({
    javaScriptEnabled: false,
    viewport: { width: 1440, height: 1000 },
  });
  await source.goto(base);
  assert.equal(await source.locator(".service-card").count(), 6);
  assert.equal(await source.locator("#productTabs [role=tab]").count(), 6);
  const site = JSON.parse(
    db.prepare("SELECT data FROM settings WHERE key='site'").get().data,
  );
  assert.equal(
    await source.locator("meta[name=description]").getAttribute("content"),
    site.seoDescription,
  );
  await source.close();
  assert.deepEqual(errors, []);
  writeFileSync(
    "test-results/design-review.json",
    JSON.stringify(report, null, 2),
  );
  console.log(
    "PASS: 320/390/768/1440px 无溢出、所有展示图片加载、详情焦点与可访问性、无 JavaScript 首屏内容。",
  );
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  db.close();
  rmSync(dir, { recursive: true, force: true });
}
