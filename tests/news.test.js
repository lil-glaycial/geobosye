const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createApp } = require("../server/app");
const { setupAdmin } = require("../server/db");
test("品牌资讯：后台发布、草稿隔离、分页、转义与删除", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bosye-news-"));
  const { app, db } = createApp({ dataDir: dir });
  setupAdmin(db, "admin", "NewsTesting!123", "测试管理员", false);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const base = "http://127.0.0.1:" + server.address().port;
  let headers = { "Content-Type": "application/json" };
  const request = (url, method = "GET", body) =>
    fetch(base + url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  try {
    assert.equal((await request("/api/admin/news")).status, 401);
    const login = await request("/api/auth/login", "POST", {
      username: "admin",
      password: "NewsTesting!123",
    });
    headers.Cookie = login.headers.get("set-cookie").split(";")[0];
    headers["X-CSRF-Token"] = (await login.json()).csrf;
    const data = {
      title: "品牌资讯 <script>标题</script>",
      summary: "摘要内容",
      body: "## 品牌新闻\n\n<script>alert(1)</script>",
      publishedDate: "2026-10-29",
      image: "",
      sort: 0,
      account: "博士园会员服务中心",
      imageCount: 21,
      sourceUrl: "https://mp.weixin.qq.com/s/example",
    };
    let res = await request("/api/admin/news", "POST", {
      data,
      published: false,
    });
    assert.equal(res.status, 201);
    const { id } = await res.json();
    assert.equal((await request("/news/" + id)).status, 404);
    assert.match(await (await request("/news")).text(), /暂无品牌资讯/);
    assert.ok(!(await (await request("/sitemap.xml")).text()).includes(id));
    assert.equal(
      (
        await request("/api/admin/news/" + id, "PUT", {
          data: { ...data, publishedDate: "2026-02-30" },
          published: true,
        })
      ).status,
      400,
    );
    assert.equal(
      (await request("/api/admin/news/" + id, "PUT", { data, published: true }))
        .status,
      200,
    );
    const detail = await (await request("/news/" + id)).text();
    assert.match(detail, /&lt;script&gt;alert/);
    assert.match(detail, /<h2>品牌新闻<\/h2>/);
    assert.doesNotMatch(detail, /来源账号|原文图片|微信公众号原文|摘要内容/);
    assert.match(detail, /阅读完整资讯/);
    assert.ok(
      (await (await request("/sitemap.xml")).text()).includes("/news/" + id),
    );
    for (let i = 0; i < 12; i++)
      assert.equal(
        (
          await request("/api/admin/news", "POST", {
            data: { ...data, title: "测试资讯 " + i, sort: i + 1 },
            published: true,
          })
        ).status,
        201,
      );
    const first = await (await request("/news")).text();
    const second = await (await request("/news?page=2")).text();
    assert.equal((first.match(/class="brand-news-card"/g) || []).length, 12);
    assert.equal((second.match(/class="brand-news-card"/g) || []).length, 1);
    assert.match(second, /第 2 \/ 2 页，共 13 篇/);
    for (const page of ["0", "-1", "3", "abc", "1.5"])
      assert.equal((await request("/news?page=" + page)).status, 404);
    assert.equal(
      (await request("/api/admin/news/" + id, "DELETE")).status,
      200,
    );
    assert.equal((await request("/news/" + id)).status, 404);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
