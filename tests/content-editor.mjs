import { createRequire } from "node:module";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
const require = createRequire(import.meta.url);
const { createApp } = require("../server/app");
const { setupAdmin, hashPassword } = require("../server/db");
const dir = mkdtempSync(path.join(os.tmpdir(), "bosye-editor-"));
const { app, db } = createApp({ dataDir: dir });
setupAdmin(db, "editor-test", "ContentEditor!123", "内容测试", false);
db.prepare("INSERT INTO roles VALUES(?,?,?,?)").run(
  "content-viewer",
  "内容只读",
  JSON.stringify(["site.read"]),
  0,
);
db.prepare("INSERT INTO users VALUES(?,?,?,?,?,?,?,?)").run(
  randomUUID(),
  "viewer-test",
  "内容只读",
  hashPassword("ContentViewer!123"),
  "content-viewer",
  1,
  0,
  new Date().toISOString(),
);
const server = await new Promise((resolve) => {
  const s = app.listen(0, "127.0.0.1", () => resolve(s));
});
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
mkdirSync("test-results", { recursive: true });
const login = async (target, username, password) => {
  await target.goto(base + "/admin.html");
  await target.locator("#loginForm [name=username]").fill(username);
  await target.locator("#loginForm [name=password]").fill(password);
  await target.locator("#loginForm button").click();
  await target.locator("#adminShell").waitFor();
  await target.locator('#sideNav [data-view="content"]').click();
  await target.locator("#contentForm").waitFor();
};
const save = async (form, endpoint) => {
  const responsePromise = page.waitForResponse(
    (r) => r.url().endsWith(endpoint) && r.request().method() === "PUT",
  );
  await page.locator(`#${form} > button[type=submit]`).click();
  const response = await responsePromise;
  assert.equal(response.status(), 200, await response.text());
};
const a11y = async (target) => {
  const report = await new AxeBuilder({ page: target })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  assert.deepEqual(
    report.violations.map((v) => ({
      id: v.id,
      targets: v.nodes.map((n) => n.target),
    })),
    [],
  );
};
try {
  assert.equal(
    (await page.request.get(base + "/api/admin/content")).status(),
    401,
  );
  await login(page, "editor-test", "ContentEditor!123");
  assert.equal(
    await page.locator('#contentForm [name="brand_mission"]').inputValue(),
    "匠心毛发健康，专注养防植健，成就美好人生",
  );
  await a11y(page);
  await page
    .locator('#contentForm [name="brand_mission"]')
    .fill("后台编辑验收 · 使命");
  const timeline = page.locator('[data-content-list="timeline"]');
  await timeline.locator("..").locator("summary").click();
  await page
    .locator('[data-action="content-add"][data-list="timeline"]')
    .click();
  const last = timeline.locator(".content-row").last();
  await last.locator('[data-row-field="year"]').fill("2026");
  await last.locator('[data-row-field="title"]').fill("后台新增品牌阶段");
  await last
    .locator('[data-row-field="text"]')
    .fill("通过后台添加、排序并保存的资料。");
  await last.locator('[data-action="content-up"]').click();
  await save("contentForm", "/api/admin/content");
  const publicData = await (
    await page.request.get(base + "/api/public/site")
  ).json();
  assert.equal(publicData.knowledge.brand.mission, "后台编辑验收 · 使命");
  assert.equal(publicData.knowledge.timeline.at(-2).title, "后台新增品牌阶段");
  const homeData = await (
    await page.request.get(base + "/api/admin/home-fields")
  ).json();
  const heading = homeData.fields.find(
    (f) => f.group === "品牌故事" && f.label.startsWith("标题："),
  );
  await page
    .getByRole("button", { name: "首页文案与图片", exact: true })
    .click();
  const principles = page.locator('[data-home-collection="principles"]');
  assert.equal(await principles.locator("[data-collection-row]").count(), 4);
  await principles
    .locator('[data-collection-field="label"]')
    .nth(0)
    .fill("综合养护（后台成组编辑）");
  await principles.locator('[data-action="home-collection-add"]').click();
  assert.equal(await principles.locator("[data-collection-row]").count(), 5);
  await principles
    .locator("[data-collection-row]")
    .last()
    .locator('[data-collection-field="key"]')
    .fill("新");
  await principles
    .locator("[data-collection-row]")
    .last()
    .locator('[data-collection-field="label"]')
    .fill("新增理念");
  const homeHeading = page.locator(`#homeForm [name="${heading.key}"]`);
  const headingGroup = homeHeading.locator("xpath=ancestor::details");
  if (!(await headingGroup.evaluate((details) => details.open)))
    await headingGroup.locator("summary").click();
  await homeHeading.fill("从后台更新的品牌栏目\n标题第二行");
  await page
    .locator('[data-action="home-image"][data-key="campusImage"]')
    .click();
  await page.locator("#mediaPickerModal").waitFor();
  await page.locator("#mediaPickerCount").filter({ hasText: "显示" }).waitFor();
  await page.locator("#mediaPickerGrid [data-picker-url]").first().click();
  const selected = await page
    .locator("#mediaPickerGrid [aria-pressed=true]")
    .getAttribute("data-picker-url");
  await page.locator("#mediaPickerConfirm").click();
  assert.equal(
    await homeHeading.inputValue(),
    "从后台更新的品牌栏目\n标题第二行",
  );
  await save("homeForm", "/api/admin/home-fields");
  const afterHome = await (
    await page.request.get(base + "/api/public/site")
  ).json();
  assert.equal(
    afterHome.knowledge.home.principles[0].label,
    "综合养护（后台成组编辑）",
  );
  assert.equal(afterHome.knowledge.home.principles.at(-1).key, "新");
  const noJS = await browser.newPage({ javaScriptEnabled: false });
  await noJS.goto(base);
  assert.equal(
    await noJS.locator(heading.selector).innerText(),
    "从后台更新的品牌栏目\n标题第二行",
  );
  assert.equal(await noJS.locator("#researchTechniques > div").count(), 4);
  assert.equal(await noJS.locator("#timeline article").count(), 13);
  assert.equal(
    await noJS.locator(".brand-values p").textContent(),
    "后台编辑验收 · 使命",
  );
  await noJS.close();
  assert.equal(
    (await (await page.request.get(base + "/api/admin/content")).json()).home
      .campusImage,
    selected,
  );
  await page.getByRole("button", { name: "资料详情页", exact: true }).click();
  const faq = page
    .locator("[data-page-editor]")
    .filter({ has: page.locator('input[value="/faq"]') });
  await faq.locator("..").locator("summary").click();
  await faq
    .locator('textarea[name$="_body"]')
    .fill(
      "## 后台新增问题？\n\n后台填写的回答。\n\n<script>alert('unsafe')</script>\n\n[不安全链接](javascript:alert)",
    );
  assert.equal(await faq.locator("input[type=checkbox]").isChecked(), true);
  await save("pageForm", "/api/admin/page-content");
  const faqHTML = await (await page.request.get(base + "/faq")).text();
  assert.match(faqHTML, /后台新增问题/);
  assert.doesNotMatch(faqHTML, /<script>alert|href="javascript:/);
  assert.match(faqHTML, /"name":"后台新增问题？"/);
  // A later knowledge save preserves separately maintained home/page edits.
  await page
    .getByRole("button", { name: "品牌与模块资料", exact: true })
    .click();
  await save("contentForm", "/api/admin/content");
  const stored = await (
    await page.request.get(base + "/api/admin/content")
  ).json();
  assert.equal(stored.home.campusImage, selected);
  assert.ok(stored.pages["/faq"].body.includes("后台新增问题"));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/content-editor-mobile.png",
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth),
    390,
  );
  await a11y(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "test-results/content-editor-desktop.png",
    fullPage: true,
  });
  const viewer = await browser.newPage();
  await login(viewer, "viewer-test", "ContentViewer!123");
  assert.equal(
    await viewer.locator('#contentForm [name="brand_mission"]').isDisabled(),
    true,
  );
  const me = await (await viewer.request.get(base + "/api/auth/me")).json();
  for (const endpoint of ["content", "home-fields", "page-content"]) {
    assert.equal(
      (
        await viewer.request.put(base + "/api/admin/" + endpoint, {
          headers: { "X-CSRF-Token": me.csrf },
          data: {},
        })
      ).status(),
      403,
    );
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS: 后台内容表单、增删排序、图库选择、保存持久化、无 JS 首页同步、资料页与 FAQ、脚本转义、只读权限及 PC/手机可访问性。",
  );
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  db.close();
  rmSync(dir, { recursive: true, force: true });
}
