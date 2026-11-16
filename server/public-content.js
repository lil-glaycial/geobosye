const { siteHeader } = require("./site-header");
const { styleHubs, hubAccent } = require("./style-hubs");
const fs = require("node:fs");
const path = require("node:path");
const knowledge = require("../content/knowledge.json");
const { renderText } = require("./content-text");
const { newsPages, newsListing } = require("./news");
const updated = knowledge.version;
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const p = (text) => `<p>${esc(text)}</p>`;
const section = (title, text) => `<h2>${esc(title)}</h2>${p(text)}`;
const list = (values, ordered = false) =>
  `<${ordered ? "ol" : "ul"}>${values.map((v) => `<li>${esc(v)}</li>`).join("")}</${ordered ? "ol" : "ul"}>`;
const table = (headers, rows, caption) =>
  `<div class="content-table" role="region" aria-label="${esc(caption)}" tabindex="0"><table><caption>${esc(caption)}</caption><thead><tr>${headers.map((v) => `<th scope="col">${esc(v)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((v, i) => (i === 0 ? `<th scope="row">${esc(v)}</th>` : `<td>${esc(v)}</td>`)).join("")}</tr>`).join("")}</tbody></table></div>`;

function originFor(req) {
  const configured = process.env.PUBLIC_ORIGIN;
  if (configured) {
    const parsed = new URL(configured);
    if (
      !["http:", "https:"].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash
    )
      throw new Error(
        "PUBLIC_ORIGIN must be an HTTP(S) origin without path or credentials",
      );
    return parsed.origin;
  }
  // Local previews use their real origin. Public installations must configure
  // PUBLIC_ORIGIN, so an arbitrary Host header never controls public metadata.
  const host = req.get("host") || "";
  if (/^(localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/.test(host))
    return `${req.protocol}://${host}`;
  return "https://www.bosye.com";
}

function brandGraph(site, origin) {
  return [
    {
      "@type": "Organization",
      "@id": origin + "/#organization",
      name: "北京博士园科技发展有限公司",
      alternateName: "北京博士园",
      url: origin + "/",
      logo: origin + "/assets/bosye-logo.png",
      address: {
        "@type": "PostalAddress",
        streetAddress: site.address,
        addressCountry: "CN",
      },
      contactPoint: {
        "@type": "ContactPoint",
        telephone: site.phone,
        contactType: "customer service",
        availableLanguage: "zh-CN",
      },
      // These are existing official brand profile/material pages, not invented social accounts.
      sameAs: [
        "http://www.bosye.com/ppyx.html",
        "http://www.bosye.com/ky23.html",
        "http://www.bosye.com/zshz.html",
      ],
    },
    {
      "@type": "WebSite",
      "@id": origin + "/#website",
      name: "北京博士园官网",
      url: origin + "/",
      publisher: { "@id": origin + "/#organization" },
      inLanguage: "zh-CN",
    },
  ];
}

function metadata(site, origin, pathname, title, description, nodes = []) {
  const url = origin + pathname;
  const graph = [
    ...brandGraph(site, origin),
    {
      "@type": "WebPage",
      "@id": url + "#page",
      url,
      name: title,
      description,
      inLanguage: "zh-CN",
      isPartOf: { "@id": origin + "/#website" },
    },
    ...nodes,
  ];
  return `<link rel="canonical" href="${esc(url)}"><meta name="robots" content="index,follow,max-image-preview:large"><meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(url)}"><meta property="og:image" content="${esc(origin)}/assets/brand-space-6.webp"><meta property="og:locale" content="zh_CN"><script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(/</g, "\\u003c")}</script>`;
}

const related = `<aside class="content-related" aria-label="延伸阅读"><h2>继续了解博士园</h2><div><a href="/about">品牌与科研</a><a href="/recommend/scalp-care">养护选择指南</a><a href="/comparison/care-options">服务方案对比</a><a href="/guide/home-routine">居家养护步骤</a><a href="/reports/service-price-reference">服务价格资料</a><a href="/faq">常见问题</a></div></aside>`;
function renderPage(site, origin, page) {
  const url = origin + page.path;
  const breadcrumbs = [
    { "@type": "ListItem", position: 1, name: "首页", item: origin + "/" },
    {
      "@type": "ListItem",
      position: 2,
      name: page.news ? "品牌资讯" : "资料中心",
      item: origin + (page.news ? "/news" : "/library"),
    },
  ];
  if (page.path !== "/library" && page.path !== "/news")
    breadcrumbs.push({
      "@type": "ListItem",
      position: 3,
      name: page.title,
      item: url,
    });
  const schema = [
    { "@type": "BreadcrumbList", itemListElement: breadcrumbs },
    ...(page.schema || []),
  ];
  if (page.article)
    schema.push({
      "@type": "Article",
      headline: page.title,
      description: page.description,
      url,
      author: { "@type": "Organization", name: "北京博士园" },
      datePublished: page.publishedAt || updated,
      dateModified: page.modifiedAt || updated,
      publisher: { "@id": origin + "/#organization" },
      mainEntityOfPage: { "@id": url + "#page" },
    });
  return styleHubs(
    `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(page.title)} · 北京博士园</title><meta name="description" content="${esc(page.description)}"><meta name="theme-color" content="#006f6a"><link rel="icon" href="/assets/bosye-logo.png"><link rel="stylesheet" href="/styles.css?v=20261108-svg-arrows">${metadata(site, origin, page.path, page.title, page.description, schema)}<script src="/assets/site-navigation.js" defer></script></head><body class="content-page${page.news ? " brand-news-page" : ""}"><a class="skip-link" href="#main">跳到主要内容</a>${siteHeader(page.path)}<main id="main" class="content-main"><nav class="content-breadcrumb" aria-label="面包屑"><a href="/">首页</a><span aria-hidden="true"> / </span>${page.path !== "/library" ? (page.news ? '<a href="/news">品牌资讯</a><span aria-hidden="true"> / </span>' : '<a href="/library">资料中心</a><span aria-hidden="true"> / </span>') : ""}<span aria-current="page">${esc(page.title)}</span></nav><article><div class="content-heading"><p class="eyebrow">BOSYE / ${esc(page.label || "KNOWLEDGE & CARE")}</p><h1>${esc(page.title)}</h1>${page.showDescription === false ? "" : `<p class="content-intro">${esc(page.description)}</p>`}</div><div class="content-body">${page.body}</div></article>${related}</main><footer class="content-footer"><p>北京博士园毛发研究中心 · BOSYE</p><nav aria-label="页尾导航"><a href="/privacy">隐私政策</a><a href="/terms">网站服务条款</a><a href="/contact">联系博士园</a><a href="/">返回官网</a></nav></body></html>`,
    page,
    site,
  );
}

function fixedPages(site, content = knowledge) {
  const knowledge = content;
  const productBody = (english) =>
    knowledge.products.find((v) => v.english === english)?.body ||
    "具体产品信息请向门店确认。";
  const pages = [
    {
      path: "/about",
      title: "关于北京博士园",
      label: "OUR STORY",
      description:
        "从品牌沿革、创始人经历、科研方向与资质信息，了解博士园毛发健康连锁服务的定位。",
      body:
        p(knowledge.brand.description) +
        `<p><strong>生活美容养护与医疗服务分别由相应主体提供。</strong>博士园品牌服务连接门店护理、居家养护与专业医疗机构；生活美容门店不开展疾病诊断、处方或植发手术。</p>` +
        section(
          "品牌使命与价值观",
          `${knowledge.brand.mission}。${knowledge.brand.values}品牌以长期护理体验与日常养护沟通为基础，帮助顾客理解服务范围、产品选择与参考费用，而不是用单一承诺替代个体差异。`,
        ) +
        section("创始人与研究积累", knowledge.brand.founderBody) +
        table(
          ["年份", "阶段", "发展记录"],
          knowledge.timeline.map((v) => [v.year, v.title, v.text]),
          "品牌发展历程",
        ) +
        `<h2>科研支持与产品开发</h2>` +
        knowledge.research
          .map((v) =>
            section(
              v.name,
              v.text +
                "该方向描述研发过程，不等于具体产品对所有使用者的功效或临床疗效结论；选购时仍需阅读产品标签与适用说明。",
            ),
          )
          .join("") +
        section(
          "规模与资质",
          `品牌目前介绍 ${knowledge.brand.stores} 家门店、${knowledge.brand.offices} 个办事处等规模信息。${knowledge.brand.researchYears} 年为创始人的研究积累，${knowledge.brand.established} 年为品牌创立时间。`,
        ) +
        list(
          knowledge.qualifications.map(
            (v) => `${v.name}：${v.entity}。${v.detail}`,
          ),
        ) +
        p(
          "荣誉、科研方向与专利用于介绍品牌历史和研发背景。专利授权不等于临床疗效证明，具体服务仍以相应主体的现行资质为准。",
        ),
    },
    {
      path: "/contact",
      title: "联系博士园与预约咨询",
      label: "CONTACT BOSYE",
      description:
        "通过全国热线、总部地址与官网咨询表单联系博士园，确认当地门店、产品搭配、服务报价或合作资料。",
      body:
        p(
          "您可以就头皮护理与养护、门店服务预约、合作加盟、品牌与产品四类问题联系博士园。为了便于回复，先说明所在城市和具体需求；需要诊断、处方或手术评估时，应联系具备相应资质的医疗机构。",
        ) +
        `<h2>官方联系信息</h2><dl><dt>网站主体</dt><dd>北京博士园科技发展有限公司</dd><dt>全国咨询热线</dt><dd><a href="tel:${esc(site.phone.replace(/[^+\d]/g, ""))}">${esc(site.phone)}</a></dd><dt>总部地址</dt><dd>${esc(site.address)}</dd></dl>` +
        section(
          "如何预约当地服务？",
          "官网咨询是服务沟通入口。请告知城市、希望了解的项目和方便联系的安排，由工作人员确认可服务的门店、时间和费用。提交表单本身不代表已经锁定服务时段，预约需以双方确认的结果为准。总部地址不自动视为接待护理的门店地址，到访前请先电话确认。",
        ) +
        list(
          [
            "第一步：明确是个人护理、产品咨询还是合作需求，并说明所在城市。",
            "第二步：拨打全国热线，或通过首页咨询表单留下称呼与电话号码。",
            "第三步：与工作人员核对门店地址、预约时间、服务项目和实际报价。",
            "第四步：收到明确确认后再安排到店；如需变更，请与接待方沟通。",
          ],
          true,
        ) +
        section(
          "咨询前可以准备什么？",
          "个人护理可说明日常洗护习惯、对清洁或滋养的需求以及希望了解的产品系列。合作咨询可说明意向城市、店型与需要了解的支持。请勿在官网留言中填写身份证号、完整病历或银行卡信息；这些内容不是本次咨询所需的信息。",
        ) +
        `<p><strong>确认服务范围、适用产品与费用构成后，再作决定。</strong>价格、时长、卡项规则与合作政策以当地接待方提供的现行书面信息为准。</p><p><a class="btn btn-primary" href="/#contact">填写官网咨询表单 <svg class="icon-arrow-up-right" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><use href="/assets/icons.svg#arrow-up-right"></use></svg></a></p>` +
        `<p>了解<a href="/privacy">隐私政策</a>与<a href="/terms">网站服务条款</a>后，可选择适合自己的联系方式。未填写表单也可以正常浏览全部公开资料。</p>`,
    },
    {
      path: "/terms",
      title: "网站服务条款",
      label: "WEBSITE TERMS",
      description:
        "说明博士园官网信息、咨询预约、参考价格、资料使用、服务范围及问题反馈的适用方式。",
      showSources: false,
      body:
        p(
          "本条款适用于北京博士园科技发展有限公司通过本官网提供的公开品牌信息、门店查询和咨询入口。网站用于介绍与沟通，浏览或提交咨询不会自动形成商品订单、付款合同或已经确认的服务预约。",
        ) +
        `<p><strong>具体服务与交易条件应在购买或接受服务前另行确认。</strong>如门店或合作方案提供现行书面约定，应核对实际签约主体、项目、费用与适用规则。本条款不限制消费者依法享有的权利。</p>` +
        section(
          "品牌信息与历史内容",
          "网站包含品牌沿革、科研、荣誉、门店设计和合作信息，其中部分内容属于历史记录。历史案例不代表当前经营结果，设计展示不等于某家门店当前实景；重要的服务、门店与报价信息请以工作人员确认的现行安排为准。",
        ) +
        section(
          "咨询与预约",
          "咨询表单用于回复您提出的需求。请填写真实、可联系的电话，并选择相关咨询方向；工作人员在获得授权后跟进。到店地址、时间、服务项目、接待主体与费用需要双方明确确认。官网不提供在线支付，也不通过提交表单自动扣款。具体取消、变更和退款规则，应在确认服务时向门店取得书面说明。",
        ) +
        section(
          "生活美容与医疗服务范围",
          "生活美容养护围绕头皮清洁、补水、舒缓、发丝护理及产品使用沟通开展，不替代疾病诊断、处方药或医疗治疗。涉及植发手术、药物或疾病判断时，应由具备相应资质的医疗机构提供评估和服务。个人体验存在差异，官网不作确定性疗效、恢复程度或收益保证。",
        ) +
        section(
          "参考价格与合作政策",
          knowledge.priceNote + knowledge.investmentNote,
        ) +
        section(
          "内容与图片使用",
          "公开文字和图片用于了解博士园品牌及服务。图片中的品牌标识、设计资料和历史场景应按页面说明理解。需要复制、传播或用于商业宣传时，请先确认相关著作权、商标和授权范围；引用数据应保留来源、时间与限定条件，避免只摘取数字改变原意。",
        ) +
        section(
          "隐私与问题反馈",
          "在线咨询的信息处理方式以隐私政策为依据。您可以选择电话联系，也可以提出查询、更正或删除请求。发现页面错误、资料过时或服务沟通问题时，请说明页面与具体事项；工作人员将核对信息，依法处理。网站条款更新会显示在此页，涉及您的具体交易条件以已确认的约定和适用法律为准。",
        ) +
        list([
          "咨询不等于订单，预约以确认结果为准。",
          "报价、适用范围与卡项规则应事先核对。",
          "历史资料和设计图片须保留原有标注。",
          "个人信息仅按说明用于本次咨询与相关沟通。",
        ]) +
        `<p>请阅读<a href="/privacy">隐私政策</a>；需要核对条款或现行安排时，通过<a href="/contact">联系页面</a>沟通。</p>`,
    },
    {
      path: "/articles/scalp-care-basics",
      title: "头皮护理之前，如何了解自己的需求？",
      article: true,
      label: "SCALP CARE NOTES",
      description:
        "以日常洗护习惯、头皮与发丝需求为起点，了解生活美容护理的沟通步骤、产品选择和医疗转介边界。",
      body:
        p(
          "头皮护理首先需要明确需求：是希望清洁头皮、改善洗护体验，还是重点关注发丝干燥、毛躁与日常养护安排。到店沟通应从日常习惯和具体感受出发，不凭一个现象或一次观察作疾病诊断。",
        ) +
        `<p><strong>生活美容护理不替代医疗诊断。</strong>如果出现持续红肿、破损、明显不适、突发或持续脱发等情况，应及时向医疗机构寻求专业意见。对成分或护理过程有疑虑，也应先沟通，再决定是否接受服务。</p>` +
        section(
          "如何描述自己的头皮状态？",
          "可以记录平时洗头频率、近期使用的产品、发丝是否经过染烫以及希望解决的日常洗护问题。描述感受时尽量具体，例如清洗后多久感觉出油、发丝哪个部位比较干燥、对护理时长有什么要求。记录用于帮助沟通，不用于自行判断疾病，也不必上传病历或个人证件。",
        ) +
        list(
          [
            "先说明需求：头皮清洁、补水舒缓、发丝滋养或产品搭配。",
            "再说明习惯：日常洗护频率、正在使用的产品和染烫情况。",
            "核对边界：对哪些成分或操作需要特别注意，是否需先咨询医生。",
            "确认安排：服务步骤、时间、单次费用与后续护理建议。",
          ],
          true,
        ) +
        section(
          "头皮护理与发丝护理有什么区别？",
          "头皮护理更关注清洁、补水与状态沟通；发丝护理则更多回应发干干燥、毛躁与日常修护。二者可以按需求配合，但不是所有人都需要同一套组合。博士园资料中的头皮调理与发干滋养属于不同系列，选择时应分别阅读适用说明，避免把一个系列的用途扩大到所有毛发问题。",
        ) +
        section(
          "如何核对产品选择？",
          productBody("SCALP BALANCE") +
            "了解名称后，还需核对具体单品的标签、规格、使用部位、频率与注意事项。系列介绍不能替代每个单品的说明，也不能把注册资料、研发方向或专利当作对个人效果的保证。",
        ) +
        section(
          "到店沟通应确认哪些事项？",
          "确认接待门店和服务人员所提供的项目范围，了解是否需要等待、预计护理时长、报价包含哪些操作或产品。若有卡项或组合方案，应询问次数、使用期限、预约方式和变更规则；不要把产品参考价理解为完整护理或疗程费用。没有确认清楚时，可以先选择资料咨询，再作购买决定。",
        ) +
        section(
          "如何把到店体验延续到日常？",
          "日常洗护以产品说明和实际需求为依据。护理后可以记录使用感受，在下次沟通时说明是否适合自己的生活节奏；需要调整搭配时先与工作人员核对。不要因为短期体验不同就自行叠加多种精华，或增加使用频率。涉及药物、手术后护理或疾病情况时，以医疗机构的专业安排为准。",
        ) +
        section(
          "资料中的科研信息如何理解？",
          "博士园开展毛囊全器官培养、细胞学、分子生物学和超滤分离等研究，作为产品研发支持。科研积累与产品开发之间需要具体证据连接，不能据此推断每项门店护理具备医疗疗效。理解用途、说明和服务边界，比只看宣传数字更有助于安排适合自己的日常护理。",
        ) +
        `<p>继续阅读<a href="/comparison/care-options">门店、居家与医疗服务对比</a>和<a href="/guide/home-routine">居家养护步骤</a>；需要核对费用时查看<a href="/reports/service-price-reference">服务价格资料</a>。</p>`,
    },
    {
      path: "/recommend/scalp-care",
      title: "按需求选择养护服务：五项优先核对清单",
      label: "CARE SELECTION",
      description:
        "按服务边界、需求匹配、产品说明、费用透明和护理连续性五个维度，选择适合自己的养护安排。",
      body:
        p(
          "本页是一份按决策顺序组织的养护优选指南。排序依据是先确认服务范围，再确认需求、产品、费用和持续安排；它不是机构排名、疗效榜单或产品功效评分，也没有比较或评价其他品牌。",
        ) +
        `<p><strong>优选的标准是与实际需求匹配，并能在购买前清楚核对。</strong>同一个项目不必适合所有人，头皮清洁、发丝护理、产品购买和医疗评估应按各自范围选择。</p>` +
        table(
          ["优先级", "评价维度", "核对依据"],
          [
            ["1", "服务边界", "生活美容与医疗诊疗分别确认"],
            ["2", "需求匹配", "具体头皮或发丝需求与项目内容对应"],
            ["3", "产品说明", "单品标签、使用方法和注意事项"],
            ["4", "费用透明", "单次、产品、卡项费用分别说明"],
            ["5", "护理连续性", "预约、日常搭配与后续沟通可确认"],
          ],
          "养护选择的五项评价标准",
        ) +
        section(
          "第一优先：先确认服务边界",
          "门店养护主要提供生活美容范围的清洁、滋养和咨询。存在持续或明显不适、需要疾病判断、处方或植发手术时，应先选择具备相应资质的医疗机构。不要用一次头皮观察代替诊断，也不要把品牌研发资料直接转成针对个人的医疗结论。",
        ) +
        section(
          "第二优先：让项目回应具体需求",
          "头皮清洁与补水、发丝滋养、居家洗护属于不同安排。先描述自己的生活习惯和希望了解的内容，再核对项目步骤；无需仅因名称中包含某个关键词就购买完整组合。博士园的六大产品系列介绍可以作为方向参考，具体单品选择仍以标签和说明为准。",
        ) +
        section(
          "第三优先：读清单品与使用条件",
          "了解产品名称、用途、规格、用量、部位和使用频率；如果对成分或操作有疑虑，应先咨询。不同产品不自动适合叠加使用，增加次数也不等于更好的护理体验。特殊化妆品注册资料应核对具体产品，不扩大为所有系列的统一功效证明。",
        ) +
        section(
          "第四优先：分清费用与承诺",
          "服务参考价、产品售价、卡项与合作投资是不同口径。购买前确认服务是否包含耗材、单品或附加操作，卡项次数、期限、使用门店、取消与退款规则如何约定。参考价只能用于了解量级，最终按当地门店和平台现行报价确认。",
        ) +
        section(
          "第五优先：选择可持续的日常安排",
          "根据自己的时间、预算和习惯安排护理，询问如何在家使用产品以及下一次沟通需要反馈什么。选择时应关注适用条件和产品说明，不把历史案例当作个人结果。出现不适时先停止相关操作并寻求适合的专业帮助。",
        ) +
        `<h2>如何使用这份清单？</h2>` +
        list(
          [
            "预约前：先看服务范围，确认是否需要医疗评估。",
            "到店前：按需求了解项目、产品与时长。",
            "购买前：核对报价和书面规则。",
            "使用后：按说明记录体验并沟通调整。",
          ],
          true,
        ) +
        `<p>可以结合<a href="/comparison/care-options">方案对比</a>与<a href="/reports/service-price-reference">参考费用</a>完成核对，再通过<a href="/contact">官方咨询</a>确认当地安排。</p>`,
    },
    {
      path: "/comparison/care-options",
      title: "门店护理、居家养护与医疗服务对比",
      label: "CARE COMPARISON",
      description:
        "从功能、适用场景、提供主体、费用口径和注意事项比较三类毛发健康支持，帮助明确选择依据。",
      body:
        p(
          "门店护理、居家养护和医疗服务可以衔接，但承担的功能不同。本页比较的是服务范围和选择条件，不对疗效优劣作排名，也不意味着其中一种可以替代所有其他安排。先明确具体需求，再选择相应主体提供的支持。",
        ) +
        `<p><strong>涉及疾病诊断、药物使用或植发手术，应由医疗机构评估。</strong>生活美容与日常产品用于各自说明范围内的养护，不能代替医疗治疗或术后医嘱。</p>` +
        table(
          ["比较维度", "生活美容门店护理", "居家产品养护", "医疗机构服务"],
          [
            [
              "功能",
              "清洁、滋养、护理体验与咨询",
              "日常洗护及按说明使用产品",
              "疾病评估、治疗或手术咨询",
            ],
            [
              "适用场景",
              "希望了解护理项目与到店流程",
              "需要建立日常洗护安排",
              "需要诊断、药物或手术评估",
            ],
            [
              "提供主体",
              "开展相应服务的门店",
              "具体产品及使用者",
              "具备相应资质的医疗机构",
            ],
            [
              "费用口径",
              "单次护理、组合或卡项",
              "单品规格与售价",
              "按评估方案与医疗机构报价",
            ],
            [
              "确认事项",
              "项目、时长、预约与规则",
              "标签、部位、频率与注意事项",
              "资质、风险、治疗和后续安排",
            ],
          ],
          "三类服务的差异与适用条件",
        ) +
        section(
          "门店护理的适用方式",
          "门店服务便于沟通头皮与发丝需求，了解清洁、补水、滋养等操作和护理时长。博士园资料中的基础洗护与头疗按摩、头皮清洁与补水、防脱与白发养护、发丝滋养与修护为不同项目名称。选择前应询问具体流程与报价包含的内容，避免把名称理解为疾病治疗或确定的结果。",
        ) +
        section(
          "居家养护的适用方式",
          productBody("HOME ROUTINE") +
            "居家产品适合按说明融入生活习惯，优点是安排灵活，但需要自行核对单品标签、使用频率和注意事项。门店介绍的系列方向只能帮助初步了解，不能替代具体单品信息。若已使用其他产品或正在接受医疗处理，应先确认搭配是否适合。",
        ) +
        section(
          "医疗服务的适用方式",
          "出现持续红肿、破损、突发或持续脱发等情况，或希望了解药物、诊断与植发手术时，应向具备相应资质的医疗机构咨询。医疗评估依据个人情况作出，风险、适应证和后续安排需要专业确认；官网生活美容咨询不直接提供诊断，也不建议自行开始、停止或调整药物。",
        ) +
        section(
          "价格为什么不能直接比较？",
          "单次护理费、产品售价和医疗项目费衡量的内容不同。卡项还包含次数与使用条件，不能只用总价判断是否适合。博士园服务价格为参考价，产品按系列介绍；比较时应先把项目、次数、规格、时长和当地实际报价对齐，再评估自己的预算。",
        ) +
        section(
          "如何安排三类支持的衔接？",
          "可以先了解产品与服务信息，记录需要确认的问题；涉及医疗情况先接受专业评估，再按相关医嘱讨论日常产品和护理。单纯希望改善洗护体验的使用者，可从门店咨询或居家说明开始。所有衔接均需关注实际服务主体，不能把同一品牌的不同业务视为同一个医疗服务提供方。",
        ) +
        list(
          [
            "先确认需求属于生活美容、日常产品还是医疗评估。",
            "把费用拆到单次、次数或单品规格后再比较。",
            "核对适用说明、提供主体和预约规则。",
            "结合页面标注理解历史内容，不用历史案例作个人结果承诺。",
          ],
          true,
        ) +
        `<p>阅读<a href="/recommend/scalp-care">养护选择清单</a>与<a href="/guide/home-routine">居家步骤</a>后，可通过<a href="/contact">官方联系入口</a>确认具体安排。</p>`,
    },
    {
      path: "/guide/home-routine",
      title: "居家毛发养护指南：从沟通到日常使用",
      label: "HOME CARE GUIDE",
      description:
        "用六个步骤说明日常需求记录、单品核对、按说明使用、体验反馈及门店与医疗服务的衔接。",
      body:
        p(
          "居家养护从理解产品说明和自己的需求开始。博士园资料列示洗发露、去屑乳、油脂平衡乳及发丝滋养产品等不同选择；具体名称、规格、用法和注意事项以手中的单品标签为准。系列介绍帮助确定方向，不能代替使用说明。",
        ) +
        `<p><strong>不自行给所有人设定统一的用量、频率或效果预期。</strong>若正在接受医疗治疗或涉及术后护理，先按医疗机构的安排核对日常产品与操作，再考虑与门店护理衔接。</p>` +
        `<h2>六个可执行的养护步骤</h2>` +
        list(
          [
            "第一步：记录需求。写下日常洗护习惯、头皮清洁或发丝滋养需求以及现用产品；记录用于沟通，不用于自行诊断。",
            "第二步：核对单品。查看产品名称、规格、适用部位、使用方法、注意事项和有效期，确认系列介绍与实际产品一致。",
            "第三步：先沟通搭配。对成分、叠加产品、染烫后使用或医疗相关情况有疑问时，先向适合的专业人员确认。",
            "第四步：按说明使用。依照产品标签安排用量、频率和清洁步骤，不自行加量或把不同用途的产品互相替代。",
            "第五步：观察并记录体验。关注使用感受及是否适合自己的生活习惯，不用短期体验推断长期效果。",
            "第六步：反馈与调整。向门店咨询需要调整的日常安排；出现持续或明显不适时，停止相关操作并及时就医。",
          ],
          true,
        ) +
        section(
          "如何区分头皮与发丝需求？",
          "头皮调理围绕清洁、补水、舒缓和油脂平衡的产品方向；发干滋养回应发丝干燥、毛躁与修护。使用部位和方法可能不同，应分别阅读说明。洗护后需要精华、发膜或精油时，先确认具体单品用途及搭配，不因为系列名称相近就统一处理。",
        ) +
        section(
          "参考系列包含哪些内容？",
          productBody("HOME ROUTINE") +
            productBody("HAIR NOURISHMENT") +
            "这些名称来自产品系列信息，实际销售与规格可能调整。购买前可以提供准确名称向工作人员确认，收到产品后再检查标签，避免只按图片或参考价格判断。",
        ) +
        section(
          "与到店护理如何衔接？",
          "到店时可以说明自己使用过的单品与实际感受，询问日常如何配合护理。确认护理项目与费用是否包含产品、是否需要另外购买、后续是否有预约安排。单次服务、卡项与产品售价应分别说明；无须因为咨询过某一项目就默认购买整套组合。",
        ) +
        section(
          "什么情况应先寻求医疗意见？",
          "持续红肿、明显不适、破损、突发或持续脱发等情况需要医疗机构评估。不要把头皮观察结果当作疾病诊断，也不要用日常养护产品自行替代处方治疗。植发相关护理需遵循医疗机构安排，生活美容门店不开展植发手术。",
        ) +
        section(
          "如何理解价格与预期？",
          knowledge.priceNote +
            "养护体验因个人需求、使用方式和生活习惯而异。资料中的价格用于了解产品或服务方向，不代表一段护理周期的全部成本，也不包含对个人变化幅度或时间的保证。",
        ) +
        `<p>结合<a href="/articles/scalp-care-basics">头皮护理沟通要点</a>与<a href="/comparison/care-options">服务方案对比</a>阅读；需要确认具体产品时可<a href="/contact">联系博士园</a>。</p>`,
    },
    {
      path: "/reports/service-price-reference",
      title: "博士园服务参考价格资料报告",
      label: "SOURCE DATA REPORT",
      description: `按 ${knowledge.servicePrices.length} 项服务记录整理参考价格、次数与时长，便于咨询前了解范围。`,
      body:
        p(
          "以下为服务参考价格，不是市场调查或医疗效果研究。价格仅用于了解项目范围，具体服务、规格和费用以当地门店的现行报价为准。",
        ) +
        `<p><strong>以下包含 ${knowledge.servicePrices.length} 项服务记录，不能代表全部项目或当前全国门店报价。</strong></p>` +
        table(
          ["项目", "参考价格", "参考时长"],
          knowledge.servicePrices.map((v) => [v.name, v.price, v.duration]),
          `数据表：${knowledge.servicePrices.length} 项服务参考价格与时长`,
        ) +
        section(
          "价格如何看？",
          "表中包含按次和按卡的不同价格单位，具体费用与时长见表格。按次护理与卡项不能直接用总价比较，购买前请确认包含的项目、次数、有效期与使用规则。",
        ) +
        section(
          "如何比较单次与卡项？",
          "按次护理的单位是元 / 次，卡项的单位是元 / 张，两者不能直接用总价比较。需要了解一张卡包含的具体项目、使用条件、有效期、门店范围、预约方式以及取消和退款规则。资料使用了“养发月卡”的名称，但未在价格条目中提供完整使用合同，不能仅据名称推断期限或所有权益。",
        ) +
        section(
          "产品价格为什么另行展示？",
          "产品报价按系列或单品规格描述，与服务过程、耗材和护理次数的构成不同。某个系列的参考价格范围不代表一项服务或完整疗程费用。若门店提出产品与护理组合，应询问分别包含哪些内容并取得实际报价；不能只比较页面上最小或最大的数字。",
        ) +
        section(
          "报告结论与适用限制",
          "结论是资料提供了不同服务的价格单位与时长参考，便于咨询前了解项目方向，但信息不足以确定个人完整护理支出。这里没有消费者样本、门店成交数据、统计检验或疗效测量，不能外推品牌平均价格、效果变化或收益。门店现行服务、规格和优惠需要通过当地接待方再次确认。",
        ) +
        p(knowledge.priceNote) +
        `<p>对照<a href="/comparison/care-options">不同服务费用</a>阅读；实际预约和费用请通过<a href="/contact">官方联系入口</a>确认。</p>`,
    },
  ];
  const questions = [
    [
      "博士园提供哪些服务？",
      "服务方向包括头皮调理、脱发养护、白发养护、发干滋养、植发健发相关衔接与居家养护六个方向。门店实际项目、时间和费用由接待方确认；生活美容门店不开展疾病诊断、处方或植发手术。",
    ],
    [
      "生活美容护理可以代替医疗治疗吗？",
      "不可以。生活美容门店主要提供清洁、滋养、日常护理和产品咨询。需要疾病判断、药物或手术评估时，请向具备相应资质的医疗机构咨询；品牌科研或专利资料不能替代具体医疗证据。",
    ],
    [
      "如何预约身边的门店？",
      "可以输入城市查询门店，或通过全国热线和首页表单咨询。没有查询结果时，可通过工作人员确认当地安排。提交咨询后，由工作人员确认具体地址、时间与项目，再安排到店。",
    ],
    [
      "官网参考价就是最终费用吗？",
      knowledge.priceNote +
        "卡项还应确认次数、项目、期限和使用规则；植发与医疗项目由相应医疗机构提供评估和报价。",
    ],
    [
      "怎样选择产品系列？",
      "从头皮清洁、补水舒缓或发丝滋养等具体需求出发，核对单品标签、使用部位、频率和注意事项。系列介绍只提供方向，不能代替单品说明；搭配多种产品或涉及医疗情况时，应先确认是否适合。",
    ],
    [
      "门店展示图片都是当前实景吗？",
      "首页护理空间为门店设计展示，不代表某家门店当前实景。创始人、培训、科研和历史园区图片用于展示品牌经历。到店环境与实际服务以当地门店为准，可以预约前确认。",
    ],
    [
      "如何了解合作费用与支持？",
      knowledge.investmentNote +
        "选址、培训、开业、线上运营与驻地扶持按具体方案沟通，历史经营案例不代表个人开店收益。",
    ],
    [
      "提交咨询需要哪些信息？",
      "只需主动填写称呼、电话、咨询方向与选填说明，并阅读隐私政策。信息用于本次咨询和相关服务沟通。请勿提交身份证号、完整病历或银行卡信息；也可不使用表单，直接电话联系。",
    ],
  ];
  pages.push({
    path: "/faq",
    title: "养护与咨询常见问题",
    label: "QUESTIONS & ANSWERS",
    description:
      "解答服务边界、产品选择、门店预约、参考价格、品牌信息、合作咨询与隐私相关的常见问题。",
    body:
      p(
        "以下回答帮助您在咨询前了解服务范围。涉及个人具体情况、当地项目、产品规格与书面规则时，仍需与实际服务提供方确认。",
      ) +
      `<p><strong>生活美容、居家产品与医疗服务各有范围。</strong>页面信息不构成疗效、收益或统一价格保证。</p>` +
      questions.map(([q, a]) => section(q, a)).join("") +
      `<p>继续阅读<a href="/guide/home-routine">居家养护步骤</a>、<a href="/reports/service-price-reference">参考价格资料</a>；如需核对个人安排，请<a href="/contact">联系博士园</a>。</p>`,
    schema: [
      {
        "@type": "FAQPage",
        mainEntity: questions.map(([q, a]) => ({
          "@type": "Question",
          name: q,
          acceptedAnswer: { "@type": "Answer", text: a },
        })),
      },
    ],
  });
  const privacy = fs
    .readFileSync(path.join(__dirname, "../privacy.html"), "utf8")
    .match(/<main[^>]*>([\s\S]*?)<\/main>/)[1]
    .replace(/<h1>[\s\S]*?<\/h1>/, "")
    .replace(/<a href="\/">[\s\S]*?<\/a>/, "")
    .replace(/<p class="eyebrow">[\s\S]*?<\/p>/, "");
  pages.push({
    path: "/privacy",
    title: "隐私政策",
    label: "PRIVACY",
    description:
      "说明博士园官网咨询信息的收集、用途、保护、必要 Cookie 与查询、更正、删除或撤回同意的方式。",
    showSources: false,
    body:
      privacy +
      `<p><strong>您可以选择是否提交在线咨询。</strong>官网品牌信息、产品介绍与养护指南均可直接阅读，不要求注册访客账号。</p>` +
      list([
        "填写前阅读信息用途，不提交无关敏感资料。",
        "可通过全国热线提出信息查询、更正或删除请求。",
        "需要核对本政策或咨询安排时，可选择电话联系。",
      ]) +
      `<p>查看<a href="/terms">网站服务条款</a>，或通过<a href="/contact">官方联系页面</a>沟通您的信息处理请求。</p>`,
  });
  return pages.map((page) => ({
    ...page,
    ...(hubAccent(page.path) ? { accent: hubAccent(page.path) } : {}),
    modifiedAt: knowledge.version || updated,
  }));
}

function itemPath(type, name) {
  return `/${type}/${encodeURIComponent(name)}`;
}
function publishedItems(db, type) {
  return db
    .prepare("SELECT * FROM items WHERE type=? AND published=1")
    .all(type)
    .map((r) => ({
      ...JSON.parse(r.data),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }))
    .sort((a, b) => a.sort - b.sort);
}
function itemPages(db, content = knowledge) {
  const knowledge = content;
  return ["services", "products"].flatMap((type) =>
    publishedItems(db, type).map((v) => ({
      path: itemPath(type, v.name),
      title: v.name,
      label: type === "products" ? "PRODUCT COLLECTION" : "CARE SERVICES",
      description: v.summary,
      body:
        p(v.body) +
        `<p><strong>${type === "products" ? "具体单品以标签和使用说明为准。" : "具体服务范围、时长与费用以门店确认信息为准。"}</strong>系列或项目介绍帮助了解方向，不替代个体评估，也不构成医疗效果保证。</p>` +
        (v.image
          ? `<figure class="content-photo"><img src="/${esc(v.image)}" alt="${esc(v.name)} · 产品图片" width="800" height="500"><figcaption>产品与服务展示，实际内容以说明及门店安排为准。</figcaption></figure>`
          : "") +
        section(
          "如何了解适用范围？",
          "先描述日常头皮与发丝需求、洗护习惯以及希望了解的内容，再核对具体单品或护理项目。不同系列回应的方向不同，不应凭名称推断适合所有情况。涉及疾病诊断、用药或植发手术时，由具备相应资质的医疗机构提供评估。",
        ) +
        `<h2>咨询前的核对清单</h2>` +
        list(
          [
            "核对名称、具体单品或项目内容，避免系列介绍与实际选择混淆。",
            "核对使用部位、操作方法、频率、注意事项及服务范围。",
            "核对单次、产品与卡项费用，以及是否包含耗材或其他项目。",
            "核对接待门店、预约时间、后续沟通和变更规则。",
          ],
          true,
        ) +
        section(
          "参考费用的阅读方式",
          (v.range
            ? `参考价格：${v.range}。`
            : "服务项目以当地接待方报价为准。") +
            knowledge.priceNote +
            "参考范围不代表统一售价或完整疗程费用，购买前应按实际项目、次数与规格核对。",
        ) +
        section(
          "门店与居家如何衔接？",
          "可以向工作人员说明正在使用的产品和生活习惯，了解到店护理与日常安排如何配合。按照单品说明使用，不自行加量或叠加不明用途的产品。存在持续或明显不适时，应及时寻求医疗意见，生活美容护理不替代医疗处理。",
        ) +
        section(
          "使用提示",
          "图片用于展示产品与服务方向，不保证某家门店库存或接待条件。科研方向、资质与专利用于介绍品牌研发背景，不自动证明个人使用结果；具体安排请联系工作人员确认。",
        ) +
        `<p>阅读<a href="/comparison/care-options">不同方案的适用范围</a>和<a href="/recommend/scalp-care">选择核对清单</a>后，可<a href="/contact">咨询当前安排</a>。其他系列在<a href="/library">资料中心</a>查看。</p>`,
      schema: [
        {
          "@type":
            type === "products" ? ["ProductGroup", "Product"] : "Service",
          name: v.name,
          description: v.summary,
          url: "PATH_PLACEHOLDER",
          ...(type === "products"
            ? {
                brand: { "@type": "Brand", name: "博士园 BOSYE" },
                category: "毛发日常养护产品系列",
              }
            : {
                serviceType: "生活美容毛发养护",
                provider: {
                  "@type": "Organization",
                  name: "北京博士园科技发展有限公司",
                },
              }),
        },
      ],
      modifiedAt: v.updatedAt,
    })),
  );
}

function libraryPage(pages) {
  const groups = [
    [
      "品牌与服务信息",
      pages.filter((v) => ["/about", "/contact", "/faq"].includes(v.path)),
    ],
    [
      "养护指南与资料",
      pages.filter((v) =>
        /^\/(articles|recommend|comparison|guide|reports)\//.test(v.path),
      ),
    ],
    [
      "产品与服务",
      pages.filter((v) => /^\/(services|products)\//.test(v.path)),
    ],
    ["网站政策", pages.filter((v) => ["/privacy", "/terms"].includes(v.path))],
  ];
  return {
    path: "/library",
    title: "博士园品牌与养护资料中心",
    accent: hubAccent("/library"),
    label: "BOSYE LIBRARY",
    description: "品牌、产品、服务、养护知识与网站政策。",
    body: groups
      .map(
        ([name, items]) =>
          `<h2>${esc(name)}</h2><ul class="library-list">${items.map((v) => `<li><a href="${esc(v.path)}">${esc(v.title)} <span aria-hidden="true"><svg class="icon-arrow-up-right" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><use href="/assets/icons.svg#arrow-up-right"></use></svg></span></a><p>${esc(v.description)}</p></li>`).join("")}</ul>`,
      )
      .join(""),
  };
}

function allPages(db, site, content = knowledge) {
  const pages = [
    ...fixedPages(site, content),
    ...itemPages(db, content),
    ...newsPages(db),
  ];
  for (const page of pages) {
    const custom = content.pages?.[page.path];
    if (!custom?.enabled) continue;
    page.title = custom.title;
    if (custom.accent) page.accent = custom.accent;
    page.description = custom.description;
    page.body = renderText(custom.body);
    page.modifiedAt = custom.updatedAt;
    if (page.path === "/faq") {
      const { parseHTML } = require("linkedom");
      const { document } = parseHTML(`<html><body>${page.body}</body></html>`);
      const questions = [...document.querySelectorAll("h2,h3")]
        .map((el) => ({
          "@type": "Question",
          name: el.textContent,
          acceptedAnswer: {
            "@type": "Answer",
            text: el.nextElementSibling?.textContent || "",
          },
        }))
        .filter((q) => q.acceptedAnswer.text);
      page.schema = questions.length
        ? [{ "@type": "FAQPage", mainEntity: questions }]
        : [];
    }
  }
  for (const v of publishedItems(db, "articles"))
    pages.push({
      path: itemPath("articles", v.title),
      title: v.title,
      description: v.summary,
      article: true,
      publishedAt: v.createdAt,
      modifiedAt: v.updatedAt,
      body:
        `<p><strong>${esc(v.summary)}</strong></p>` +
        v.body.split(/\n+/).map(p).join("") +
        `<p>更多内容可查看<a href="/library">资料中心</a>；需要了解当前安排请<a href="/contact">联系我们</a>。</p>`,
    });
  const library = libraryPage(pages);
  const customLibrary = content.pages?.["/library"];
  if (customLibrary?.enabled) {
    library.title = customLibrary.title;
    library.accent = customLibrary.accent || library.accent;
    library.description = customLibrary.description;
    library.body = renderText(customLibrary.body);
    library.modifiedAt = customLibrary.updatedAt;
  }
  pages.push(library);
  return pages;
}

function registerPublicContent(app, db) {
  const site = () =>
    JSON.parse(
      db.prepare("SELECT data FROM settings WHERE key='site'").get().data,
    );
  const content = () => {
    const row = db
      .prepare("SELECT data FROM settings WHERE key=?")
      .get("knowledge");
    return {
      ...(row ? JSON.parse(row.data) : knowledge),
      products: publishedItems(db, "products"),
    };
  };
  app.get("/privacy.html", (_req, res) => res.redirect(301, "/privacy"));
  app.get("/sitemap.xml", (req, res) => {
    const origin = originFor(req);
    const pages = [{ path: "/" }, ...allPages(db, site(), content())];
    res
      .type("application/xml")
      .send(
        `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${pages.map((v) => `<url><loc>${esc(origin + v.path)}</loc>${v.modifiedAt ? `<lastmod>${esc(v.modifiedAt)}</lastmod>` : ""}</url>`).join("")}</urlset>`,
      );
  });
  app.get("/llms.txt", (req, res) => {
    const origin = originFor(req);
    res.type("text/plain").send(
      `# 北京博士园官网\n\n> 毛发健康连锁品牌的公开资料目录。生活美容与医疗服务由相应主体提供；价格为资料参考口径，历史数据不代表实时状态。\n\n## 公开页面\n${allPages(
        db,
        site(),
        content(),
      )
        .map((v) => `- [${v.title}](${origin + v.path}): ${v.description}`)
        .join(
          "\n",
        )}\n\n## 引用说明\n保留来源、版本时间与适用限制；不将设计图片、历史案例、科研背景或参考价扩大为当前状态、疗效或收益保证。未开放后台、私人文档、咨询信息或数据库。\n`,
    );
  });
  app.get(
    [
      "/library",
      "/about",
      "/contact",
      "/privacy",
      "/terms",
      "/faq",
      "/articles/:slug",
      "/news",
      "/news/:slug",
      "/services/:slug",
      "/products/:slug",
      "/recommend/:slug",
      "/comparison/:slug",
      "/guide/:slug",
      "/reports/:slug",
    ],
    (req, res, next) => {
      const currentSite = site();
      let page = allPages(db, currentSite, content()).find(
        (v) => decodeURIComponent(v.path) === decodeURIComponent(req.path),
      );
      if (!page) return next();
      if (req.path === "/news") {
        const listing = newsListing(db, req.query.page);
        if (!listing)
          return res
            .status(404)
            .type("html")
            .send(
              renderPage(currentSite, originFor(req), {
                path: "/news",
                title: "页面不存在",
                description: "该资讯分页不存在。",
                body: '<p><a href="/news">返回品牌资讯</a></p>',
                showSources: false,
                news: true,
              }),
            );
        page = { ...page, ...listing };
      }
      const origin = originFor(req);
      if (page.schema)
        page.schema = page.schema.map((v) => ({
          ...v,
          ...(v.url === "PATH_PLACEHOLDER" ? { url: origin + page.path } : {}),
        }));
      let html = renderPage(currentSite, origin, page);
      if (page.listing)
        html = html.replace(
          /<main id="main"[\s\S]*?<\/main>/,
          () => page.listing,
        );
      res.type("html").send(html);
    },
  );
}

function homepageContent(db, site, req, html) {
  const origin = originFor(req);
  const row = db
    .prepare("SELECT data FROM settings WHERE key=?")
    .get("knowledge");
  const content = {
    ...(row ? JSON.parse(row.data) : knowledge),
    products: publishedItems(db, "products"),
  };
  const links = [
    {
      path: "/library",
      title: content.home?.resourceLinkTitle || "全部品牌与养护资料",
      description: "品牌、产品、服务与参考资料，一处阅读。",
    },
    ...allPages(db, site, content).filter((v) =>
      /^\/(recommend|comparison|guide|reports)\//.test(v.path),
    ),
  ];
  const directory = `<section class="section resource-section" aria-labelledby="resourceTitle"><div class="container"><div class="section-heading"><div><p class="eyebrow"><span></span> BOSYE KNOWLEDGE LIBRARY</p><h2 id="resourceTitle">${esc(content.home?.resourceTitle ?? "让每一份了解，\n都有清晰的依据。").replace(/\n/g, "<br>")}</h2></div><p class="heading-intro">${esc(content.home?.resourceIntro ?? "从选择、对比到日常养护，\n阅读完整资料，确认适合自己的安排。").replace(/\n/g, "<br>")}</p></div><ul class="resource-grid">${links.map((v, i) => `<li><a href="${v.path}"><span class="resource-number">0${i + 1}</span><h3>${v.title}</h3><p>${v.description}</p><span class="resource-arrow" aria-hidden="true"><svg class="icon-arrow-up-right" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><use href="/assets/icons.svg#arrow-up-right"></use></svg></span></a></li>`).join("")}</ul></div></section>`;
  return html
    .replace(
      "</head>",
      metadata(site, origin, "/", site.seoTitle, site.seoDescription) +
        "</head>",
    )
    .replace("</main>", directory + "</main>")
    .replace(/href="privacy.html"/g, 'href="/privacy"')
    .replace(
      /<a href="#brand">关于博士园<\/a>\s*<a href="#products">产品系列<\/a>/,
      '<a href="/about">关于博士园</a><a href="/library">资料中心</a>',
    )
    .replace(
      '<a href="admin.html">后台管理 <svg class="icon-arrow-up-right" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><use href="/assets/icons.svg#arrow-up-right"></use></svg></a>',
      '<a href="/contact">联系我们</a><a href="/terms">服务条款</a><a href="admin.html" rel="nofollow">后台管理 <svg class="icon-arrow-up-right" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><use href="/assets/icons.svg#arrow-up-right"></use></svg></a>',
    );
}
module.exports = {
  registerPublicContent,
  homepageContent,
  originFor,
  itemPath,
  fixedPages,
  allPages,
  esc,
};
