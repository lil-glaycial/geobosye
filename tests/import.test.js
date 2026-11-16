const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createApp } = require("../server/app");
const { setupAdmin } = require("../server/db");

test("内容发布 CSV 批量导入会整体校验并写入", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bosye-import-"));
  const { app, db } = createApp({ dataDir: dir });
  setupAdmin(db, "admin", "InitialPassword!123", "导入测试", false);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie;
  let csrf;
  try {
    const login = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { Origin: base, "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "admin",
        password: "InitialPassword!123",
      }),
    });
    assert.equal(login.status, 200);
    cookie = login.headers.get("set-cookie").split(";", 1)[0];
    csrf = (await login.json()).csrf;
    const csv = [
      "标题,栏目,摘要,正文,图片路径,排序,发布",
      'CSV 测试文章,毛发知识,"摘要，带逗号","正文第一行\n正文第二行",assets/care.jpg,1,是',
      "CSV 草稿,品牌动态,第二条摘要,第二条正文,,2,否",
    ].join("\r\n");
    const form = new FormData();
    form.append(
      "file",
      new Blob(["\ufeff" + csv], { type: "text/csv" }),
      "articles.csv",
    );
    const imported = await fetch(`${base}/api/admin/articles/import`, {
      method: "POST",
      headers: { Origin: base, Cookie: cookie, "X-CSRF-Token": csrf },
      body: form,
    });
    const importedBody = await imported.text();
    assert.equal(imported.status, 201, importedBody);
    assert.deepEqual(JSON.parse(importedBody).imported, 2);
    const rows = await (
      await fetch(`${base}/api/admin/articles`, {
        headers: { Origin: base, Cookie: cookie },
      })
    ).json();
    assert.equal(rows.items.length, 2);
    const badForm = new FormData();
    badForm.append(
      "file",
      new Blob(
        ["标题,栏目,摘要,正文,图片路径,排序,发布\n缺少栏目,,摘要,正文,,0,否"],
        { type: "text/csv" },
      ),
      "bad.csv",
    );
    const bad = await fetch(`${base}/api/admin/articles/import`, {
      method: "POST",
      headers: { Origin: base, Cookie: cookie, "X-CSRF-Token": csrf },
      body: badForm,
    });
    assert.equal(bad.status, 400);
    assert.equal(
      (
        await (
          await fetch(`${base}/api/admin/articles`, {
            headers: { Origin: base, Cookie: cookie },
          })
        ).json()
      ).items.length,
      2,
    );
    const storeCsv = [
      "门店名称,城市,详细地址,门店电话,营业时间,展示图片,排序,发布状态",
      "批量门店,上海,上海市静安区示例路 2 号,021-12345678,09:00-18:00,assets/care.jpg,1,已发布",
    ].join("\n");
    const storeForm = new FormData();
    storeForm.append(
      "file",
      new Blob([storeCsv], { type: "text/csv" }),
      "stores.csv",
    );
    const storesImport = await fetch(`${base}/api/admin/stores/import`, {
      method: "POST",
      headers: { Origin: base, Cookie: cookie, "X-CSRF-Token": csrf },
      body: storeForm,
    });
    assert.equal(storesImport.status, 201, await storesImport.text());
    assert.equal(
      (
        await (
          await fetch(`${base}/api/public/stores?q=上海`, {
            headers: { Origin: base },
          })
        ).json()
      ).items.some((item) => item.name === "批量门店"),
      true,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
