import { createRequire } from "node:module";
import {
  mkdtempSync,
  rmSync,
  readFileSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const require = createRequire(import.meta.url);
const { createApp } = require("../server/app");
const { setupAdmin, hashPassword } = require("../server/db");
const dir = mkdtempSync(path.join(os.tmpdir(), "bosye-picker-"));
const { app, db } = createApp({ dataDir: dir });
setupAdmin(db, "picker", "MediaPicker!123", "图片管理测试", false);
db.prepare("INSERT INTO roles VALUES (?,?,?,?)").run(
  "gallery",
  "仅选择图库",
  JSON.stringify(["services.read", "services.write", "media.read"]),
  0,
);
db.prepare("INSERT INTO users VALUES (?,?,?,?,?,?,?,?)").run(
  randomUUID(),
  "gallery",
  "图库成员",
  hashPassword("GalleryUser!123"),
  "gallery",
  1,
  0,
  new Date().toISOString(),
);
const server = await new Promise((resolve) => {
  const current = app.listen(0, "127.0.0.1", () => resolve(current));
});
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
const errors = [];
const checks = [];
page.on("pageerror", (e) => errors.push(e.message));
mkdirSync("test-results", { recursive: true });
const pickerModal = page.locator("#mediaPickerModal");
const openPicker = async () => {
  await page
    .getByRole("button", { name: "选择图片 / 本地上传", exact: true })
    .click();
  await pickerModal.waitFor();
  await page.locator("#mediaPickerCount").filter({ hasText: "显示" }).waitFor();
};
const a11y = async (label) => {
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
    label,
  );
  checks.push({ label, violations: violations.length });
};
async function login(username, password) {
  await page.goto(base + "/admin.html");
  await page.locator("#loginScreen").waitFor();
  await page.locator("#loginForm [name=username]").fill(username);
  await page.locator("#loginForm [name=password]").fill(password);
  await page.locator("#loginForm button").click();
  await page.locator("#adminShell").waitFor();
}
try {
  await login("picker", "MediaPicker!123");
  assert.equal(await page.getByText("北京总部", { exact: true }).count(), 0);
  await page.locator('#sideNav [data-view="products"]').click();
  await page.locator('[data-action="edit"]').first().click();
  const originalImage = await page
    .locator('#editorForm [name="image"]')
    .inputValue();
  await page
    .locator('#editorForm [name="summary"]')
    .fill("保留表单内容 · 图片选择测试");
  await openPicker();
  assert.equal(await page.getByRole("dialog").count(), 1);
  await a11y("桌面图库选择器");
  await page.locator("#mediaPickerClose").focus();
  await page.keyboard.press("Shift+Tab");
  assert.equal(
    await page
      .locator("#mediaPickerConfirm")
      .evaluate((el) => el === document.activeElement),
    true,
  );
  await page.keyboard.press("Escape");
  assert.equal(await pickerModal.isVisible(), false);
  assert.equal(await page.locator("#editorModal").isVisible(), true);
  assert.equal(
    await page
      .getByRole("button", { name: "选择图片 / 本地上传", exact: true })
      .evaluate((el) => el === document.activeElement),
    true,
  );
  assert.equal(
    await page.locator('#editorForm [name="image"]').inputValue(),
    originalImage,
  );
  await openPicker();
  await page.locator("#mediaSearch").fill("不存在的图片名称");
  await page.getByText("没有匹配的图片，请调整搜索或图片来源。").waitFor();
  await page.locator("#mediaSearch").fill("");
  await page.locator('[data-picker-url="assets/bosye-logo.png"]').click();
  await page.locator("#mediaPickerConfirm").click();
  assert.equal(
    await page.locator('#editorForm [name="image"]').inputValue(),
    "assets/bosye-logo.png",
  );
  assert.equal(
    await page.locator('#editorForm [name="summary"]').inputValue(),
    "保留表单内容 · 图片选择测试",
  );
  await a11y("编辑表单图片预览");
  await page.locator('[data-action="clear-image"]').click();
  assert.equal(
    await page.locator('#editorForm [name="image"]').inputValue(),
    "",
  );
  await openPicker();
  await page.locator("#mediaPickerFile").setInputFiles({
    name: "无效图片.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not an image"),
  });
  await page.getByText("请选择 JPG、PNG 或 WEBP 图片。").waitFor();
  assert.equal(await page.locator("#mediaPickerUpload").isEnabled(), true);
  await page.locator("#mediaPickerFile").setInputFiles({
    name: "超过限制.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
  });
  await page.getByText("图片不能超过 5 MB，请选择较小的图片。").waitFor();
  const upload = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/admin/media") && r.request().method() === "POST",
  );
  await page.locator("#mediaPickerFile").setInputFiles({
    name: "本地测试图片.png",
    mimeType: "image/png",
    buffer: readFileSync("assets/bosye-logo.png"),
  });
  const response = await upload;
  assert.equal(response.status(), 201);
  const uploaded = await response.json();
  assert.equal(uploaded.name, "本地测试图片.png");
  await page
    .locator("#mediaPickerSelection")
    .filter({ hasText: "本地测试图片.png" })
    .waitFor();
  await page.locator("#mediaSource").selectOption("uploads");
  assert.equal(
    await page.locator('[data-picker-url="' + uploaded.url + '"]').count(),
    1,
  );
  await a11y("上传后选择与大图预览");
  await page.screenshot({
    path: "test-results/admin-image-picker-desktop.png",
  });
  await page.locator("#mediaPickerConfirm").click();
  assert.equal(
    await page.locator('#editorForm [name="image"]').inputValue(),
    uploaded.url,
  );
  await page.locator('#editorForm button[type="submit"]').click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  const product = db
    .prepare("SELECT data FROM items WHERE type='products'")
    .all()
    .map((r) => JSON.parse(r.data))
    .find((v) => v.summary === "保留表单内容 · 图片选择测试");
  assert.equal(product.image, uploaded.url);
  await page.locator('[data-action="edit"]').first().click();
  await page.setViewportSize({ width: 390, height: 844 });
  await openPicker();
  await a11y("手机图库选择器");
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth),
    390,
  );
  assert.equal(
    await page
      .locator(".media-picker")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
    true,
  );
  await page.screenshot({ path: "test-results/admin-image-picker-mobile.png" });
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const type of ["stores", "services", "articles"]) {
    await page.locator(`#sideNav [data-view="${type}"]`).click();
    await page.locator('[data-action="new"]').click();
    await openPicker();
    assert.equal(
      await page.locator('[data-picker-url="' + uploaded.url + '"]').count(),
      1,
      type,
    );
    await page.locator('[data-picker-url="' + uploaded.url + '"]').click();
    await page.locator("#mediaPickerConfirm").click();
    assert.equal(
      await page.locator('#editorForm [name="image"]').inputValue(),
      uploaded.url,
      type,
    );
    await page.keyboard.press("Escape");
  }
  await page.locator('#sideNav [data-view="media"]').click();
  const mediaUpload = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/admin/media") && r.request().method() === "POST",
  );
  await page.locator("#mediaUpload").setInputFiles({
    name: "媒体页上传.webp",
    mimeType: "image/webp",
    buffer: readFileSync("assets/brand-space-6.webp"),
  });
  assert.equal((await mediaUpload).status(), 201);
  await page
    .getByRole("button", { name: "预览媒体页上传.webp", exact: true })
    .click();
  await pickerModal.waitFor();
  await page
    .locator("#mediaPickerName")
    .filter({ hasText: "媒体页上传.webp" })
    .waitFor();
  assert.equal(await page.locator("#mediaPickerConfirm").isVisible(), false);
  await page.keyboard.press("Escape");
  await page.locator("#logoutBtn").click();
  await page.locator("#loginScreen").waitFor();
  await login("gallery", "GalleryUser!123");
  await page.locator('[data-action="edit"]').first().click();
  await openPicker();
  assert.equal(await page.locator("#mediaPickerUpload").isVisible(), false);
  await page.locator('[data-picker-url="assets/bosye-logo.png"]').click();
  await page.locator("#mediaPickerConfirm").click();
  assert.equal(
    await page.locator('#editorForm [name="image"]').inputValue(),
    "assets/bosye-logo.png",
  );
  assert.deepEqual(errors, []);
  writeFileSync(
    "test-results/admin-image-picker.json",
    JSON.stringify(
      { checks, selectedAndSaved: uploaded.url, runtimeErrors: errors },
      null,
      2,
    ),
  );
  console.log(
    "PASS：图库选择/取消、搜索、图片移除、本地上传与保存、四类内容字段、媒体大图预览、权限及电脑/手机可访问性。",
  );
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  db.close();
  rmSync(dir, { recursive: true, force: true });
}
