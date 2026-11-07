# coding: utf-8
"""Render the curated source knowledge into the public HTML (no client-side loading needed)."""
from pathlib import Path
from html import escape
import json
root=Path(__file__).resolve().parents[1]
k=json.loads((root/'content/knowledge.json').read_text())
html='''<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>博士园｜科学毛发健康管理</title>
<meta name="description" content="博士园——专注脱发白发的科研型毛发健康管理连锁品牌，提供头皮调理、脱发养护、白发养护、头油头屑等护理服务及植发植眉等毛发移植服务。">
<meta name="theme-color" content="#006f6a">
<link rel="icon" href="assets/bosye-logo.png"><link rel="stylesheet" href="styles.css">
<link rel="preload" href="assets/brand-space-6.webp" as="image">
</head>
<body id="top">
<a class="skip-link" href="#main">跳到主要内容</a>
<header class="site-header">
<div class="header-inner">
<a href="#top" class="brand" aria-label="博士园首页"><img src="assets/bosye-logo.png" width="121" height="75" alt="博士园 BOSYE 官方标识"><span class="brand-signature">北京博士园毛发研究中心</span></a>
<nav class="main-nav" id="mainNav" aria-label="主导航"><a class="active" href="#top">首页</a><a href="#brand">关于博士园</a><a href="#services">服务体系</a><a href="#research">科研实力</a><a href="#products">产品系列</a><a href="#network">门店体验</a><a href="#join">合作加盟</a></nav>
<a href="#contact" class="header-cta">预约咨询 <span aria-hidden="true">↗</span></a>
<button class="menu-toggle" aria-label="打开菜单" aria-controls="mainNav" aria-expanded="false"><span></span><span></span></button>
</div>
</header>
<main id="main">
<section class="hero" id="hero">
<div class="container hero-grid">
<div class="hero-copy"><p class="eyebrow"><span></span> SCIENCE FOR BETTER HAIR</p>
<p class="hero-label">专注脱发白发的科研型连锁品牌</p>
<h1><span id="heroTitle">科学养护</span><em id="heroAccent">全周期毛发健康管理</em></h1>
<p id="heroDescription" class="hero-description">30 余年毛发研究积累，连接专业门店护理与日常居家养护。博士园，以养、防、植、健一体的毛发健康服务，陪伴每一份对美好生活的期待。</p>
<div class="hero-actions"><a class="btn btn-primary" href="#services">探索养护服务 <span aria-hidden="true">↗</span></a><a class="text-link" href="#brand">了解博士园 <span aria-hidden="true">→</span></a></div>
<div class="hero-principles"><span>养<small>综合养护</small></span><span>防<small>精准防护</small></span><span>植<small>精细治理</small></span><span>健<small>健发养身</small></span></div>
</div>
<div class="hero-visual"><img src="assets/brand-space-6.webp" alt="博士园品牌门店设计中的开放护理空间" width="1269" height="952" fetchpriority="high"><div class="hero-image-label"><span class="live-dot"></span> BOSYE CARE SPACE <span>品牌门店设计展示</span></div><div class="hero-image-note"><span>科研 · 专业 · 自然 · 健康</span><a href="#network" aria-label="探索门店空间">↗</a></div></div>
</div>
<div class="hero-bottom container"><span>RESEARCH · CARE · LIFE</span><span>源于科学，归于生活</span><a href="#brand" aria-label="向下浏览">向下探索 <span aria-hidden="true">↓</span></a></div>
</section>
<section class="brand-stats" aria-label="品牌规模"><div class="container stats-grid"><div><strong>30<em>+</em></strong><span>毛发研究积累<small>年 · 创始人研究始于 1987</small></span></div><div><strong>2000<em>+</em></strong><span>品牌连锁网络<small>家 · 品牌资料统计口径</small></span></div><div><strong>6</strong><span>专业产品系列<small>覆盖多种养护需求</small></span></div><div><strong>16</strong><span>全国办事处<small>就近支持与服务</small></span></div></div></section>
<section class="section brand-section" id="brand">
<div class="container"><div class="section-heading"><div><p class="eyebrow"><span></span> ABOUT BOSYE</p><h2>把科研的深度，<br>带进日常的温度。</h2></div><p class="heading-intro">从一位医学博士的研究初心，<br>到一个专注毛发健康的连锁品牌。</p></div>
<div class="brand-layout"><figure class="founder-card"><img src="assets/brand-founder.webp" alt="博士园创始人王朝刚博士" width="838" height="520" loading="lazy"><figcaption><div><strong>王朝刚</strong><span>创始人 · 首席科学家</span></div><button class="circle-link" data-knowledge="founder" aria-label="了解王朝刚博士">↗</button></figcaption></figure><div class="brand-story"><span class="small-tag">SINCE 2000 · 北京</span><h3>深耕毛发健康，<br>让专业被每个人感受到。</h3><p id="brandIntro">@BRAND_DESCRIPTION@</p><div class="brand-values"><span>我们的使命</span><p>@MISSION@</p></div><button class="text-link" data-knowledge="brand">品牌故事与价值观 <span aria-hidden="true">→</span></button></div></div>
</div></section>
<section class="section services-section" id="services"><div class="container"><div class="section-heading"><div><p class="eyebrow"><span></span> PROFESSIONAL CARE</p><h2>每一种需求，<br>都有用心的照顾。</h2></div><div class="heading-side"><p>从头皮到发丝，从门店到居家。<br>为不同阶段的毛发需求，提供清晰的养护建议。</p><button class="text-link" data-knowledge="prices">查看服务参考价格 <span aria-hidden="true">↗</span></button></div></div>
<div class="service-grid"><!-- SERVICES_START --><!-- SERVICES_END --></div>
<div class="service-process"><span>一次完整的护理体验</span><ol><li><b>01</b> 状态检测</li><li><b>02</b> 需求沟通</li><li><b>03</b> 适配护理</li><li><b>04</b> 持续养护</li></ol><a href="#contact">预约我的护理 <span aria-hidden="true">↗</span></a></div>
</div></section>
<section class="section research-section" id="research"><div class="container"><div class="section-heading"><div><p class="eyebrow"><span></span> SCIENCE AT THE ROOT</p><h2>根植科学，<br>持续探索毛发健康的奥秘</h2></div><p class="heading-intro">从基础研究到产品研发，<br>以长期积累回应真实需求。</p></div>
<div class="research-layout"><div class="research-image"><img src="assets/brand-laboratory.webp" alt="旧官网展示的毛发科研工作场景" width="790" height="540" loading="lazy"><span>毛发研究 · 品牌科研资料</span></div><div class="research-content"><p class="small-tag">四大科研技术方向</p><div class="research-techniques" id="researchTechniques">@RESEARCH@</div><div class="research-numbers" id="researchNumbers">@RESEARCH_NUMBERS@</div><p class="data-note">科研数据整理自品牌资料，反映研究积累，不代表个体护理效果。</p></div></div>
<div class="credentials-strip"><div><span class="credential-symbol" aria-hidden="true">✧</span><span>高新技术企业<small>北京博士园毛发研究中心</small></span></div><div><span class="credential-symbol" aria-hidden="true">✧</span><span>北京市“专精特新”<small>北京博士园科技发展有限公司</small></span></div><div><span class="credential-symbol" aria-hidden="true">✧</span><span>科技创新奖一等奖<small>2022 年 · 中国商业联合会</small></span></div><button class="text-link" data-knowledge="qualifications">资质、荣誉与专利 <span aria-hidden="true">↗</span></button></div>
<div class="history-heading"><h3>时间，是专注的见证。</h3><span>1987 — 2025</span></div><div class="timeline" id="timeline" tabindex="0" role="region" aria-label="品牌发展历程，可横向滚动">@TIMELINE@</div>
</div></section>
<section class="section products-section" id="products"><div class="container"><div class="section-heading"><div><p class="eyebrow"><span></span> THE BOSYE COLLECTION</p><h2>功效为先，<br>脱发白发头皮发干全覆盖</h2></div><p class="heading-intro">六大产品系列，衔接门店与居家。<br>按头皮状态与发丝需求选择适合的养护。</p></div>
<!-- PRODUCTS_START --><div class="product-layout" id="productLayout"><div class="product-tabs" id="productTabs" role="tablist" aria-label="产品系列">@PRODUCT_TABS@</div><div class="product-panel" id="productPanel" role="tabpanel" aria-labelledby="product-tab-0" tabindex="0"><div class="product-photo"><img id="productImage" src="assets/brand-product-hair-loss.webp" alt="博士园产品陈列，品牌系列展示" width="800" height="500" loading="lazy"><span>产品陈列 · 品牌资料</span></div><div class="product-copy"><p class="eyebrow" id="productEnglish">HAIR CARE</p><h3 id="productName">脱发养护系列</h3><p id="productSummary">围绕不同类型脱发进行微环境调理、营养补充和组织活力养护。</p><p id="productBody">@PRODUCT_BODY@</p><div class="product-range"><small>资料参考价格</small><strong id="productRange">158—1280 元</strong></div><a class="text-link" href="#contact" data-consult="品牌与产品咨询">咨询产品与搭配 <span aria-hidden="true">↗</span></a></div></div></div>
<!-- PRODUCTS_END --><p class="data-note" id="productPriceNote">@PRICE_NOTE@</p>
</div></section>
<section class="section network-section" id="network"><div class="container"><div class="section-heading"><div><p class="eyebrow"><span></span> A SPACE FOR YOURSELF</p><h2>在熟悉的城市，<br>给自己一点养护时间。</h2></div><p class="heading-intro">明亮的空间，有序的服务，<br>从一次到店，感受博士园的专业与温度。</p></div>
<div class="gallery-layout"><div class="gallery-main"><button id="galleryExpand" aria-label="放大查看开放护理区"><img id="galleryImage" src="assets/brand-space-6.webp" width="1269" height="952" alt="开放护理区，品牌门店设计资料" loading="lazy"><span class="expand-icon" aria-hidden="true">↗</span></button><div class="gallery-caption"><strong id="galleryTitle">开放护理区</strong><span id="galleryCaption">品牌门店设计资料 · 舒适的护理座席</span><small id="galleryCount">01 / 06</small></div></div><div class="gallery-thumbs" id="galleryThumbs">@GALLERY@</div></div>
<div class="store-search"><div><p class="eyebrow">FIND YOUR BOSYE</p><h3>寻找身边的博士园</h3><p>输入所在城市，查询已发布的门店信息。</p></div><div class="store-search-controls"><div class="search-field"><label class="sr-only" for="cityInput">所在城市或门店名称</label><input id="cityInput" type="search" placeholder="输入城市或门店名称，例如：北京" maxlength="80"><button class="btn btn-primary" id="searchStore">查找门店 <span aria-hidden="true">→</span></button></div><p id="networkResult" aria-live="polite">更多门店信息，可致电全国咨询热线 <a data-phone href="tel:4006189558">400-618-9558</a>。</p></div></div>
</div></section>
<section class="section join-section" id="join"><div class="container"><div class="join-intro"><div><p class="eyebrow"><span></span> GROW TOGETHER</p><h2>把专业的事，<br>做成长期的事业。</h2><p>与博士园一起，在毛发健康服务行业扎根。<br>从开店筹备到日常经营，让每一步都有支持。</p><a class="btn btn-primary" href="#contact" data-consult="合作加盟咨询">获取合作方案 <span aria-hidden="true">↗</span></a></div><figure><img src="assets/brand-space-2.webp" alt="博士园品牌门店外观设计" width="1269" height="937" loading="lazy"><figcaption>品牌门店外观设计展示</figcaption></figure></div>
<div class="support-grid" id="supportGrid">@SUPPORT@</div>
<div class="model-heading"><h3>三种空间，适配不同规划。</h3><span>2026 年合作资料 · 标准投资参考</span></div><div class="model-grid" id="shopModels">@SHOP_MODELS@</div><p class="data-note" id="investmentNote">@INVESTMENT_NOTE@</p>
</div></section>
<section class="section learning-section"><div class="container"><div class="learning-layout"><figure><img src="assets/brand-training-classroom.webp" alt="博士园培训课堂与毛发知识培训现场" width="1500" height="1032" loading="lazy"><figcaption>博士园培训课堂 · 品牌资料</figcaption></figure><div><p class="eyebrow"><span></span> LEARN. PRACTICE. GROW.</p><h2>把专业练成日常，<br>把成长带进门店。</h2><p>博士园智胜成长培训体系，覆盖不同岗位与经营阶段。</p><div class="learning-tracks" id="learningTracks">@LEARNING@</div><button class="text-link" data-knowledge="training">了解人才与运营支持 <span aria-hidden="true">↗</span></button></div></div><div class="partner-heading"><h3>与品牌一起，走过时间。</h3><button class="text-link" data-knowledge="partners">更多合作伙伴故事 <span aria-hidden="true">→</span></button></div><div class="partner-grid" id="partnerGrid">@PARTNERS@</div><p class="data-note" id="partnerNote">合作案例为品牌资料中的历史记录，门店数量与经营情况可能变化，实际收益因地区、门店及经营周期而异。</p></div></section>
<section class="section journal-section" id="knowledge"><div class="container"><div class="section-heading"><div><p class="eyebrow"><span></span> THE CARE JOURNAL</p><h2>多一点了解，<br>让养护更有方向。</h2></div><p class="heading-intro">从常见的毛发问题出发，<br>了解护理、产品与专业服务的关系。</p></div><div class="journal-grid"><button class="journal-card" data-knowledge="scalp"><span class="journal-number">01</span><small>头皮护理</small><h3>护理之前，<br>先了解自己的头皮。</h3><p>清洁、补水与水油平衡，怎样建立日常护理习惯？</p><span class="text-link">阅读养护知识 <span aria-hidden="true">↗</span></span></button><button class="journal-card" data-knowledge="routine"><span class="journal-number">02</span><small>居家养护</small><h3>让门店护理，<br>延续到每一天。</h3><p>从洗护到精华，如何按实际需求搭配产品？</p><span class="text-link">阅读养护知识 <span aria-hidden="true">↗</span></span></button><button class="journal-card" data-knowledge="medical"><span class="journal-number">03</span><small>专业协同</small><h3>了解服务边界，<br>选择适合的支持。</h3><p>生活美容养护与医疗机构植发服务，有哪些区别？</p><span class="text-link">阅读养护知识 <span aria-hidden="true">↗</span></span></button></div></div></section>
<section class="section news-section" id="news" hidden><div class="container"><div class="section-heading"><div><p class="eyebrow"><span></span> BOSYE NEWS</p><h2>品牌动态</h2></div></div><div class="news-grid" id="newsGrid"></div></div></section>
<section class="contact-section" id="contact"><div class="container contact-grid"><div class="contact-copy"><p class="eyebrow"><span></span> LET'S TALK</p><h2>美好的改变，<br>从一次沟通开始。</h2><p>关于脱发白发、头皮护理、产品选择、门店预约与合作加盟，<br>欢迎留下你的需求。</p><div class="contact-details"><div><span>全国咨询热线</span><a data-phone href="tel:4006189558">400-618-9558</a></div><div><span>北京总部</span><p id="headquarters">北京市朝阳区后现代城 5 号楼 C 座 2 层</p></div></div><div class="contact-wechat"><img src="assets/bosye-ewm.jpg" width="90" height="90" loading="lazy" alt="博士园旧官网提供的官方二维码"><div><strong>关注博士园</strong><span>获取品牌资讯与养护知识</span></div></div></div><form class="contact-form" id="contactForm" method="post" action="/api/public/leads"><div class="form-title"><strong>预约咨询</strong><span>留下需求，由顾问联系</span></div><div class="form-row"><label>您的称呼<input name="name" autocomplete="name" maxlength="40" placeholder="请输入您的称呼" required></label><label>联系电话<input name="phone" type="tel" autocomplete="tel" inputmode="tel" minlength="7" maxlength="30" placeholder="请输入手机号码" required></label></div><label>咨询方向<select name="type"><option>头皮护理与养护</option><option>门店服务预约</option><option>合作加盟咨询</option><option>品牌与产品咨询</option></select></label><label>补充说明<textarea name="message" rows="3" maxlength="2000" placeholder="告诉我们您关心的问题（选填）"></textarea></label><label class="consent"><input name="consent" type="checkbox" required><span>我已阅读并同意<a href="privacy.html" target="_blank" rel="noopener">《隐私政策》</a>，同意为本次咨询使用上述信息。</span></label><input name="website" tabindex="-1" autocomplete="off" class="honeypot" aria-hidden="true"><p id="formError" class="form-error" role="alert"></p><button class="btn btn-primary btn-submit" type="submit">提交咨询 <span aria-hidden="true">↗</span></button><small>信息仅用于本次咨询及相关服务沟通。</small></form></div></section>
</main>
<footer class="site-footer"><div class="container footer-top"><a class="brand" href="#top" aria-label="回到博士园首页"><img src="assets/bosye-logo.png" width="121" height="75" alt="博士园 BOSYE"><span class="brand-signature">源于科学，归于生活。</span></a><div class="footer-links"><a href="#brand">关于博士园</a><a href="#products">产品系列</a><a href="#research">科研实力</a><a href="#join">合作加盟</a><a href="admin.html">后台管理 ↗</a></div></div><div class="container footer-bottom"><span>北京博士园毛发研究中心 · © 2000—2026 BOSYE</span><span><a id="icpLink" href="https://beian.miit.gov.cn/" target="_blank" rel="noopener">京ICP备10216282号-12</a>　<span id="policeRecord">京公网安备 11010502039889号</span>　<a href="privacy.html">隐私政策</a></span></div></footer>
<div class="floating-tools"><a href="tel:4006189558" aria-label="拨打电话">☎</a><a href="#contact" aria-label="预约咨询">咨</a><button id="toTop" aria-label="回到顶部">↑</button></div>
<div class="toast" id="toast" role="status"></div>
<div class="modal-backdrop" id="detailModal" hidden><section class="quick-modal detail-modal" role="dialog" aria-modal="true" aria-labelledby="detailTitle"><button class="modal-close" id="detailClose" aria-label="关闭详情">×</button><p class="eyebrow" id="detailCategory"></p><h2 id="detailTitle"></h2><div id="detailBody" class="multiline"></div><a class="btn btn-primary" href="#contact" id="detailConsult">预约咨询 <span aria-hidden="true">↗</span></a></section></div>
<script src="app.js"></script>
</body></html>'''
e=lambda s:escape(str(s),quote=True)
def fill(key,val):
 global html
 html=html.replace('@'+key+'@',val)
fill('BRAND_DESCRIPTION',e(k['brand']['description']))
fill('MISSION',e(k['brand']['mission']))
fill('RESEARCH',''.join(f'<div><b>{i+1:02}</b><h3>{e(v["name"])}</h3><p>{e(v["text"])}</p></div>' for i,v in enumerate(k['research'])))
fill('RESEARCH_NUMBERS',''.join(f'<div><strong>{e(v["number"])}</strong><span>{e(v["label"])}</span></div>' for v in k['researchNumbers']))
fill('TIMELINE',''.join(f'<article><strong>{e(v["year"])}</strong><span class="timeline-dot"></span><h4>{e(v["title"])}</h4><p>{e(v["text"])}</p></article>' for v in k['timeline']))
fill('PRODUCT_TABS',''.join(f'<button id="product-tab-{i}" role="tab" aria-controls="productPanel" aria-selected="{str(i==0).lower()}" tabindex="{0 if i==0 else -1}" data-product-index="{i}"><span>{i+1:02}</span>{e(v["name"])}<b aria-hidden="true">↗</b></button>' for i,v in enumerate(k['products'])))
fill('PRODUCT_BODY',e(k['products'][0]['body']))
fill('PRICE_NOTE',e(k['priceNote']))
fill('GALLERY',''.join(f'<button class="gallery-thumb {"active" if i==0 else ""}" data-gallery-index="{i}" aria-pressed="{str(i==0).lower()}" aria-label="查看{e(v["title"])}"><img src="{e(v["image"])}" alt="" width="1269" height="952" loading="lazy"><span>{e(v["title"])}</span></button>' for i,v in enumerate(k['gallery'])))
fill('SUPPORT',''.join(f'<article><span>{i+1:02}</span><h3>{e(v["name"])}</h3><p>{e(v["text"])}</p></article>' for i,v in enumerate(k['support'])))
fill('SHOP_MODELS',''.join(f'<article class="model-card"><div><h4>{e(v["name"])}</h4><span>{e(v["size"])}</span></div><p class="model-price"><strong>{e(v["investment"])}</strong> 万元</p><p>资料所列标准投资</p><ul><li>{e(v["products"])}</li><li>{e(v["equipment"])}</li></ul><a class="text-link" href="#contact" data-consult="合作加盟咨询">了解合作方案 <span aria-hidden="true">↗</span></a></article>' for v in k['shopModels']))
fill('INVESTMENT_NOTE',e(k['investmentNote']))
fill('LEARNING',''.join(f'<div><span>0{i+1}</span><strong>{e(v["name"])}</strong><p>{e(v["text"])}</p></div>' for i,v in enumerate(k['learning'])))
fill('PARTNERS',''.join(f'<button class="partner-card" data-partner-index="{i}"><div><span>{e(v["city"])}</span><small>{e(v["joined"])} 年加入</small></div><p><strong>{e(v["metric"])}</strong>{e(v["unit"])}</p><h4>{e(v["name"])} · 合作伙伴 <span aria-hidden="true">↗</span></h4></button>' for i,v in enumerate(k['partners'][:3])))
(root/'index.html').write_text(html)
print('Homepage built with curated source content.')
