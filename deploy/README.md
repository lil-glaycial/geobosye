# 线上域名配置

## bosye.com（2026-11-11）

- `bosye.com` 和 `www.bosye.com` 均解析到 `114.55.103.210`，通过 HTTPS 访问同一官网。
- HTTP 请求返回 301，保留域名、路径和查询参数并跳转到 HTTPS。
- [bosye.nginx.conf](bosye.nginx.conf) 对应服务器 `/etc/nginx/conf.d/bosye.conf`，反向代理到 `127.0.0.1:4173` 的 `bosye-web` 容器，同时保留 IP 地址的 HTTP 入口。
- 旧的 `/etc/nginx/conf.d/bosye_https.conf` 已停用，避免重复声明域名和默认服务。
- 修改前的 Nginx 配置保存在服务器 `/var/backups/bosye/nginx-bosye-com-20261111-I1eCeP/`。
- `bosyejm.com` 和 `www.bosyejm.com` 继续使用 [bosyejm.nginx.conf](bosyejm.nginx.conf)。应用的 `PUBLIC_ORIGIN` 仍为 `https://www.bosyejm.com`，因此 canonical 和 sitemap 的主地址沿用该域名。

### 证书

两个域名均使用 Certbot 管理的 Let's Encrypt 证书，每份证书覆盖对应的裸域名和 `www` 域名。

服务器安装路径：

| 域名 | 证书链 | 私钥 |
| --- | --- | --- |
| `bosye.com`、`www.bosye.com` | `/etc/letsencrypt/live/bosye.com/fullchain.pem` | `/etc/letsencrypt/live/bosye.com/privkey.pem` |
| `bosyejm.com`、`www.bosyejm.com` | `/etc/letsencrypt/live/www.bosyejm.com/fullchain.pem` | `/etc/letsencrypt/live/www.bosyejm.com/privkey.pem` |

`live/` 下的文件由 Certbot 以符号链接管理，实际版本保存在 `/etc/letsencrypt/archive/`。不要手动覆盖这些文件；证书和私钥不存入代码仓库。

自动续期共用 `/etc/cron.d/bosyejm-certbot` 中已有的任务，每天 **03:15 和 15:15（北京时间）** 执行 `/app/npm/certbot-renew.sh`，脚本对应仓库中的 [certbot-renew.sh](certbot-renew.sh)。任务名称沿用早期名称，但 `certbot renew` 会检查上述两份证书，在需要时续期，并通过 `/usr/sbin/nginx -t && /usr/bin/systemctl reload nginx` 加载新证书。使用绝对命令路径，兼容定时任务的环境。日志位于 `/var/log/bosyejm-certbot.log`。

域名验证使用 HTTP-01，验证文件位于 `/var/www/acme/.well-known/acme-challenge/`。两个域名的 80 端口都为该路径保留直接访问，其余请求跳转到 HTTPS。

手动验证自动续期流程：

```bash
/root/.local/bin/certbot renew --dry-run --no-random-sleep-on-renew \
  --run-deploy-hooks --deploy-hook "/usr/sbin/nginx -t && /usr/bin/systemctl reload nginx"
```

原阿里云证书保留在 `/etc/nginx/ssl/bosye.com/`，仅用于回退，当前 Nginx 不再引用它。

### 已完成的验收

- 两个域名的证书链和主机名校验通过。
- 首页、品牌资讯、文章详情、资料中心、联系咨询、健康接口、站点地图和图标资源均返回 HTTP 200。
- 两个域名的 HTTP 请求均按原路径和查询参数跳转到 HTTPS。
- 浏览器检查首页、品牌资讯、资料中心、联系咨询，未发现页面脚本错误、同域请求失败或已加载图片损坏。
- 两个 `bosyejm.com` 入口仍正常，Nginx 配置检查通过且没有域名冲突警告。
- Certbot 对两份证书的模拟续期均成功，并执行了 Nginx 检查及重载流程。
