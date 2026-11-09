const { parseHTML } = require("linkedom");
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const hubs = {
  "/library": {
    key: "library",
    title: "资料中心",
    accent: "让每一次了解，都更清晰",
    image: "brand-training-classroom.webp",
    label: "KNOWLEDGE & CARE",
  },
  "/about": {
    key: "about",
    title: "关于博士园",
    accent: "以专注为起点，与美好同行",
    image: "brand-campus.webp",
    label: "THE BOSYE STORY",
  },
  "/contact": {
    key: "contact",
    title: "联系咨询",
    accent: "从一次沟通，开始了解彼此",
    image: "brand-space-2.webp",
    label: "LET’S CONNECT",
  },
};
function styleHubs(html, page, site) {
  const config = hubs[page.path];
  if (!config) return html;
  const { document } = parseHTML(html);
  document.body.classList.add("hub-page", "hub-" + config.key);
  const heading = document.querySelector(".content-heading");
  const defaultTitles = [
    "博士园品牌与养护资料中心",
    "关于北京博士园",
    "联系博士园与预约咨询",
  ];
  heading.querySelector("h1").textContent = defaultTitles.includes(page.title)
    ? config.title
    : page.title;
  heading.querySelector(".eyebrow").textContent = "BOSYE / " + config.label;
  const sub = document.createElement("p");
  sub.className = "hub-tagline";
  sub.textContent = config.accent;
  heading.querySelector("h1").after(sub);
  const meta = heading.querySelector(".content-meta");
  const hero = document.createElement("section");
  hero.className = "hub-hero";
  const breadcrumb = document.querySelector(".content-breadcrumb");
  hero.append(breadcrumb, heading);
  const photo = document.createElement("img");
  photo.className = "hub-hero-photo";
  photo.src = "/assets/" + config.image;
  photo.alt = "";
  hero.append(photo);
  document.querySelector(".content-main").prepend(hero);
  const body = document.querySelector(".content-body");
  const nodes = [...body.children];
  body.replaceChildren();
  let panel = document.createElement("section");
  panel.className = "hub-panel hub-intro";
  body.append(panel);
  let index = 0;
  for (const node of nodes) {
    if (node.matches(".content-sources")) {
      body.append(node);
      continue;
    }
    if (node.tagName === "H2") {
      panel = document.createElement("section");
      panel.className = "hub-panel";
      panel.id = "hub-section-" + ++index;
      body.append(panel);
    }
    panel.append(node);
  }
  if (config.key === "library") {
    const nav = document.createElement("nav");
    nav.className = "hub-topic-nav";
    nav.setAttribute("aria-label", "资料分类");
    body.querySelectorAll(".hub-panel > h2").forEach((h) => {
      const a = document.createElement("a");
      a.href = "#" + h.parentElement.id;
      a.textContent = h.textContent;
      nav.append(a);
    });
    body.prepend(nav);
    body
      .querySelectorAll(".library-list")
      .forEach((list) => list.parentElement.classList.add("hub-library-group"));
  }
  if (config.key === "about") {
    const img = document.createElement("figure");
    img.className = "hub-story-photo";
    img.innerHTML =
      '<img src="/assets/brand-laboratory.webp" alt="博士园科研空间" loading="lazy"><figcaption>专注毛发健康 · 连接研究与日常</figcaption>';
    body.querySelector(".hub-intro").append(img);
    body.querySelectorAll(".hub-panel").forEach((section) => {
      if (section.querySelector("h2")?.textContent === "创始人与研究积累") {
        section.classList.add("hub-founder");
        const portrait = document.createElement("img");
        portrait.src = "/assets/brand-founder.webp";
        portrait.alt = "博士园创始人";
        portrait.loading = "lazy";
        section.prepend(portrait);
      }
    });
  }
  if (config.key === "contact") {
    const cards = document.createElement("div");
    cards.className = "hub-contact-cards";
    cards.innerHTML = `<a class="hub-contact-card" href="tel:${esc(site.phone.replace(/[^+\d]/g, ""))}"><span class="hub-card-icon" aria-hidden="true"><svg class="icon-arrow-up-right" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><use href="/assets/icons.svg#arrow-up-right"></use></svg></span><span class="eyebrow">CALL US</span><h2>全国咨询热线</h2><strong>${esc(site.phone)}</strong><p>门店预约 · 产品咨询 · 合作沟通</p><span class="hub-card-link">拨打电话 <svg class="icon-arrow-up-right" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><use href="/assets/icons.svg#arrow-up-right"></use></svg></span></a><a class="hub-contact-card" href="/#contact"><span class="hub-card-icon" aria-hidden="true">✎</span><span class="eyebrow">LEAVE A MESSAGE</span><h2>在线预约咨询</h2><p>留下您的称呼、联系方式与需求，让我们为您提供更有针对性的信息。</p><span class="hub-card-link">填写咨询表单 <svg class="icon-arrow-up-right" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><use href="/assets/icons.svg#arrow-up-right"></use></svg></span></a><a class="hub-contact-card" href="/#network"><span class="hub-card-icon" aria-hidden="true">⌖</span><span class="eyebrow">FIND A STORE</span><h2>寻找身边的博士园</h2><p>按城市查看门店信息，了解地址与联系信息，到店前请先确认预约。</p><span class="hub-card-link">查询附近门店 <svg class="icon-arrow-up-right" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><use href="/assets/icons.svg#arrow-up-right"></use></svg></span></a>`;
    body.prepend(cards);
  }
  if (meta) {
    meta.classList.add("hub-updated");
    body.append(meta);
  }
  document.querySelectorAll(".content-header nav a").forEach((a) => {
    if (a.getAttribute("href") === page.path)
      a.setAttribute("aria-current", "page");
  });
  return "<!doctype html>" + document.documentElement.outerHTML;
}
module.exports = { styleHubs };
