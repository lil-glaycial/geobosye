const Database = require("better-sqlite3");
const {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  randomUUID,
} = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const permissions = {
  "dashboard.read": "查看仪表盘",
  "leads.read": "查看咨询线索",
  "leads.write": "跟进咨询线索",
  "leads.export": "导出咨询线索",
  "stores.read": "查看门店",
  "stores.write": "维护门店",
  "services.read": "查看服务项目",
  "services.write": "维护服务项目",
  "products.read": "查看产品系列",
  "products.write": "维护产品系列",
  "articles.read": "查看文章",
  "articles.write": "维护文章",
  "media.read": "查看媒体",
  "media.write": "上传媒体",
  "site.read": "查看官网内容与设置",
  "site.write": "修改官网内容与设置",
  "users.read": "查看管理员",
  "users.write": "维护管理员",
  "roles.read": "查看角色",
  "roles.write": "维护角色权限",
  "audit.read": "查看操作日志",
};
function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}
function verifyPassword(password, hash) {
  try {
    const [salt, key] = hash.split(":");
    const digest = scryptSync(password, salt, 64);
    return timingSafeEqual(digest, Buffer.from(key, "hex"));
  } catch {
    return false;
  }
}
function openDatabase(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const db = new Database(path.join(dataDir, "bosye.sqlite"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.exec(`
    CREATE TABLE IF NOT EXISTS roles (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, permissions TEXT NOT NULL, protected INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE, name TEXT NOT NULL, password_hash TEXT NOT NULL, role_id TEXT NOT NULL REFERENCES roles(id), active INTEGER NOT NULL DEFAULT 1, must_change INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, csrf TEXT NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS leads (id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT NOT NULL, type TEXT NOT NULL, message TEXT NOT NULL DEFAULT '', source TEXT NOT NULL, status TEXT NOT NULL DEFAULT '待跟进', owner_id TEXT REFERENCES users(id), note TEXT NOT NULL DEFAULT '', consent_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY, type TEXT NOT NULL, data TEXT NOT NULL, published INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS media (id TEXT PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL UNIQUE, size INTEGER NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, actor TEXT NOT NULL, action TEXT NOT NULL, target TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS leads_date ON leads(created_at);
    CREATE INDEX IF NOT EXISTS items_type ON items(type,published);
    CREATE INDEX IF NOT EXISTS session_expiry ON sessions(expires);
  `);
  fs.chmodSync(path.join(dataDir, "bosye.sqlite"), 0o600);
  if (!db.prepare("SELECT 1 FROM roles LIMIT 1").get()) {
    const insert = db.prepare("INSERT INTO roles VALUES (?,?,?,?)");
    insert.run(
      "owner",
      "超级管理员",
      JSON.stringify(Object.keys(permissions)),
      1,
    );
    insert.run(
      "operations",
      "运营管理",
      JSON.stringify(
        Object.keys(permissions).filter((p) =>
          /^(dashboard|leads|stores|services|products|articles|media)\./.test(
            p,
          ),
        ),
      ),
      0,
    );
    insert.run(
      "editor",
      "内容编辑",
      JSON.stringify([
        "dashboard.read",
        "services.read",
        "services.write",
        "products.read",
        "products.write",
        "articles.read",
        "articles.write",
        "media.read",
        "media.write",
        "site.read",
      ]),
      0,
    );
    insert.run(
      "viewer",
      "只读查看",
      JSON.stringify([
        "dashboard.read",
        "stores.read",
        "services.read",
        "products.read",
        "articles.read",
      ]),
      0,
    );
  }
  if (!db.prepare("SELECT 1 FROM settings WHERE key=?").get("site")) {
    const site = {
      heroTitle: "科学养护",
      heroAccent: "全周期毛发健康管理",
      heroDescription:
        "30 余年毛发研究积累，连接专业门店护理与日常居家养护。博士园，以养、防、植、健一体的毛发健康服务，陪伴每一份对美好生活的期待。",
      phone: "400-618-9558",
      address: "北京市朝阳区后现代城 5 号楼 C 座 2 层",
      brandIntro:
        "博士园由留日归国医学博士王朝刚于 2000 年发起创立，集毛发健康产品研发、生产、销售与连锁服务于一体。围绕“养防植健”布局业务，将门店护理、居家养护与医疗机构的植发相关服务连接，回应脱发、白发、头皮调理及发丝护理等不同需求。",
      icp: "京ICP备10216282号-12",
      police: "京公网安备 11010502039889号",
      seoTitle: "博士园｜科学毛发健康管理",
      seoDescription:
        "博士园——专注脱发白发的科研型毛发健康管理连锁品牌，提供头皮调理、脱发养护、白发养护、头油头屑等护理服务及植发植眉等毛发移植服务。",
    };
    db.prepare("INSERT INTO settings VALUES (?,?)").run(
      "site",
      JSON.stringify(site),
    );
    const services = [
      [
        "头皮调理",
        "SCALP CARE",
        "清洁 · 舒缓 · 水油平衡",
        "围绕头皮清洁、补水与油脂平衡，结合实际头皮状态提供护理服务。门店检测、沟通需求、制定养护安排，并持续评估体验。",
        "assets/brand-service-scalp-care.webp",
      ],
      [
        "脱发养护",
        "HAIR CARE",
        "强韧 · 滋养 · 防治结合",
        "针对多种脱发情况，从日常洗护习惯与头皮状态出发，搭配康发露、丝韧营养露、头皮强韧精华液等产品。护理方案由门店沟通确认；持续或突发脱发建议及时就医。进行合理预防与分阶段防脱养护。",
        "assets/brand-service-hair-loss.webp",
      ],
      [
        "白发养护",
        "GREY HAIR CARE",
        "防白 · 修护 · 长期管理",
        "以黑秀精华露等养护系列配合日常护理，针对性补充营养，呵护色素组织，调理毛发生长微环境，改善白发状况，关注头皮与发丝状态，分阶段沟通养护预期。产品使用以说明书及实际适用情况为准。",
        "assets/brand-service-grey-hair.webp",
      ],
      [
        "发干滋养",
        "HAIR NOURISHMENT",
        "柔顺 · 保湿 · 发丝修护",
        "围绕发丝干燥、毛躁等日常需求，修护受损毛发、改善头发干枯毛糙、发黄分叉、细软易断等毛发问题。提供发膜及护发精油护理，帮助建立适合自己的洗护习惯。",
        "assets/brand-service-scientific-care.webp",
      ],
      [
        "植发健发",
        "POST-TRANSPLANT CARE",
        "专业协同 · 养护跟进",
        "提供植发相关日常养护咨询，医疗植发业务由具备资质的医疗机构承接。生活美容门店不开展医疗诊疗或手术。改善毛囊生长环境，持续提供营养，帮助休眠毛囊焕发生机。通过植发与术后健发，及时及早修补局部毛发分布缺陷，维护形象，持久、自然美观。",
        "assets/brand-service-transplant-care.webp",
      ],
      [
        "居家养护",
        "HOME ROUTINE",
        "洗护 · 精华 · 每日养护",
        "将门店护理延续到家，按头皮与发质需求搭配洗发露、护发产品和精华。避免过度清洁，按产品说明使用。与在店毛发保健相得益彰，维护秀发健康强韧，强化养发效果。",
        "assets/brand-service-home-care.webp",
      ],
    ];
    const insert = db.prepare("INSERT INTO items VALUES (?,?,?,?,?,?)");
    const now = new Date().toISOString();
    services.forEach((s, i) =>
      insert.run(
        randomUUID(),
        "services",
        JSON.stringify({
          name: s[0],
          english: s[1],
          summary: s[2],
          body: s[3],
          image: s[4],
          sort: i,
        }),
        1,
        now,
        now,
      ),
    );
  }
  require("./source-content").installSourceContent(db, permissions);
  return db;
}
function setupAdmin(
  db,
  username,
  password,
  name = "网站管理员",
  mustChange = true,
) {
  if (db.prepare("SELECT COUNT(*) n FROM users").get().n)
    throw new Error("管理员已初始化，未覆盖现有账号");
  db.prepare("INSERT INTO users VALUES (?,?,?,?,?,1,?,?)").run(
    randomUUID(),
    username,
    name,
    hashPassword(password),
    "owner",
    mustChange ? 1 : 0,
    new Date().toISOString(),
  );
}
module.exports = {
  openDatabase,
  setupAdmin,
  hashPassword,
  verifyPassword,
  permissions,
};
