import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import os from "node:os";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { createApp } = require("../server/app");
const { setupAdmin } = require("../server/db");
const dir = fs.mkdtempSync(os.tmpdir() + "/bosye-a11y-");
const { app, db } = createApp({ dataDir: dir });
setupAdmin(db, "a11y", "Accessibility!123", "管理员", false);
const server = await new Promise((resolve) => {
  const s = app.listen(0, "127.0.0.1", () => resolve(s));
});
const base = "http://127.0.0.1:" + server.address().port;
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
let failures = 0;
fs.mkdirSync("test-results", { recursive: true });
try {
  for (const target of [
    "home",
    "admin-login",
    "admin",
    "roles-dialog",
    "mobile-home",
  ]) {
    if (target === "home" || target === "mobile-home") {
      if (target === "mobile-home")
        await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(base);
      await page
        .getByRole("button", { name: "了解头皮调理", exact: true })
        .waitFor();
    } else if (target === "admin-login") {
      await page.goto(base + "/admin.html");
      await page.locator("#loginScreen").waitFor();
    } else if (target === "admin") {
      await page.locator("[name=username]").fill("a11y");
      await page.locator("[name=password]").fill("Accessibility!123");
      await page.getByRole("button", { name: "登录后台" }).click();
      await page.getByRole("heading", { name: "你好，管理员" }).waitFor();
    } else {
      await page.locator("#sideNav [data-view=roles]").click();
      await page.getByRole("button", { name: "新建角色" }).click();
      await page.getByRole("dialog").waitFor();
    }
    const report = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    fs.writeFileSync(
      "test-results/axe-" + target + ".json",
      JSON.stringify(report.violations, null, 2),
    );
    failures += report.violations.length;
    console.log(
      target,
      JSON.stringify(
        report.violations.map((v) => ({
          id: v.id,
          count: v.nodes.length,
          nodes: v.nodes
            .slice(0, 35)
            .map((n) => ({ target: n.target, summary: n.failureSummary })),
        })),
        null,
        2,
      ),
    );
  }
  assert.equal(failures, 0, "需要修复可访问性检查中发现的问题");
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
}
