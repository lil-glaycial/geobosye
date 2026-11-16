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
  const header = $(".site-header"),
    nav = $(".main-nav"),
    toggle = $(".menu-toggle");
  let toastTimer,
    services = [],
    articles = [],
    products = [],
    knowledge,
    galleryIndex = 0,
    lastFocus;
  function toast(message) {
    $("#toast").textContent = message;
    $("#toast").classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 4000);
  }
  async function api(path, options) {
    const res = await fetch("/api/public/" + path, options);
    const data = await res.json().catch(() => ({ error: "服务暂时不可用" }));
    if (!res.ok) throw new Error(data.error || "请求失败，请稍后重试");
    return data;
  }
  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "关闭菜单" : "打开菜单");
  });
  nav.querySelectorAll("a").forEach((a) =>
    a.addEventListener("click", () => {
      nav.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "打开菜单");
    }),
  );
  window.addEventListener(
    "scroll",
    () => header.classList.toggle("scrolled", window.scrollY > 30),
    { passive: true },
  );
  $("#toTop").addEventListener("click", () =>
    window.scrollTo({
      top: 0,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    }),
  );
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      nav.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "打开菜单");
      closeDetail();
    }
  });
  const links = [...nav.querySelectorAll("a")];
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting)
            links.forEach((a) =>
              a.classList.toggle(
                "active",
                a.getAttribute("href") === "#" + entry.target.id ||
                  (entry.target.id === "hero" &&
                    a.getAttribute("href") === "#top"),
              ),
            );
        }),
      { rootMargin: "-20% 0px -50% 0px" },
    );
    document
      .querySelectorAll("main section[id]")
      .forEach((s) => observer.observe(s));
  }
  function showDetail(item, richHtml) {
    lastFocus = document.activeElement;
    $("#detailTitle").textContent = item.name || item.title;
    $("#detailCategory").textContent = item.english || item.category || "BOSYE";
    if (richHtml)
      $("#detailBody").innerHTML =
        '<div class="detail-rich">' + richHtml + "</div>";
    else $("#detailBody").textContent = item.body;
    $("#detailModal").hidden = false;
    $("#detailModal").classList.add("open");
    document.body.style.overflow = "hidden";
    $("#detailClose").focus();
  }
  function closeDetail() {
    if ($("#detailModal").hidden) return;
    $("#detailModal").hidden = true;
    $("#detailModal").classList.remove("open");
    document.body.style.overflow = "";
    lastFocus?.focus();
  }
  $("#detailClose").addEventListener("click", closeDetail);
  $("#detailConsult").addEventListener("click", closeDetail);
  $("#detailModal").addEventListener("click", (e) => {
    if (e.target === $("#detailModal")) closeDetail();
  });
  $("#detailModal").addEventListener("keydown", (e) => {
    if (e.key === "Tab") {
      const focusable = [
        ...$("#detailModal").querySelectorAll(
          'button,a[href],input,select,textarea,[tabindex="0"]',
        ),
      ].filter((el) => !el.disabled && !el.hidden);
      const first = focusable[0],
        last = focusable.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });
  const paragraph = (value) => "<p>" + esc(value) + "</p>";
  const entries = (items, template) =>
    items
      .map((v) => '<div class="detail-entry">' + template(v) + "</div>")
      .join("");
  async function openKnowledge(key) {
    if (!knowledge) return toast("资料暂时无法读取，请刷新后重试。");
    const pages = {
      scalp: "/articles/scalp-care-basics",
      routine: "/guide/home-routine",
      medical: "/comparison/care-options",
    };
    if (pages[key]) {
      try {
        const response = await fetch(pages[key]);
        if (!response.ok) throw new Error("资料暂时无法读取");
        const document = new DOMParser().parseFromString(
          await response.text(),
          "text/html",
        );
        showDetail(
          {
            title: document.querySelector("h1").textContent,
            category: "BOSYE · 养护知识",
          },
          document.querySelector(".content-body").innerHTML,
        );
      } catch {
        toast("资料暂时无法读取，请稍后再试。");
      }
      return;
    }
    const k = knowledge;
    let title,
      body,
      category = "BOSYE · 品牌知识库";
    switch (key) {
      case "founder":
        title = k.brand.founder + " · 从研究初心到博士园";
        body =
          '<img src="' +
          esc(document.querySelector(".founder-card img").getAttribute("src")) +
          '" alt="' +
          esc(k.brand.founder) +
          '博士">' +
          paragraph(k.brand.founderBody);
        break;
      case "brand":
        title = k.home?.brandStoryModalTitle || "博士园 · 品牌故事";
        body =
          paragraph(k.brand.description) +
          "<h3>创始人的研究初心</h3>" +
          paragraph(k.brand.founderResearch || k.brand.founderBody) +
          "<h3>我们的使命</h3>" +
          paragraph(k.brand.mission) +
          "<h3>品牌价值观</h3>" +
          paragraph(k.brand.values) +
          "<h3>品牌发展历程</h3>" +
          entries(
            k.timeline,
            (v) =>
              "<h4>" +
              esc(v.year + " · " + v.title) +
              "</h4>" +
              paragraph(v.text),
          ) +
          "<h3>" +
          esc(k.home?.brandCampusHeading || "品牌园区历史影像") +
          '</h3><img loading="lazy" src="' +
          esc(k.home?.campusImage || "assets/brand-campus.webp") +
          '" alt="旧官网展示的品牌园区历史图片">' +
          paragraph(
            k.home?.brandCampusCaption ||
              "品牌园区历史影像，展示品牌产学研布局；不对应新园区当前建设进度。",
          );
        break;
      case "qualifications":
        title = "科研资质、荣誉与专利";
        body =
          "<h3>科研与品牌资质</h3>" +
          entries(
            k.qualifications,
            (v) =>
              "<h4>" +
              esc(v.name) +
              "</h4><small>" +
              esc(v.entity) +
              "</small>" +
              paragraph(v.detail),
          ) +
          '<h3>旧官网奖项影像</h3><img loading="lazy" src="' +
          esc(k.home?.awardImage || "assets/bosye-kylb12.png") +
          '" alt="旧官网展示的品牌奖项证书资料"><h3>品牌荣誉</h3><ul>' +
          k.honors.map((v) => "<li>" + esc(v) + "</li>").join("") +
          "</ul><h3>专利资料</h3>" +
          entries(
            k.patents,
            (v) =>
              "<h4>" +
              esc(v.name) +
              '</h4><p class="patent-number">' +
              esc(v.number) +
              "</p>",
          ) +
          '<p class="note">资料依据品牌知识库整理，专利名称为登记名称，不代表生活美容门店提供相关医疗服务。具体权利状态及证书信息以公开登记为准。</p>';
        break;
      case "prices":
        title = "护理服务参考价格";
        category = "BOSYE · 服务指南";
        body =
          '<table><thead><tr><th scope="col">服务项目</th><th scope="col">参考价格</th><th scope="col">参考时长</th></tr></thead><tbody>' +
          k.servicePrices
            .map(
              (v) =>
                "<tr><td>" +
                esc(v.name) +
                "</td><td>" +
                esc(v.price) +
                "</td><td>" +
                esc(v.duration) +
                "</td></tr>",
            )
            .join("") +
          '</tbody></table><p class="note">' +
          esc(k.priceNote) +
          "</p>";
        break;
      case "training":
        title = "人才培训与全周期支持";
        body =
          '<img src="' +
          esc(
            document.querySelector(".learning-layout img").getAttribute("src"),
          ) +
          '" alt="博士园培训课堂"><h3>博士园智胜成长培训体系</h3>' +
          entries(
            k.learning,
            (v) => "<h4>" + esc(v.name) + "</h4>" + paragraph(v.text),
          ) +
          "<h3>六大合作支持</h3>" +
          entries(
            k.support,
            (v) => "<h4>" + esc(v.name) + "</h4>" + paragraph(v.text),
          );
        break;
      case "partners":
        title = "合作伙伴 · 历史案例";
        body =
          entries(k.partners, partnerMarkup) +
          '<p class="note">以上为品牌资料中的历史经营案例，不代表当前业绩或收益承诺；各地门店、投入与经营情况不同。</p>';
        break;
      default:
        return;
    }
    showDetail({ title, category }, body);
  }
  function partnerMarkup(v) {
    return (
      "<h4>" +
      esc(v.name + " · " + v.city) +
      "</h4><small>" +
      esc(v.joined + " 年加入 · " + v.metric + " " + v.unit) +
      "</small>" +
      paragraph(v.text)
    );
  }
  function renderKnowledgeBlocks(k) {
    if (!k) return;
    const home = k.home || {};
    const principles =
      Array.isArray(home.principles) && home.principles.length
        ? home.principles
        : [
            { key: "养", label: "综合养护" },
            { key: "防", label: "精准防护" },
            { key: "植", label: "精细治理" },
            { key: "健", label: "健发养身" },
          ];
    const principlesEl = document.querySelector(".hero-principles");
    if (principlesEl)
      principlesEl.innerHTML = principles
        .map((v) => `<span>${esc(v.key)}<small>${esc(v.label)}</small></span>`)
        .join("");
    const homeStats =
      Array.isArray(home.brandStats) && home.brandStats.length
        ? home.brandStats
        : [
            {
              number: "30+",
              label: "毛发研究积累",
              detail: "年 · 创始人研究始于 1987",
            },
            {
              number: "2000+",
              label: "品牌连锁网络",
              detail: "家 · 全国服务网络",
            },
            { number: "6", label: "专业产品系列", detail: "覆盖多种养护需求" },
            { number: "16", label: "全国办事处", detail: "就近支持与服务" },
          ];
    const statsEl = document.querySelector(".stats-grid");
    if (statsEl)
      statsEl.innerHTML = homeStats
        .map(
          (v) =>
            `<div><strong>${esc(v.number)}</strong><span>${esc(v.label)}<small>${esc(v.detail)}</small></span></div>`,
        )
        .join("");
    const process =
      Array.isArray(home.serviceProcess) && home.serviceProcess.length
        ? home.serviceProcess
        : [
            { number: "01", text: "状态检测" },
            { number: "02", text: "需求沟通" },
            { number: "03", text: "适配护理" },
            { number: "04", text: "持续养护" },
          ];
    const processEl = document.querySelector(".service-process ol");
    if (processEl)
      processEl.innerHTML = process
        .map((v) => `<li><b>${esc(v.number)}</b> ${esc(v.text)}</li>`)
        .join("");
    const research = document.querySelector("#researchTechniques");
    if (research)
      research.innerHTML = (k.research || [])
        .map(
          (v, i) =>
            `<div><b>${String(i + 1).padStart(2, "0")}</b><h3>${esc(v.name)}</h3><p>${esc(v.text)}</p></div>`,
        )
        .join("");
    const numbers = document.querySelector("#researchNumbers");
    if (numbers)
      numbers.innerHTML = (k.researchNumbers || [])
        .map(
          (v) =>
            `<div><strong>${esc(v.number)}</strong><span>${esc(v.label)}</span></div>`,
        )
        .join("");
    const timeline = document.querySelector("#timeline");
    if (timeline)
      timeline.innerHTML = (k.timeline || [])
        .map(
          (v) =>
            `<article><strong>${esc(v.year)}</strong><span class="timeline-dot"></span><h4>${esc(v.title)}</h4><p>${esc(v.text)}</p></article>`,
        )
        .join("");
    const support = document.querySelector("#supportGrid");
    if (support)
      support.innerHTML = (k.support || [])
        .map(
          (v, i) =>
            `<article><span>${String(i + 1).padStart(2, "0")}</span><h3>${esc(v.name)}</h3><p>${esc(v.text)}</p></article>`,
        )
        .join("");
    const models = document.querySelector("#shopModels");
    if (models)
      models.innerHTML = (k.shopModels || [])
        .map(
          (v) =>
            `<article class="model-card"><div><h4>${esc(v.name)}</h4><span>${esc(v.size)}</span></div><p class="model-price"><strong>${esc(v.investment)}</strong> 万元</p><p>资料所列标准投资</p><ul><li>${esc(v.products)}</li><li>${esc(v.equipment)}</li></ul><a class="text-link" href="#contact" data-consult="合作加盟咨询">了解合作方案 <span aria-hidden="true"><svg class="icon-arrow-up-right" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><use href="/assets/icons.svg#arrow-up-right"></use></svg></span></a></article>`,
        )
        .join("");
    const learning = document.querySelector("#learningTracks");
    if (learning)
      learning.innerHTML = (k.learning || [])
        .map(
          (v, i) =>
            `<div><span>${String(i + 1).padStart(2, "0")}</span><strong>${esc(v.name)}</strong><p>${esc(v.text)}</p></div>`,
        )
        .join("");
    const partners = document.querySelector("#partnerGrid");
    if (partners)
      partners.innerHTML = (k.partners || [])
        .map(
          (v, i) =>
            `<button class="partner-card" data-partner-index="${i}"><div><span>${esc(v.city)}</span><small>${esc(v.joined)} 年加入</small></div><p><strong>${esc(v.metric)}</strong>${esc(v.unit)}</p><h4>${esc(v.name)} · 合作伙伴 <span aria-hidden="true"><svg class="icon-arrow-up-right" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><use href="/assets/icons.svg#arrow-up-right"></use></svg></span></h4></button>`,
        )
        .join("");
    const thumbs = document.querySelector("#galleryThumbs");
    if (thumbs)
      thumbs.innerHTML = (k.gallery || [])
        .map(
          (v, i) =>
            `<button class="gallery-thumb ${i === 0 ? "active" : ""}" data-gallery-index="${i}" aria-pressed="${i === 0}" aria-label="查看${esc(v.title)}"><img src="${esc(v.image)}" alt="" width="1269" height="952" loading="lazy"><span>${esc(v.title)}</span></button>`,
        )
        .join("");
    if (k.gallery?.length) selectGallery(0);
    document.querySelector(".gallery-layout").hidden = !k.gallery?.length;
    const priceNote = document.querySelector("#productPriceNote");
    if (priceNote) priceNote.textContent = k.priceNote || "";
    const investmentNote = document.querySelector("#investmentNote");
    if (investmentNote) investmentNote.textContent = k.investmentNote || "";
    const brand = k.brand || {};
    const founder = document.querySelector(".founder-card figcaption");
    if (founder) {
      founder
        .querySelector("strong")
        ?.replaceChildren(document.createTextNode(brand.founder || ""));
      founder
        .querySelector("span")
        ?.replaceChildren(document.createTextNode(brand.founderRole || ""));
    }
    const mission = document.querySelector(".brand-values p");
    if (mission) mission.textContent = brand.mission || "";
    const stats = [
      brand.researchYears,
      brand.stores,
      brand.series,
      brand.offices,
    ];
    document.querySelectorAll(".stats-grid > div strong").forEach((el, i) => {
      if (stats[i]) el.textContent = stats[i];
    });
  }

  function selectProduct(index, focus = false) {
    const product = products[index];
    if (!product) return;
    const tabs = [...$("#productTabs").querySelectorAll('[role="tab"]')];
    tabs.forEach((el, i) => {
      el.setAttribute("aria-selected", String(i === index));
      el.tabIndex = i === index ? 0 : -1;
    });
    $("#productPanel").setAttribute("aria-labelledby", "product-tab-" + index);
    if (focus) {
      tabs[index].focus();
      tabs[index].scrollIntoView({ block: "nearest", inline: "nearest" });
    }
    for (const [id, field] of [
      ["productName", "name"],
      ["productEnglish", "english"],
      ["productSummary", "summary"],
      ["productBody", "body"],
      ["productRange", "range"],
    ])
      $("#" + id).textContent = product[field] || "";
    $("#productImage").src =
      product.image || "assets/brand-product-hair-loss.webp";
    $("#productImage").alt = "博士园产品陈列 · " + product.name;
  }
  $("#productTabs").addEventListener("keydown", (e) => {
    const tabs = [...$("#productTabs").querySelectorAll('[role="tab"]')],
      index = tabs.indexOf(e.target);
    if (
      index < 0 ||
      ![
        "ArrowRight",
        "ArrowLeft",
        "ArrowUp",
        "ArrowDown",
        "Home",
        "End",
      ].includes(e.key)
    )
      return;
    e.preventDefault();
    const next =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? tabs.length - 1
          : (index +
              (["ArrowRight", "ArrowDown"].includes(e.key) ? 1 : -1) +
              tabs.length) %
            tabs.length;
    selectProduct(next, true);
  });
  function selectGallery(index) {
    const v = knowledge?.gallery[index];
    if (!v) return;
    galleryIndex = index;
    $("#galleryImage").src = v.image;
    $("#galleryImage").alt = v.title + "，" + v.caption;
    $("#galleryTitle").textContent = v.title;
    $("#galleryCaption").textContent = v.caption;
    $("#galleryCount").textContent =
      String(index + 1).padStart(2, "0") +
      " / " +
      String(knowledge.gallery.length).padStart(2, "0");
    $("#galleryExpand").setAttribute("aria-label", "放大查看" + v.title);
    document.querySelectorAll("[data-gallery-index]").forEach((el, i) => {
      el.classList.toggle("active", i === index);
      el.setAttribute("aria-pressed", String(i === index));
    });
  }
  $("#galleryExpand").addEventListener("click", async () => {
    await siteReady;
    const v = knowledge?.gallery[galleryIndex];
    if (v)
      showDetail(
        { title: v.title, category: "BOSYE · 门店空间" },
        '<img src="' +
          esc(v.image) +
          '" alt="' +
          esc(v.title) +
          '">' +
          paragraph(v.caption),
      );
  });
  document.addEventListener("click", async (e) => {
    const sourceButton = e.target.closest(
      "[data-knowledge],[data-product-index],[data-gallery-index],[data-partner-index]",
    );
    if (sourceButton) {
      await siteReady;
      if (sourceButton.dataset.knowledge)
        openKnowledge(sourceButton.dataset.knowledge);
      else if (sourceButton.dataset.productIndex !== undefined)
        selectProduct(Number(sourceButton.dataset.productIndex));
      else if (sourceButton.dataset.galleryIndex !== undefined)
        selectGallery(Number(sourceButton.dataset.galleryIndex));
      else if (knowledge) {
        const v = knowledge.partners[Number(sourceButton.dataset.partnerIndex)];
        if (v)
          showDetail(
            {
              title: v.name + " · " + v.city,
              category: "BOSYE · 历史合作案例",
            },
            partnerMarkup(v) +
              '<p class="note">案例为品牌资料中的历史记录，不代表当前经营数据或收益承诺。</p>',
          );
      }
    }
    const consult = e.target.closest("[data-consult]");
    if (consult)
      $("#contactForm").elements.type.value = consult.dataset.consult;
    const card = e.target.closest("[data-service],[data-article]");
    if (card) {
      await siteReady;
      const item = card.dataset.service
        ? services.find((s) => s.id === card.dataset.service)
        : articles.find((a) => a.id === card.dataset.article);
      if (item) showDetail(item);
    }
  });
  async function loadSite() {
    try {
      const d = await api("site");
      services = d.services;
      articles = d.articles;
      products = d.products;
      knowledge = d.knowledge;
      renderKnowledgeBlocks(knowledge);
      $("#productLayout").hidden = !products.length;
      $("#productTabs").innerHTML = products
        .map(
          (v, i) =>
            '<button id="product-tab-' +
            i +
            '" role="tab" aria-controls="productPanel" aria-selected="' +
            (i === 0) +
            '" tabindex="' +
            (i === 0 ? 0 : -1) +
            '" data-product-index="' +
            i +
            '"><span>' +
            String(i + 1).padStart(2, "0") +
            "</span>" +
            esc(v.name) +
            '<b aria-hidden="true"><svg class="icon-arrow-up-right" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><use href="/assets/icons.svg#arrow-up-right"></use></svg></b></button>',
        )
        .join("");
      selectProduct(0);
      const s = d.site;
      document.title = s.seoTitle;
      document.querySelector('meta[name="description"]').content =
        s.seoDescription;
      for (const id of [
        "heroTitle",
        "heroAccent",
        "heroDescription",
        "brandIntro",
      ])
        $("#" + id).textContent = s[id];
      document.querySelectorAll("[data-phone]").forEach((el) => {
        el.textContent = s.phone;
        el.href = "tel:" + s.phone.replace(/[^+\d]/g, "");
      });
      document.querySelector(".floating-tools a").href =
        "tel:" + s.phone.replace(/[^+\d]/g, "");
      $("#headquarters").textContent = s.address;
      $("#icpLink").textContent = s.icp;
      $("#policeRecord").textContent = s.police;
      $(".service-grid").innerHTML = services
        .map(
          (v, i) =>
            `<button class="service-card" data-service="${v.id}" aria-label="了解${esc(v.name)}"><div class="service-image">${v.image ? `<img src="${esc(v.image)}" alt="${esc(v.name)}服务" loading="lazy">` : ""}<div class="service-overlay"></div><span class="service-index">${String(i + 1).padStart(2, "0")}</span></div><div class="service-content"><p>${esc(v.english)}</p><h3>${esc(v.name)}</h3><span class="service-arrow" aria-hidden="true"><svg class="icon-arrow-up-right" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><use href="/assets/icons.svg#arrow-up-right"></use></svg></span><div class="service-detail">${esc(v.summary)}</div></div></button>`,
        )
        .join("");
      $("#news").hidden = !articles.length;
      $("#newsGrid").innerHTML = articles
        .map(
          (v) =>
            `<button class="news-card" data-article="${v.id}"><small>${esc(v.category)}</small><h3>${esc(v.title)}</h3><p>${esc(v.summary)}</p><span>阅读全文 <svg class="icon-arrow-up-right" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><use href="/assets/icons.svg#arrow-up-right"></use></svg></span></button>`,
        )
        .join("");
    } catch {
      const note = document.createElement("p");
      note.className = "data-note";
      note.textContent = "服务详情暂时无法读取，请稍后刷新或拨打咨询热线。";
      $(".service-grid").after(note);
    }
  }
  const results = document.createElement("div");
  results.className = "store-results";
  results.setAttribute("aria-live", "polite");
  $("#networkResult").after(results);
  let searchVersion = 0;
  async function findStores() {
    const version = ++searchVersion;
    const q = $("#cityInput").value.trim();
    $("#networkResult").textContent = "正在查询…";
    $("#searchStore").disabled = true;
    try {
      const d = await api("stores?q=" + encodeURIComponent(q));
      if (version !== searchVersion) return;
      $("#networkResult").textContent = d.items.length
        ? `找到 ${d.items.length} 家门店`
        : "暂未查询到门店信息，请拨打全国热线咨询附近门店。";
      results.innerHTML = d.items
        .map(
          (s) =>
            `<article class="store-result"><h3>${esc(s.name)}</h3><p>${esc(s.city)} · ${esc(s.address)}</p><p>${esc(s.hours || "营业时间请电话确认")}</p><a href="tel:${esc(s.phone.replace(/[^+\d]/g, ""))}">门店电话 ${esc(s.phone)}</a></article>`,
        )
        .join("");
    } catch (e) {
      $("#networkResult").textContent = e.message;
      results.innerHTML = "";
    } finally {
      $("#searchStore").disabled = false;
    }
  }
  $("#searchStore").addEventListener("click", findStores);
  $("#cityInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      findStores();
    }
  });
  $("#contactForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target,
      button = form.querySelector('button[type="submit"]'),
      data = Object.fromEntries(new FormData(form));
    data.consent = form.elements.consent.checked;
    $("#formError").textContent = "";
    button.disabled = true;
    try {
      await api("leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      form.reset();
      toast("咨询已提交，顾问将根据您留下的信息联系您。");
    } catch (error) {
      $("#formError").textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
  const siteReady = loadSite();
})();
