# 北京博士园官网部署说明

更新日期：2026 年 10 月 21 日。适用于本项目现有 Express + SQLite 版本，包含官网前端、管理后台、服务端 API 和数据迁移。

## 1. 前后端架构

本项目使用一个 Node.js 进程，同时提供官网页面、后台页面、API 和图片资源。生产环境推荐使用 **Nginx HTTPS 反向代理 + Node.js 22 + 本机 SQLite 持久化目录**。

```text
用户浏览器 / 管理员浏览器
          │ HTTPS :443
          ▼
        Nginx
          │ HTTP 127.0.0.1:4173
          ▼
  Node.js / Express（单实例）
          ├─ 官网：/、/about、/library 等
          ├─ 管理后台：/admin.html
          ├─ 接口：/api/public/*、/api/auth/*、/api/admin/*
          ├─ 素材：/assets/*、/uploads/*
          └─ 数据：DATA_DIR/bosye.sqlite、DATA_DIR/uploads/
```

| 部分 | 主要文件 | 作用与部署方式 |
| --- | --- | --- |
| 官网前端 | `index.html`、`styles.css`、`app.js`、`assets/` | 原生 HTML/CSS/JavaScript，PC、平板和手机共用响应式页面；Express 将后台内容渲染到首页，再由浏览器增强交互。 |
| 管理后台前端 | `admin.html`、`admin.css`、`admin.js` | 登录、内容编辑、图库上传、管理员和角色权限等界面，由相同 Express 服务提供。 |
| 后端入口 | `server/index.js` | 监听端口、可选原生 HTTPS、进程退出时关闭数据库。 |
| 业务后端 | `server/app.js`、`server/db.js` | API、登录会话、CSRF、权限、内容管理、媒体上传、咨询线索与数据库。 |
| 页面与内容渲染 | `server/home-content.js`、`server/render-products.js`、`server/public-content.js`、`server/content-text.js` | 首页、服务/产品详情、资料页，以及 Canonical、结构化数据、站点地图和 `llms.txt`。 |
| 初始知识库 | `content/knowledge.json`、`server/source-content.js` | 新数据库初始化资料及带标记的一次性资料导入；后台修改后的内容保存在数据库。 |

### 前后端如何连接

- 官网请求同域 `/api/public/*`，后台请求同域 `/api/*`，代码中没有独立的 API 域名配置。
- 所有页面和接口部署在域名根路径，例如 `https://www.example.com/`；当前没有 `/bosye/` 这类子目录部署配置。
- 前端没有单独的构建步骤，没有 `npm run build` 或 `dist/`。`npm ci` 安装后端运行依赖，`npm start` 启动整个项目。
- 不需要另开一个前端服务，也不需要为现有部署配置跨域。只把 HTML 上传到静态空间，会失去登录、内容渲染、上传和表单入库功能。
- Nginx 应代理整个站点到 Express，不要将项目根目录配置成公开静态目录，也不要用 SPA 的 `try_files ... /index.html` 替代后端路由。

### 主要接口

| 路径 | 用途 |
| --- | --- |
| `GET /api/health` | 进程健康检查，正常返回 `{"ok":true}`。它不能替代登录、上传和业务数据验收。 |
| `GET /api/public/site` | 已发布产品、服务、文章、官网设置和品牌资料。 |
| `GET /api/public/stores?q=城市或门店名` | 搜索已发布门店。 |
| `POST /api/public/leads` | 提交官网咨询，写入数据库。 |
| `/api/auth/login`、`/api/auth/me`、`/api/auth/password`、`/api/auth/logout` | 登录、会话、改密和退出。 |
| `/api/admin/*` | 受登录与角色权限保护的后台业务接口。 |

## 2. 部署文件与持久化数据

| 内容 | 是否必须保留 | 说明 |
| --- | --- | --- |
| `package.json`、`package-lock.json`、页面/CSS/JS、`server/`、`content/`、完整 `assets/` | 是 | 运行代码及品牌素材。图片路径可能已被后台数据引用，发布时不能只拷贝部分图片。 |
| `scripts/`、`docs/` | 建议交付 | 本地服务、审核工具和部署示例。正常 `npm start` 不依赖 Python 脚本。 |
| `DATA_DIR/bosye.sqlite` | 迁移现有站点时必须 | 管理员、密码哈希、角色、官网内容、文章、门店、咨询、图库索引、会话和操作日志。 |
| `DATA_DIR/uploads/` | 迁移现有站点时必须 | 后台上传的图片，与数据库配套迁移。 |
| `node_modules/` | 否 | 在目标机器重新运行 `npm ci`。SQLite 驱动含原生模块，不要把 macOS 的依赖目录直接复制到 Linux。 |
| `.local-credentials.txt` | 首次初始化后单独交接 | 保存初始管理员凭据；改密后文件不会自动更新。该文件不属于网站公开内容。 |
| `source-materials/`、`test-results/` | 运行时不需要 | 原始归档和测试产物，可在交接资料中另行保存。 |

**新建空站点**：使用空 `DATA_DIR`，运行一次 `npm run setup`，创建管理员及初始资料。

**迁移现在的官网**：复制数据库备份和 `uploads/`，同时发布完整代码及 `assets/`；跳过 `setup`。只部署代码到空目录不会带上目前后台编辑的文案、用户和门店数据。具体见第 7 节。

## 3. 环境要求与配置

- 推荐 Node.js 22 LTS，项目声明的最低版本为 18.20；历史 Node.js 18 验证记录不作为新服务器的版本建议。
- 使用与 `package-lock.json` 对应的 npm 依赖，生产安装命令为 `npm ci --omit=dev`。
- `better-sqlite3` 需要对应系统/架构的原生模块。预编译包不可用时，Linux 需 Python 3、make 和 C++ 编译器；Debian/Ubuntu 可安装 `python3 make g++`。
- 使用可写的本地持久化磁盘。SQLite 使用 WAL，本部署方案采用单个应用实例，不要开 PM2 cluster 或让多台机器共享一个数据库文件。

| 变量 | 默认值 | 配置说明 |
| --- | --- | --- |
| `NODE_ENV` | 未设置时不启用生产分支 | 本机用 `development`；公网设为 `production`，启用 Secure Cookie、HSTS 等。 |
| `HOST` | `127.0.0.1` | Linux 反向代理部署保持该值；Docker 容器内使用 `0.0.0.0`，镜像已配置。 |
| `PORT` | `4173` | Node.js 监听端口，与代理上游一致。 |
| `DATA_DIR` | 项目根目录 `data/` | 数据库与上传目录；生产建议绝对路径 `/var/lib/bosye`，避免更新代码时覆盖。初始化、启动和备份必须指向同一目录。 |
| `PUBLIC_ORIGIN` | 本地请求使用本地地址；其他请求回退到 `https://www.bosye.com` | 生产显式设为实际 HTTPS 主域名，例如 `https://www.example.com`，仅含协议、域名和可选端口，不含业务路径、参数或片段。 |
| `TRUST_PROXY` | 不信任代理 | 本文单层 Nginx 代理设为 `1`，使 Express 识别原始 HTTPS 和客户端 IP；直接运行时使用 `0`。多层 CDN/代理需另行评估，不能直接套用单层配置。 |
| `ADMIN_USERNAME` | `admin` | 仅首次 `setup` 使用；不会更改已有账号。 |
| `ADMIN_PASSWORD` | 随机生成 | 仅首次 `setup` 可选，长度 12–128 位；建议省略，由程序生成。 |
| `TLS_CERT_FILE`、`TLS_KEY_FILE` | 未设置 | Node 直接提供 HTTPS 时同时填写证书/私钥绝对路径。使用本文 Nginx 方案时留空。 |
| `LOCAL_IPV6` | 不启用额外监听 | `HOST=127.0.0.1` 且设置为 `1` 时另监听 `::1`；macOS 本地服务会自动配置。 |

应用**不会自动读取 `.env`**。项目的 [`.env.example`](../.env.example) 仅供参考；Linux 用 systemd 的 `EnvironmentFile` 注入，Docker 用 `--env-file` 注入，临时启动则由 shell 导出变量。

## 4. 本地开发与查看

```bash
cd /Users/peaklin/items/my/bjbsy
npm ci
# 仅全新、尚未创建管理员的数据库执行：
npm run setup
npm start
```

官网：`http://localhost:4173/`；后台：`http://localhost:4173/admin.html`。

当前 Mac 已配置常驻服务，优先使用下列命令，不要同时运行 `npm start` 抢占同一端口：

```bash
npm run start:local
npm run restart:local
npm run stop:local
```

常驻配置为 `~/Library/LaunchAgents/com.bosye.website.local.plist`，日志在项目 `data/local-service/`。这些命令仅支持 macOS；迁移到新路径后需从新目录运行，生成对应路径的配置。

## 5. Linux 正式部署：systemd + Nginx

以下以 Debian/Ubuntu、服务账号 `bosye` 和单层 Nginx 为例。示例主域名统一为 `www.example.com`，部署前替换为最终域名。Node.js 22、Nginx、域名 DNS 和有效 HTTPS 证书应已准备好。

约定目录：

```text
/srv/bosye/app/             应用源码与依赖
/var/lib/bosye/             SQLite、uploads 等运行数据
/var/backups/bosye/         备份目录
/etc/bosye.env              生产环境变量
/etc/systemd/system/bosye.service
```

### 5.1 交付代码并安装依赖

可从本机项目根目录打包代码，数据通过第 7 节另行迁移：

```bash
cd /Users/peaklin/items/my/bjbsy
tar --exclude='./node_modules' --exclude='./data' --exclude='./.env' \
  --exclude='./.local-credentials.txt' --exclude='./.git' \
  --exclude='./test-results' --exclude='./source-materials' \
  --exclude='.DS_Store' -czf /tmp/bosye-code.tar.gz .
scp /tmp/bosye-code.tar.gz deploy@SERVER:/tmp/
```

`deploy@SERVER` 替换为实际服务器 SSH 用户及地址。在首次部署的服务器上执行；若账号或目录已存在，使用现有配置：

```bash
sudo useradd --system --user-group --home-dir /srv/bosye --shell /usr/sbin/nologin bosye
sudo install -d -o bosye -g bosye -m 755 /srv/bosye /srv/bosye/app
sudo install -d -o bosye -g bosye -m 700 /var/lib/bosye /var/backups/bosye
sudo tar -xzf /tmp/bosye-code.tar.gz -C /srv/bosye/app
sudo chown -R bosye:bosye /srv/bosye/app
cd /srv/bosye/app
sudo -u bosye npm ci --omit=dev
command -v node
```

后面的服务模板使用 `/usr/bin/node`。若最后一条命令返回不同路径，修改模板中的 `ExecStart`；不要使用仅交互式 shell 才能解析的 Node 别名。

### 5.2 设置生产变量

```bash
sudo install -o root -g root -m 600 .env.example /etc/bosye.env
sudoedit /etc/bosye.env
```

将生效配置设为：

```dotenv
NODE_ENV=production
HOST=127.0.0.1
PORT=4173
DATA_DIR=/var/lib/bosye
PUBLIC_ORIGIN=https://www.example.com
TRUST_PROXY=1
```

systemd 会读取该文件。只编辑项目 `.env` 或 `.env.example` 不会改变正在运行的环境；后续修改 `/etc/bosye.env` 后需重启服务。

### 5.3 初始化或迁移数据

**只在全新数据库执行**，随机初始密码写入项目根目录凭据文件：

```bash
cd /srv/bosye/app
sudo -u bosye env DATA_DIR=/var/lib/bosye ADMIN_USERNAME=admin node server/setup.js
```

管理员初始凭据位于 `/srv/bosye/app/.local-credentials.txt`。该文件内地址是固定的本地提示，正式登录请使用实际域名 `/admin.html`。首次登录必须设置新密码。

若迁移现有网站，先按第 7 节将备份恢复到 `/var/lib/bosye`，此处跳过初始化。`setup` 遇到已有管理员会报“管理员已初始化”，它不是重置密码命令。

### 5.4 启动后端及前端页面

使用随项目提供的 [systemd 模板](bosye.service.example)：

```bash
cd /srv/bosye/app
sudo cp docs/bosye.service.example /etc/systemd/system/bosye.service
sudo systemctl daemon-reload
sudo systemctl enable --now bosye
sudo systemctl status bosye --no-pager
curl -fsS http://127.0.0.1:4173/api/health
```

预期健康响应为 `{"ok":true}`。Node 同时服务官网和后台，前端无需额外启动。

常用维护命令：

```bash
sudo systemctl restart bosye
sudo systemctl stop bosye
sudo journalctl -u bosye -n 100 --no-pager
sudo journalctl -u bosye -f
```

### 5.5 Nginx 与 HTTPS

使用 [Nginx 示例](nginx.conf.example)，将其中 `example.com` 全部替换成实际主域名，并填写已签发证书的路径。以 Debian/Ubuntu 的目录约定为例：

```bash
cd /srv/bosye/app
sudo cp docs/nginx.conf.example /etc/nginx/sites-available/bosye.conf
sudoedit /etc/nginx/sites-available/bosye.conf
sudo ln -s /etc/nginx/sites-available/bosye.conf /etc/nginx/sites-enabled/bosye.conf
sudo nginx -t
sudo systemctl reload nginx
```

证书文件必须存在后才能通过 `nginx -t`。签发与续期按证书供应方或现有 Certbot 流程完成；示例不包含证书自动申请配置。已有同名符号链接时无需重复创建。使用其他 Linux 发行版时按其 Nginx 配置目录调整。

配置要点：

- `proxy_pass http://127.0.0.1:4173;` 覆盖整个站点，包括 `/api/`、`/assets/` 和 `/uploads/`。
- 保留 `Host`；用 `$scheme` 设置 `X-Forwarded-Proto`；单层代理用 `$remote_addr` 覆盖 `X-Forwarded-For`，与 `TRUST_PROXY=1` 配套。
- 示例 `client_max_body_size 6m` 为表单封装留余量，应用限制单张图片不超过 5 MB，仅接受 JPG、PNG、WEBP。
- HTTP 重定向到 HTTPS。生产模式登录依赖 Secure Cookie，应通过正式 HTTPS 域名使用后台。
- 公网仅需开放 Web 的 80/443；Node 的 4173 端口保持回环监听。SSH 按服务器现有管理规则配置。
- 如果同时使用裸域名和 `www`，选定一个主域名，其他入口重定向到主域名，证书覆盖相应入口；`PUBLIC_ORIGIN` 与主域名一致。
- 动态首页、后台和 `/api/` 不应配置共享页面缓存，否则后台更新可能无法及时显示，登录响应也不能被缓存。

## 6. Docker 部署（替代 systemd）

已有 [Dockerfile](../Dockerfile)，使用 Node.js 22，在镜像内安装生产依赖，并以 `node` 用户运行。此方案与第 5 节二选一，勿同时绑定宿主机 4173。当前环境尚未进行 Docker 镜像构建和公网联调，以下步骤为按现有配置核对的部署示例。

```bash
cd /path/to/bjbsy
docker build -t bosye-website:1.0.0 .
docker volume create bosye-data
```

准备仅供此容器使用的 `bosye.docker.env`，例如放在项目外 `/etc/bosye.docker.env`，并限制文件权限：

```dotenv
NODE_ENV=production
HOST=0.0.0.0
PORT=4173
DATA_DIR=/app/data
PUBLIC_ORIGIN=https://www.example.com
TRUST_PROXY=1
```

`HOST=0.0.0.0` 是容器内部监听；下面的端口映射只向宿主机回环地址开放。

### 6.1 仅空数据卷：初始化管理员

初始化容器先保留，复制凭据后再删除。不要在复制凭据前使用 `--rm`：

```bash
docker create --name bosye-init --env-file /etc/bosye.docker.env \
  --mount source=bosye-data,target=/app/data \
  bosye-website:1.0.0 npm run setup
docker start --attach bosye-init
docker cp bosye-init:/app/.local-credentials.txt ./bosye-initial-credentials.txt
chmod 600 ./bosye-initial-credentials.txt
docker rm bosye-init
```

### 6.2 迁移现有内容：导入备份

已有备份时跳过账号初始化。以下命令仅用于新建且尚未启动应用的目标数据卷；已有运行数据应先备份并使用新的目标卷，不要把备份直接混入运行中的卷。将 `source=` 后的备份路径替换为第 7 节生成的实际目录：

```bash
docker run --rm -i --user root \
  --mount source=bosye-data,target=/app/data \
  --mount type=bind,source=/absolute/path/to/bosye-backup-20261021,target=/restore,readonly \
  bosye-website:1.0.0 sh <<'SH'
set -eu
cp /restore/bosye.sqlite /app/data/bosye.sqlite
if [ -d /restore/uploads ]; then
  cp -R /restore/uploads /app/data/uploads
fi
chown -R node:node /app/data
chmod 600 /app/data/bosye.sqlite
SH
```

此步骤保留原管理员和官网内容，不执行 `setup`。宿主机的 `/var/lib/bosye` 不会自动进入 Docker 命名卷，需显式导入备份。

### 6.3 启动服务

```bash
docker run -d --name bosye-web --restart unless-stopped \
  --env-file /etc/bosye.docker.env \
  -p 127.0.0.1:4173:4173 \
  --mount source=bosye-data,target=/app/data \
  bosye-website:1.0.0
docker logs --tail 100 bosye-web
curl -fsS http://127.0.0.1:4173/api/health
```

宿主机的 Nginx 仍按第 5.5 节代理到 `127.0.0.1:4173`。修改环境变量或发布新镜像后需要重建运行容器，单纯 `docker restart` 不会读取更新后的 env 文件。复用数据卷以保留网站内容。

容器内备份示例：

```bash
docker exec bosye-web node server/backup.js /app/data/backups/before-release
docker cp bosye-web:/app/data/backups/before-release ./bosye-backup-before-release
```

每次使用新的备份目录名，并将备份保存到运行卷之外。不要删除承载业务数据的卷。Dockerfile 只打包运行文件，浏览器测试与 AI 检测在包含开发依赖及工具的源码环境运行。

## 7. 现有官网迁移、备份与恢复

### 7.1 从当前本机交付现有内容

在项目根目录执行备份。备份脚本使用 SQLite 在线备份 API 导出一致数据库，再复制上传图片。备份期间暂停后台编辑、上传和相关写入；若要求数据库与图片在同一时点完全对应，安排维护窗口停止应用后再备份。

```bash
cd /Users/peaklin/items/my/bjbsy
npm run backup -- /absolute/path/to/bosye-backup-20261021
```

上面的绝对路径须替换为实际交接目录，不能放到公开网站目录下。目录内容为：

```text
bosye-backup-20261021/
  bosye.sqlite
  uploads/          源站存在上传目录时一并复制
```

将该备份通过 SSH 等现有运维通道传至目标服务器，例如 `/tmp/bosye-backup-20261021/`。代码及 `assets/` 使用第 5.1 节的发布包另行传输；备份脚本不包含代码、品牌素材、环境配置及证书。

备份包含账号哈希、会话和咨询记录，应按业务数据交接。迁移后管理员沿用原账号和原密码；初始密码文件不能替代已修改的密码。

### 7.2 Linux 恢复或导入

对于已运行的站点先停止服务，并保存当前数据目录。首次迁移、尚未创建 systemd 服务时，跳过停止命令：

```bash
sudo systemctl stop bosye
sudo mv /var/lib/bosye /var/lib/bosye.before-restore-20261021
sudo install -d -o bosye -g bosye -m 700 /var/lib/bosye
sudo cp /tmp/bosye-backup-20261021/bosye.sqlite /var/lib/bosye/bosye.sqlite
# 备份中存在 uploads/ 时执行：
sudo cp -R /tmp/bosye-backup-20261021/uploads /var/lib/bosye/uploads
sudo chown -R bosye:bosye /var/lib/bosye
sudo chmod 600 /var/lib/bosye/bosye.sqlite
# 若正在首次部署，继续第 5.4 节；已有服务则启动：
sudo systemctl start bosye
```

替换日期和目录名，确保留存目录名未被使用。恢复到全新目录，不要将旧的 `bosye.sqlite-wal`、`bosye.sqlite-shm` 与备份数据库混在一起。不要在应用运行时仅复制正在使用的主数据库文件来代替备份。

### 7.3 生产备份

生产环境始终显式使用与服务相同的 `DATA_DIR`：

```bash
cd /srv/bosye/app
sudo -u bosye env DATA_DIR=/var/lib/bosye node server/backup.js \
  /var/backups/bosye/before-release-20261021
```

可按运营频率用系统定时任务执行，并使用每次唯一的目录名。保留至少一份服务器外的备份，定期在隔离环境验证恢复。未指定目录时，默认输出到 `DATA_DIR/backups/<UTC 时间>/`。

## 8. 更新发布与回滚

1. 在开发或预发布环境运行适当测试，生成代码发布包；按第 7 节备份当前数据库和图片，并保留旧版代码、`assets/`、环境配置。
2. Linux 运行 `sudo systemctl stop bosye`，将新代码发布到 `/srv/bosye/app`。数据位于独立 `/var/lib/bosye`，发布时不要覆盖。若采用新发布目录，需一并调整 systemd 的 `WorkingDirectory` 和 `ExecStart`。
3. 在新代码目录重新运行 `sudo -u bosye npm ci --omit=dev`，检查运行账号能读取代码、写入 `DATA_DIR`。现有账号不需再次 `setup`。
4. 修改了服务文件时先执行 `sudo systemctl daemon-reload`，再 `sudo systemctl start bosye`；只改代码或环境文件时直接启动/重启服务。按第 9 节验收。
5. 失败时停止服务，恢复旧代码与对应依赖。新版本启动会执行数据库初始化/一次性资料迁移逻辑；若数据已变更，评估是否需要使用发布前成套备份恢复，恢复会丢弃备份之后的新增数据。

仅在后台编辑文案、上传图片、发布门店或文章时，通常无需重启服务，保存后刷新官网即可。修改源码中的 HTML/CSS/JS 或服务端逻辑，发布后建议重启，并清理代理中人为配置的旧缓存。

## 9. 部署验收

将下列域名替换为真实 HTTPS 主域名：

```bash
curl -fsS https://www.example.com/api/health
curl -I http://www.example.com/
curl -I https://www.example.com/admin.html
curl -fsS https://www.example.com/sitemap.xml
curl -fsS https://www.example.com/llms.txt
```

人工确认：

- 官网桌面和手机均可访问，服务与产品图正常显示，合作伙伴尾行铺满。
- 后台能登录、首次改密（仅新账号），保存一处内容后官网同步显示；迁移站点的原内容、用户及角色存在。
- 用明确标记的验收数据测试咨询提交、后台查看和跟进；在预发布环境优先测试，正式站点的验收记录按运营流程处理。
- 图库能选择已有素材、上传符合限制的图片并保存展示；只读或其他角色按配置限制操作。
- HTTP 跳转到 HTTPS；页面 Canonical、站点地图、结构化数据使用真实主域名。
- 未登录访问 `/api/admin/dashboard` 返回 `401`；`/data/bosye.sqlite`、`/.local-credentials.txt` 和 `/source-materials/` 等私有路径返回 `404`。

在安装开发依赖的源码环境可运行现有检查；测试使用临时数据库，不会修改当前业务数据库：

```bash
npm ci
npm test
npx playwright install chromium
npm run test:browser
npm run test:a11y
npm run test:design
npm run test:media
npm run test:content
npm run test:readiness-pages
```

Linux 执行浏览器检查还需 Playwright 对应系统库，可按环境使用 `npx playwright install --with-deps chromium`。生产运行本身不需要 Chromium。

AI 信源评分还依赖独立的 `ai-agent-ready` 检测项目，未随官网运行文件打包。将检测项目部署在验证机器上并安装其依赖，再显式指定位置；不要照搬开发者 Mac 路径：

```bash
READINESS_EVALUATOR_DIR=/absolute/path/to/ai-agent-ready \
  node scripts/audit-readiness.mjs https://www.example.com/ test-results/ai-readiness-public.json
```

历史本地 100/100 记录不代表尚未上线的域名已经通过检测。公网发布后需重新验证实际页面和证书，详见 [AI 检测说明](ai-readiness.md)。

## 10. 常见问题

| 现象 | 优先检查 |
| --- | --- |
| `502 Bad Gateway` | `systemctl status bosye` / `docker logs`、`/api/health`、Nginx 上游端口、Node 路径与数据目录权限。 |
| `EADDRINUSE` | 4173 是否已有 `npm start`、macOS 常驻服务、systemd 或 Docker 实例；同一端口保留一个服务。 |
| 登录后立即回到登录页 | 生产环境是否使用 HTTPS；Nginx 是否保留 Host 并正确传递协议；是否存在缓存或被浏览器拦截的 Cookie。 |
| “不允许跨站提交” | 页面与 API 是否同协议、同域名、同端口；`TRUST_PROXY=1` 与单层代理请求头是否匹配。 |
| “请求验证失败” | 刷新后重新登录，以取得与当前会话匹配的 CSRF Token；避免缓存后台或接口。 |
| “账号或密码不正确” | 确认服务实际使用的 `DATA_DIR`；初始化文件只保存初始密码。改密后的明文不可反查，有权限的其他管理员可通过后台重置该账号。唯一管理员遗失密码时需由服务器维护人员单独恢复，不要重新初始化或删除数据库。 |
| “请先修改初始密码” | 首次登录按页面完成改密后再操作；密码至少 12 位。 |
| 上传 `413` 或失败 | Nginx 请求大小限制、应用单图 5 MB 限制及 JPG/PNG/WEBP 格式；运行账号对 `DATA_DIR/uploads` 的写权限。 |
| 官网变成初始资料、原账号消失 | 先检查是否误用了空 `DATA_DIR`；将现有备份恢复到服务实际目录，不要继续初始化账号。 |
| 文案已保存但公开页面没更新 | 产品/门店/文章是否已发布、是否编辑了正确模块、代理是否缓存 HTML、Node 是否使用预期数据库。 |
| 素材 `404` | 是否发布了完整 `assets/`，是否迁移了 `uploads/`；数据库中的相对路径是否与实际文件对应。 |
| `better-sqlite3` 安装或加载失败 | Node 版本/ABI、CPU 架构、编译工具及目录权限；删除的是目标机器依赖目录时再按锁文件重新安装，不要复制别的系统的 `node_modules`。 |
| 修改 `.env` 没生效 | 应用不自动读取该文件；确认 systemd `EnvironmentFile` 或 Docker `--env-file` 的实际路径，按部署方式重启服务或重建容器。 |

## 11. 本次验证范围

2026 年 10 月 21 日，在 macOS / Node.js 18.20.8 的临时项目副本中完成以下核对，业务目录与真实管理员未参与测试：

- 按锁文件执行 `npm ci --omit=dev`，初始化空数据目录，通过 `server/index.js` 启动服务。
- 使用生产变量并模拟单层代理请求头，验证官网、后台、API、主域名 Canonical、Secure Cookie、首次改密及私有路径隔离。
- 验证内容保存和图片上传，再执行备份；恢复到新的 `DATA_DIR` 后，账号、已保存文案和上传图片可继续使用。
- 检查本文与 README 中 26 个 shell 示例的语法、文档相对链接、环境变量清单与服务模板路径。

Linux 的 systemd/Nginx 启动、Docker 镜像构建及公网证书/域名联调需在目标服务器验收。本文补充不包含公网发布或旧官网替换。
