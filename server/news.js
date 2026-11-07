const { renderText } = require("./content-text");
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
function publishedNews(db) {
  return db
    .prepare("SELECT * FROM items WHERE type='news' AND published=1")
    .all()
    .map((row) => ({
      ...JSON.parse(row.data),
      id: row.id,
      updatedAt: row.updated_at,
    }))
    .sort(
      (a, b) =>
        a.sort - b.sort ||
        b.publishedDate.localeCompare(a.publishedDate) ||
        b.updatedAt.localeCompare(a.updatedAt) ||
        a.id.localeCompare(b.id),
    );
}
function newsPages(db) {
  return [
    {
      path: "/news",
      title: "品牌资讯",
      description: "了解博士园品牌动态与最新资讯。",
      news: true,
      showSources: false,
      body: "",
    },
    ...publishedNews(db).map((item) => ({
      path: "/news/" + item.id,
      title: item.title,
      description: item.summary,
      article: true,
      news: true,
      showSources: false,
      publishedAt: item.publishedDate,
      modifiedAt: item.updatedAt,
      body:
        (item.image
          ? `<figure class="content-photo"><img src="/${esc(item.image)}" alt="${esc(item.title)}"></figure>`
          : "") +
        (item.account || item.imageCount !== undefined
          ? `<p class="content-meta-detail">来源账号：${esc(item.account || "博士园")} · 原文图片：${esc(item.imageCount ?? 0)} 张</p>`
          : "") +
        renderText(item.body).replace(/src="(assets|uploads)\//g, 'src="/$1/') +
        (item.sourceUrl
          ? `<p class="content-source-link"><a href="${esc(item.sourceUrl)}" rel="noopener" target="_blank">查看微信公众号原文 ↗</a></p>`
          : "") +
        '<p><a href="/news">← 返回品牌资讯</a></p>',
    })),
  ];
}
function newsListing(db, value) {
  if (
    value !== undefined &&
    (typeof value !== "string" || !/^[1-9]\d*$/.test(value))
  )
    return null;
  const page = Number(value || 1),
    items = publishedNews(db),
    pages = Math.max(1, Math.ceil(items.length / 12));
  if (!Number.isSafeInteger(page) || page > pages) return null;
  const url = (n) => (n === 1 ? "/news" : "/news?page=" + n);
  const links = [];
  if (page > 1)
    links.push(`<a href="${url(page - 1)}" aria-label="上一页">← 上一页</a>`);
  for (let n = 1; n <= pages; n++) {
    if (n === 1 || n === pages || Math.abs(n - page) <= 2)
      links.push(
        `<a href="${url(n)}" ${n === page ? 'aria-current="page"' : ""}>${n}</a>`,
      );
    else if (n === page - 3 || n === page + 3) links.push("<span>…</span>");
  }
  if (page < pages)
    links.push(`<a href="${url(page + 1)}" aria-label="下一页">下一页 →</a>`);
  return {
    path: url(page),
    listing: `<main id="main" class="brand-news-main"><section class="brand-news-heading"><div class="brand-news-container"><nav class="content-breadcrumb" aria-label="面包屑"><a href="/">首页</a><span> / </span>${page > 1 ? `<a href="/news">品牌资讯</a><span> / </span><span aria-current="page">第 ${page} 页</span>` : '<span aria-current="page">品牌资讯</span>'}</nav><p class="eyebrow">BOSYE JOURNAL / 品牌记录</p><h1>品牌 <strong>资讯</strong></h1><p class="brand-news-intro">与博士园一起，探索毛发健康与美好生活。<br>记录品牌故事，分享科研探索与专业养护理念。</p><p class="brand-news-count">第 ${page} / ${pages} 页，共 ${items.length} 篇。</p></div></section><div class="brand-news-container brand-news-results"><div class="brand-news-section-title"><div><p class="eyebrow">LATEST STORIES</p><h2>品牌新知 · 与你分享</h2></div><span>关于品牌的每一步，都在这里</span></div><div class="brand-news-grid">${
      items
        .slice((page - 1) * 12, page * 12)
        .map(
          (item) =>
            `<a class="brand-news-card" href="/news/${esc(item.id)}">${item.image ? `<div class="brand-news-cover"><img src="/${esc(item.image)}" alt="" loading="lazy"><span>品牌资讯</span></div>` : ""}<div class="brand-news-card-body"><p class="brand-news-meta">${esc(item.account || "品牌资讯")} · <time datetime="${esc(item.publishedDate)}">${esc(item.publishedDate)}</time>${item.imageCount !== undefined ? ` · ${esc(item.imageCount)} 图` : ""}</p><h2>${esc(item.title)}</h2><p class="brand-news-summary">${esc(item.summary)}</p><span class="brand-news-read">阅读全文 <span aria-hidden="true">↗</span></span></div></a>`,
        )
        .join("") ||
      '<div class="brand-news-empty"><h2>暂无品牌资讯</h2><p>更多品牌动态，敬请期待。</p></div>'
    }</div>${pages > 1 ? `<nav class="brand-news-pagination" aria-label="资讯分页">${links.join("")}</nav>` : ""}</div></main>`,
  };
}
module.exports = { newsPages, newsListing };
