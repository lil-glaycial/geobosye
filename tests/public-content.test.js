const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const http = require("node:http");
const { createApp } = require("../server/app");

test("公开资料的抓取、规范地址、结构化数据与草稿隔离", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bosye-content-"));
  const { app, db } = createApp({ dataDir: dir });
  const server = await new Promise((resolve) => {
    const current = app.listen(0, "127.0.0.1", () => resolve(current));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = async (pathname, options) => {
    const response = await fetch(base + pathname, options);
    return { response, html: await response.text() };
  };
  try {
    await t.test(
      "内页沿用首页完整导航，锚点返回首页且当前栏目高亮",
      async () => {
        const { parseHTML } = require("linkedom");
        const home = parseHTML((await request("/")).html).document;
        const expected = [...home.querySelectorAll(".main-nav a")].map((a) => ({
          label: a.textContent.trim(),
          href:
            a.getAttribute("href") === "#top"
              ? "/"
              : a.getAttribute("href").replace(/^#/, "/#"),
        }));
        for (const route of ["/news", "/library", "/about", "/contact"]) {
          const document = parseHTML((await request(route)).html).document;
          const links = [...document.querySelectorAll(".main-nav a")];
          assert.deepEqual(
            links.map((a) => ({
              label: a.textContent.trim(),
              href: a.getAttribute("href"),
            })),
            expected,
          );
          assert.equal(
            document
              .querySelector('.main-nav [aria-current="page"]')
              .getAttribute("href"),
            route,
          );
          assert.equal(
            document
              .querySelector(".menu-toggle")
              .getAttribute("aria-controls"),
            document.querySelector(".main-nav").id,
          );
          assert.ok(
            document.querySelector('script[src="/assets/site-navigation.js"]'),
          );
          for (const link of links) {
            const href = link.getAttribute("href");
            if (href.startsWith("/#"))
              assert.ok(home.getElementById(href.slice(2)), href);
          }
        }
        assert.equal(
          (await request("/assets/site-navigation.js")).response.status,
          200,
        );
      },
    );
    await t.test("站点地图内每个页面均可直接读取且地址与标记一致", async () => {
      const { response, html: xml } = await request("/sitemap.xml");
      assert.equal(response.status, 200);
      assert.match(response.headers.get("content-type"), /xml/);
      const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
      assert.equal(new Set(urls).size, urls.length);
      assert.equal(urls.length, 25);
      assert.ok(
        urls.every(
          (url) => !/admin|api\/|source-materials|data\/|uploads\//.test(url),
        ),
      );
      for (const url of urls) {
        const pathname = new URL(url).pathname;
        const { response, html } = await request(pathname);
        assert.equal(response.status, 200, pathname);
        assert.match(response.headers.get("content-type"), /html/);
        assert.equal((html.match(/<h1(?:\s|>)/g) || []).length, 1, pathname);
        assert.ok(
          html.includes(`<link rel="canonical" href="${url}">`),
          pathname,
        );
        assert.ok(
          html.includes(`<meta property="og:url" content="${url}">`),
          pathname,
        );
        assert.match(html, /<meta name="description" content="[^"]+"/);
        const scripts = [
          ...html.matchAll(
            /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
          ),
        ];
        assert.equal(scripts.length, 1, pathname);
        const graph = JSON.parse(scripts[0][1])["@graph"];
        assert.ok(graph.some((node) => node["@type"] === "Organization"));
        if (pathname !== "/")
          assert.ok(graph.some((node) => node["@type"] === "BreadcrumbList"));
        if (pathname.startsWith("/products/"))
          assert.ok(graph.some((node) => node["@type"].includes("Product")));
        if (pathname === "/faq") {
          const faq = graph.find((node) => node["@type"] === "FAQPage");
          for (const question of faq.mainEntity)
            assert.ok(html.includes(question.name));
        }
      }
    });
    await t.test("后台、私有文件与旧入口保持正确公开边界", async () => {
      const robots = (await request("/robots.txt")).html;
      assert.ok(robots.includes(`Sitemap: ${base}/sitemap.xml`));
      assert.match(robots, /Disallow: \/api\//);
      const admin = await request("/admin.html");
      assert.match(admin.response.headers.get("x-robots-tag"), /noindex/);
      for (const pathname of ["/index.html", "/privacy.html"]) {
        const result = await request(pathname, { redirect: "manual" });
        assert.equal(result.response.status, 301);
        assert.ok(
          ["/", "/privacy"].includes(result.response.headers.get("location")),
        );
      }
      assert.equal(
        (await request("/source-materials/knowledge/医和你-服务合同.docx"))
          .response.status,
        404,
      );
    });
    await t.test(
      "产品草稿不会通过新详情、目录或站点地图泄漏，发布内容安全转义",
      async () => {
        const id = randomUUID();
        const name = '草稿<script>alert("x")</script>';
        const stamp = new Date().toISOString();
        db.prepare("INSERT INTO items VALUES(?,?,?,?,?,?)").run(
          id,
          "products",
          JSON.stringify({
            name,
            summary: "隔离测试",
            body: "<script>window.secret=true</script>",
            sort: 0,
          }),
          0,
          stamp,
          stamp,
        );
        const pathname = "/products/" + encodeURIComponent(name);
        assert.equal((await request(pathname)).response.status, 404);
        assert.ok(
          !(await request("/sitemap.xml")).html.includes(
            encodeURIComponent(name),
          ),
        );
        assert.ok(!(await request("/library")).html.includes("草稿"));
        db.prepare("UPDATE items SET published=1 WHERE id=?").run(id);
        const result = await request(pathname);
        assert.equal(result.response.status, 200);
        assert.ok(!result.html.includes("<script>window.secret"));
        assert.ok(result.html.includes("&lt;script&gt;window.secret"));
        const json = result.html.match(
          /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
        )[1];
        assert.ok(!json.includes("</script>"));
        assert.equal(
          JSON.parse(json)["@graph"].find((node) =>
            Array.isArray(node["@type"]),
          ).name,
          name,
        );
        db.prepare("UPDATE items SET published=0 WHERE id=?").run(id);
        assert.equal((await request(pathname)).response.status, 404);
      },
    );
    await t.test("非本地 Host 不能篡改品牌规范地址", async () => {
      const html = await new Promise((resolve, reject) => {
        http
          .get(
            {
              hostname: "127.0.0.1",
              port: server.address().port,
              path: "/about",
              headers: { Host: "attacker.invalid" },
            },
            (response) => {
              let body = "";
              response.setEncoding("utf8");
              response.on("data", (chunk) => {
                body += chunk;
              });
              response.on("end", () => resolve(body));
            },
          )
          .on("error", reject);
      });
      assert.ok(
        html.includes('rel="canonical" href="https://www.bosye.com/about"'),
      );
      assert.ok(!html.includes("attacker.invalid"));
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
