import { createRequire } from "node:module";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { chromium } from "playwright";
const require = createRequire(import.meta.url);
const { createApp } = require("../server/app");
const { setupAdmin } = require("../server/db");
const dir = mkdtempSync(path.join(os.tmpdir(), "bosye-browser-"));
const { app, db } = createApp({ dataDir: dir });
setupAdmin(db, "admin", "BrowserInitial!123", "网站管理员", true);
const server = await new Promise((resolve) => {
  const s = app.listen(0, "127.0.0.1", () => resolve(s));
});
const base = "http://127.0.0.1:" + server.address().port;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
mkdirSync("test-results", { recursive: true });
const screenshot = async (name) =>
  page.screenshot({ path: "test-results/" + name + ".png", fullPage: true });
try {
  await page.goto(base);
  await page
    .getByRole("button", { name: "了解头皮调理", exact: true })
    .waitFor();
  await page.locator('#productTabs [data-product-index="1"]').click();
  await page
    .locator("#productName")
    .filter({ hasText: "白发养护系列" })
    .waitFor();
  await page
    .locator('#productTabs [data-product-index="1"]')
    .press("ArrowRight");
  assert.equal(
    await page.locator("#productName").textContent(),
    "植发健发系列",
  );
  await page.locator('#productTabs [data-product-index="0"]').click();
  await page.getByRole("button", { name: "资质、荣誉与专利" }).click();
  await page.getByRole("dialog").waitFor();
  assert.equal(await page.locator("#detailBody .patent-number").count(), 9);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "查看洗护空间", exact: true }).click();
  assert.equal(await page.locator("#galleryTitle").textContent(), "洗护空间");
  await page
    .getByRole("button", { name: "放大查看洗护空间", exact: true })
    .click();
  await page.getByRole("dialog").waitFor();
  assert.ok(
    (await page.locator("#detailBody img").getAttribute("src")).includes(
      "brand-space-5",
    ),
  );
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "查看开放护理区", exact: true })
    .click();
  // Load below-the-fold source images before creating the full-page review artifact.
  await page
    .locator("img[loading=lazy]")
    .evaluateAll((images) => images.forEach((img) => (img.loading = "eager")));
  await page.evaluate(() =>
    Promise.all(
      [...document.images].map((img) => img.decode().catch(() => {})),
    ),
  );
  await page.evaluate(() => scrollTo(0, 0));
  await screenshot("home-desktop");
  assert.equal(await page.locator(".service-card").count(), 6);
  await page.getByRole("button", { name: "了解头皮调理", exact: true }).click();
  await page.getByRole("dialog").waitFor();
  assert.ok((await page.locator("#detailBody").textContent()).includes("清洁"));
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog").isVisible(), false);
  await page.locator("#cityInput").fill("北京");
  await page.locator("#searchStore").click();
  await page
    .getByText("暂未查询到门店信息，请拨打全国热线咨询附近门店。")
    .waitFor();
  await page.locator("#contactForm [name=name]").fill("浏览器验收客户");
  await page.locator("#contactForm [name=phone]").fill("13800009999");
  await page.locator("#contactForm [name=message]").fill("请介绍养护服务");
  await page.locator("#contactForm [name=consent]").check();
  await page.getByRole("button", { name: "提交咨询" }).click();
  await page.getByText("咨询已提交，顾问将根据您留下的信息联系您。").waitFor();
  await page.goto(base + "/admin.html");
  await page.locator("#loginScreen").waitFor();
  await screenshot("admin-login");
  await page.locator("#loginForm [name=username]").fill("admin");
  await page.locator("#loginForm [name=password]").fill("BrowserInitial!123");
  await page.getByRole("button", { name: "登录后台" }).click();
  await page.getByRole("heading", { name: "首次登录 · 设置新密码" }).waitFor();
  await page.locator("[name=current]").fill("BrowserInitial!123");
  await page.locator("#editorForm [name=password]").fill("BrowserUpdated!123");
  await page.locator("[name=confirm]").fill("BrowserUpdated!123");
  await page.locator("#editorForm button[type=submit]").click();
  await page.getByRole("heading", { name: "你好，网站管理员" }).waitFor();
  await screenshot("admin-dashboard");
  await page.locator("#sideNav [data-view=leads]").click();
  await page.getByText("浏览器验收客户", { exact: true }).waitFor();
  await page.getByRole("button", { name: "查看 / 跟进" }).click();
  await page.locator("#editorForm [name=status]").selectOption("已预约");
  await page.locator("#editorForm [name=note]").fill("浏览器完整流程验证");
  await page.locator("#editorForm button[type=submit]").click();
  await page.locator("td").filter({ hasText: "已预约" }).waitFor();
  await page.locator("#sideNav [data-view=stores]").click();
  await page.getByRole("button", { name: "新增门店" }).click();
  await page.locator("#editorForm [name=name]").fill("验收门店");
  await page.locator("#editorForm [name=city]").fill("北京");
  await page.locator("#editorForm [name=address]").fill("测试地址 1 号");
  await page.locator("#editorForm [name=phone]").fill("13800008888");
  await page.locator("#editorForm [name=hours]").fill("09:00—18:00");
  await page.locator("#editorForm [name=published]").check();
  await page.locator("#editorForm button[type=submit]").click();
  await page.getByText("验收门店", { exact: true }).waitFor();
  await page.locator("#sideNav [data-view=roles]").click();
  await page.getByRole("button", { name: "新建角色" }).click();
  await page.locator("#editorForm [name=name]").fill("验收只读");
  await page.locator('[name=permission][value="dashboard.read"]').check();
  await page.locator('[name=permission][value="services.read"]').check();
  await page.locator("#editorForm button[type=submit]").click();
  await page.getByRole("heading", { name: "验收只读", exact: true }).waitFor();
  await screenshot("admin-roles");
  await page.locator("#sideNav [data-view=users]").click();
  await page.getByRole("button", { name: "添加管理员" }).click();
  await page.locator("#editorForm [name=name]").fill("验收成员");
  await page.locator("#editorForm [name=username]").fill("reader");
  await page
    .locator("#editorForm [name=roleId]")
    .selectOption({ label: "验收只读" });
  await page.locator("#editorForm [name=password]").fill("ReaderInitial!123");
  await page.locator("#editorForm button[type=submit]").click();
  await page.getByText("验收成员", { exact: true }).waitFor();
  await page.locator("#sideNav [data-view=products]").click();
  await page.getByRole("heading", { name: "产品系列", exact: true }).waitFor();
  const row = page.getByRole("row").filter({ hasText: "脱发养护系列" });
  await row.getByRole("button", { name: "编辑", exact: true }).click();
  await page
    .locator("#editorForm [name=summary]")
    .fill("验收：日常防脱养护产品介绍");
  await page.locator("#editorForm button[type=submit]").click();
  await page.getByText("验收：日常防脱养护产品介绍", { exact: true }).waitFor();
  await page.locator("#sideNav [data-view=website]").click();
  await page
    .locator("#websiteSiteForm [name=heroTitle]")
    .fill("以专业，照顾每一根发丝");
  await page.getByRole("button", { name: "保存顶部与首屏" }).click();
  await page.getByText("顶部与首屏已保存", { exact: true }).waitFor();
  await page.locator("#sideNav [data-view=articles]").click();
  await page.getByRole("button", { name: "新建文章" }).click();
  await page.locator("#editorForm [name=title]").fill("日常护理知识");
  await page
    .locator("#editorForm [name=summary]")
    .fill("建立适合自己的护理习惯");
  await page
    .locator("#editorForm [name=body]")
    .fill("根据头皮与发质需求，选择适合自己的日常洗护产品。");
  await page.locator("#editorForm [name=published]").check();
  await page.locator("#editorForm button[type=submit]").click();
  await page.getByText("日常护理知识", { exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.getByRole("heading", { name: "内容发布", exact: true }).waitFor();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await screenshot("admin-mobile");
  await page.goto(base);
  await page
    .locator("#heroTitle")
    .filter({ hasText: "以专业，照顾每一根发丝" })
    .waitFor();
  await page.locator("#cityInput").fill("北京");
  await page.locator("#searchStore").click();
  await page.getByRole("heading", { name: "验收门店" }).waitFor();
  await page.getByRole("button", { name: /日常护理知识/ }).click();
  await page.getByRole("dialog").waitFor();
  await page.keyboard.press("Escape");
  await page.evaluate(() => scrollTo(0, 0));
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await screenshot("home-mobile");
  await page.getByRole("button", { name: "打开菜单" }).click();
  await page
    .locator(".main-nav")
    .getByRole("link", { name: "服务体系" })
    .click();
  assert.equal(
    await page
      .locator(".main-nav")
      .evaluate((el) => el.classList.contains("open")),
    false,
  );
  await page.goto(base + "/admin.html");
  await page.locator("#logoutBtn").click();
  await page.locator("#loginScreen").waitFor();
  await page.locator("#loginForm [name=username]").fill("reader");
  await page.locator("#loginForm [name=password]").fill("ReaderInitial!123");
  await page.getByRole("button", { name: "登录后台" }).click();
  await page.getByRole("heading", { name: "首次登录 · 设置新密码" }).waitFor();
  await page.locator("[name=current]").fill("ReaderInitial!123");
  await page.locator("#editorForm [name=password]").fill("ReaderUpdated!123");
  await page.locator("[name=confirm]").fill("ReaderUpdated!123");
  await page.locator("#editorForm button[type=submit]").click();
  await page.getByRole("heading", { name: "你好，验收成员" }).waitFor();
  assert.equal(await page.locator("#sideNav [data-view=roles]").count(), 0);
  assert.equal(
    await page.evaluate(async () => {
      const r = await fetch("/api/admin/users");
      return r.status;
    }),
    403,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: PC/手机布局、咨询提交与跟进、门店发布查询、CMS、角色管理员、首次改密、越权、零运行时错误。",
  );
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  db.close();
  rmSync(dir, { recursive: true, force: true });
}
