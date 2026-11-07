// Explicit local preview data only. Never called during application startup.
const Database = require("better-sqlite3");
const path = require("node:path");
const fs = require("node:fs");
const knowledge = require("../content/knowledge.json");
const entries = [
  [
    "brand-story",
    "从品牌初心出发，认识博士园的毛发健康理念",
    "围绕“养防植健”，连接门店护理、产品研发与居家养护。从品牌的起点出发，了解博士园如何看待毛发健康与日常生活的关系。",
    "brand-campus.webp",
    "品牌的起点",
    knowledge.brand.description,
    "关于品牌理念",
    knowledge.brand.mission,
  ],
  [
    "research",
    "走近科研空间，了解品牌背后的探索与积累",
    "一份产品与服务的介绍之外，还有值得了解的研究背景。本篇带你从品牌资料出发，认识博士园的科研方向与专业积累。",
    "brand-laboratory.webp",
    "从研究出发",
    "博士园品牌资料围绕毛发健康研究、产品研发与服务应用展开介绍。科研空间让人们更直观地认识品牌的研究背景。",
    "继续了解",
    "可通过官网科研板块阅读品牌资料。科研背景与历史资料不等同于具体产品的效果承诺，产品使用应以实际说明为准。",
  ],
  [
    "products",
    "六大产品系列，让日常养护有更清晰的选择",
    "从头皮护理到居家养护，不同系列对应不同的沟通与护理需求。了解系列定位，是认识产品、阅读说明和选择日常养护方式的第一步。",
    "brand-products.webp",
    "了解系列定位",
    "官网展示头皮调理、防脱固发、白发养护、植发健发、居家养发与发丝护理等产品系列。不同系列的介绍可在产品板块查看。",
    "从实际需求开始",
    "选购前请阅读具体产品的适用范围与使用说明，并与门店沟通实际需求。具体产品信息以现行标签和门店说明为准。",
  ],
  [
    "store-space",
    "走进博士园门店，感受自然舒适的养护空间",
    "明亮的空间、清晰的功能分区与细致的沟通，共同构成一次门店体验。通过品牌空间图片，提前了解门店养护的环境与服务氛围。",
    "brand-space-2.webp",
    "从环境到体验",
    "门店空间是品牌与顾客交流的场所。接待、咨询与护理区域的设计，让服务流程更容易理解。",
    "预约前的准备",
    "可通过官网门店查询了解所在城市的门店信息，再确认营业时间、可预约项目与实际服务安排。配图用于展示品牌空间，具体环境以当地门店为准。",
  ],
  [
    "learning",
    "持续学习，让专业服务落实到每一次沟通",
    "清晰地介绍服务、耐心地倾听需求，是门店体验的重要组成部分。透过品牌培训场景，了解服务学习与团队交流的日常。",
    "brand-training.webp",
    "以学习连接服务",
    "品牌培训空间承载产品知识、服务流程与沟通经验的交流。通过持续学习，让团队更清楚地介绍品牌资料和服务信息。",
    "让信息更清晰",
    "咨询时，可以就项目内容、服务时间、费用说明和后续安排逐项沟通，了解完整信息后再做决定。",
  ],
  [
    "home-care",
    "从门店到日常，把养护融入自己的生活节奏",
    "毛发养护不仅发生在门店，也与日常的产品使用和生活安排有关。认识门店服务与居家养护之间的联系，为日常沟通整理一份思路。",
    "brand-service-home-care.webp",
    "关注日常安排",
    "居家养护应从了解所用产品开始。查看产品标签与使用说明，并在咨询时说明自己的需求、使用习惯与疑问。",
    "做好服务衔接",
    "门店沟通可以帮助梳理产品使用和服务安排。生活美容服务不代替医疗诊断；如有需要，应向具备相应资质的医疗机构咨询。",
  ],
];
(async () => {
  const dataDir = path.resolve(__dirname, "../data");
  const db = new Database(path.join(dataDir, "bosye.sqlite"));
  try {
    const backupDir = path.join(dataDir, "backups");
    fs.mkdirSync(backupDir, { recursive: true });
    await db.backup(
      path.join(backupDir, "before-news-demo-" + Date.now() + ".sqlite"),
    );
    const insert = db.prepare(
      "INSERT OR IGNORE INTO items (id,type,data,published,created_at,updated_at) VALUES (?,?,?,?,?,?)",
    );
    const now = new Date().toISOString();
    const added = db.transaction(() =>
      entries.reduce(
        (count, [key, title, summary, image, h1, p1, h2, p2], i) => {
          const data = {
            title,
            summary,
            image: "assets/" + image,
            sort: i + 10,
            publishedDate: "2026-10-30",
            body: `${summary}\n\n## ${h1}\n\n${p1}\n\n## ${h2}\n\n${p2}\n\n本文为页面展示示例，根据现有品牌资料整理，不代表新增活动公告。可由后台编辑或替换。`,
          };
          return (
            count +
            insert.run(
              "demo-news-" + key,
              "news",
              JSON.stringify(data),
              1,
              now,
              now,
            ).changes
          );
        },
        0,
      ),
    )();
    console.log(`已添加 ${added} 篇品牌资讯示例；未覆盖现有内容。`);
  } finally {
    db.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
