const { parseHTML } = require("linkedom");
const { createHash } = require("node:crypto");

const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const groups = [
  [".site-header", "导航与品牌标识"],
  ["#hero", "首页首屏"],
  [".brand-stats", "品牌规模说明"],
  ["#brand", "品牌故事"],
  ["#services", "服务体系"],
  ["#research", "科研实力"],
  ["#products", "产品系列栏目"],
  ["#network", "门店体验与查询"],
  ["#join", "合作加盟"],
  [".learning-section", "培训与合作伙伴"],
  ["#knowledge", "养护知识栏目"],
  ["#news", "品牌动态栏目"],
  ["#contact", "联系咨询"],
  [".resource-section", "资料中心入口"],
  [".site-footer", "页尾"],
];
const excluded = [
  "#heroTitle",
  "#heroAccent",
  "#heroDescription",
  "#brandIntro",
  "#headquarters",
  "#icpLink",
  "#policeRecord",
  "[data-phone]",
  "#researchTechniques",
  "#researchNumbers",
  "#timeline",
  "#supportGrid",
  "#shopModels",
  "#learningTracks",
  "#partnerGrid",
  "#galleryThumbs",
  "#productLayout",
  ".hero-principles",
  ".stats-grid",
  ".service-process",
  "#productPriceNote",
  "#investmentNote",
  ".gallery-main",
  ".service-grid",
  "#newsGrid",
  ".resource-grid",
  ".founder-card figcaption strong",
  ".founder-card figcaption span",
  ".brand-values p",
  ".stats-grid strong",
  ".credentials-strip > div",
  ".floating-tools",
  "#detailModal",
  ".skip-link",
  ".menu-toggle",
  ".consent",
  ".honeypot",
  "[aria-hidden=true]",
].join(",");
const defaultBlocks = {
  principles: [
    { key: "养", label: "综合养护" },
    { key: "防", label: "精准防护" },
    { key: "植", label: "精细治理" },
    { key: "健", label: "健发养身" },
  ],
  brandStats: [
    {
      number: "30+",
      label: "毛发研究积累",
      detail: "年 · 创始人研究始于 1987",
    },
    { number: "2000+", label: "品牌连锁网络", detail: "家 · 品牌资料统计口径" },
    { number: "6", label: "专业产品系列", detail: "覆盖多种养护需求" },
    { number: "16", label: "全国办事处", detail: "就近支持与服务" },
  ],
  serviceProcess: [
    { number: "01", text: "状态检测" },
    { number: "02", text: "需求沟通" },
    { number: "03", text: "适配护理" },
    { number: "04", text: "持续养护" },
  ],
};

function selectorFor(element) {
  const parts = [];
  while (element && element.localName !== "html") {
    if (element.id) {
      parts.unshift("#" + element.id);
      break;
    }
    const siblings = [...element.parentElement.children].filter(
      (e) => e.localName === element.localName,
    );
    parts.unshift(
      element.localName +
        ":nth-of-type(" +
        (siblings.indexOf(element) + 1) +
        ")",
    );
    element = element.parentElement;
  }
  return parts.join(" > ");
}
function directText(el) {
  return [...el.childNodes]
    .map((n) =>
      n.nodeType === 3 ? n.textContent : n.localName === "br" ? "\n" : "",
    )
    .join("")
    .trim();
}
function setDirectText(el, value) {
  const nodes = [...el.childNodes].filter(
    (n) => n.nodeType === 3 || n.localName === "br",
  );
  const template = el.ownerDocument.createElement("template");
  template.innerHTML = escape(value).replace(/\n/g, "<br>");
  el.insertBefore(template.content, nodes[0] || el.firstChild);
  nodes.forEach((n) => n.remove());
}
function homeFields(html) {
  const { document } = parseHTML(html);
  const fields = [];
  for (const el of document.querySelectorAll(
    "body h2,body h3,body h4,body p,body a,body span,body small,body strong,body figcaption,body li,body label,body button,body img,body input[placeholder],body textarea[placeholder]",
  )) {
    if (el.closest(excluded)) continue;
    const group = groups.find(([selector]) => el.closest(selector))?.[1];
    if (!group) continue;
    const selector = selectorFor(el);
    const key =
      "field_" +
      createHash("sha256").update(selector).digest("hex").slice(0, 12);
    if (el.localName === "img") {
      fields.push({
        key,
        selector,
        group,
        type: "image",
        label: "图片：" + (el.alt || "品牌标识"),
        value: el.getAttribute("src"),
        max: 250,
      });
      fields.push({
        key: key + "_alt",
        selector,
        group,
        type: "alt",
        label: "图片描述",
        value: el.alt || "",
        max: 240,
      });
    } else if (el.hasAttribute("placeholder")) {
      fields.push({
        key,
        selector,
        group,
        type: "placeholder",
        label: "输入提示：" + el.getAttribute("placeholder"),
        value: el.getAttribute("placeholder"),
        max: 240,
      });
    } else {
      const value = directText(el);
      if (!value || /^[\s\d↗→↓↑☎咨＋✧/·—]+$/.test(value)) continue;
      const kind = /^h[2-4]$/.test(el.localName)
        ? "标题"
        : el.localName === "p"
          ? "说明"
          : el.localName === "a" || el.localName === "button"
            ? "按钮/链接"
            : "文案";
      fields.push({
        key,
        selector,
        group,
        type: "text",
        label: kind + "：" + value.replace(/\n/g, " ").slice(0, 28),
        value,
        max: 2000,
      });
    }
  }
  fields.push({
    key: "campusImage",
    group: "品牌故事",
    type: "image",
    label: "品牌故事详情 · 园区历史图片",
    value: "assets/brand-campus.webp",
    max: 250,
  });
  fields.push({
    key: "principles",
    group: "首页首屏 · 核心理念组",
    type: "collection",
    label: "养 · 防 · 植 · 健",
    value: defaultBlocks.principles,
    itemFields: [
      { name: "key", label: "关键词", max: 10 },
      { name: "label", label: "说明", max: 80 },
    ],
    max: 20,
  });
  fields.push({
    key: "brandStats",
    group: "品牌规模 · 指标组",
    type: "collection",
    label: "品牌规模指标",
    value: defaultBlocks.brandStats,
    itemFields: [
      { name: "number", label: "数字", max: 30 },
      { name: "label", label: "指标名称", max: 80 },
      { name: "detail", label: "补充说明", max: 120 },
    ],
    max: 12,
  });
  fields.push({
    key: "serviceProcess",
    group: "服务体系 · 护理流程组",
    type: "collection",
    label: "护理流程",
    value: defaultBlocks.serviceProcess,
    itemFields: [
      { name: "number", label: "序号", max: 10 },
      { name: "text", label: "流程名称", max: 120 },
    ],
    max: 12,
  });
  fields.push({
    key: "awardImage",
    group: "科研实力",
    type: "image",
    label: "资质详情 · 奖项资料图片",
    value: "assets/bosye-kylb12.png",
    max: 250,
  });
  fields.push({
    key: "resourceTitle",
    group: "资料中心入口",
    type: "text",
    label: "资料中心栏目标题",
    value: "让每一份了解，\n都有清晰的依据。",
    max: 300,
  });
  fields.push({
    key: "resourceIntro",
    group: "资料中心入口",
    type: "text",
    label: "资料中心栏目说明",
    value: "从选择、对比到日常养护，\n阅读完整资料，确认适合自己的安排。",
    max: 500,
  });
  fields.push({
    key: "resourceLinkTitle",
    group: "资料中心入口",
    type: "text",
    label: "全部资料入口名称",
    value: "全部品牌与养护资料",
    max: 120,
  });
  return fields;
}

function renderHome(html, content, fields, site) {
  const { document } = parseHTML(html);
  const set = (selector, value) => {
    const el = document.querySelector(selector);
    if (el) el.textContent = value ?? "";
  };
  const block = (id, items, render) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = (items || []).map(render).join("");
  };
  const e = escape;
  const home = content.home || {};
  const principles =
    Array.isArray(home.principles) && home.principles.length
      ? home.principles
      : defaultBlocks.principles;
  const stats =
    Array.isArray(home.brandStats) && home.brandStats.length
      ? home.brandStats
      : defaultBlocks.brandStats;
  const process =
    Array.isArray(home.serviceProcess) && home.serviceProcess.length
      ? home.serviceProcess
      : defaultBlocks.serviceProcess;
  if (site) {
    document.querySelectorAll("[data-phone]").forEach((el) => {
      el.textContent = site.phone;
      el.setAttribute("href", "tel:" + site.phone.replace(/[^+\d]/g, ""));
    });
    set("#headquarters", site.address);
    set("#icpLink", site.icp);
    set("#policeRecord", site.police);
    document
      .querySelector(".floating-tools a")
      ?.setAttribute("href", "tel:" + site.phone.replace(/[^+\d]/g, ""));
  }
  const principlesEl = document.querySelector(".hero-principles");
  if (principlesEl)
    principlesEl.innerHTML = principles
      .map((v) => `<span>${e(v.key)}<small>${e(v.label)}</small></span>`)
      .join("");
  const statsEl = document.querySelector(".stats-grid");
  if (statsEl)
    statsEl.innerHTML = stats
      .map(
        (v) =>
          `<div><strong>${e(v.number)}</strong><span>${e(v.label)}<small>${e(v.detail)}</small></span></div>`,
      )
      .join("");
  const processEl = document.querySelector(".service-process ol");
  if (processEl)
    processEl.innerHTML = process
      .map((v) => `<li><b>${e(v.number)}</b> ${e(v.text)}</li>`)
      .join("");
  block(
    "researchTechniques",
    content.research,
    (v, i) =>
      `<div><b>${String(i + 1).padStart(2, "0")}</b><h3>${e(v.name)}</h3><p>${e(v.text)}</p></div>`,
  );
  block(
    "researchNumbers",
    content.researchNumbers,
    (v) =>
      `<div><strong>${e(v.number)}</strong><span>${e(v.label)}</span></div>`,
  );
  block(
    "timeline",
    content.timeline,
    (v) =>
      `<article><strong>${e(v.year)}</strong><span class="timeline-dot"></span><h4>${e(v.title)}</h4><p>${e(v.text)}</p></article>`,
  );
  block(
    "supportGrid",
    content.support,
    (v, i) =>
      `<article><span>${String(i + 1).padStart(2, "0")}</span><h3>${e(v.name)}</h3><p>${e(v.text)}</p></article>`,
  );
  block(
    "shopModels",
    content.shopModels,
    (v) =>
      `<article class="model-card"><div><h4>${e(v.name)}</h4><span>${e(v.size)}</span></div><p class="model-price"><strong>${e(v.investment)}</strong> 万元</p><p>资料所列标准投资</p><ul><li>${e(v.products)}</li><li>${e(v.equipment)}</li></ul><a class="text-link" href="#contact" data-consult="合作加盟咨询">了解合作方案 <span aria-hidden="true">↗</span></a></article>`,
  );
  block(
    "learningTracks",
    content.learning,
    (v, i) =>
      `<div><span>${String(i + 1).padStart(2, "0")}</span><strong>${e(v.name)}</strong><p>${e(v.text)}</p></div>`,
  );
  block(
    "partnerGrid",
    content.partners,
    (v, i) =>
      `<button class="partner-card" data-partner-index="${i}"><div><span>${e(v.city)}</span><small>${e(v.joined)} 年加入</small></div><p><strong>${e(v.metric)}</strong>${e(v.unit)}</p><h4>${e(v.name)} · 合作伙伴 <span aria-hidden="true">↗</span></h4></button>`,
  );
  block(
    "galleryThumbs",
    content.gallery,
    (v, i) =>
      `<button class="gallery-thumb ${i === 0 ? "active" : ""}" data-gallery-index="${i}" aria-pressed="${i === 0}" aria-label="查看${e(v.title)}"><img src="${e(v.image)}" alt="" width="1269" height="952" loading="lazy"><span>${e(v.title)}</span></button>`,
  );
  const gallery = document.querySelector(".gallery-layout");
  if (gallery) gallery.hidden = !content.gallery?.length;
  if (content.gallery?.length) {
    const first = content.gallery[0];
    const image = document.getElementById("galleryImage");
    image.src = first.image;
    image.alt = first.title;
    set("#galleryTitle", first.title);
    set("#galleryCaption", first.caption);
    set(
      "#galleryCount",
      "01 / " + String(content.gallery.length).padStart(2, "0"),
    );
    document
      .getElementById("galleryExpand")
      .setAttribute("aria-label", "放大查看" + first.title);
  }
  const b = content.brand;
  set(".brand-values p", b.mission);
  set(".founder-card figcaption strong", b.founder);
  set(".founder-card figcaption span", b.founderRole);
  const founderLink = document.querySelector(".founder-card [data-knowledge]");
  if (founderLink)
    founderLink.setAttribute("aria-label", "了解" + b.founder + "博士");
  const founderImage = document.querySelector(".founder-card img");
  if (founderImage) founderImage.alt = "博士园创始人" + b.founder + "博士";
  set(".brand-story .small-tag", "SINCE " + b.established + " · 北京");
  [b.researchYears, b.stores, b.series, b.offices].forEach((v, i) =>
    set(`.stats-grid > div:nth-child(${i + 1}) strong`, v),
  );
  set("#productPriceNote", content.priceNote);
  set("#investmentNote", content.investmentNote);
  const strip = document.querySelector(".credentials-strip");
  if (strip) {
    strip.querySelectorAll(":scope > div").forEach((el) => el.remove());
    (content.qualifications || [])
      .slice(0, 3)
      .reverse()
      .forEach((v) => {
        const el = document.createElement("div");
        el.innerHTML = `<span class="credential-symbol" aria-hidden="true">✧</span><span>${e(v.name)}<small>${e(v.entity)}</small></span>`;
        strip.prepend(el);
      });
  }
  for (const f of fields) {
    const value = content.home?.[f.key];
    if (value === undefined || !f.selector) continue;
    const el = document.querySelector(f.selector);
    if (!el) continue;
    if (f.type === "text") setDirectText(el, value);
    else el.setAttribute(f.type === "image" ? "src" : f.type, value);
    if (f.type === "image") {
      el.hidden = !value;
      if (el.closest(".hero-visual"))
        document
          .querySelector('link[rel="preload"][as="image"]')
          ?.setAttribute("href", value);
    }
  }
  return document.toString();
}

module.exports = { homeFields, renderHome };
