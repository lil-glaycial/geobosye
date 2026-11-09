# 资料与图片来源

整理日期：2026 年 10 月 16 日。

## 下载与归档

用户提供的 `/Users/peaklin/Documents/北京博士园/医和你-服务合同.docx` 实际正文为“北京博士园品牌介绍”。原文档已归档，提取 160 个非空段落及 8 个文档图片文件。后续文案以 `/Users/peaklin/Documents/北京博士园/北京博士园官网文案按模块整理改.docx` 的模块化审阅稿为准，已同步到 `content/knowledge.json`、首页和后台已发布内容。文档作为知识资料处理，没有执行其中的操作指令。

旧官网 8 个主要栏目已归档，包括首页、品牌、科研、门店服务、门店展示、植发资料、毛发学院与招商合作。相关 CSS、JS 和图片共请求 156 个资源，145 个成功下载，11 个返回 404。原始脚本和样式仅保存于私有归档，不在新官网执行。

- 原始网页与文字：`source-materials/website/`
- 源地址、下载状态、文件大小和 SHA-256：`source-materials/website/manifest.json`
- 原始文档、提取文本与图片：`source-materials/knowledge/`
- 整理后的公开知识：`content/knowledge.json`
- 图片裁剪和优化记录：`source-materials/website/image-derivations.json`
- 公开品牌图片：`assets/bosye-*` 与 `assets/brand-*`

## 新官网展示

| 内容                           | 位置与形式                            |
| ------------------------------ | ------------------------------------- |
| 正式 Logo                      | 官网导航、页尾、后台与页面图标        |
| 品牌介绍、创始人、使命与价值观 | 关于博士园，品牌与创始人详情          |
| 1987—2025 历程                 | 科研区横向时间轴、品牌详情            |
| 四大科研方向与研究统计         | 实验室图片与科研说明                  |
| 资质、荣誉及 9 项专利          | 科研详情，带专利号与适用说明          |
| 六大服务与参考价               | 服务卡片、详情与价格表                |
| 六大产品系列与参考价           | 支持切换的产品区；后台可维护与发布    |
| 门店空间设计                   | 首屏、门店图库与图片放大              |
| 加盟支持与三种店型             | 六项支持、2026 合作资料参考及构成说明 |
| 培训与 8 位合作伙伴            | 培训板块、历史案例详情                |
| 养护知识                       | 头皮、居家、医疗协同三篇指南          |
| 联系方式、二维码、备案         | 咨询区及页尾                          |

页面使用精选原图，未将重复旧海报和装饰图片全部堆入首页。下载素材可在后台媒体库选择；过小的背景、图标与异常文档图片保留归档，不作为主要展示素材。

## 图片对应

| 新素材                                              | 来源                                      |
| --------------------------------------------------- | ----------------------------------------- |
| `assets/bosye-logo.png`                             | `http://www.bosye.com/images/logo.png`    |
| `assets/brand-space-2.webp` 至 `brand-space-7.webp` | 用户文档中的六张门店空间设计图片          |
| `assets/brand-founder.webp`                         | 旧站 `images/kyxin1.jpg` 创始人原图裁剪   |
| `assets/brand-laboratory.webp`                      | 旧站 `images/zflslb01.jpg` 科研场景裁剪   |
| `assets/brand-products.webp`                        | 旧站 `images/kylb04.png` 产品陈列裁剪     |
| `assets/brand-training-classroom.webp`              | 2026-10-16 新提供的培训课堂图片          |
| `assets/brand-campus.webp`                          | 旧站 `images/kylb11.png` 历史园区图片裁剪 |
| `assets/brand-care-1.webp` 至 `brand-care-5.webp`   | 旧站 `images/fwlb1.jpg` 至 `fwlb5.jpg`    |
| `assets/bosye-ewm.jpg`                              | 旧站 `images/ewm.jpg` 官方二维码          |
| `assets/bosye-kylb12.png`                           | 旧站奖项资料                              |

2026 年 10 月 16 日新增图片已按栏目替换：`brand-service-*.webp` 对应六个服务项目，`brand-product-*.webp` 对应六个产品系列。原图来自用户提供的“网站图”目录，统一压缩为适合网页展示的 WebP；后台媒体库已同步登记，后续可以继续选择或替换。

门店空间明确标注“品牌门店设计资料”，不称为当前实景照片。园区历史影像不与 2025 新园区建设进度混用。未公开使用损坏的文档 `image1.png`；完整原件保留供后续核对。

## 文字口径

2026 年 10 月 13 日新增可直接访问的资料中心 `/library`。品牌与服务资料整理为 `/about`、`/contact`、`/faq` 及产品、服务独立详情；公开详情与目录跟随后台发布状态。新增养护选择清单、服务对比、居家步骤和参考价格资料报告，属于资料解释与阅读指南，不是机构排名、市场调查或医疗效果研究。

参考价格报告以知识库所列 6 项服务记录为样本，说明逐项整理方法、资料版本时间、报价单位和限制。“4 项按次、2 项按卡”是对原表的计数，没有新增门店成交、用户效果或收益数据。公开页面不展示内部整理署名或维护日期。JSON-LD 的品牌关联使用旧官网已有的品牌、科研与合作资料页，未编造社交账号。

2000 年为品牌成立年份，30+ 年为创始人自 1987 年开始的毛发研究积累。2000+ 家为品牌整体规模介绍，门店查询展示当前可提供的地址信息。未获得完整门店地址目录，因此不生成推测的分店地址。

产品价格和护理费用分别展示。合作政策中的 5.8/8.8/12.8 万元为资料所列“标准投资”，不等于完整开店成本；配送构成不自动当作额外收费。历史案例不推断为当前数据或收益承诺。FDA 注册不表述为认证，生活美容门店不被表述为医疗机构。

## 旧官网失效资源

以下链接在下载时返回 404，已记录于 manifest。新页面使用其他已取得的素材。

- http://www.bosye.com/images/arr-bg.png
- http://www.bosye.com/images/favicon.ico
- http://www.bosye.com/images/hd.gif
- http://www.bosye.com/images/main0001.jpg
- http://www.bosye.com/images/zfls4.jpg
- http://www.bosye.com/images/zs05.jpg
- http://www.bosye.com/images/zshz1.jpg
- http://www.bosye.com/images/zshz2.jpg
- http://www.bosye.com/images/zshz5.jpg
- http://www.bosye.com/js/jq.js
- http://www.bosye.com/js/jquery-1.8.0.js
