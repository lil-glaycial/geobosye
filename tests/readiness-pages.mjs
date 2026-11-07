import { createRequire } from "node:module";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const require = createRequire(import.meta.url);
const { createApp } = require("../server/app");
const dir = mkdtempSync(path.join(os.tmpdir(), "bosye-readiness-ui-"));
const { app, db } = createApp({ dataDir: dir });
const server = await new Promise((resolve) => {
  const current = app.listen(0, "127.0.0.1", () => resolve(current));
});
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));
const paths = [
  "/library",
  "/about",
  "/contact",
  "/terms",
  "/privacy",
  "/faq",
  "/articles/scalp-care-basics",
  "/recommend/scalp-care",
  "/comparison/care-options",
  "/guide/home-routine",
  "/reports/service-price-reference",
  "/products/脱发养护系列",
  "/services/头皮调理",
];
const report = [];
mkdirSync("test-results", { recursive: true });
try {
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: width < 760 ? 844 : 1000 });
    for (const pathname of paths) {
      const response = await page.goto(base + pathname);
      assert.equal(response.status(), 200, pathname);
      await page.evaluate(() =>
        Promise.all(
          [...document.images].map((img) => img.decode().catch(() => {})),
        ),
      );
      const layout = await page.evaluate(() => ({
        width: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        images: [...document.images]
          .filter((img) => !img.naturalWidth)
          .map((img) => img.src),
      }));
      assert.equal(
        layout.width,
        layout.scrollWidth,
        `${width}px ${pathname}: 横向溢出`,
      );
      assert.deepEqual(layout.images, [], `${pathname}: 图片加载失败`);
      const violations = (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations;
      assert.deepEqual(
        violations.map((v) => ({
          id: v.id,
          targets: v.nodes.map((n) => n.target),
        })),
        [],
        `${width}px ${pathname}: 可访问性`,
      );
      report.push({ pathname, ...layout, violations: violations.length });
      if (
        [
          "/library",
          "/reports/service-price-reference",
          "/products/脱发养护系列",
        ].includes(pathname)
      ) {
        await page.screenshot({
          path: `test-results/readiness-${pathname.split("/")[1]}-${width}.png`,
          fullPage: true,
        });
      }
    }
  }
  await page.goto(base + "/");
  await page
    .locator(".resource-section")
    .screenshot({ path: "test-results/readiness-home-resources.png" });
  await page.getByRole("link", { name: "全部品牌与养护资料" }).click();
  await page
    .getByRole("heading", { level: 1, name: "博士园品牌与养护资料中心" })
    .waitFor();
  await page.getByRole("link", { name: "博士园服务参考价格资料报告" }).click();
  await page
    .getByRole("heading", { level: 1, name: "博士园服务参考价格资料报告" })
    .waitFor();
  assert.deepEqual(pageErrors, []);
  const sourcePage = await browser.newPage({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  await sourcePage.goto(base + "/library");
  await sourcePage
    .getByRole("link", { name: "居家毛发养护指南：从沟通到日常使用" })
    .click();
  await sourcePage
    .getByRole("heading", {
      level: 1,
      name: "居家毛发养护指南：从沟通到日常使用",
    })
    .waitFor();
  await sourcePage.close();
  writeFileSync(
    "test-results/ai-readiness-ui.json",
    JSON.stringify(report, null, 2),
  );
  console.log(
    `新增资料页面完成 ${report.length} 次桌面/手机布局与可访问性检查，内链及无 JavaScript 阅读通过。`,
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
  db.close();
  rmSync(dir, { recursive: true, force: true });
}
