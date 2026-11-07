import { createRequire } from "node:module";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { chromium } from "playwright";

const require = createRequire(import.meta.url);
const { createApp } = require("../server/app");
const { setupAdmin } = require("../server/db");
const dir = mkdtempSync(path.join(os.tmpdir(), "bosye-login-"));
const { app, db } = createApp({ dataDir: dir });
setupAdmin(db, "login-test", "LoginInitial!123", "登录测试", true);
const server = await new Promise((resolve) => {
  const current = app.listen(0, "127.0.0.1", () => resolve(current));
});
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
try {
  await page.route("**/api/auth/me", (route) => route.abort());
  await page.goto(base + "/admin.html");
  await page
    .getByText("无法连接后台服务，请确认服务已启动，再刷新页面重试。")
    .waitFor();
  assert.equal(await page.locator("#loginScreen").isVisible(), true);
  await page.unroute("**/api/auth/me");
  await page.reload();
  await page.locator("#loginForm [name=username]").fill("login-test");
  await page.locator("#loginForm [name=password]").fill("wrong-password");
  await page.locator("#loginForm button").click();
  await page.getByText("账号或密码不正确").waitFor();
  await page.locator("#loginForm [name=password]").fill("LoginInitial!123");
  await page.locator("#loginForm button").click();
  await page.getByRole("dialog").waitFor();
  assert.equal(
    await page.locator("#modalTitle").textContent(),
    "首次登录 · 设置新密码",
  );
  await page.locator("#editorForm [name=current]").fill("LoginInitial!123");
  await page.locator("#editorForm [name=password]").fill("LoginUpdated!123");
  await page.locator("#editorForm [name=confirm]").fill("LoginUpdated!123");
  await page.locator('#editorForm button[type="submit"]').click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.locator('#sideNav [data-view="dashboard"]').waitFor();
  await page.locator("#logoutBtn").click();
  await page.locator("#loginScreen").waitFor();
  const staticContext = await browser.newContext({ javaScriptEnabled: false });
  const staticPage = await staticContext.newPage();
  await staticPage.goto(base + "/admin.html");
  assert.equal(await staticPage.locator("#loginScreen").isVisible(), true);
  await staticContext.close();
  console.log(
    "PASS：连接故障提示、错误密码、真实登录、首次改密、退出与初始登录页显示。",
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
  db.close();
  rmSync(dir, { recursive: true, force: true });
}
