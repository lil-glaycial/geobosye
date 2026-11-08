const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
function renderProducts(products) {
  if (!products.length)
    return '<p class="data-note">产品资料正在更新，欢迎联系顾问了解。</p><div id="productLayout" hidden><div id="productTabs"></div><div id="productPanel"></div></div>';
  const product = products[0];
  const tabs = products
    .map(
      (v, i) =>
        `<button id="product-tab-${i}" role="tab" aria-controls="productPanel" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-product-index="${i}"><span>${String(i + 1).padStart(2, "0")}</span>${esc(v.name)}<b aria-hidden="true"><svg class="icon-arrow-up-right" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><use href="/assets/icons.svg#arrow-up-right"></use></svg></b></button>`,
    )
    .join("");
  return `<div class="product-layout" id="productLayout"><div class="product-tabs" id="productTabs" role="tablist" aria-label="产品系列">${tabs}</div><div class="product-panel" id="productPanel" role="tabpanel" aria-labelledby="product-tab-0" tabindex="0"><div class="product-photo"><img id="productImage" src="${esc(product.image || "assets/brand-product-hair-loss.webp")}" alt="博士园品牌产品资料 · ${esc(product.name)}" width="800" height="500" loading="lazy"><span>产品陈列 · 品牌资料</span></div><div class="product-copy"><p class="eyebrow" id="productEnglish">${esc(product.english)}</p><h3 id="productName">${esc(product.name)}</h3><p id="productSummary">${esc(product.summary)}</p><p id="productBody">${esc(product.body)}</p><div class="product-range"><small>资料参考价格</small><strong id="productRange">${esc(product.range)}</strong></div><a class="text-link" href="#contact" data-consult="品牌与产品咨询">咨询产品与搭配 <span aria-hidden="true"><svg class="icon-arrow-up-right" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><use href="/assets/icons.svg#arrow-up-right"></use></svg></span></a></div></div></div>`;
}
module.exports = { renderProducts };
