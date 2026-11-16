"use strict";
(() => {
  const $ = (s) => document.querySelector(s);
  const esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const date = (v) =>
    v
      ? new Date(v).toLocaleString("zh-CN", {
          timeZone: "Asia/Shanghai",
          hour12: false,
        })
      : "—";
  const state = {
    user: null,
    csrf: "",
    view: "",
    items: [],
    page: 1,
    q: "",
    status: "",
    roles: [],
    catalog: {},
    websiteItems: {},
    modalView: "",
    returnView: "",
  };
  const menu = [
    ["dashboard", "仪表盘", "⌂", "dashboard.read"],
    ["leads", "咨询线索", "↗", "leads.read"],
    ["stores", "门店管理", "⌖", "stores.read"],
    ["services", "服务项目", "◈", "services.read"],
    ["products", "产品系列", "◇", "products.read"],
    ["articles", "内容发布", "▤", "articles.read"],
    ["news", "品牌资讯", "▤", "articles.read"],
    ["media", "媒体资源", "▧", "media.read"],
    ["website", "官网编辑", "✎", "site.read"],
    ["users", "管理员管理", "♙", "users.read"],
    ["roles", "角色与权限", "⊞", "roles.read"],
    ["audit", "操作日志", "≡", "audit.read"],
  ];
  const can = (p) =>
    state.user?.permissions.includes(p.replace(/^news\./, "articles."));
  let timer,
    modalCloseAllowed = true,
    lastFocus = null,
    onModalSubmit = null;
  const picker = {
    field: null,
    homeTarget: null,
    opener: null,
    items: [],
    selected: "",
    busy: false,
    loading: false,
    request: 0,
  };
  function toast(message) {
    $("#adminToast").textContent = message;
    $("#adminToast").classList.add("show");
    clearTimeout(timer);
    timer = setTimeout(() => $("#adminToast").classList.remove("show"), 3500);
  }
  async function api(url, { method = "GET", body, raw = false } = {}) {
    const headers = {};
    if (body && !(body instanceof FormData))
      headers["Content-Type"] = "application/json";
    if (method !== "GET") headers["X-CSRF-Token"] = state.csrf;
    let res;
    try {
      res = await fetch("/api/" + url, {
        method,
        headers,
        body: body
          ? body instanceof FormData
            ? body
            : JSON.stringify(body)
          : undefined,
      });
    } catch {
      throw new Error("无法连接后台服务，请确认服务已启动，再刷新页面重试。");
    }
    if (!res.ok) {
      const d = await res.json().catch(() => ({ error: "服务不可用" }));
      if (res.status === 401 && url !== "auth/login") showLogin();
      throw new Error(d.error || "请求失败");
    }
    if (raw) return res;
    if (!(res.headers.get("content-type") || "").includes("application/json"))
      throw new Error("当前地址未连接后台服务，请从官网的后台管理入口登录。");
    return res.json();
  }
  function showLogin() {
    closeMediaPicker(true);
    state.user = null;
    $("#adminShell").hidden = true;
    $("#loginScreen").hidden = false;
    closeModal(true);
  }
  function showApp(data) {
    state.user = data.user;
    state.csrf = data.csrf;
    $("#loginScreen").hidden = true;
    $("#adminShell").hidden = false;
    $("#userName").textContent = state.user.name;
    $("#userAvatar").textContent = state.user.name.slice(0, 1);
    $("#userRole").textContent = state.user.roleName;
    $("#sideNav").innerHTML = menu
      .filter((m) => can(m[3]))
      .map(
        ([id, label, icon]) =>
          `<a class="side-link" href="#${id}" data-view="${id}"><span class="nav-icon" aria-hidden="true">${icon}</span>${label}</a>`,
      )
      .join("");
    if (state.user.mustChangePassword) {
      $("#adminContent").innerHTML =
        "<p>请先修改初始密码，完成后即可开始管理网站。</p>";
      passwordDialog(true);
      return;
    }
    let page = location.hash.slice(1);
    if (page === "site" || page === "content") page = "website";
    if (!menu.some((m) => m[0] === page && can(m[3])))
      page = menu.find((m) => can(m[3]))?.[0];
    if (page) navigate(page);
    else
      $("#adminContent").innerHTML = empty(
        "当前角色暂无管理权限，请联系超级管理员。",
      );
  }
  function empty(message = "暂无记录") {
    return `<div class="empty-state"><span>◌</span><p>${esc(message)}</p></div>`;
  }
  function heading(title, desc, action = "") {
    return `<div class="page-heading"><div><p class="page-kicker">BOSYE / ${esc(state.view.toUpperCase())}</p><h1>${title}</h1><p>${desc}</p></div>${action}</div>`;
  }
  const newButton = (label) =>
    `<button class="primary-action" data-action="new">＋ ${label}</button>`;
  function table(heads, rows) {
    return `<div class="panel table-panel"><div class="table-scroll" tabindex="0" role="region" aria-label="数据表格，可横向滚动"><table class="full-table"><thead><tr>${heads.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>${rows.length ? "" : empty()}</div>`;
  }
  function pager(total, size = 15) {
    const pages = Math.max(1, Math.ceil(total / size));
    return `<div class="pagination"><span>共 ${total} 条 · 第 ${state.page} / ${pages} 页</span><button data-action="prev" ${state.page <= 1 ? "disabled" : ""}>上一页</button><button data-action="next" ${state.page >= pages ? "disabled" : ""}>下一页</button></div>`;
  }
  const status = (v) =>
    `<span class="status ${v === "待跟进" ? "pending" : v === "沟通中" ? "processing" : "done"}">${esc(v)}</span>`;
  async function navigate(view, reset = true) {
    if (!menu.some((m) => m[0] === view && can(m[3]))) return;
    state.view = view;
    if (reset) {
      state.page = 1;
      state.q = "";
      state.status = "";
    }
    history.replaceState(null, "", "#" + view);
    $("#breadcrumbTitle").textContent = menu.find((m) => m[0] === view)[1];
    document
      .querySelectorAll("[data-view]")
      .forEach((a) => a.classList.toggle("active", a.dataset.view === view));
    $("#sidebar").classList.remove("open");
    $("#sidebarToggle").setAttribute("aria-expanded", "false");
    $("#adminContent").innerHTML = '<p class="loading">正在读取数据…</p>';
    try {
      await render(view);
    } catch (e) {
      $("#adminContent").innerHTML = empty(e.message);
    }
  }
  async function render(view) {
    let html = "";
    if (view === "dashboard") {
      const d = await api("admin/dashboard");
      const cards = [
        ["咨询总数", d.counts.leads, "官网及后台录入"],
        ["待跟进咨询", d.counts.pending, "等待安排跟进"],
        ["已发布门店", d.counts.stores, "官网可查询的门店"],
        ["已发布文章", d.counts.articles, "官网展示的内容"],
      ];
      const max = Math.max(0, ...d.trend.map((v) => v.count));
      const bars = Array.from({ length: 30 }, (_, i) => {
        const day = new Date(
          Date.now() - (29 - i) * 86400000,
        ).toLocaleDateString("sv-SE", { timeZone: "Asia/Shanghai" });
        const n = d.trend.find((t) => t.date === day)?.count || 0;
        return `<div class="trend-col" title="${day}：${n} 条"><i style="height:${n ? Math.max(6, (n / max) * 100) : 2}%"></i></div>`;
      }).join("");
      html =
        heading(
          `你好，${esc(state.user.name)}`,
          "以下数据来自当前网站后台。",
          can("leads.write")
            ? '<button class="primary-action" data-action="new-lead">＋ 新建线索</button>'
            : "",
        ) +
        `<div class="overview-grid">${cards.map(([title, n, note], i) => `<div class="overview-card ${i === 0 ? "card-teal" : ""}"><div class="overview-head"><span>${title}</span></div><strong>${n === null ? "—" : n}</strong><small>${n === null ? "当前角色未授权查看" : note}</small></div>`).join("")}</div>`;
      if (can("leads.read"))
        html +=
          `<div class="panel real-chart"><div class="panel-head"><div><h2>近 30 天咨询趋势</h2><p>按北京时间统计 · 每根柱代表一天，最高 ${max} 条</p></div></div><div class="trend-bars">${bars}</div><div class="trend-axis"><span>30 天前</span><span>今天</span></div></div><div class="panel-head"><h2>最近咨询</h2><button class="text-btn" data-view="leads">查看全部 →</button></div>` +
          table(
            ["客户", "咨询方向", "时间", "状态"],
            d.recent.map(
              (l) =>
                `<tr><td>${esc(l.name)}</td><td>${esc(l.type)}</td><td>${date(l.created_at)}</td><td>${status(l.status)}</td></tr>`,
            ),
          );
    } else if (view === "leads") {
      const d = await api(
        `admin/leads?q=${encodeURIComponent(state.q)}&status=${encodeURIComponent(state.status)}&page=${state.page}`,
      );
      if (state.view !== view) return;
      state.items = d.items;
      html =
        heading(
          "咨询线索",
          "查看客户需求，记录跟进状态与负责人。",
          can("leads.write") ? newButton("新建线索") : "",
        ) +
        `<form id="leadSearchForm" class="filter-bar"><div class="search-input"><input name="q" aria-label="搜索姓名或手机" placeholder="搜索客户姓名或电话" value="${esc(state.q)}"></div><select name="status" aria-label="跟进状态">${["", "待跟进", "沟通中", "已预约", "已完成", "无效"].map((s) => `<option value="${s}" ${s === state.status ? "selected" : ""}>${s || "全部状态"}</option>`).join("")}</select><button class="outline-btn">查询</button>${can("leads.export") ? '<button class="outline-btn" type="button" data-action="export">导出 CSV</button>' : ""}</form>` +
        table(
          [
            "客户 / 联系方式",
            "咨询方向",
            "来源",
            "负责人",
            "提交时间",
            "状态",
            "操作",
          ],
          d.items.map(
            (l) =>
              `<tr><td><b>${esc(l.name)}</b><small class="cell-sub">${esc(l.phone)}</small></td><td>${esc(l.type)}</td><td>${esc(l.source)}</td><td>${esc(l.owner_name || "未分配")}</td><td>${date(l.created_at)}</td><td>${status(l.status)}</td><td><button class="text-btn" data-action="edit" data-id="${l.id}">查看${can("leads.write") ? " / 跟进" : ""}</button></td></tr>`,
          ),
        ) +
        pager(d.total);
    } else if (
      ["stores", "services", "products", "articles", "news"].includes(view)
    ) {
      const d = await api("admin/" + view);
      if (state.view !== view) return;
      state.items = d.items;
      const labels = {
        news: [
          "品牌资讯",
          "维护品牌资讯，发布后展示在官网品牌资讯栏目。",
          "添加品牌资讯",
        ],
        stores: [
          "门店管理",
          "发布后的门店会出现在官网城市查询结果中。",
          "新增门店",
        ],
        services: [
          "服务项目",
          "编辑服务介绍，并控制官网展示顺序与发布状态。",
          "新增服务",
        ],
        products: [
          "产品系列",
          "维护六大系列的介绍、参考价格、图片与发布状态。",
          "新增产品系列",
        ],
        articles: [
          "内容发布",
          "以纯文本撰写品牌动态、毛发知识和合作资讯。",
          "新建文章",
        ],
      }[view];
      html =
        heading(
          labels[0],
          labels[1],
          can(view + ".write") ? newButton(labels[2]) : "",
        ) +
        table(
          ["名称", "简介 / 地址", "状态", "更新时间", "操作"],
          d.items.map(
            (i) =>
              `<tr><td><b>${esc(i.name || i.title)}</b></td><td class="wrap-cell">${esc(i.address || i.summary)}</td><td>${status(i.published ? "已发布" : "草稿")}</td><td>${date(i.updatedAt)}</td><td><button class="text-btn" data-action="edit" data-id="${i.id}">${can(view + ".write") ? "编辑" : "查看"}</button>${can(view + ".write") ? `<button class="text-btn danger" data-action="delete" data-id="${i.id}">删除</button>` : ""}</td></tr>`,
          ),
        );
    } else if (view === "users") {
      const d = await api("admin/users");
      if (state.view !== view) return;
      state.items = d.items;
      html =
        heading(
          "管理员管理",
          "创建成员账号、分配角色或停用访问权限。",
          can("users.write") ? newButton("添加管理员") : "",
        ) +
        table(
          ["姓名", "登录账号", "角色", "状态", "创建时间", "操作"],
          d.items.map(
            (u) =>
              `<tr><td>${esc(u.name)}</td><td>${esc(u.username)}</td><td><span class="role-pill ${u.roleId === "owner" ? "role-owner" : ""}">${esc(u.roleName)}</span></td><td>${status(u.active ? "启用" : "停用")}</td><td>${date(u.createdAt)}</td><td>${can("users.write") ? `<button class="text-btn" data-action="edit" data-id="${u.id}">编辑</button>` : "—"}</td></tr>`,
          ),
        );
    } else if (view === "roles") {
      const d = await api("admin/roles");
      if (state.view !== view) return;
      state.items = d.items;
      state.catalog = d.permissions;
      html =
        heading(
          "角色与权限",
          "按职责分配菜单与操作权限，接口会校验每一次操作。",
          can("roles.write") ? newButton("新建角色") : "",
        ) +
        `<div class="role-grid">${d.items.map((r) => `<article class="role-card ${r.protected ? "selected" : ""}"><div><span class="role-icon icon-owner">◈</span><h3>${esc(r.name)}</h3><p>${r.permissions.length} 项权限 · ${r.memberCount} 位成员</p></div><div class="role-actions"><button class="text-btn" data-action="edit" data-id="${r.id}">${r.protected ? "查看权限" : "编辑权限"}</button>${!r.protected && can("roles.write") ? `<button class="text-btn danger" data-action="delete" data-id="${r.id}">删除</button>` : ""}</div></article>`).join("")}</div>`;
    } else if (view === "audit") {
      const d = await api("admin/audit?page=" + state.page);
      html =
        heading("操作日志", "追踪管理员登录、内容更新、权限调整与线索导出。") +
        table(
          ["时间", "操作人", "操作", "记录标识"],
          d.items.map(
            (i) =>
              `<tr><td>${date(i.created_at)}</td><td>${esc(i.actor)}</td><td>${esc(i.action)}</td><td class="wrap-cell mono">${esc(i.target)}</td></tr>`,
          ),
        ) +
        pager(d.total, 30);
    } else if (view === "media") {
      const d = await api("admin/media");
      if (state.view !== view) return;
      state.items = d.items;
      html =
        heading(
          "媒体资源",
          "上传 JPG、PNG 或 WEBP 图片，单张不超过 5 MB。",
          can("media.write")
            ? '<button class="primary-action" type="button" data-action="upload-media">↑ 上传图片</button><input id="mediaUpload" type="file" accept="image/jpeg,image/png,image/webp" hidden>'
            : "",
        ) +
        `<div class="media-grid">${d.items.map((m) => `<article class="media-item"><button class="media-thumbnail" type="button" data-action="preview-media" data-id="${esc(m.id)}" aria-label="预览${esc(m.name)}"><img loading="lazy" src="/${esc(m.url)}" alt="${esc(m.name)}"><span>查看大图 ↗</span></button><div><b>${esc(m.name)}</b><small>${(m.size / 1024).toFixed(0)} KB · ${date(m.created_at)}</small><button class="text-btn" data-action="copy" data-url="${esc(m.url)}">复制图片路径</button></div></article>`).join("")}</div>` +
        (d.items.length ? "" : empty("还没有上传媒体图片。"));
    } else if (view === "website") {
      const read = (path, permission) =>
        can(permission)
          ? api(path).catch(() => ({ items: [] }))
          : Promise.resolve({ items: [] });
      const [site, content, homeData, pageData, stores, services, products, articles, news] =
        await Promise.all([
          api("admin/site"),
          api("admin/content"),
          api("admin/home-fields"),
          api("admin/page-content"),
          read("admin/stores", "stores.read"),
          read("admin/services", "services.read"),
          read("admin/products", "products.read"),
          read("admin/articles", "articles.read"),
          read("admin/news", "articles.read"),
        ]);
      state.websiteItems = {
        stores: stores.items || [],
        services: services.items || [],
        products: products.items || [],
        articles: articles.items || [],
        news: news.items || [],
      };
      html = renderWebsiteEditor({ site, content, homeData, pageData });
    } else if (view === "site") {
      const d = await api("admin/site");
      html =
        heading("官网设置", "管理首页文案、联系方式、搜索摘要和备案信息。") +
        `<form class="site-form panel" id="siteForm">${field("heroTitle", "首页标题", d.heroTitle, "text", true, 40)}${field("heroAccent", "首页副标题", d.heroAccent, "text", true, 40)}${field("heroDescription", "首页介绍", d.heroDescription, "textarea", true, 400)}${field("brandIntro", "品牌介绍", d.brandIntro, "textarea", true, 2000)}${field("phone", "咨询电话", d.phone, "text", true, 30)}${field("address", "总部地址", d.address, "text", true, 200)}${field("seoTitle", "搜索结果标题", d.seoTitle, "text", true, 100)}${field("seoDescription", "搜索结果描述", d.seoDescription, "textarea", true, 300)}${field("icp", "ICP备案号", d.icp)}${field("police", "公安备案号", d.police)}<p class="form-error" role="alert"></p>${can("site.write") ? '<button class="primary-action">保存并更新官网</button>' : ""}</form>`;
    }
    if (view === "content") {
      const [d, homeData, pageData] = await Promise.all([
        api("admin/content"),
        api("admin/home-fields"),
        api("admin/page-content"),
      ]);
      const b = d.brand || {};
      const basic = [
        [
          "品牌基础信息",
          [
            field("brand_name", "品牌名称", b.name, "text", true, 80),
            field(
              "brand_established",
              "成立年份",
              b.established,
              "text",
              true,
              20,
            ),
            field(
              "brand_mission",
              "品牌使命",
              b.mission,
              "textarea",
              true,
              300,
            ),
            field(
              "brand_values",
              "品牌价值观",
              b.values,
              "textarea",
              true,
              500,
            ),
            field(
              "brand_description",
              "品牌介绍",
              b.description,
              "textarea",
              true,
              2000,
            ),
          ],
        ],
        [
          "创始人信息",
          [
            field("brand_founder", "创始人", b.founder, "text", true, 80),
            field(
              "brand_founderRole",
              "创始人身份",
              b.founderRole,
              "text",
              true,
              120,
            ),
            field(
              "brand_founderBody",
              "创始人简介",
              b.founderBody,
              "textarea",
              true,
              3000,
            ),
            field(
              "brand_founderResearch",
              "研究初心与成果",
              b.founderResearch,
              "textarea",
              true,
              5000,
            ),
          ],
        ],
        [
          "品牌规模指标",
          [
            field(
              "brand_researchYears",
              "研究积累指标",
              b.researchYears,
              "text",
              true,
              30,
            ),
            field("brand_stores", "品牌门店指标", b.stores, "text", true, 30),
            field("brand_series", "产品系列指标", b.series, "text", true, 30),
            field("brand_offices", "办事处指标", b.offices, "text", true, 30),
          ],
        ],
      ]
        .map(
          ([title, fields]) =>
            `<details class="home-edit-group" open><summary>${title}</summary><div class="content-basic-grid">${fields.join("")}</div></details>`,
        )
        .join("");
      const complex = contentLists
        .map(
          ([key, label]) =>
            `<details class="home-edit-group"><summary>${label} · ${(d[key] || []).length} 项</summary><div data-content-list="${key}">${(d[key] || []).map((v) => contentRow(key, v)).join("")}</div>${can("site.write") ? `<button type="button" class="outline-btn" data-action="content-add" data-list="${key}">＋ 添加${label}</button>` : ""}</details>`,
        )
        .join("");
      const write = can("site.write");
      const homeGroups = [...new Set(homeData.fields.map((f) => f.group))];
      const homeFields = homeGroups
        .map(
          (group) =>
            `<details class="home-edit-group" open><summary>${esc(group)}</summary><div class="content-basic-grid">${homeData.fields
              .filter((f) => f.group === group)
              .map((f) => {
                if (f.type === "collection")
                  return homeCollectionField(f, write);
                const meta = esc(
                  JSON.stringify({
                    key: f.key,
                    selector: f.selector || "",
                    type: f.type,
                    label: f.label,
                    group: f.group,
                    max: f.max || 2000,
                  }),
                );
                return f.type === "image"
                  ? `<div class="home-image-edit edit-field"><span>${esc(f.label)}</span><input type="hidden" name="${esc(f.key)}" value="${esc(f.value || "")}"><input type="hidden" name="__meta_${esc(f.key)}" value="${meta}"><button type="button" class="image-field-preview" data-action="home-image" data-key="${esc(f.key)}">${f.value ? `<img src="/${esc(f.value)}" alt="${esc(f.label)}"><span>点击更换图片</span>` : `<span class="image-field-empty">点击选择图片</span>`}</button></div>`
                  : `<label class="edit-field">${esc(f.label)}<textarea name="${esc(f.key)}" rows="${f.type === "text" ? 3 : 2}" maxlength="${f.max || 2000}">${esc(f.value || "")}</textarea><input type="hidden" name="__meta_${esc(f.key)}" value="${meta}"></label>`;
              })
              .join("")}</div></details>`,
        )
        .join("");
      const pageFields = pageData.pages
        .map(
          (page, i) =>
            `<details class="home-edit-group"><summary>${esc(page.title)} · ${esc(page.path)}</summary><div class="content-page-field" data-page-editor="${i}"><input type="hidden" name="page_${i}_path" value="${esc(page.path)}"><label class="check-row"><input name="page_${i}_enabled" type="checkbox" ${page.enabled ? "checked" : ""}>使用自定义内容（关闭则同步品牌知识库默认资料）</label>${field(`page_${i}_title`, "页面标题", page.title, "text", true, 160)}${["/library", "/about", "/contact"].includes(page.path) ? field(`page_${i}_accent`, "页面副标题 / 横幅标语", page.accent, "text", false, 200) + pageHubCopyFields(page, i) : ""}${field(`page_${i}_description`, "页面简介 / 搜索摘要", page.description, "textarea", true, 400)}${field(`page_${i}_body`, "页面正文", page.body, "textarea", false, 60000)}<small class="modal-note">支持 ## 标题、- 列表、**强调**、[文字](链接) 和 ![说明](图片路径)。修改正文、副标题或页面卡片文案会自动启用自定义内容。</small></div></details>`,
        )
        .join("");
      html =
        heading(
          "官网内容",
          "编辑首页知识库、科研资料、发展历程、合作内容、图库和参考价格。产品系列请在“产品系列”模块单独维护。",
          "",
        ) +
        `<div class="content-tabs" role="group" aria-label="官网内容分类"><button type="button" class="outline-btn" data-action="content-tab" data-form="contentForm" aria-pressed="true">品牌与模块资料</button><button type="button" class="outline-btn" data-action="content-tab" data-form="homeForm" aria-pressed="false">首页文案与图片</button><button type="button" class="outline-btn" data-action="content-tab" data-form="pageForm" aria-pressed="false">资料详情页</button><a class="text-btn" href="/" target="_blank" rel="noopener">预览官网 ↗</a></div><form class="content-form panel" id="contentForm"><input type="hidden" name="version" value="${esc(d.version)}"><h2>品牌知识</h2><p class="modal-note">这里的内容会用于官网首页、详情弹窗、资料中心、资料详情页和公开资料目录。按模块填写资料，可添加、删除或调整条目顺序；图片支持图库选择和本地上传。</p><div class="content-basic-grid">${basic}</div><h2>模块化资料</h2>${complex}<label class="edit-field">参考价格说明<textarea name="priceNote" rows="4" maxlength="1000">${esc(d.priceNote)}</textarea></label><label class="edit-field">合作政策说明<textarea name="investmentNote" rows="5" maxlength="1600">${esc(d.investmentNote)}</textarea></label><p class="form-error" role="alert"></p>${write ? '<button class="primary-action" type="submit">保存官网内容</button>' : ""}</form><form class="content-form panel" id="homeForm" hidden><h2>首页文字与图片</h2><p class="modal-note">首页可见标题、说明、按钮、图片和图片描述均可编辑；科研、历程、合作、图库等结构化模块仍在上方维护。</p>${homeFields}<p class="form-error" role="alert"></p>${write ? '<button class="primary-action" type="submit">保存首页内容</button>' : ""}</form><form class="content-form panel" id="pageForm" hidden><h2>资料详情页</h2><p class="modal-note">编辑品牌、联系、常见问题、养护指南、对比、参考价格报告、隐私与条款等公开资料页。默认资料随品牌知识库同步，也可启用自定义内容。</p><div class="content-page-grid">${pageFields}</div><p class="form-error" role="alert"></p>${write ? '<button class="primary-action" type="submit">保存资料页</button>' : ""}</form>`;
      if (!write)
        setTimeout(
          () =>
            document
              .querySelectorAll(
                "#contentForm input,#contentForm textarea,#contentForm select,#contentForm button,#homeForm input,#homeForm textarea,#homeForm button,#pageForm input,#pageForm textarea,#pageForm button",
              )
              .forEach((el) => (el.disabled = true)),
          0,
        );
    }
    if (state.view === view) {
      $("#adminContent").innerHTML = html;
      if (view === "site" && !can("site.write"))
        $("#siteForm")
          ?.querySelectorAll("input,textarea")
          .forEach((i) => (i.disabled = true));
      if (view === "website" && !can("site.write"))
        $("#adminContent")
          .querySelectorAll(
            "#websiteSiteForm input,#websiteSiteForm textarea,#websiteHomeForm input,#websiteHomeForm textarea,#websiteContentForm input,#websiteContentForm textarea,#websitePagesForm input,#websitePagesForm textarea",
          )
          .forEach((i) => (i.disabled = true));
    }
  }
  function renderWebsiteEditor({ site, content: d, homeData, pageData }) {
    const write = can("site.write");
    const b = d.brand || {};
    const siteFields =
      field("heroTitle", "首页主标题", site.heroTitle, "text", true, 40) +
      field("heroAccent", "首页副标题", site.heroAccent, "text", true, 40) +
      field("heroDescription", "首页介绍", site.heroDescription, "textarea", true, 400) +
      field("brandIntro", "品牌简介（与品牌资料同步）", site.brandIntro, "textarea", true, 2000) +
      field("phone", "咨询电话", site.phone, "text", true, 30) +
      field("address", "总部地址", site.address, "text", true, 200) +
      field("seoTitle", "搜索结果标题", site.seoTitle, "text", true, 100) +
      field("seoDescription", "搜索结果描述", site.seoDescription, "textarea", true, 300) +
      field("icp", "ICP备案号", site.icp) +
      field("police", "公安备案号", site.police);

    const homeGroups = [];
    for (const value of homeData.fields || []) {
      let group = homeGroups.find((item) => item.name === value.group);
      if (!group) {
        group = { name: value.group, fields: [] };
        homeGroups.push(group);
      }
      group.fields.push(value);
    }
    const homeFields = homeGroups
      .map(
        (group) =>
          `<details class="home-edit-group" open><summary>${esc(group.name)}</summary><div class="content-basic-grid">${group.fields
            .map((f) => renderWebsiteHomeField(f, write))
            .join("")}</div></details>`,
      )
      .join("");

    const basic = [
      [
        "品牌基础信息",
        [
          field("brand_name", "品牌名称", b.name, "text", true, 80),
          field("brand_established", "成立年份", b.established, "text", true, 20),
          field("brand_mission", "品牌使命", b.mission, "textarea", true, 300),
          field("brand_values", "品牌价值观", b.values, "textarea", true, 500),
          field("brand_description", "品牌介绍", b.description, "textarea", true, 2000),
        ],
      ],
      [
        "创始人信息",
        [
          field("brand_founder", "创始人", b.founder, "text", true, 80),
          field("brand_founderRole", "创始人身份", b.founderRole, "text", true, 120),
          field("brand_founderBody", "创始人简介", b.founderBody, "textarea", true, 3000),
          field("brand_founderResearch", "研究初心与成果", b.founderResearch, "textarea", true, 5000),
        ],
      ],
      [
        "品牌规模指标",
        [
          field("brand_researchYears", "研究积累指标", b.researchYears, "text", true, 30),
          field("brand_stores", "品牌门店指标", b.stores, "text", true, 30),
          field("brand_series", "产品系列指标", b.series, "text", true, 30),
          field("brand_offices", "办事处指标", b.offices, "text", true, 30),
        ],
      ],
    ]
      .map(
        ([title, fields]) =>
          `<details class="home-edit-group" open><summary>${title}</summary><div class="content-basic-grid">${fields.join("")}</div></details>`,
      )
      .join("");
    const collections = contentLists
      .map(
        ([key, label]) =>
          `<details class="home-edit-group"><summary>${label} · ${(d[key] || []).length} 项</summary><div data-content-list="${key}">${(d[key] || []).map((v) => contentRow(key, v)).join("")}</div>${write ? `<button type="button" class="outline-btn" data-action="content-add" data-list="${key}">＋ 添加到${label}</button>` : ""}</details>`,
      )
      .join("");
    const pageFields = (pageData.pages || [])
      .map(
        (page, i) =>
          `<details class="home-edit-group"><summary>${esc(page.title)} · ${esc(page.path)}</summary><div class="content-page-field" data-page-editor="${i}"><input type="hidden" name="page_${i}_path" value="${esc(page.path)}"><label class="check-row"><input name="page_${i}_enabled" type="checkbox" ${page.enabled ? "checked" : ""}>使用自定义内容（关闭则使用默认内容）</label>${field(`page_${i}_title`, "页面标题", page.title, "text", true, 160)}${["/library", "/about", "/contact"].includes(page.path) ? field(`page_${i}_accent`, "页面副标题 / 横幅标语", page.accent, "text", false, 200) + pageHubCopyFields(page, i) : ""}${field(`page_${i}_description`, "页面简介 / 搜索摘要", page.description, "textarea", true, 400)}${field(`page_${i}_body`, "页面正文", page.body, "textarea", false, 60000)}<small class="modal-note">支持 ## 标题、- 列表、**强调**、[文字](链接) 和 ![说明](图片路径)。修改正文、副标题或页面卡片文案会自动启用自定义内容。</small></div></details>`,
      )
      .join("");
    const dynamic = [
      ["stores", "门店查询", "stores.read", "stores.write", "门店地址、电话和营业时间。"],
      ["services", "服务项目", "services.read", "services.write", "首页服务卡片和服务详情弹窗。"],
      ["products", "产品系列", "products.read", "products.write", "首页产品栏目和产品详情。"],
      ["articles", "内容发布", "articles.read", "articles.write", "用于文章类内容。"],
      ["news", "品牌资讯", "articles.read", "articles.write", "公众号文章需要在这里手动提交，保存并发布后才会出现在官网。"],
    ]
      .filter(([, , permission]) => can(permission))
      .map(([key, title, permission, writePermission, note]) => {
        const items = state.websiteItems[key] || [];
        const canWrite = can(writePermission);
        return `<section class="website-module" id="website-${key}"><div class="website-module-head"><div><h3>${title}</h3><p>${note}</p></div><div><span class="block-count">${items.length} 项</span>${canWrite ? `<button type="button" class="outline-btn" data-action="website-edit" data-module="${key}">＋ 添加</button>` : ""}</div></div><div class="website-item-list">${items.length ? items.map((item) => `<article class="website-item-row"><div><b>${esc(item.name || item.title)}</b><p>${esc(item.address || item.summary || item.city || item.category || "")}</p></div><span class="status ${item.published ? "done" : "pending"}">${item.published ? "已发布" : "草稿"}</span><button type="button" class="text-btn" data-action="website-edit" data-module="${key}" data-id="${esc(item.id)}">${canWrite ? "编辑" : "查看"}</button></article>`).join("") : empty("暂时没有记录")}</div></section>`;
      })
      .join("");

    return (
      heading(
        "官网编辑",
        "按官网从上到下的展示顺序集中维护。首页文字、品牌资料、服务产品、门店、资讯和资料详情页都在这一页查找。",
        '<a class="outline-btn" href="/" target="_blank" rel="noopener">预览官网 ↗</a>',
      ) +
      `<nav class="website-editor-nav" aria-label="官网编辑模块"><a href="#website-site">顶部与首屏</a><a href="#website-home">首页模块</a><a href="#website-brand">品牌故事</a><a href="#website-dynamic">服务、产品、门店与资讯</a><a href="#website-pages">资料详情页</a></nav>` +
      `<div class="website-editor"><section class="website-section" id="website-site"><div class="website-section-heading"><span>01</span><div><h2>顶部与首页首屏</h2><p>导航、首页标题、联系方式、搜索摘要和备案信息。</p></div></div><form class="website-form panel" id="websiteSiteForm">${siteFields}<p class="form-error" role="alert"></p>${write ? '<button class="primary-action" type="submit">保存顶部与首屏</button>' : ""}</form></section>` +
      `<section class="website-section" id="website-home"><div class="website-section-heading"><span>02</span><div><h2>首页模块文字与图片</h2><p>按首页布局顺序编辑品牌、服务、科研、产品、门店、合作、咨询和资料入口等内容。</p></div></div><form class="website-form panel" id="websiteHomeForm">${homeFields}<p class="form-error" role="alert"></p>${write ? '<button class="primary-action" type="submit">保存首页模块</button>' : ""}</form></section>` +
      `<section class="website-section" id="website-brand"><div class="website-section-heading"><span>03</span><div><h2>品牌资料与结构化模块</h2><p>发展历程、科研数据、资质荣誉、服务参考价、合作店型、伙伴和图库。客户文档中标注的“中精特新”、伙伴姓名和重复资料都在对应条目中修改。</p></div></div><form class="website-form panel" id="websiteContentForm"><div class="content-basic-grid">${basic}</div><h3 class="website-form-subtitle">按官网顺序维护模块</h3>${collections}<label class="edit-field">参考价格说明<textarea name="priceNote" rows="4" maxlength="1000">${esc(d.priceNote)}</textarea></label><label class="edit-field">合作政策说明<textarea name="investmentNote" rows="5" maxlength="1600">${esc(d.investmentNote)}</textarea></label><p class="form-error" role="alert"></p>${write ? '<button class="primary-action" type="submit">保存品牌资料</button>' : ""}</form></section>` +
      `<section class="website-section" id="website-dynamic"><div class="website-section-heading"><span>04</span><div><h2>服务、产品、门店与资讯</h2><p>每个模块都在本页列出；点击“编辑”会打开对应的完整表单，保存后立即同步官网。</p></div></div>${dynamic || empty("当前账号没有可查看的内容模块")}</section>` +
      `<section class="website-section" id="website-pages"><div class="website-section-heading"><span>05</span><div><h2>资料详情页</h2><p>关于我们、联系咨询、资料中心、养护指南、服务对比、价格报告、常见问题、隐私与条款等页面统一在这里修改。</p></div></div><form class="website-form panel" id="websitePagesForm"><div class="content-page-grid">${pageFields}</div><p class="form-error" role="alert"></p>${write ? '<button class="primary-action" type="submit">保存资料详情页</button>' : ""}</form></section></div>`
    );
  }

  function renderWebsiteHomeField(f, editable) {
    if (f.type === "collection") return homeCollectionField(f, editable);
    const meta = esc(
      JSON.stringify({
        key: f.key,
        selector: f.selector || "",
        type: f.type,
        label: f.label,
        group: f.group,
        max: f.max || 2000,
      }),
    );
    if (f.type === "image")
      return `<div class="home-image-edit edit-field"><span>${esc(f.label)}</span><input type="hidden" name="${esc(f.key)}" value="${esc(f.value || "")}"><input type="hidden" name="__meta_${esc(f.key)}" value="${meta}"><button type="button" class="image-field-preview" data-action="home-image" data-key="${esc(f.key)}" ${editable ? "" : "disabled"}>${f.value ? `<img src="/${esc(f.value)}" alt="${esc(f.label)}"><span>${editable ? "点击更换图片" : "点击预览图片"}</span>` : '<span class="image-field-empty">暂无图片</span>'}</button></div>`;
    return `<label class="edit-field">${esc(f.label)}<textarea name="${esc(f.key)}" rows="${f.type === "text" ? 3 : 2}" maxlength="${f.max || 2000}" ${editable ? "" : "disabled"}>${esc(f.value || "")}</textarea><input type="hidden" name="__meta_${esc(f.key)}" value="${meta}"></label>`;
  }

  function pageHubCopyFields(page, index) {
    const specs =
      page.path === "/about"
        ? [["storyImageCaption", "关于页 · 科研图片说明", "text", 240]]
        : page.path === "/contact"
          ? [
              ["contactPhoneTitle", "联系页 · 电话卡标题", "text", 120],
              ["contactPhoneDescription", "联系页 · 电话卡说明", "textarea", 300],
              ["contactPhoneLink", "联系页 · 电话卡按钮", "text", 120],
              ["contactFormTitle", "联系页 · 表单卡标题", "text", 120],
              ["contactFormDescription", "联系页 · 表单卡说明", "textarea", 400],
              ["contactFormLink", "联系页 · 表单卡按钮", "text", 120],
              ["contactStoreTitle", "联系页 · 门店卡标题", "text", 120],
              ["contactStoreDescription", "联系页 · 门店卡说明", "textarea", 400],
              ["contactStoreLink", "联系页 · 门店卡按钮", "text", 120],
            ]
          : [];
    const copy = page.hubCopy || {};
    return specs
      .map(([key, label, type, max]) =>
        field(`page_${index}_hub_${key}`, label, copy[key] || "", type, false, max),
      )
      .join("");
  }

  function field(
    name,
    label,
    value = "",
    type = "text",
    required = false,
    max = 200,
  ) {
    return `<label class="edit-field">${label}${required ? ' <span class="required">*</span>' : ""}${type === "textarea" ? `<textarea name="${name}" rows="4" maxlength="${max}" ${required ? "required" : ""}>${esc(value)}</textarea>` : `<input name="${name}" type="${type}" value="${esc(value)}" maxlength="${max}" ${type === "number" ? 'min="0" max="9999"' : ""} ${type === "password" ? 'minlength="12" autocomplete="new-password"' : ""} ${required ? "required" : ""}>`}</label>`;
  }
  function select(name, label, options, current) {
    return `<label class="edit-field">${label}<select name="${name}">${options
      .map((o) => {
        let [v, l] = Array.isArray(o) ? o : [o, o];
        return `<option value="${esc(v)}" ${v === current ? "selected" : ""}>${esc(l)}</option>`;
      })
      .join("")}</select></label>`;
  }
  const contentLists = [
    [
      "timeline",
      "品牌发展历程",
      [
        ["year", "年份", 20],
        ["title", "标题", 120],
        ["text", "事件介绍", 500, "textarea"],
      ],
    ],
    [
      "research",
      "科研技术方向",
      [
        ["name", "方向名称", 120],
        ["text", "介绍", 1200, "textarea"],
      ],
    ],
    [
      "researchNumbers",
      "科研数据",
      [
        ["number", "数字", 40],
        ["label", "指标说明", 100],
      ],
    ],
    [
      "qualifications",
      "资质资料",
      [
        ["name", "资质名称", 160],
        ["entity", "主体 / 年份", 240],
        ["detail", "详细说明", 800, "textarea"],
      ],
    ],
    ["honors", "品牌荣誉", [["text", "荣誉名称", 240]]],
    [
      "patents",
      "专利资料",
      [
        ["name", "专利名称", 200],
        ["number", "专利编号", 80],
      ],
    ],
    [
      "servicePrices",
      "服务参考价格",
      [
        ["name", "服务名称", 120],
        ["price", "参考价格", 100],
        ["duration", "参考时长", 100],
      ],
    ],
    [
      "support",
      "合作支持",
      [
        ["name", "支持名称", 120],
        ["text", "介绍", 800, "textarea"],
      ],
    ],
    [
      "shopModels",
      "合作店型",
      [
        ["name", "店型名称", 80],
        ["size", "面积说明", 80],
        ["investment", "标准投资（万元）", 40],
        ["products", "产品配置", 160],
        ["equipment", "设备配置", 160],
      ],
    ],
    [
      "partners",
      "合作伙伴案例",
      [
        ["name", "伙伴姓名", 80],
        ["city", "城市", 100],
        ["joined", "加入年份", 20],
        ["metric", "历史指标", 40],
        ["unit", "指标单位", 80],
        ["text", "案例介绍", 600, "textarea"],
      ],
    ],
    [
      "gallery",
      "门店空间图库",
      [
        ["title", "空间名称", 120],
        ["caption", "图片说明", 240],
        ["image", "展示图片", 250, "image"],
      ],
    ],
    [
      "learning",
      "人才培训课程",
      [
        ["name", "课程名称", 120],
        ["text", "课程介绍", 600, "textarea"],
      ],
    ],
  ];
  function homeCollectionRow(fields, value = {}) {
    const controls = fields
      .map((field) => {
        const type = field.type === "textarea" ? "textarea" : "input";
        return `<label class="edit-field collection-field">${esc(field.label)}${type === "textarea" ? `<textarea data-collection-field="${esc(field.name)}" maxlength="${field.max || 2000}" rows="3">${esc(value[field.name] || "")}</textarea>` : `<input data-collection-field="${esc(field.name)}" value="${esc(value[field.name] || "")}" maxlength="${field.max || 2000}">`}</label>`;
      })
      .join("");
    return `<div class="content-row" data-collection-row><div class="content-row-actions"><button type="button" class="text-btn" data-action="home-collection-up">↑ 上移</button><button type="button" class="text-btn" data-action="home-collection-down">↓ 下移</button><button type="button" class="text-btn danger" data-action="home-collection-remove">删除本项</button></div><div class="content-basic-grid">${controls}</div></div>`;
  }
  function syncHomeCollection(block) {
    const values = [...block.querySelectorAll("[data-collection-row]")].map(
      (row) =>
        Object.fromEntries(
          [...row.querySelectorAll("[data-collection-field]")].map((input) => [
            input.dataset.collectionField,
            input.value,
          ]),
        ),
    );
    block.querySelector("[data-home-value]").value = JSON.stringify(values);
  }
  function homeCollectionField(field, editable) {
    const values = Array.isArray(field.value) ? field.value : [];
    const meta = esc(
      JSON.stringify({
        key: field.key,
        selector: "",
        type: field.type,
        label: field.label,
        group: field.group,
        max: field.max || 30,
      }),
    );
    const itemFields = esc(JSON.stringify(field.itemFields || []));
    return `<section class="home-content-block" data-home-collection="${esc(field.key)}" data-item-fields="${itemFields}"><div class="home-content-block-heading"><div><h3>${esc(field.label)}</h3><p>这一组内容会在官网同一内容块中成组展示，可添加、删除和排序。</p></div><span class="block-count" data-block-count>${values.length} 项</span></div><input type="hidden" name="${esc(field.key)}" value="${esc(JSON.stringify(values))}" data-home-value><input type="hidden" name="__meta_${esc(field.key)}" value="${meta}"><div data-collection-rows>${values.map((value) => homeCollectionRow(field.itemFields || [], value)).join("")}</div>${editable ? `<button type="button" class="outline-btn" data-action="home-collection-add">＋ 添加到${esc(field.label)}</button>` : ""}</section>`;
  }
  let contentRowId = 0;
  function contentRow(key, value = {}) {
    const fields = contentLists.find((v) => v[0] === key)[2];
    const id = ++contentRowId;
    const data = typeof value === "string" ? { text: value } : value;
    const controls = fields
      .map(([name, label, max, type]) => {
        if (type === "image")
          return `<div class="home-image-edit edit-field"><span>${label}</span><input type="hidden" name="row_${id}_${name}" data-row-field="${name}" value="${esc(data[name] || "")}"><button type="button" class="image-field-preview" data-action="home-image" ${can("site.write") ? "" : "disabled"}>${data[name] ? `<img src="/${esc(data[name])}" alt="当前展示图片"><span>点击更换图片</span>` : '<span class="image-field-empty">点击选择图片</span>'}</button></div>`;
        return field(
          `row_${id}_${name}`,
          label,
          data[name] || "",
          type || "text",
          true,
          max,
        )
          .replace("<input ", `<input data-row-field="${name}" `)
          .replace("<textarea ", `<textarea data-row-field="${name}" `);
      })
      .join("");
    return `<div class="content-row"><div class="content-row-actions">${can("site.write") ? '<button type="button" class="text-btn" data-action="content-up" aria-label="向上移动">↑ 上移</button><button type="button" class="text-btn" data-action="content-down" aria-label="向下移动">↓ 下移</button><button type="button" class="text-btn danger" data-action="content-remove">删除条目</button>' : ""}</div><div class="content-basic-grid">${controls}</div></div>`;
  }
  function imageField(image, editable) {
    return `<div class="image-field"><span class="image-field-label">展示图片</span><input type="hidden" name="image" value="${esc(image || "")}"><button class="image-field-preview" type="button" data-action="choose-image" ${editable ? 'aria-label="选择或上传展示图片"' : `aria-label="预览展示图片" ${image ? "" : "disabled"}`}>${image ? `<img src="/${esc(image)}" alt="当前展示图片"><span>${editable ? "点击更换图片" : "点击预览图片"}</span>` : `<span class="image-field-empty">${editable ? '<b aria-hidden="true">＋</b>点击选择图片' : "暂无展示图片"}</span>`}</button>${editable ? `<div class="image-field-actions"><button class="outline-btn" type="button" data-action="choose-image">选择图片 / 本地上传</button><button class="text-btn" type="button" data-action="clear-image" ${image ? "" : "hidden"}>移除图片</button></div><small>选择后保存本条记录，图片才会应用到官网。</small>` : ""}</div>`;
  }
  function updateImageField(field, url) {
    field.querySelector('[name="image"]').value = url;
    const button = field.querySelector(".image-field-preview");
    button.innerHTML = url
      ? `<img src="/${esc(url)}" alt="当前展示图片"><span>点击更换图片</span>`
      : '<span class="image-field-empty"><b aria-hidden="true">＋</b>点击选择图片</span>';
    field.querySelector('[data-action="clear-image"]').hidden = !url;
  }
  const imageInfo = (image) =>
    `${image?.url.startsWith("uploads/") ? "本地上传" : "品牌素材"}${image?.size ? ` · ${(image.size / 1024).toFixed(0)} KB` : ""}`;
  function renderMediaPicker() {
    const query = $("#mediaSearch").value.trim().toLowerCase();
    const source = $("#mediaSource").value;
    const images = picker.items.filter(
      (m) =>
        (!query || m.name.toLowerCase().includes(query)) &&
        (source === "all" || m.url.startsWith(source + "/")),
    );
    $("#mediaPickerGrid").innerHTML = images.length
      ? images
          .map(
            (m) =>
              `<button class="picker-image ${m.url === picker.selected ? "selected" : ""}" type="button" data-picker-url="${esc(m.url)}" aria-label="选择${esc(m.name)}" aria-pressed="${m.url === picker.selected}"><span class="picker-image-frame"><img loading="lazy" src="/${esc(m.url)}" alt="${esc(m.name)}"><span class="picker-check" aria-hidden="true">✓</span></span><span class="picker-image-name">${esc(m.name)}</span><small>${imageInfo(m)}</small></button>`,
          )
          .join("")
      : `<p class="picker-empty">${picker.loading ? "正在加载图库…" : !can("media.read") ? "当前账号没有查看图库权限。" : query || source !== "all" ? "没有匹配的图片，请调整搜索或图片来源。" : "图库暂无图片，可从本地上传。"}</p>`;
    $("#mediaPickerCount").textContent = picker.loading
      ? "正在读取图片…"
      : `显示 ${images.length} 张 · 共 ${picker.items.length} 张图片`;
    renderPickerSelection();
  }
  function renderPickerSelection() {
    const selected = picker.items.find((m) => m.url === picker.selected);
    $("#mediaPickerPreview").innerHTML = selected
      ? `<img src="/${esc(selected.url)}" alt="所选图片：${esc(selected.name)}">`
      : "<span>选择图片后，在这里预览</span>";
    $("#mediaPickerName").textContent = selected?.name || "尚未选择图片";
    $("#mediaPickerInfo").textContent = selected ? imageInfo(selected) : "";
    $("#mediaPickerSelection").textContent = selected
      ? `已选：${selected.name}`
      : "请选择图片";
    $("#mediaPickerConfirm").disabled = !selected || picker.busy;
    $("#mediaPickerGrid")
      .querySelectorAll("[data-picker-url]")
      .forEach((button) => {
        const active = button.dataset.pickerUrl === picker.selected;
        button.classList.toggle("selected", active);
        button.setAttribute("aria-pressed", String(active));
      });
  }
  async function openMediaPicker(field = null, image = null) {
    picker.opener = document.activeElement;
    picker.field = field;
    picker.selected =
      field?.querySelector('[name="image"]')?.value ||
      field?.querySelector('input[type="hidden"]')?.value ||
      image?.url ||
      "";
    picker.items = image
      ? [image]
      : picker.selected
        ? [{ url: picker.selected, name: "当前展示图片" }]
        : [];
    picker.busy = false;
    picker.loading = can("media.read");
    const request = ++picker.request;
    $("#mediaSearch").value = "";
    $("#mediaSource").value = "all";
    $("#mediaPickerError").textContent = "";
    $("#mediaPickerFile").value = "";
    $("#mediaPickerUpload").textContent = "↑ 上传本地图片";
    $("#mediaPickerTitle").textContent = field ? "选择展示图片" : "图片预览";
    $("#mediaPickerDescription").textContent = field
      ? "选择图库图片，或上传本地图片。确认后返回编辑内容。"
      : "浏览图库与查看大图，也可上传新图片。";
    $("#mediaPickerUpload").hidden = !can("media.write");
    $("#mediaPickerUpload").disabled = picker.loading;
    $("#mediaPickerClose").disabled = false;
    $("#mediaPickerCancel").disabled = false;
    $("#mediaPickerConfirm").hidden = !field;
    $("#mediaPickerCancel").textContent = field ? "取消" : "关闭";
    $("#mediaPickerModal").hidden = false;
    for (const id of ["adminShell", "editorModal"]) {
      $("#" + id).inert = true;
      $("#" + id).setAttribute("aria-hidden", "true");
    }
    document.body.style.overflow = "hidden";
    renderMediaPicker();
    $("#mediaSearch").focus();
    if (can("media.read")) {
      try {
        const { items } = await api("admin/media");
        if (request !== picker.request || $("#mediaPickerModal").hidden) return;
        const current = picker.items.find((m) => m.url === picker.selected);
        picker.items = items;
        if (current && !items.some((m) => m.url === current.url))
          picker.items.unshift(current);
      } catch (error) {
        if (request === picker.request)
          $("#mediaPickerError").textContent = error.message;
      } finally {
        if (request === picker.request) {
          picker.loading = false;
          $("#mediaPickerUpload").disabled = false;
          renderMediaPicker();
        }
      }
    }
  }
  function closeMediaPicker(force = false) {
    if ($("#mediaPickerModal").hidden || (picker.busy && !force)) return;
    picker.request++;
    $("#mediaPickerModal").hidden = true;
    for (const id of ["adminShell", "editorModal"]) {
      $("#" + id).inert = false;
      $("#" + id).removeAttribute("aria-hidden");
    }
    document.body.style.overflow = $("#editorModal").hidden ? "" : "hidden";
    picker.opener?.focus();
    picker.field = null;
    picker.homeTarget = null;
  }
  async function uploadImage(file) {
    if (file.size > 5 * 1024 * 1024)
      throw new Error("图片不能超过 5 MB，请选择较小的图片。");
    if (
      !/\.(jpe?g|png|webp)$/i.test(file.name) ||
      (file.type &&
        !["image/jpeg", "image/png", "image/webp"].includes(file.type))
    )
      throw new Error("请选择 JPG、PNG 或 WEBP 图片。");
    const data = new FormData();
    data.append("file", file);
    return api("admin/media", { method: "POST", body: data });
  }
  function showModal(title, content, onSubmit, closeAllowed = true) {
    lastFocus = document.activeElement;
    modalCloseAllowed = closeAllowed;
    onModalSubmit = onSubmit;
    $("#modalTitle").textContent = title;
    $("#modalBody").innerHTML = content;
    $("#modalClose").hidden = !closeAllowed;
    $("#editorModal").hidden = false;
    $("#editorModal").classList.add("open");
    document.body.style.overflow = "hidden";
    setTimeout(
      () =>
        $("#modalBody").querySelector("input,textarea,select,button")?.focus(),
      30,
    );
  }
  function closeModal(force = false) {
    if (!modalCloseAllowed && !force) return;
    closeMediaPicker(force);
    $("#editorModal").classList.remove("open");
    $("#editorModal").hidden = true;
    document.body.style.overflow = "";
    lastFocus?.focus();
    onModalSubmit = null;
  }
  const form = (content, button = "保存") =>
    `<form id="editorForm">${content}<p class="form-error" role="alert"></p><button class="primary-action" type="submit">${button}</button></form>`;
  function passwordDialog(required = false) {
    showModal(
      required ? "首次登录 · 设置新密码" : "修改密码",
      form(
        (required
          ? '<p class="modal-note">请设置至少 12 位的新密码。修改后，其他设备上的登录将失效。</p>'
          : "") +
          field("current", "当前密码", "", "password", true, 128) +
          field("password", "新密码", "", "password", true, 128) +
          field("confirm", "确认新密码", "", "password", true, 128),
      ),
      async (data) => {
        if (data.password !== data.confirm)
          throw new Error("两次输入的新密码不一致");
        await api("auth/password", {
          method: "POST",
          body: { current: data.current, password: data.password },
        });
        closeModal(true);
        toast("密码已修改");
        showApp(await api("auth/me"));
      },
      !required,
    );
  }
  async function edit(view, item) {
    state.returnView = state.view;
    state.modalView = view;
    if (view === "leads") {
      if (!item) {
        showModal(
          "新建咨询线索",
          form(
            field("name", "客户姓名", "", "text", true, 40) +
              field("phone", "联系电话", "", "tel", true, 30) +
              select("type", "咨询方向", [
                "头皮护理与养护",
                "门店服务预约",
                "合作加盟咨询",
                "品牌与产品咨询",
              ]) +
              field("message", "客户需求", "", "textarea", false, 2000),
          ),
          async (data) => {
            await api("admin/leads", { method: "POST", body: data });
            closeModal();
            toast("线索已保存");
            navigate("leads");
          },
        );
        return;
      }
      const detail = `<div class="lead-detail"><p><b>${esc(item.name)}</b> · ${esc(item.phone)}</p><p>${esc(item.type)} · ${esc(item.source)}</p><p class="multiline">${esc(item.message || "未填写补充说明")}</p></div>`;
      if (!can("leads.write")) {
        showModal(
          "咨询详情",
          detail +
            `<p>${status(item.status)}</p><p class="multiline">${esc(item.note)}</p>`,
        );
        return;
      }
      const users = await api("admin/assignees");
      showModal(
        "咨询详情与跟进",
        form(
          detail +
            select(
              "status",
              "跟进状态",
              ["待跟进", "沟通中", "已预约", "已完成", "无效"],
              item.status,
            ) +
            select(
              "ownerId",
              "负责人",
              [["", "暂不分配"], ...users.items.map((u) => [u.id, u.name])],
              item.owner_id || "",
            ) +
            field("note", "跟进记录", item.note, "textarea", false, 4000),
        ),
        async (data) => {
          await api("admin/leads/" + item.id, {
            method: "PATCH",
            body: { ...data, ownerId: data.ownerId || null },
          });
          closeModal();
          toast("跟进记录已保存");
          navigate("leads", false);
        },
      );
      return;
    }
    if (["stores", "services", "products", "articles", "news"].includes(view)) {
      const i = item || { sort: 0, image: "", published: false };
      let fields = "";
      if (view === "stores")
        fields =
          field("name", "门店名称", i.name, "text", true, 100) +
          field("city", "城市", i.city, "text", true, 40) +
          field("address", "详细地址", i.address, "text", true, 200) +
          field("phone", "门店电话", i.phone, "tel", true, 30) +
          field("hours", "营业时间", i.hours);
      if (view === "services" || view === "products")
        fields =
          field(
            "name",
            view === "products" ? "系列名称" : "服务名称",
            i.name,
            "text",
            true,
            60,
          ) +
          field("english", "英文名称", i.english, "text", false, 80) +
          field("summary", "简短介绍", i.summary, "text", true, 140) +
          field(
            "body",
            view === "products" ? "产品详情" : "服务详情",
            i.body,
            "textarea",
            true,
            10000,
          );
      if (view === "products")
        fields += field("range", "参考价格说明", i.range, "text", false, 100);
      if (view === "articles")
        fields =
          field("title", "文章标题", i.title, "text", true, 150) +
          select(
            "category",
            "栏目",
            ["品牌动态", "毛发知识", "合作资讯"],
            i.category,
          ) +
          field("summary", "文章摘要", i.summary, "textarea", true, 240) +
          field("body", "文章正文", i.body, "textarea", true, 30000);
      if (view === "news")
        fields =
          field("title", "资讯标题", i.title, "text", true, 150) +
          field(
            "publishedDate",
            "发布日期",
            i.publishedDate ||
              new Intl.DateTimeFormat("en-CA", {
                timeZone: "Asia/Shanghai",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
              }).format(new Date()),
            "date",
            true,
          ) +
          field("summary", "资讯摘要", i.summary, "textarea", true, 240) +
          field(
            "body",
            "资讯正文（支持 Markdown 标题、列表和图片）",
            i.body,
            "textarea",
            true,
            30000,
          ) +
          field("account", "来源账号", i.account, "text", false, 80) +
          field("publishedAt", "原文发布时间", i.publishedAt, "text", false, 16) +
          field("imageCount", "原文图片数", i.imageCount, "number", false, 3) +
          field("sourceUrl", "微信公众号原文链接", i.sourceUrl, "url", false, 500);
      const write = can(view + ".write");
      fields +=
        imageField(i.image, write) +
        field("sort", "排序（数值越小越靠前）", i.sort, "number", true) +
        `<label class="check-row"><input name="published" type="checkbox" ${i.published ? "checked" : ""}>发布到官网</label>`;
      showModal(
        (item ? "编辑" : "新建") + menu.find((m) => m[0] === view)[1],
        write ? form(fields) : fields,
        async (data, formEl) => {
          const published = formEl.elements.published.checked;
          delete data.published;
          data.sort = Number(data.sort);
          if (view === "news") {
            if (data.imageCount === "") delete data.imageCount;
            else data.imageCount = Number(data.imageCount);
            for (const key of ["account", "publishedAt", "sourceUrl"])
              if (data[key] === "") delete data[key];
          }
          await api("admin/" + view + (item ? "/" + item.id : ""), {
            method: item ? "PUT" : "POST",
            body: { data, published },
          });
          closeModal();
          toast("已保存，官网内容同步更新");
          navigate(state.returnView === "website" ? "website" : view, false);
        },
      );
      if (!write)
        $("#modalBody")
          .querySelectorAll("input,select,textarea")
          .forEach((el) => (el.disabled = true));
      return;
    }
    if (view === "users") {
      const roles = (await api("admin/role-options")).items;
      const i = item || { active: true };
      showModal(
        item ? "编辑管理员" : "添加管理员",
        form(
          field("name", "姓名", i.name, "text", true, 40) +
            field("username", "登录账号", i.username, "text", true, 60) +
            select(
              "roleId",
              "角色",
              roles.map((r) => [r.id, r.name]),
              i.roleId,
            ) +
            field(
              "password",
              item ? "重置密码（留空则保留）" : "初始密码",
              "",
              "password",
              !item,
              128,
            ) +
            `<p class="modal-note">请将初始密码单独交给成员。首次登录需要修改密码。</p><label class="check-row"><input type="checkbox" name="active" ${i.active ? "checked" : ""}>启用账号</label>`,
        ),
        async (data, el) => {
          data.active = el.elements.active.checked;
          if (!data.password) delete data.password;
          await api("admin/users" + (item ? "/" + item.id : ""), {
            method: item ? "PUT" : "POST",
            body: data,
          });
          closeModal();
          toast("管理员信息已保存");
          navigate("users", false);
        },
      );
      return;
    }
    if (view === "roles") {
      const i = item || { permissions: [] };
      const write = !i.protected && can("roles.write");
      const groups = {
        dashboard: "仪表盘",
        leads: "线索管理",
        stores: "门店管理",
        services: "服务项目",
        products: "产品系列",
        articles: "内容发布",
        media: "媒体资源",
        site: "官网编辑",
        users: "管理员管理",
        roles: "角色权限",
        audit: "操作日志",
      };
      const checks = Object.entries(groups)
        .map(
          ([prefix, label]) =>
            `<fieldset class="permission-fieldset"><legend>${label}</legend>${Object.entries(
              state.catalog,
            )
              .filter(([key]) => key.startsWith(prefix + "."))
              .map(
                ([key, label]) =>
                  `<label><input type="checkbox" name="permission" value="${key}" ${i.permissions.includes(key) ? "checked" : ""} ${!can(key) || !write ? "disabled" : ""}>${esc(label)}</label>`,
              )
              .join("")}</fieldset>`,
        )
        .join("");
      const fields =
        field("name", "角色名称", i.name, "text", true, 40) + checks;
      showModal(
        write ? (item ? "编辑角色权限" : "新建角色") : "角色权限明细",
        write ? form(fields) : fields,
        async (data, el) => {
          const selected = [
            ...el.querySelectorAll('[name="permission"]:checked'),
          ].map((e) => e.value);
          await api("admin/roles" + (item ? "/" + item.id : ""), {
            method: item ? "PUT" : "POST",
            body: { name: data.name, permissions: selected },
          });
          closeModal();
          toast("权限已保存，该角色成员需要重新登录");
          navigate("roles", false);
        },
      );
      if (!write)
        $("#modalBody").querySelector('[name="name"]').disabled = true;
    }
  }
  document.addEventListener("click", async (e) => {
    const nav = e.target.closest("[data-view]");
    if (nav) {
      e.preventDefault();
      navigate(nav.dataset.view);
      return;
    }
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const action = btn.dataset.action,
      item =
        action === "website-edit"
          ? (state.websiteItems[btn.dataset.module] || []).find(
              (i) => i.id === btn.dataset.id,
            )
          : state.items.find((i) => i.id === btn.dataset.id);
    try {
      if (action === "content-tab") {
        document
          .querySelectorAll(".content-tabs button")
          .forEach((button) =>
            button.setAttribute("aria-pressed", String(button === btn)),
          );
        for (const id of ["contentForm", "homeForm", "pageForm"])
          $("#" + id).hidden = id !== btn.dataset.form;
      } else if (
        [
          "content-add",
          "content-remove",
          "content-up",
          "content-down",
        ].includes(action)
      ) {
        if (!can("site.write")) return;
        if (action === "content-add")
          document
            .querySelector(`[data-content-list="${btn.dataset.list}"]`)
            .insertAdjacentHTML("beforeend", contentRow(btn.dataset.list));
        else {
          const row = btn.closest(".content-row");
          if (action === "content-remove") row.remove();
          else if (action === "content-up" && row.previousElementSibling)
            row.previousElementSibling.before(row);
          else if (action === "content-down" && row.nextElementSibling)
            row.nextElementSibling.after(row);
        }
      } else if (action === "home-image") {
        if (!can("site.write")) return;
        picker.homeTarget = btn.closest(".home-image-edit");
        await openMediaPicker(picker.homeTarget);
      } else if (action === "home-collection-add") {
        if (!can("site.write")) return;
        const block = btn.closest("[data-home-collection]");
        const fields = JSON.parse(block.dataset.itemFields);
        block
          .querySelector("[data-collection-rows]")
          .insertAdjacentHTML("beforeend", homeCollectionRow(fields));
        syncHomeCollection(block);
      } else if (
        [
          "home-collection-remove",
          "home-collection-up",
          "home-collection-down",
        ].includes(action)
      ) {
        if (!can("site.write")) return;
        const row = btn.closest("[data-collection-row]"),
          block = btn.closest("[data-home-collection]");
        if (action === "home-collection-remove") {
          const rows = block.querySelectorAll("[data-collection-row]");
          if (rows.length <= 1) return toast("每个内容块至少保留一项");
          row.remove();
        } else if (
          action === "home-collection-up" &&
          row.previousElementSibling
        )
          row.previousElementSibling.before(row);
        else if (action === "home-collection-down" && row.nextElementSibling)
          row.nextElementSibling.after(row);
        syncHomeCollection(block);
      } else if (action === "choose-image") {
        const field = btn.closest(".image-field");
        const activeView = state.view === "website" ? state.modalView : state.view;
        if (can(activeView + ".write")) await openMediaPicker(field);
        else {
          const url = field.querySelector('[name="image"]').value;
          await openMediaPicker(
            null,
            url ? { url, name: "当前展示图片" } : null,
          );
        }
      } else if (action === "clear-image") {
        const activeView = state.view === "website" ? state.modalView : state.view;
        if (can(activeView + ".write"))
          updateImageField(btn.closest(".image-field"), "");
      } else if (action === "upload-media") $("#mediaUpload").click();
      else if (action === "preview-media") await openMediaPicker(null, item);
      else if (action === "website-edit")
        await edit(btn.dataset.module, item);
      else if (action === "new") await edit(state.view);
      else if (action === "new-lead") await edit("leads");
      else if (action === "edit") await edit(state.view, item);
      else if (action === "prev" || action === "next") {
        state.page += action === "next" ? 1 : -1;
        navigate(state.view, false);
      } else if (action === "delete") {
        const view = state.view;
        showModal(
          "确认删除",
          form(
            `<p>删除「${esc(item.name || item.title)}」后，该记录将被移除。</p>`,
            "确认删除",
          ),
          async () => {
            await api("admin/" + view + "/" + item.id, { method: "DELETE" });
            closeModal();
            toast("记录已删除");
            navigate(view, false);
          },
        );
      } else if (action === "export") {
        const res = await api(
          `admin/leads/export?q=${encodeURIComponent(state.q)}&status=${encodeURIComponent(state.status)}`,
          { raw: true },
        );
        const url = URL.createObjectURL(await res.blob());
        const a = document.createElement("a");
        a.href = url;
        a.download = "博士园咨询线索.csv";
        a.click();
        URL.revokeObjectURL(url);
      } else if (action === "copy") {
        await navigator.clipboard.writeText(btn.dataset.url);
        toast("图片路径已复制");
      }
    } catch (error) {
      toast(error.message);
    }
  });
  document.addEventListener("submit", async (e) => {
    if (e.target.id === "loginForm") {
      e.preventDefault();
      const btn = e.target.querySelector("button");
      btn.disabled = true;
      $("#loginError").textContent = "";
      try {
        showApp(
          await api("auth/login", {
            method: "POST",
            body: Object.fromEntries(new FormData(e.target)),
          }),
        );
        e.target.reset();
      } catch (error) {
        $("#loginError").textContent = error.message;
      } finally {
        btn.disabled = false;
      }
      return;
    }
    if (e.target.id === "leadSearchForm") {
      e.preventDefault();
      const d = new FormData(e.target);
      state.q = d.get("q");
      state.status = d.get("status");
      state.page = 1;
      navigate("leads", false);
      return;
    }
    if (
      [
        "editorForm",
        "siteForm",
        "contentForm",
        "homeForm",
        "pageForm",
        "websiteSiteForm",
        "websiteHomeForm",
        "websiteContentForm",
        "websitePagesForm",
      ].includes(e.target.id)
    ) {
      e.preventDefault();
      const el = e.target,
        btn = el.querySelector('button[type="submit"],button.primary-action'),
        errorEl = el.querySelector(".form-error");
      if (btn) btn.disabled = true;
      errorEl.textContent = "";
      try {
        if (el.id === "homeForm" || el.id === "websiteHomeForm")
          el.querySelectorAll("[data-home-collection]").forEach(
            syncHomeCollection,
          );
        const data = Object.fromEntries(new FormData(el));
        if (el.id === "siteForm" || el.id === "websiteSiteForm") {
          await api("admin/site", { method: "PUT", body: data });
          toast(el.id === "websiteSiteForm" ? "顶部与首屏已保存" : "官网设置已保存");
        } else if (el.id === "contentForm" || el.id === "websiteContentForm") {
          const collections = {};
          for (const [key] of contentLists) {
            collections[key] = [
              ...el.querySelectorAll(
                `[data-content-list="${key}"] > .content-row`,
              ),
            ].map((row) => {
              const values = Object.fromEntries(
                [...row.querySelectorAll("[data-row-field]")].map((input) => [
                  input.dataset.rowField,
                  input.value,
                ]),
              );
              return key === "honors" ? values.text : values;
            });
          }
          const brand = {};
          for (const key of [
            "name",
            "established",
            "mission",
            "values",
            "description",
            "founder",
            "founderRole",
            "founderBody",
            "founderResearch",
            "researchYears",
            "stores",
            "series",
            "offices",
          ]) {
            brand[key] = data["brand_" + key];
            delete data["brand_" + key];
          }
          for (const [key, value] of Object.entries(collections))
            data[key] = value;
          for (const key of Object.keys(data))
            if (key.startsWith("row_")) delete data[key];
          data.brand = brand;
          delete data.source;
          delete data.products;
          delete data.contentForm;
          delete data.websiteContentForm;
          await api("admin/content", { method: "PUT", body: data });
          toast(el.id === "websiteContentForm" ? "品牌资料已保存并更新" : "官网内容已保存并更新");
        } else if (el.id === "homeForm" || el.id === "websiteHomeForm") {
          const fields = [];
          for (const metaEl of el.querySelectorAll('[name^="__meta_"]')) {
            const meta = JSON.parse(metaEl.value);
            fields.push({ ...meta, value: data[meta.key] || "" });
            delete data[meta.key];
          }
          await api("admin/home-fields", { method: "PUT", body: { fields } });
          toast(el.id === "websiteHomeForm" ? "首页模块已保存并更新" : "首页内容已保存并更新");
        } else if (el.id === "pageForm" || el.id === "websitePagesForm") {
          const pages = [...el.querySelectorAll("[data-page-editor]")].map(
            (editor) => {
              const prefix = `page_${editor.dataset.pageEditor}_`;
              const hubCopy = {};
              for (const [key, value] of Object.entries(data)) {
                const marker = prefix + "hub_";
                if (key.startsWith(marker)) hubCopy[key.slice(marker.length)] = value;
              }
              return {
                path: data[prefix + "path"],
                title: data[prefix + "title"],
                accent: data[prefix + "accent"] || "",
                hubCopy,
                description: data[prefix + "description"],
                body: data[prefix + "body"] || "",
                enabled: el.elements[prefix + "enabled"].checked,
              };
            },
          );
          await api("admin/page-content", { method: "PUT", body: { pages } });
          toast(el.id === "websitePagesForm" ? "资料详情页已保存并更新" : "资料页内容已保存并更新");
        } else await onModalSubmit?.(data, el);
      } catch (error) {
        errorEl.textContent = error.message;
      } finally {
        if (btn) btn.disabled = false;
      }
    }
  });
  document.addEventListener("input", (e) => {
    const editor = e.target.closest("[data-page-editor]");
    if (editor && e.target.type !== "checkbox")
      editor.querySelector('input[type="checkbox"]').checked = true;
  });
  document.addEventListener("change", async (e) => {
    if (e.target.id === "mediaUpload") {
      try {
        const file = e.target.files[0];
        if (!file) return;
        e.target.disabled = true;
        const button = document.querySelector('[data-action="upload-media"]');
        if (button) {
          button.disabled = true;
          button.textContent = "正在上传…";
        }
        await uploadImage(file);
        toast("图片上传成功");
        navigate("media");
      } catch (error) {
        toast(error.message);
      } finally {
        e.target.disabled = false;
        e.target.value = "";
        const button = document.querySelector('[data-action="upload-media"]');
        if (button) {
          button.disabled = false;
          button.textContent = "↑ 上传图片";
        }
      }
    }
    if (e.target.id === "mediaPickerFile") {
      const file = e.target.files[0];
      if (!file || picker.busy) return;
      const request = picker.request;
      picker.busy = true;
      $("#mediaPickerError").textContent = "";
      $("#mediaPickerUpload").textContent = "正在上传…";
      for (const id of [
        "mediaPickerUpload",
        "mediaPickerConfirm",
        "mediaPickerClose",
        "mediaPickerCancel",
      ])
        $("#" + id).disabled = true;
      try {
        const result = await uploadImage(file);
        if (request !== picker.request) return;
        picker.items.unshift(result);
        picker.selected = result.url;
        $("#mediaSearch").value = "";
        $("#mediaSource").value = "all";
        renderMediaPicker();
        toast("图片已上传，点击“使用此图片”应用到当前记录。");
      } catch (error) {
        if (request === picker.request)
          $("#mediaPickerError").textContent = error.message;
      } finally {
        e.target.value = "";
        if (request === picker.request) {
          picker.busy = false;
          $("#mediaPickerUpload").textContent = "↑ 上传本地图片";
          for (const id of [
            "mediaPickerUpload",
            "mediaPickerClose",
            "mediaPickerCancel",
          ])
            $("#" + id).disabled = false;
          renderPickerSelection();
        }
      }
    }
    if (
      e.target.name === "permission" &&
      e.target.checked &&
      e.target.value.endsWith(".write")
    ) {
      const read = $(
        `[name="permission"][value="${e.target.value.replace(".write", ".read")}"]`,
      );
      if (read) read.checked = true;
    }
  });
  $("#modalClose").addEventListener("click", () => closeModal());
  $("#mediaPickerGrid").addEventListener("click", (e) => {
    const button = e.target.closest("[data-picker-url]");
    if (!button || picker.busy) return;
    picker.selected = button.dataset.pickerUrl;
    renderPickerSelection();
  });
  $("#mediaSearch").addEventListener("input", renderMediaPicker);
  $("#mediaSource").addEventListener("change", renderMediaPicker);
  $("#mediaPickerUpload").addEventListener("click", () =>
    $("#mediaPickerFile").click(),
  );
  $("#mediaPickerClose").addEventListener("click", () => closeMediaPicker());
  $("#mediaPickerCancel").addEventListener("click", () => closeMediaPicker());
  $("#mediaPickerModal").addEventListener("click", (e) => {
    if (e.target === $("#mediaPickerModal")) closeMediaPicker();
  });
  $("#mediaPickerConfirm").addEventListener("click", () => {
    if (!picker.field?.isConnected || picker.busy || !picker.selected) return;
    if (picker.homeTarget) {
      const input = picker.homeTarget.querySelector('input[type="hidden"]');
      input.value = picker.selected;
      picker.homeTarget.querySelector(".image-field-preview").innerHTML =
        `<img src="/${esc(picker.selected)}" alt="当前展示图片"><span>点击更换图片</span>`;
    } else updateImageField(picker.field, picker.selected);
    closeMediaPicker();
  });
  $("#editorModal").addEventListener("click", (e) => {
    if (e.target === $("#editorModal")) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (!$("#mediaPickerModal").hidden) {
      if (e.key === "Escape") {
        e.preventDefault();
        closeMediaPicker();
      }
      if (e.key === "Tab") {
        const elements = [
          ...$("#mediaPickerModal").querySelectorAll("input,select,button,a"),
        ].filter((el) => !el.disabled && el.getClientRects().length);
        const first = elements[0],
          last = elements.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
      return;
    }
    if ($("#editorModal").hidden) return;
    if (e.key === "Escape") closeModal();
    if (e.key === "Tab") {
      const focusables = [
        ...$("#editorModal").querySelectorAll("input,select,textarea,button,a"),
      ].filter((el) => !el.disabled && el.getClientRects().length);
      const first = focusables[0],
        last = focusables.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  });
  $("#changePassword").addEventListener("click", () => passwordDialog());
  $("#logoutBtn").addEventListener("click", async () => {
    try {
      await api("auth/logout", { method: "POST" });
      showLogin();
    } catch (e) {
      toast(e.message);
    }
  });
  $("#sidebarToggle").addEventListener("click", () => {
    const open = $("#sidebar").classList.toggle("open");
    $("#sidebarToggle").setAttribute("aria-expanded", String(open));
  });
  if (location.protocol === "file:") {
    showLogin();
    $("#loginError").textContent =
      "请通过 http://localhost:4173/admin.html 打开管理后台。";
    $("#loginForm button[type=submit]").disabled = true;
  } else {
    api("auth/me")
      .then(showApp)
      .catch((error) => {
        showLogin();
        if (
          error.message !== "请先登录管理后台" &&
          error.message !== "登录已过期，请重新登录"
        )
          $("#loginError").textContent = error.message;
      });
  }
})();
