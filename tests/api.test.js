const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createApp } = require("../server/app");
const { setupAdmin, openDatabase } = require("../server/db");
test("官网与后台业务、鉴权、权限与持久化", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bosye-test-"));
  const { app, db } = createApp({ dataDir: dir });
  setupAdmin(db, "admin", "InitialPassword!123", "测试管理员", true);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const base = "http://127.0.0.1:" + server.address().port;
  const session = {};
  async function request(
    url,
    { method = "GET", body, auth = session, headers = {} } = {},
  ) {
    const h = { Origin: base, ...headers };
    if (auth.cookie) h.Cookie = auth.cookie;
    if (auth.csrf) h["X-CSRF-Token"] = auth.csrf;
    if (body) h["Content-Type"] = "application/json";
    const r = await fetch(base + url, {
      method,
      headers: h,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await r.text();
    return {
      status: r.status,
      headers: r.headers,
      data: (r.headers.get("content-type") || "").includes("json")
        ? JSON.parse(data)
        : data,
    };
  }
  const login = async (username, password, auth) => {
    const r = await request("/api/auth/login", {
      method: "POST",
      body: { username, password },
      auth: {},
    });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    auth.cookie = r.headers.get("set-cookie").split(";")[0];
    auth.csrf = r.data.csrf;
    return r;
  };
  try {
    await t.test("未登录访问受保护数据与本地凭据路径", async () => {
      assert.equal(
        (await request("/api/admin/leads", { auth: {} })).status,
        401,
      );
      for (const url of [
        "/data/bosye.sqlite",
        "/.local-credentials.txt",
        "/server/db.js",
        "/.env",
        "/source-materials/knowledge/knowledge-extracted.md",
        "/content/knowledge.json",
      ])
        assert.equal((await request(url, { auth: {} })).status, 404);
    });
    await t.test("登录、首次改密与 CSRF 检查", async () => {
      assert.equal(
        (
          await request("/api/auth/login", {
            method: "POST",
            body: { username: "admin", password: "incorrect" },
            auth: {},
          })
        ).status,
        401,
      );
      const r = await login("admin", "InitialPassword!123", session);
      assert.equal(r.data.user.mustChangePassword, true);
      assert.ok(r.headers.get("set-cookie").includes("HttpOnly"));
      assert.equal((await request("/api/admin/leads")).status, 403);
      assert.equal(
        (
          await request("/api/auth/password", {
            method: "POST",
            body: {
              current: "InitialPassword!123",
              password: "UpdatedPassword!123",
            },
            auth: { cookie: session.cookie },
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await request("/api/auth/password", {
            method: "POST",
            body: {
              current: "InitialPassword!123",
              password: "UpdatedPassword!123",
            },
          })
        ).status,
        200,
      );
      assert.equal(
        (await request("/api/auth/me")).data.user.mustChangePassword,
        false,
      );
    });
    let leadId;
    await t.test("表单同意校验、服务端保存及跟进", async () => {
      const lead = {
        name: "测试客户 <img src=x onerror=alert(1)>",
        phone: "13800001234",
        type: "头皮护理与养护",
        message: "请介绍护理安排。",
        consent: true,
        website: "",
      };
      assert.equal(
        (
          await request("/api/public/leads", {
            method: "POST",
            body: { ...lead, consent: false },
            auth: {},
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await request("/api/public/leads", {
            method: "POST",
            body: lead,
            auth: {},
            headers: { Origin: "https://evil.invalid" },
          })
        ).status,
        403,
      );
      const r = await request("/api/public/leads", {
        method: "POST",
        body: lead,
        auth: {},
      });
      assert.equal(r.status, 201);
      leadId = r.data.id;
      const found = (
        await request("/api/admin/leads?q=" + encodeURIComponent("测试客户"))
      ).data;
      assert.equal(found.total, 1);
      assert.equal(found.items[0].message, lead.message);
      const owner = (await request("/api/auth/me")).data.user.id;
      assert.equal(
        (
          await request("/api/admin/leads/" + leadId, {
            method: "PATCH",
            body: { status: "沟通中", note: "已电话联系", ownerId: owner },
          })
        ).status,
        200,
      );
      const csv = await request("/api/admin/leads/export");
      assert.equal(csv.status, 200);
      assert.ok(csv.data.includes("已电话联系"));
    });
    await t.test("品牌知识与产品发布、服务端渲染及素材权限", async () => {
      let site = (await request("/api/public/site", { auth: {} })).data;
      assert.equal(site.products.length, 6);
      assert.equal(site.knowledge.patents.length, 9);
      assert.equal(site.knowledge.gallery.length, 6);
      const data = {
        name: "产品草稿测试",
        english: "TEST",
        summary: "未发布资料",
        body: "草稿产品详情",
        range: "按门店报价",
        image: "assets/brand-products.webp",
        sort: 0,
      };
      const created = await request("/api/admin/products", {
        method: "POST",
        body: { data, published: false },
      });
      assert.equal(created.status, 201);
      const id = created.data.id;
      assert.ok(
        !(await request("/api/public/site", { auth: {} })).data.products.some(
          (p) => p.id === id,
        ),
      );
      assert.ok(!(await request("/", { auth: {} })).data.includes(data.name));
      const updated = await request("/api/admin/products/" + id, {
        method: "PUT",
        body: {
          data: { ...data, name: "发布产品 <script>alert(1)</script>" },
          published: true,
        },
      });
      assert.equal(updated.status, 200);
      const html = (await request("/", { auth: {} })).data;
      assert.ok(
        html.includes("发布产品 &lt;script&gt;alert(1)&lt;/script&gt;"),
      );
      assert.ok(!html.includes("发布产品 <script>"));
      const media = (await request("/api/admin/media")).data.items;
      assert.ok(media.some((m) => m.url === "assets/bosye-logo.png"));
      assert.ok(media.some((m) => m.url === "assets/brand-founder.webp"));
      assert.equal(
        (await request("/api/admin/products", { auth: {} })).status,
        401,
      );
      assert.equal(
        (await request("/api/admin/products/" + id, { method: "DELETE" }))
          .status,
        200,
      );
    });
    let storeId;
    await t.test("CMS 草稿隔离、门店发布、查询和设置", async () => {
      const data = {
        name: "测试门店",
        city: "测试城市",
        address: "测试地址 1 号",
        phone: "13800001234",
        hours: "09:00—18:00",
        image: "assets/care.jpg",
        sort: 0,
      };
      let r = await request("/api/admin/stores", {
        method: "POST",
        body: { data, published: false },
      });
      assert.equal(r.status, 201, JSON.stringify(r.data));
      storeId = r.data.id;
      assert.equal(
        (await request("/api/public/stores?q=测试城市", { auth: {} })).data
          .items.length,
        0,
      );
      assert.equal(
        (
          await request("/api/admin/stores/" + storeId, {
            method: "PUT",
            body: { data, published: true },
          })
        ).status,
        200,
      );
      assert.equal(
        (await request("/api/public/stores?q=测试城市", { auth: {} })).data
          .items[0].name,
        data.name,
      );
      const site = (await request("/api/admin/site")).data;
      site.seoTitle = "新官网标题 <测试>";
      site.heroTitle = "新的首页标题";
      assert.equal(
        (await request("/api/admin/site", { method: "PUT", body: site }))
          .status,
        200,
      );
      assert.equal(
        (await request("/api/public/site", { auth: {} })).data.site.heroTitle,
        site.heroTitle,
      );
      assert.ok((await request("/")).data.includes("新官网标题 &lt;测试&gt;"));
      assert.equal(
        (
          await request(
            "/api/admin/services/" +
              (await request("/api/public/site")).data.services[0].id,
            {
              method: "PUT",
              body: {
                data: {
                  name: "测试",
                  english: "TEST",
                  summary: "测试",
                  body: "测试",
                  image: "../../.env",
                  sort: 0,
                },
                published: true,
              },
            },
          )
        ).status,
        400,
      );
    });
    let viewerId, roleId;
    const viewer = {};
    await t.test("自定义角色、管理员及服务端越权保护", async () => {
      const r = await request("/api/admin/roles", {
        method: "POST",
        body: {
          name: "测试只读角色",
          permissions: ["dashboard.read", "services.read"],
        },
      });
      assert.equal(r.status, 201);
      roleId = r.data.id;
      const u = await request("/api/admin/users", {
        method: "POST",
        body: {
          username: "viewer",
          name: "只读成员",
          roleId,
          active: true,
          password: "ViewerInitial!123",
        },
      });
      assert.equal(u.status, 201);
      viewerId = u.data.id;
      await login("viewer", "ViewerInitial!123", viewer);
      await request("/api/auth/password", {
        method: "POST",
        body: { current: "ViewerInitial!123", password: "ViewerUpdated!123" },
        auth: viewer,
      });
      assert.equal(
        (await request("/api/admin/services", { auth: viewer })).status,
        200,
      );
      assert.equal(
        (await request("/api/admin/leads", { auth: viewer })).status,
        403,
      );
      assert.equal(
        (
          await request("/api/admin/roles", {
            method: "POST",
            body: { name: "伪造管理员", permissions: ["users.write"] },
            auth: viewer,
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await request("/api/admin/stores/" + storeId, {
            method: "DELETE",
            auth: viewer,
          })
        ).status,
        403,
      );
      const dash = (await request("/api/admin/dashboard", { auth: viewer }))
        .data;
      assert.equal(dash.counts.leads, null);
      assert.equal(dash.recent.length, 0);
    });
    await t.test("角色修改撤销会话、停用用户、超级管理员保护", async () => {
      assert.equal(
        (
          await request("/api/admin/roles/" + roleId, {
            method: "PUT",
            body: { name: "测试只读角色", permissions: ["services.read"] },
          })
        ).status,
        200,
      );
      assert.equal(
        (await request("/api/auth/me", { auth: viewer })).status,
        401,
      );
      await login("viewer", "ViewerUpdated!123", viewer);
      assert.equal(
        (
          await request("/api/admin/users/" + viewerId, {
            method: "PUT",
            body: {
              username: "viewer",
              name: "只读成员",
              roleId,
              active: false,
            },
          })
        ).status,
        200,
      );
      assert.equal(
        (await request("/api/auth/me", { auth: viewer })).status,
        401,
      );
      assert.equal(
        (await request("/api/admin/roles/" + roleId, { method: "DELETE" }))
          .status,
        400,
      );
      assert.equal(
        (await request("/api/admin/roles/owner", { method: "DELETE" })).status,
        400,
      );
      const owner = (await request("/api/auth/me")).data.user;
      assert.equal(
        (
          await request("/api/admin/users/" + owner.id, {
            method: "PUT",
            body: {
              name: owner.name,
              username: owner.username,
              roleId: "viewer",
              active: true,
            },
          })
        ).status,
        400,
      );
    });
    await t.test("上传验证与审计", async () => {
      const good = new FormData();
      good.append(
        "file",
        new Blob(
          [fs.readFileSync(path.join(__dirname, "../assets/care.jpg"))],
          { type: "image/jpeg" },
        ),
        "care.jpg",
      );
      const upload = await fetch(base + "/api/admin/media", {
        method: "POST",
        headers: {
          Cookie: session.cookie,
          "X-CSRF-Token": session.csrf,
          Origin: base,
        },
        body: good,
      });
      assert.equal(upload.status, 201);
      const media = await upload.json();
      assert.equal((await fetch(base + "/" + media.url)).status, 200);
      const bad = new FormData();
      bad.append(
        "file",
        new Blob(["<script>alert(1)</script>"], { type: "image/jpeg" }),
        "test.jpg",
      );
      assert.equal(
        (
          await fetch(base + "/api/admin/media", {
            method: "POST",
            headers: {
              Cookie: session.cookie,
              "X-CSRF-Token": session.csrf,
              Origin: base,
            },
            body: bad,
          })
        ).status,
        400,
      );
      const logs = (await request("/api/admin/audit")).data.items;
      assert.ok(logs.some((l) => l.action === "保存角色权限"));
      assert.ok(logs.some((l) => l.action === "导出咨询线索"));
    });
    await t.test("数据库重开后记录保留及退出撤销会话", async () => {
      const second = openDatabase(dir);
      assert.equal(
        second.prepare("SELECT note FROM leads WHERE id=?").get(leadId).note,
        "已电话联系",
      );
      second.close();
      assert.equal(
        (await request("/api/auth/logout", { method: "POST" })).status,
        200,
      );
      assert.equal((await request("/api/auth/me")).status, 401);
    });
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("来源资料迁移幂等且保留编辑内容", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bosye-migration-"));
  let db;
  try {
    db = openDatabase(dir);
    const site = JSON.parse(
      db.prepare("SELECT data FROM settings WHERE key='site'").get().data,
    );
    site.heroTitle = "用户编辑的品牌文案";
    db.prepare("UPDATE settings SET data=? WHERE key='site'").run(
      JSON.stringify(site),
    );
    const service = db
      .prepare("SELECT * FROM items WHERE type='services' LIMIT 1")
      .get();
    const edited = {
      ...JSON.parse(service.data),
      image: "uploads/custom.webp",
      body: "用户编辑的服务正文",
    };
    db.prepare("UPDATE items SET data=? WHERE id=?").run(
      JSON.stringify(edited),
      service.id,
    );
    const originalCount = db.prepare("SELECT COUNT(*) n FROM items").get().n;
    db.prepare("DELETE FROM settings WHERE key='source-content-teal-v1'").run();
    db.close();
    db = openDatabase(dir);
    assert.equal(
      JSON.parse(
        db.prepare("SELECT data FROM settings WHERE key='site'").get().data,
      ).heroTitle,
      site.heroTitle,
    );
    assert.deepEqual(
      JSON.parse(
        db.prepare("SELECT data FROM items WHERE id=?").get(service.id).data,
      ),
      edited,
    );
    assert.equal(
      db.prepare("SELECT COUNT(*) n FROM items").get().n,
      originalCount,
    );
    const count = db.prepare("SELECT COUNT(*) n FROM media").get().n;
    db.close();
    db = openDatabase(dir);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM media").get().n, count);
  } finally {
    db?.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
