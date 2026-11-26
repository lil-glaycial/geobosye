const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const vm = require("node:vm");
const { randomUUID } = require("node:crypto");
const { parseHTML } = require("linkedom");
const { createApp } = require("../server/app");

const loaderPath = "/assets/baidu-analytics.js";
const analyticsOrigin = "https://hm.baidu.com";
const analyticsUrl =
  analyticsOrigin + "/hm.js?c49949fab25fc18f582cf44798b2397b";
const publicSources = {
  "script-src": [
    "'self'",
    "'unsafe-eval'",
    analyticsOrigin,
    "https://goutong.baidu.com",
    "https://aff-im.cdn.bcebos.com",
    "https://aiff.cdn.bcebos.com",
    "https://banti-static.cdn.bcebos.com",
    "https://safe.cdn.bcebos.com",
    "https://passport.baidu.com",
    "https://affimvip.baidu.com",
  ],
  "img-src": [
    "'self'",
    "data:",
    analyticsOrigin,
    "https://affimvip.baidu.com",
    "https://aff-im.bj.bcebos.com",
    "https://aff-im.cdn.bcebos.com",
    "https://sofire.baidu.com",
  ],
  "connect-src": [
    "'self'",
    analyticsOrigin,
    "https://affimvip.baidu.com",
    "https://sofire.baidu.com",
    "https://sfp.safe.baidu.com",
    "https://banti.baidu.com",
  ],
  "frame-src": ["'self'", "https://affimvip.baidu.com"],
  "media-src": ["'self'", "https://aifanfan.baidu.com"],
};

function policyOf(headers) {
  const value = headers.get("content-security-policy");
  assert.ok(value, "每个响应都应保留 Content-Security-Policy");
  return new Map(
    value
      .split(";")
      .filter(Boolean)
      .map((directive) => {
        const [name, ...sources] = directive.trim().split(/\s+/);
        return [name, sources];
      }),
  );
}

function analyticsScripts(html) {
  const { document } = parseHTML(html);
  return [...document.querySelectorAll("script[src]")].filter(
    (script) =>
      new URL(script.getAttribute("src"), "https://example.test").pathname ===
      loaderPath,
  );
}

function assertPublicPage(result, pathname, baselinePolicy) {
  assert.equal(result.response.status, 200, pathname);
  assert.match(result.response.headers.get("content-type"), /html/, pathname);
  const scripts = analyticsScripts(result.body);
  assert.equal(
    scripts.length,
    1,
    `${pathname} 应且仅应加载一次同源统计 loader`,
  );
  assert.equal(scripts[0].getAttribute("src"), loaderPath, pathname);
  assert.ok(scripts[0].hasAttribute("defer"), pathname);
  assert.doesNotMatch(
    result.body,
    /<script\b[^>]*src=["']https?:\/\/hm\.baidu\.com/i,
  );
  const policy = policyOf(result.response.headers);
  const expectedPolicy = new Map([
    ...baselinePolicy,
    ...Object.entries(publicSources),
  ]);
  assert.equal(policy.size, expectedPolicy.size, pathname);
  for (const [name, sources] of expectedPolicy) {
    assert.deepEqual(
      policy.get(name),
      sources,
      `${pathname} 的 ${name} 应保留精确来源白名单`,
    );
  }
  assert.ok(!policy.get("script-src").includes("'unsafe-inline'"), pathname);
  assert.ok(policy.get("script-src").includes("'unsafe-eval'"), pathname);
  assert.equal(
    result.response.headers.get("referrer-policy"),
    "strict-origin-when-cross-origin",
    pathname,
  );
}

test("百度统计只覆盖公开 HTML，且保持后台和错误页的 CSP 边界", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bosye-analytics-"));
  const { app, db } = createApp({ dataDir: dir });
  const server = await new Promise((resolve) => {
    const current = app.listen(0, "127.0.0.1", () => resolve(current));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = async (pathname, options) => {
    const response = await fetch(base + pathname, options);
    return { response, body: await response.text() };
  };
  try {
    const baseline = await request("/api/health");
    const baselinePolicy = policyOf(baseline.response.headers);
    assert.doesNotMatch(
      baseline.response.headers.get("content-security-policy"),
      /baidu/i,
    );
    assert.deepEqual(baselinePolicy.get("script-src"), ["'self'"]);
    assert.deepEqual(baselinePolicy.get("connect-src"), ["'self'"]);
    assert.deepEqual(baselinePolicy.get("img-src"), ["'self'", "data:"]);
    assert.equal(baselinePolicy.has("frame-src"), false);
    assert.equal(baselinePolicy.has("media-src"), false);
    assert.equal(
      baseline.response.headers.get("referrer-policy"),
      "no-referrer",
    );
    const stamp = "2026-11-26T01:00:00.000Z";
    const dynamicPages = [];
    for (const type of ["services", "products", "articles", "news"]) {
      const id = randomUUID();
      const title = `统计集成测试${type}`;
      const data = {
        ...(type === "services" || type === "products"
          ? { name: title, english: "ANALYTICS TEST" }
          : { title }),
        category: "品牌动态",
        summary: "公开动态详情的统计覆盖测试。",
        body: "只有已发布页面应加载统计。",
        image: "",
        sort: 0,
        publishedDate: "2026-11-26",
      };
      db.prepare("INSERT INTO items VALUES(?,?,?,?,?,?)").run(
        id,
        type,
        JSON.stringify(data),
        1,
        stamp,
        stamp,
      );
      dynamicPages.push(
        type === "news"
          ? `/news/${id}`
          : `/${type}/${encodeURIComponent(title)}`,
      );
    }

    await t.test("首页、站点地图中的内页与四类动态详情各加载一次", async () => {
      const sitemap = await request("/sitemap.xml");
      const routes = [...sitemap.body.matchAll(/<loc>(.*?)<\/loc>/g)].map(
        (match) => new URL(match[1]).pathname,
      );
      assert.ok(routes.includes("/"));
      assert.ok(routes.includes("/library"));
      assert.ok(routes.includes("/news"));
      assert.ok(routes.includes("/privacy"));
      assert.ok(routes.length > 10, "应覆盖完整公共页面目录");
      for (const pathname of dynamicPages)
        assert.ok(routes.includes(pathname), pathname);
      for (const pathname of new Set(routes))
        assertPublicPage(await request(pathname), pathname, baselinePolicy);
    });

    await t.test(
      "后台、API、资源、未找到详情和资讯分页错误不加载统计",
      async () => {
        const cases = [
          ["/admin.html", 200],
          ["/api/health", 200],
          ["/api/public/site", 200],
          ["/api/public/stores", 200],
          ["/api/admin/stores", 401],
          ["/api/not-found", 404],
          ["/not-found", 404],
          ["/news?page=999", 404],
          ["/news/not-found", 404],
          ["/articles/not-found", 404],
          ["/products/not-found", 404],
          ["/services/not-found", 404],
          ["/sitemap.xml", 200],
          ["/robots.txt", 200],
          ["/llms.txt", 200],
          ["/assets/site-navigation.js", 200],
        ];
        for (const [pathname, expectedStatus] of cases) {
          const result = await request(pathname);
          assert.equal(result.response.status, expectedStatus, pathname);
          assert.equal(analyticsScripts(result.body).length, 0, pathname);
          assert.doesNotMatch(
            result.body,
            /hm\.baidu\.com|c49949fab25fc18f582cf44798b2397b/,
            pathname,
          );
          assert.deepEqual(
            policyOf(result.response.headers),
            baselinePolicy,
            pathname,
          );
          assert.equal(
            result.response.headers.get("referrer-policy"),
            "no-referrer",
            pathname,
          );
        }
      },
    );

    await t.test(
      "各域名别名保持同源 loader，旧 HTML 地址只在最终公开页加载",
      async () => {
        for (const host of [
          "bosye.com",
          "www.bosye.com",
          "wap.bosye.com",
          "bosyejm.com",
          "www.bosyejm.com",
        ]) {
          const result = await new Promise((resolve, reject) => {
            http
              .get(
                {
                  hostname: "127.0.0.1",
                  port: server.address().port,
                  path: "/about",
                  headers: { Host: host },
                },
                (response) => {
                  let body = "";
                  response.setEncoding("utf8");
                  response.on("data", (chunk) => {
                    body += chunk;
                  });
                  response.on("end", () => resolve({ response, body }));
                },
              )
              .on("error", reject);
          });
          assert.equal(result.response.statusCode, 200, host);
          assertPublicPage(
            {
              response: {
                status: result.response.statusCode,
                headers: new Headers(result.response.headers),
              },
              body: result.body,
            },
            host,
            baselinePolicy,
          );
          const scripts = analyticsScripts(result.body);
          assert.equal(scripts.length, 1, host);
          assert.equal(
            new URL(scripts[0].getAttribute("src"), `https://${host}`).host,
            host,
          );
        }
        for (const [pathname, target] of [
          ["/index.html", "/"],
          ["/privacy.html", "/privacy"],
        ]) {
          const redirect = await request(pathname, { redirect: "manual" });
          assert.equal(redirect.response.status, 301, pathname);
          assert.equal(
            redirect.response.headers.get("location"),
            target,
            pathname,
          );
          assert.equal(analyticsScripts(redirect.body).length, 0, pathname);
          assert.deepEqual(
            policyOf(redirect.response.headers),
            baselinePolicy,
            pathname,
          );
          assert.equal(
            redirect.response.headers.get("referrer-policy"),
            "no-referrer",
            pathname,
          );
          assertPublicPage(await request(pathname), pathname, baselinePolicy);
        }
      },
    );

    await t.test(
      "实际 loader 异步加载指定百度站点并保留已排队事件",
      async () => {
        const loader = await request(loaderPath);
        assert.equal(loader.response.status, 200);
        assert.match(loader.response.headers.get("content-type"), /javascript/);
        assert.deepEqual(policyOf(loader.response.headers), baselinePolicy);
        assert.equal(
          loader.response.headers.get("referrer-policy"),
          "no-referrer",
        );
        for (const existingQueue of [
          undefined,
          [["_trackEvent", "咨询", "提交"]],
        ]) {
          const appended = [];
          const window = existingQueue ? { _hmt: existingQueue } : {};
          vm.runInNewContext(
            loader.body,
            {
              window,
              document: {
                createElement(tag) {
                  assert.equal(tag, "script");
                  return {};
                },
                head: {
                  appendChild(script) {
                    appended.push(script);
                  },
                },
              },
            },
            { timeout: 1000 },
          );
          assert.equal(appended.length, 1);
          assert.equal(appended[0].src, analyticsUrl);
          assert.equal(appended[0].async, true);
          assert.equal(
            appended[0].referrerPolicy,
            "strict-origin-when-cross-origin",
          );
          assert.ok(Array.isArray(window._hmt));
          if (existingQueue) {
            assert.equal(window._hmt, existingQueue);
            assert.deepEqual(window._hmt, [["_trackEvent", "咨询", "提交"]]);
          } else assert.equal(window._hmt.length, 0);
        }
      },
    );
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
