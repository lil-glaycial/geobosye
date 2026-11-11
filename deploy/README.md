# 线上域名配置

## bosye.com（2026-11-11）

- `bosye.com` 和 `www.bosye.com` 均解析到 `114.55.103.210`，通过 HTTPS 访问同一官网。
- HTTP 请求返回 301，保留域名、路径和查询参数并跳转到 HTTPS。
- [bosye.nginx.conf](bosye.nginx.conf) 对应服务器 `/etc/nginx/conf.d/bosye.conf`，反向代理到 `127.0.0.1:4173` 的 `bosye-web` 容器，同时保留 IP 地址的 HTTP 入口。
- 旧的 `/etc/nginx/conf.d/bosye_https.conf` 已停用，避免重复声明域名和默认服务。
- 修改前的 Nginx 配置保存在服务器 `/var/backups/bosye/nginx-bosye-com-20261111-I1eCeP/`。
- `bosyejm.com` 和 `www.bosyejm.com` 继续使用 [bosyejm.nginx.conf](bosyejm.nginx.conf)。应用的 `PUBLIC_ORIGIN` 仍为 `https://www.bosyejm.com`，因此 canonical 和 sitemap 的主地址沿用该域名。

### 证书

本次安装用户提供的阿里云证书包 `28444492_bosye.com_nginx.zip`，签发机构为 DigiCert，包含 `bosye.com` 和 `www.bosye.com`。

服务器安装路径：

- 证书链：`/etc/nginx/ssl/bosye.com/bosye.com.pem`
- 私钥：`/etc/nginx/ssl/bosye.com/bosye.com.key`

目录权限为 `700`，两个文件均为 `root:root`、权限 `600`。证书和私钥不存入代码仓库。

证书于 **2027-05-12 07:59:59（北京时间）** 到期。这份手动安装的证书不属于现有 `bosyejm.com` 的 Certbot 自动续期任务，需要在到期前更新证书链和匹配的私钥，然后执行 `nginx -t && nginx -s reload`。

### 已完成的验收

- 两个域名的证书链和主机名校验通过。
- 首页、品牌资讯、文章详情、资料中心、联系咨询、健康接口、站点地图和图标资源均返回 HTTP 200。
- 两个域名的 HTTP 请求均按原路径和查询参数跳转到 HTTPS。
- 浏览器检查首页、品牌资讯、资料中心、联系咨询，未发现页面脚本错误、同域请求失败或已加载图片损坏。
- 两个 `bosyejm.com` 入口仍正常，Nginx 配置检查通过且没有域名冲突警告。
