const express = require("express");
const helmet = require("helmet");
const { rateLimit } = require("express-rate-limit");
const multer = require("multer");
const { z } = require("zod");
const path = require("node:path");
const fs = require("node:fs");
const knowledge = require("../content/knowledge.json");
const { renderProducts } = require("./render-products");
const { homeFields, renderHome } = require("./home-content");
const { htmlToText } = require("./content-text");
const { parseDelimited, toCsv } = require("./csv-import");
const {
  registerPublicContent,
  homepageContent,
  originFor,
  allPages,
  fixedPages,
} = require("./public-content");
const { randomBytes, randomUUID, createHash } = require("node:crypto");
const {
  openDatabase,
  hashPassword,
  verifyPassword,
  permissions,
} = require("./db");
const root = path.resolve(__dirname, "..");
const str = (min, max) => z.string().trim().min(min).max(max);
const phone = str(7, 30).regex(/^[+\d\s()-]+$/, "请输入有效电话号码");
const password = z.string().min(12, "密码至少 12 位").max(128);
const imagePath = z
  .string()
  .max(250)
  .refine(
    (s) => !s || /^(assets|uploads)\/[a-zA-Z0-9_.-]+$/.test(s),
    "请选择本站媒体图片",
  );

const wechatSourceUrl = z
  .string()
  .url()
  .max(500)
  .refine(
    (s) => /^https:\/\/mp\.weixin\.qq\.com\/s\//.test(s),
    "请输入微信公众号原文链接",
  );
const types = [
  "头皮护理与养护",
  "门店服务预约",
  "合作加盟咨询",
  "品牌与产品咨询",
];
const leadInput = z
  .object({
    name: str(1, 40),
    phone,
    type: z.enum(types),
    message: str(0, 2000).default(""),
  })
  .strict();
const schemas = {
  news: z
    .object({
      title: str(2, 150),
      summary: str(1, 240),
      body: str(1, 30000),
      publishedDate: z.string().date(),
      image: imagePath,
      sort: z.number().int().min(0).max(9999),
      account: str(1, 80).optional(),
      publishedAt: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
        .optional(),
      imageCount: z.number().int().min(0).max(999).optional(),
      sourceUrl: wechatSourceUrl.optional(),
    })
    .strict(),
  stores: z
    .object({
      name: str(2, 100),
      city: str(1, 40),
      address: str(3, 200),
      phone,
      hours: str(0, 100),
      image: imagePath,
      sort: z.number().int().min(0).max(9999),
    })
    .strict(),
  services: z
    .object({
      name: str(2, 60),
      english: str(0, 80),
      summary: str(1, 140),
      body: str(1, 10000),
      image: imagePath,
      sort: z.number().int().min(0).max(9999),
    })
    .strict(),
  products: z
    .object({
      name: str(2, 60),
      english: str(0, 80),
      summary: str(1, 140),
      body: str(1, 10000),
      range: str(0, 100),
      image: imagePath,
      sort: z.number().int().min(0).max(9999),
    })
    .strict(),
  articles: z
    .object({
      title: str(2, 150),
      category: z.enum(["品牌动态", "毛发知识", "合作资讯"]),
      summary: str(1, 240),
      body: str(1, 30000),
      image: imagePath,
      sort: z.number().int().min(0).max(9999),
    })
    .strict(),
};
const siteSchema = z
  .object({
    heroTitle: str(1, 40),
    heroAccent: str(1, 40),
    heroDescription: str(1, 400),
    phone,
    address: str(1, 200),
    brandIntro: str(1, 2000),
    icp: str(0, 70),
    police: str(0, 70),
    seoTitle: str(1, 100),
    seoDescription: str(1, 300),
  })
  .strict();
const contentBrandSchema = z
  .object({
    name: str(1, 80),
    established: str(1, 20),
    mission: str(1, 300),
    values: str(1, 500),
    description: str(1, 2000),
    founder: str(1, 80),
    founderRole: str(1, 120),
    founderBody: str(1, 3000),
    founderResearch: str(1, 5000),
    researchYears: str(1, 30),
    stores: str(1, 30),
    series: str(1, 30),
    offices: str(1, 30),
  })
  .strict();
const contentTimelineSchema = z
  .object({ year: str(1, 20), title: str(1, 120), text: str(1, 500) })
  .strict();
const contentResearchSchema = z
  .object({ name: str(1, 120), text: str(1, 1200) })
  .strict();
const contentResearchNumberSchema = z
  .object({ number: str(1, 40), label: str(1, 100) })
  .strict();
const contentQualificationSchema = z
  .object({ name: str(1, 160), entity: str(1, 240), detail: str(1, 800) })
  .strict();
const contentPatentSchema = z
  .object({ name: str(1, 200), number: str(1, 80) })
  .strict();
const contentPriceSchema = z
  .object({ name: str(1, 120), price: str(1, 100), duration: str(1, 100) })
  .strict();
const contentSupportSchema = z
  .object({ name: str(1, 120), text: str(1, 800) })
  .strict();
const contentShopModelSchema = z
  .object({
    name: str(1, 80),
    size: str(1, 80),
    investment: str(1, 40),
    products: str(1, 160),
    equipment: str(1, 160),
  })
  .strict();
const contentPartnerSchema = z
  .object({
    name: str(1, 80),
    city: str(1, 100),
    joined: str(1, 20),
    metric: str(1, 40),
    unit: str(1, 80),
    text: str(1, 600),
  })
  .strict();
const contentGallerySchema = z
  .object({
    image: imagePath.refine((s) => !!s, "请选择展示图片"),
    title: str(1, 120),
    caption: str(1, 240),
  })
  .strict();
const contentLearningSchema = z
  .object({ name: str(1, 120), text: str(1, 600) })
  .strict();
const contentSchema = z
  .object({
    version: str(1, 30).optional(),
    source: z.string().max(500).optional(),
    products: z.unknown().optional(),
    home: z.unknown().optional(),
    pages: z.unknown().optional(),
    brand: contentBrandSchema,
    timeline: z.array(contentTimelineSchema).max(30),
    research: z.array(contentResearchSchema).max(12),
    researchNumbers: z.array(contentResearchNumberSchema).max(12),
    qualifications: z.array(contentQualificationSchema).max(30),
    honors: z.array(str(1, 240)).max(60),
    patents: z.array(contentPatentSchema).max(30),
    servicePrices: z.array(contentPriceSchema).max(30),
    priceNote: str(1, 1000),
    support: z.array(contentSupportSchema).max(20),
    shopModels: z.array(contentShopModelSchema).max(12),
    investmentNote: str(1, 1600),
    partners: z.array(contentPartnerSchema).max(30),
    gallery: z.array(contentGallerySchema).max(30),
    learning: z.array(contentLearningSchema).max(20),
  })
  .strict();
const homeFieldSchema = z
  .object({
    key: str(1, 80),
    selector: str(0, 500).optional(),
    type: z.enum(["text", "image", "alt", "placeholder", "collection"]),
    label: str(1, 240),
    value: z.union([
      str(0, 20000),
      z.array(z.record(z.string().max(200))).max(30),
    ]),
    group: str(1, 80),
    max: z.number().int().min(1).max(3000).optional(),
  })
  .strict();
const pageContentSchema = z
  .object({
    pages: z
      .array(
        z
          .object({
            path: str(1, 200),
            title: str(1, 160),
            accent: str(0, 200).optional(),
            hubCopy: z.record(str(0, 800)).optional(),
            description: str(1, 400),
            body: str(0, 60000),
            enabled: z.boolean(),
          })
          .strict(),
      )
      .max(30),
  })
  .strict();
const publicItem = (r) => ({
  id: r.id,
  ...JSON.parse(r.data),
  published: !!r.published,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});
const hashToken = (token) => createHash("sha256").update(token).digest("hex");
const fail = (status, message) => Object.assign(new Error(message), { status });
function createApp(options = {}) {
  const dataDir = path.resolve(
    options.dataDir || process.env.DATA_DIR || path.join(root, "data"),
  );
  const db = openDatabase(dataDir);
  const uploads = path.join(dataDir, "uploads");
  fs.mkdirSync(uploads, { recursive: true });
  const app = express();
  app.disable("x-powered-by");
  if (process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          fontSrc: ["'self'"],
          imgSrc: ["'self'", "data:"],
          connectSrc: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests:
            process.env.NODE_ENV === "production" ? [] : null,
        },
      },
      hsts: process.env.NODE_ENV === "production",
    }),
  );
  app.use("/api", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.use(express.json({ limit: "2mb" }));
  const limiter = (windowMs, limit) =>
    rateLimit({
      windowMs,
      limit,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      message: { error: "请求过于频繁，请稍后重试" },
    });
  app.use("/api", limiter(60000, 300));
  const now = () => new Date().toISOString();
  const audit = (req, action, target) =>
    db
      .prepare(
        "INSERT INTO audit(user_id,actor,action,target,created_at) VALUES(?,?,?,?,?)",
      )
      .run(
        req.user?.id || null,
        req.user?.name || "系统",
        action,
        String(target),
        now(),
      );
  function getUser(id) {
    const u = db
      .prepare(
        "SELECT u.*,r.name role_name,r.permissions FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=?",
      )
      .get(id);
    return u;
  }
  const safeUser = (u) => ({
    id: u.id,
    username: u.username,
    name: u.name,
    roleId: u.role_id,
    roleName: u.role_name,
    active: !!u.active,
    mustChangePassword: !!u.must_change,
    permissions: JSON.parse(u.permissions),
    createdAt: u.created_at,
  });
  function auth(req, res, next) {
    const token = req.headers.cookie
      ?.split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("bosye_session="))
      ?.slice(14);
    if (!token) return res.status(401).json({ error: "请先登录管理后台" });
    const session = db
      .prepare("SELECT * FROM sessions WHERE token=? AND expires>?")
      .get(hashToken(token), Date.now());
    if (!session)
      return res.status(401).json({ error: "登录已过期，请重新登录" });
    const user = getUser(session.user_id);
    if (!user?.active) return res.status(401).json({ error: "账号已停用" });
    req.user = safeUser(user);
    req.session = session;
    if (req.method !== "GET" && req.headers["x-csrf-token"] !== session.csrf)
      return res.status(403).json({ error: "请求验证失败，请刷新后重试" });
    if (
      user.must_change &&
      !["/api/auth/me", "/api/auth/password", "/api/auth/logout"].includes(
        req.path,
      )
    )
      return res.status(403).json({ error: "请先修改初始密码" });
    next();
  }
  function allow(permission) {
    return (req, res, next) => {
      if (!req.user.permissions.includes(permission))
        return res.status(403).json({ error: "当前角色没有该操作权限" });
      next();
    };
  }
  function originCheck(req, res, next) {
    const origin = req.get("origin");
    if (origin && origin !== `${req.protocol}://${req.get("host")}`)
      return res.status(403).json({ error: "不允许跨站提交" });
    if (req.get("sec-fetch-site") === "cross-site")
      return res.status(403).json({ error: "不允许跨站提交" });
    next();
  }
  app.use("/api", originCheck);
  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.get("/api/public/site", (_req, res) => {
    const site = JSON.parse(
      db.prepare("SELECT data FROM settings WHERE key=?").get("site").data,
    );
    const services = db
      .prepare("SELECT * FROM items WHERE type='services' AND published=1")
      .all()
      .map(publicItem)
      .sort((a, b) => a.sort - b.sort);
    const articles = db
      .prepare(
        "SELECT * FROM items WHERE type='articles' AND published=1 ORDER BY updated_at DESC",
      )
      .all()
      .map(publicItem);
    const products = db
      .prepare("SELECT * FROM items WHERE type='products' AND published=1")
      .all()
      .map(publicItem)
      .sort((a, b) => a.sort - b.sort);
    const contentRow = db
      .prepare("SELECT data FROM settings WHERE key=?")
      .get("knowledge");
    const publicKnowledge = contentRow
      ? JSON.parse(contentRow.data)
      : knowledge;
    res.json({
      site,
      services,
      articles,
      products,
      knowledge: { ...publicKnowledge, products },
    });
  });
  app.get("/api/public/stores", (req, res) => {
    const q = String(req.query.q || "")
      .slice(0, 80)
      .toLowerCase();
    const stores = db
      .prepare("SELECT * FROM items WHERE type='stores' AND published=1")
      .all()
      .map(publicItem)
      .filter(
        (s) => !q || `${s.name}${s.city}${s.address}`.toLowerCase().includes(q),
      )
      .sort((a, b) => a.sort - b.sort);
    res.json({ items: stores });
  });
  app.post("/api/public/leads", limiter(15 * 60000, 5), (req, res, next) => {
    try {
      const { consent, website, ...rest } = z
        .object({
          ...leadInput.shape,
          consent: z.literal(true),
          website: z.string().max(0).optional(),
        })
        .strict()
        .parse(req.body);
      const data = leadInput.parse(rest);
      const id = randomUUID(),
        time = now();
      db.prepare(
        "INSERT INTO leads(id,name,phone,type,message,source,consent_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)",
      ).run(
        id,
        data.name,
        data.phone,
        data.type,
        data.message,
        "官网表单",
        time,
        time,
        time,
      );
      res.status(201).json({ ok: true, id });
    } catch (e) {
      next(e);
    }
  });
  app.post("/api/auth/login", limiter(15 * 60000, 15), (req, res, next) => {
    try {
      const input = z
        .object({ username: str(1, 60), password: z.string().min(1).max(128) })
        .strict()
        .parse(req.body);
      const raw = db
        .prepare("SELECT * FROM users WHERE username=?")
        .get(input.username);
      if (!raw?.active || !verifyPassword(input.password, raw.password_hash))
        throw fail(401, "账号或密码不正确");
      const token = randomBytes(32).toString("hex"),
        csrf = randomBytes(24).toString("hex");
      db.prepare("DELETE FROM sessions WHERE expires<=?").run(Date.now());
      db.prepare("INSERT INTO sessions VALUES(?,?,?,?)").run(
        hashToken(token),
        raw.id,
        csrf,
        Date.now() + 8 * 3600000,
      );
      res.cookie("bosye_session", token, {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        maxAge: 8 * 3600000,
        path: "/",
      });
      req.user = safeUser(getUser(raw.id));
      audit(req, "登录后台", raw.id);
      res.json({ user: req.user, csrf });
    } catch (e) {
      next(e);
    }
  });
  app.get("/api/auth/me", auth, (req, res) =>
    res.json({ user: req.user, csrf: req.session.csrf }),
  );
  app.post("/api/auth/logout", auth, (req, res) => {
    db.prepare("DELETE FROM sessions WHERE token=?").run(req.session.token);
    res.clearCookie("bosye_session", { path: "/" });
    res.json({ ok: true });
  });
  app.post("/api/auth/password", auth, (req, res, next) => {
    try {
      const data = z
        .object({ current: z.string().max(128), password })
        .strict()
        .parse(req.body);
      const u = db.prepare("SELECT * FROM users WHERE id=?").get(req.user.id);
      if (!verifyPassword(data.current, u.password_hash))
        throw fail(400, "当前密码不正确");
      if (data.current === data.password)
        throw fail(400, "新密码不能与当前密码相同");
      db.transaction(() => {
        db.prepare(
          "UPDATE users SET password_hash=?,must_change=0 WHERE id=?",
        ).run(hashPassword(data.password), u.id);
        db.prepare("DELETE FROM sessions WHERE user_id=? AND token<>?").run(
          u.id,
          req.session.token,
        );
        audit(req, "修改密码", u.id);
      })();
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });
  app.use("/api/admin", auth);
  app.get("/api/admin/dashboard", allow("dashboard.read"), (req, res) => {
    const cutoff = new Date(Date.now() - 29 * 86400000).toLocaleDateString(
      "sv-SE",
      { timeZone: "Asia/Shanghai" },
    );
    const canLeads = req.user.permissions.includes("leads.read");
    const counts = {
      leads: canLeads
        ? db.prepare("SELECT COUNT(*) n FROM leads").get().n
        : null,
      pending: canLeads
        ? db.prepare("SELECT COUNT(*) n FROM leads WHERE status='待跟进'").get()
            .n
        : null,
      stores: db
        .prepare(
          "SELECT COUNT(*) n FROM items WHERE type='stores' AND published=1",
        )
        .get().n,
      articles: db
        .prepare(
          "SELECT COUNT(*) n FROM items WHERE type='articles' AND published=1",
        )
        .get().n,
    };
    const recent = canLeads
      ? db.prepare("SELECT * FROM leads ORDER BY created_at DESC LIMIT 5").all()
      : [];
    const trend = canLeads
      ? db
          .prepare(
            "SELECT date(created_at,'+8 hours') date,COUNT(*) count FROM leads WHERE date(created_at,'+8 hours')>=? GROUP BY date",
          )
          .all(cutoff)
      : [];
    res.json({ counts, recent, trend });
  });
  const leadsWhere = (req) => {
    const q = "%" + String(req.query.q || "").slice(0, 100) + "%";
    const status = String(req.query.status || "");
    return {
      sql: "WHERE (l.name LIKE ? OR l.phone LIKE ?) AND (?='' OR l.status=?)",
      args: [q, q, status, status],
    };
  };
  app.get("/api/admin/leads", allow("leads.read"), (req, res) => {
    const page = Math.max(1, Math.min(100000, parseInt(req.query.page) || 1)),
      w = leadsWhere(req);
    const total = db
      .prepare(`SELECT COUNT(*) n FROM leads l ${w.sql}`)
      .get(...w.args).n;
    const items = db
      .prepare(
        `SELECT l.*,u.name owner_name FROM leads l LEFT JOIN users u ON u.id=l.owner_id ${w.sql} ORDER BY l.created_at DESC LIMIT 15 OFFSET ?`,
      )
      .all(...w.args, (page - 1) * 15);
    res.json({ items, total, page });
  });
  app.get(
    "/api/admin/leads/export",
    allow("leads.read"),
    allow("leads.export"),
    (req, res) => {
      const w = leadsWhere(req);
      const rows = db
        .prepare(
          `SELECT * FROM leads l ${w.sql} ORDER BY created_at DESC LIMIT 10000`,
        )
        .all(...w.args);
      const csvCell = (value) => {
        let s = String(value || "");
        if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
        return '"' + s.replaceAll('"', '""') + '"';
      };
      const csv = [
        ["姓名", "电话", "咨询方向", "状态", "备注", "创建时间"],
        ...rows.map((r) => [
          r.name,
          r.phone,
          r.type,
          r.status,
          r.note,
          r.created_at,
        ]),
      ]
        .map((r) => r.map(csvCell).join(","))
        .join("\r\n");
      audit(req, "导出咨询线索", rows.length + "条");
      res
        .set({
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="bosye-leads.csv"',
        })
        .send("\uFEFF" + csv);
    },
  );
  app.get("/api/admin/assignees", allow("leads.write"), (req, res) =>
    res.json({
      items: db
        .prepare(
          "SELECT u.id,u.name,r.permissions FROM users u JOIN roles r ON r.id=u.role_id WHERE active=1",
        )
        .all()
        .filter((u) => JSON.parse(u.permissions).includes("leads.read"))
        .map(({ id, name }) => ({ id, name })),
    }),
  );
  app.post("/api/admin/leads", allow("leads.write"), (req, res, next) => {
    try {
      const d = leadInput.parse(req.body),
        id = randomUUID(),
        time = now();
      db.prepare(
        "INSERT INTO leads(id,name,phone,type,message,source,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)",
      ).run(id, d.name, d.phone, d.type, d.message, "后台录入", time, time);
      audit(req, "新建线索", id);
      res.status(201).json({ id });
    } catch (e) {
      next(e);
    }
  });
  app.patch("/api/admin/leads/:id", allow("leads.write"), (req, res, next) => {
    try {
      const d = z
        .object({
          status: z.enum(["待跟进", "沟通中", "已预约", "已完成", "无效"]),
          note: str(0, 4000),
          ownerId: z.string().nullable(),
        })
        .strict()
        .parse(req.body);
      if (!db.prepare("SELECT id FROM leads WHERE id=?").get(req.params.id))
        throw fail(404, "线索不存在");
      if (d.ownerId) {
        const u = getUser(d.ownerId);
        if (!u?.active || !JSON.parse(u.permissions).includes("leads.read"))
          throw fail(400, "负责人无权查看线索");
      }
      db.prepare(
        "UPDATE leads SET status=?,note=?,owner_id=?,updated_at=? WHERE id=?",
      ).run(d.status, d.note, d.ownerId, now(), req.params.id);
      audit(req, "跟进线索", req.params.id);
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });
  app.get("/api/admin/site", allow("site.read"), (_req, res) =>
    res.json(
      JSON.parse(
        db.prepare("SELECT data FROM settings WHERE key=?").get("site").data,
      ),
    ),
  );
  app.put("/api/admin/site", allow("site.write"), (req, res, next) => {
    try {
      const d = siteSchema.parse(req.body);
      db.prepare("UPDATE settings SET data=? WHERE key=?").run(
        JSON.stringify(d),
        "site",
      );
      const contentRow = db
        .prepare("SELECT data FROM settings WHERE key='knowledge'")
        .get();
      if (contentRow) {
        const current = JSON.parse(contentRow.data);
        current.brand.description = d.brandIntro;
        db.prepare("UPDATE settings SET data=? WHERE key='knowledge'").run(
          JSON.stringify(current),
        );
      }
      audit(req, "更新网站设置", "site");
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });
  app.get("/api/admin/content", allow("site.read"), (_req, res) => {
    const row = db
      .prepare("SELECT data FROM settings WHERE key=?")
      .get("knowledge");
    res.json(row ? JSON.parse(row.data) : knowledge);
  });
  app.put("/api/admin/content", allow("site.write"), (req, res, next) => {
    try {
      const d = contentSchema.parse(req.body);
      const existing = db
        .prepare("SELECT data FROM settings WHERE key=?")
        .get("knowledge");
      const current = existing ? JSON.parse(existing.data) : knowledge;
      db.prepare(
        "INSERT INTO settings(key,data) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET data=excluded.data",
      ).run(
        "knowledge",
        JSON.stringify({
          ...current,
          ...d,
          version: new Date().toISOString().slice(0, 10),
          source: current.source || knowledge.source,
          home: current.home || {},
          pages: current.pages || {},
          products: current.products || knowledge.products,
        }),
      );
      const site = JSON.parse(
        db.prepare("SELECT data FROM settings WHERE key='site'").get().data,
      );
      site.brandIntro = d.brand.description;
      db.prepare("UPDATE settings SET data=? WHERE key='site'").run(
        JSON.stringify(site),
      );
      audit(req, "更新官网内容", "knowledge");
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });
  app.get("/api/admin/home-fields", allow("site.read"), (_req, res, next) => {
    try {
      const row = db
        .prepare("SELECT data FROM settings WHERE key='knowledge'")
        .get();
      const k = row ? JSON.parse(row.data) : knowledge;
      const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
      res.json({
        fields: homeFields(html).map((f) => ({
          ...f,
          value: k.home?.[f.key] ?? f.value,
        })),
        home: k.home || {},
      });
    } catch (e) {
      next(e);
    }
  });
  app.put("/api/admin/home-fields", allow("site.write"), (req, res, next) => {
    try {
      const input = z
        .object({ fields: z.array(homeFieldSchema).max(500) })
        .strict()
        .parse(req.body);
      const row = db
        .prepare("SELECT data FROM settings WHERE key='knowledge'")
        .get();
      const current = row ? JSON.parse(row.data) : knowledge;
      const allowed = new Map(
        homeFields(fs.readFileSync(path.join(root, "index.html"), "utf8")).map(
          (f) => [f.key, f],
        ),
      );
      const home = { ...(current.home || {}) };
      for (const field of input.fields) {
        const known = allowed.get(field.key);
        if (
          !known ||
          known.type !== field.type ||
          (known.selector || "") !== (field.selector || "")
        )
          throw fail(400, "官网字段已变化，请刷新后再保存");
        if (field.type === "collection") {
          const collection =
            typeof field.value === "string"
              ? (() => {
                  try {
                    return JSON.parse(field.value);
                  } catch {
                    throw fail(400, "内容块格式不正确，请刷新后重试");
                  }
                })()
              : field.value;
          if (
            !Array.isArray(collection) ||
            !collection.length ||
            collection.length > (known.max || 30)
          )
            throw fail(400, "内容块至少需要保留一项");
          home[field.key] = collection.map((item) =>
            Object.fromEntries(
              Object.entries(item).map(([key, value]) => [
                key,
                String(value ?? "").trim(),
              ]),
            ),
          );
          continue;
        }
        if (
          field.type === "image" &&
          field.value &&
          !imagePath.safeParse(field.value).success
        )
          throw fail(400, "图片必须来自本站图库");
        home[field.key] = field.value;
      }
      db.prepare(
        "INSERT INTO settings(key,data) VALUES('knowledge',?) ON CONFLICT(key) DO UPDATE SET data=excluded.data",
      ).run(JSON.stringify({ ...current, home }));
      audit(req, "更新首页内容", "knowledge");
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });
  app.get("/api/admin/page-content", allow("site.read"), (_req, res) => {
    const row = db
      .prepare("SELECT data FROM settings WHERE key='knowledge'")
      .get();
    const current = row ? JSON.parse(row.data) : knowledge;
    const site = JSON.parse(
      db.prepare("SELECT data FROM settings WHERE key='site'").get().data,
    );
    const activeProducts = db
      .prepare("SELECT * FROM items WHERE type='products' AND published=1")
      .all()
      .map(publicItem)
      .sort((a, b) => a.sort - b.sort);
    const editablePaths = new Set([
      ...fixedPages(site, current).map((p) => p.path),
      "/library",
    ]);
    const pages = allPages(db, site, {
      ...current,
      products: activeProducts,
    })
      .filter((p) => editablePaths.has(p.path))
      .map((p) => {
        const custom = current.pages?.[p.path];
        return {
          path: p.path,
          title: custom?.title || p.title,
          accent: custom?.accent ?? p.accent ?? "",
          hubCopy: custom?.hubCopy ?? p.hubCopy ?? {},
          description: custom?.description || p.description,
          body: custom?.body ?? htmlToText(p.body),
          enabled: !!custom?.enabled,
        };
      });
    res.json({ pages });
  });
  app.put("/api/admin/page-content", allow("site.write"), (req, res, next) => {
    try {
      const input = pageContentSchema.parse(req.body);
      const row = db
        .prepare("SELECT data FROM settings WHERE key='knowledge'")
        .get();
      const current = row ? JSON.parse(row.data) : knowledge;
      const site = JSON.parse(
        db.prepare("SELECT data FROM settings WHERE key='site'").get().data,
      );
      const allowed = new Set([
        ...fixedPages(site, current).map((p) => p.path),
        "/library",
      ]);
      const pages = { ...(current.pages || {}) };
      for (const page of input.pages) {
        if (!allowed.has(page.path)) throw fail(400, "资料页面不存在");
        if (!page.enabled) delete pages[page.path];
        else {
          const { path, ...data } = page;
          pages[path] = { ...data, updatedAt: new Date().toISOString() };
        }
      }
      db.prepare(
        "INSERT INTO settings(key,data) VALUES('knowledge',?) ON CONFLICT(key) DO UPDATE SET data=excluded.data",
      ).run(JSON.stringify({ ...current, pages }));
      audit(req, "更新资料页内容", "knowledge");
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });
  for (const type of Object.keys(schemas)) {
    const permission = type === "news" ? "articles" : type;
    if (type === "articles" || type === "stores") {
      const importUpload = multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: 5 * 1024 * 1024, files: 1 },
      });
      const importConfig =
        type === "articles"
          ? {
              label: "文章",
              headers: [
                "文章标题",
                "栏目",
                "文章摘要",
                "文章正文",
                "展示图片",
                "排序",
                "发布状态",
              ],
              aliases: {
                title: ["title", "标题", "文章标题"],
                category: ["category", "栏目", "分类", "文章栏目"],
                summary: ["summary", "摘要", "文章摘要"],
                body: ["body", "正文", "文章正文", "内容"],
                image: ["image", "图片", "图片路径", "封面图片", "展示图片"],
                sort: ["sort", "排序", "顺序", "排序值"],
                published: [
                  "published",
                  "发布",
                  "是否发布",
                  "状态",
                  "发布状态",
                ],
              },
            }
          : {
              label: "门店",
              headers: [
                "门店名称",
                "城市",
                "详细地址",
                "门店电话",
                "营业时间",
                "展示图片",
                "排序",
                "发布状态",
              ],
              aliases: {
                name: ["name", "门店名称", "门店"],
                city: ["city", "城市"],
                address: ["address", "详细地址", "地址"],
                phone: ["phone", "门店电话", "电话", "联系电话"],
                hours: ["hours", "营业时间", "营业时间说明"],
                image: ["image", "图片", "图片路径", "展示图片"],
                sort: ["sort", "排序", "顺序", "排序值"],
                published: [
                  "published",
                  "发布",
                  "是否发布",
                  "状态",
                  "发布状态",
                ],
              },
            };
      const normalizeHeader = (value) =>
        String(value ?? "")
          .replace(/^\ufeff/, "")
          .trim()
          .toLowerCase()
          .replace(/[\s_\-\/（）()]/g, "");
      const importTemplate = [importConfig.headers];
      app.get(
        "/api/admin/" + type + "/import-template",
        allow(permission + ".read"),
        (_req, res) => {
          res
            .type("text/csv; charset=utf-8")
            .set(
              "Content-Disposition",
              `attachment; filename="${type}-import-template.csv"`,
            )
            .send("\ufeff" + toCsv(importTemplate));
        },
      );
      app.post(
        "/api/admin/" + type + "/import",
        allow(permission + ".write"),
        importUpload.single("file"),
        (req, res, next) => {
          try {
            if (!req.file) throw fail(400, "请选择 CSV 或 TSV 文件");
            const name = String(req.file.originalname || "").toLowerCase();
            if (!/\.(csv|tsv|txt)$/.test(name))
              throw fail(400, "批量导入仅支持 CSV 或 TSV 文件");
            const text = req.file.buffer.toString("utf8");
            let sourceRows;
            try {
              sourceRows = parseDelimited(text);
            } catch (error) {
              throw fail(400, error.message || "CSV 文件格式不正确");
            }
            if (!sourceRows.length) throw fail(400, "文件中没有可导入的数据");
            if (sourceRows.length > 1000)
              throw fail(400, `单次最多导入 1000 条${importConfig.label}`);
            const aliases = Object.fromEntries(
              Object.entries(importConfig.aliases).map(([key, names]) => [
                key,
                new Set(names.map(normalizeHeader)),
              ]),
            );
            const sourceValue = (row, names) => {
              const key = Object.keys(row).find((candidate) =>
                names.has(normalizeHeader(candidate)),
              );
              return key ? row[key] : "";
            };
            const required =
              type === "articles"
                ? ["title", "category", "summary", "body"]
                : ["name", "city", "address", "phone"];
            const headerKeys = new Set(
              Object.keys(sourceRows[0]).map(normalizeHeader),
            );
            const missing = required.filter(
              (key) =>
                ![...aliases[key]].some((alias) => headerKeys.has(alias)),
            );
            if (missing.length) {
              const labels = missing.map((key) =>
                key === "title"
                  ? "文章标题"
                  : key === "category"
                    ? "栏目"
                    : key === "summary"
                      ? "文章摘要"
                      : key === "body"
                        ? "文章正文"
                        : key === "name"
                          ? "门店名称"
                          : key === "city"
                            ? "城市"
                            : key === "address"
                              ? "详细地址"
                              : "门店电话",
              );
              throw fail(400, `导入表头缺少：${labels.join("、")}`);
            }
            const boolValue = (value) => {
              const normalized = String(value || "")
                .trim()
                .toLowerCase();
              if (!normalized) return false;
              if (
                [
                  "1",
                  "true",
                  "yes",
                  "y",
                  "是",
                  "发布",
                  "已发布",
                  "上线",
                ].includes(normalized)
              )
                return true;
              if (
                [
                  "0",
                  "false",
                  "no",
                  "n",
                  "否",
                  "草稿",
                  "未发布",
                  "下线",
                ].includes(normalized)
              )
                return false;
              throw new Error(
                "发布状态请填写“已发布”或“草稿”，也可填写 1 或 0",
              );
            };
            const errors = [];
            const normalizedRows = sourceRows.map((row) => {
              try {
                const sortText = sourceValue(row, aliases.sort);
                const published = boolValue(
                  sourceValue(row, aliases.published),
                );
                const sourceData =
                  type === "articles"
                    ? {
                        title: sourceValue(row, aliases.title),
                        category: sourceValue(row, aliases.category),
                        summary: sourceValue(row, aliases.summary),
                        body: sourceValue(row, aliases.body),
                        image: sourceValue(row, aliases.image),
                        sort: sortText === "" ? 0 : Number(sortText),
                      }
                    : {
                        name: sourceValue(row, aliases.name),
                        city: sourceValue(row, aliases.city),
                        address: sourceValue(row, aliases.address),
                        phone: sourceValue(row, aliases.phone),
                        hours: sourceValue(row, aliases.hours),
                        image: sourceValue(row, aliases.image),
                        sort: sortText === "" ? 0 : Number(sortText),
                      };
                return {
                  data: sourceData,
                  published,
                };
              } catch (error) {
                errors.push({ row: row.__row, error: error.message });
                return null;
              }
            });
            const parsed = normalizedRows.map((row, index) => {
              if (!row) return null;
              try {
                return {
                  data: schemas[type].parse(row.data),
                  published: row.published,
                };
              } catch (error) {
                const details =
                  error instanceof z.ZodError
                    ? error.issues
                        .map(
                          (issue) => `${issue.path.join(".")} ${issue.message}`,
                        )
                        .join("；")
                    : error.message;
                errors.push({ row: sourceRows[index].__row, error: details });
                return null;
              }
            });
            if (errors.length)
              return res.status(400).json({
                error: `有 ${errors.length} 行未通过校验，请修正后重新导入`,
                errors,
                rows: errors,
              });
            if (!parsed.length) throw fail(400, "文件中没有可导入的数据");
            const time = now();
            const insert = db.prepare("INSERT INTO items VALUES(?,?,?,?,?,?)");
            db.transaction(() => {
              parsed.forEach((data) => {
                const id = randomUUID();
                insert.run(
                  id,
                  type,
                  JSON.stringify(data.data),
                  data.published ? 1 : 0,
                  time,
                  time,
                );
                audit(req, `批量导入${importConfig.label}`, id);
              });
            })();
            res.status(201).json({ imported: parsed.length });
          } catch (error) {
            next(error);
          }
        },
      );
    }
    app.get("/api/admin/" + type, allow(permission + ".read"), (_req, res) =>
      res.json({
        items: db
          .prepare("SELECT * FROM items WHERE type=? ORDER BY updated_at DESC")
          .all(type)
          .map(publicItem),
      }),
    );
    function save(req, res, next) {
      try {
        const input = z
          .object({ data: schemas[type], published: z.boolean() })
          .strict()
          .parse(req.body);
        const id = req.params.id || randomUUID(),
          time = now();
        if (req.params.id) {
          if (
            !db
              .prepare("SELECT id FROM items WHERE id=? AND type=?")
              .get(id, type)
          )
            throw fail(404, "记录不存在");
          db.prepare(
            "UPDATE items SET data=?,published=?,updated_at=? WHERE id=?",
          ).run(JSON.stringify(input.data), input.published ? 1 : 0, time, id);
        } else
          db.prepare("INSERT INTO items VALUES(?,?,?,?,?,?)").run(
            id,
            type,
            JSON.stringify(input.data),
            input.published ? 1 : 0,
            time,
            time,
          );
        audit(req, (req.params.id ? "更新" : "创建") + type, id);
        res.status(req.params.id ? 200 : 201).json({ id });
      } catch (e) {
        next(e);
      }
    }
    app.post("/api/admin/" + type, allow(permission + ".write"), save);
    app.put("/api/admin/" + type + "/:id", allow(permission + ".write"), save);
    app.delete(
      "/api/admin/" + type + "/:id",
      allow(permission + ".write"),
      (req, res) => {
        const deleted = db
          .prepare("DELETE FROM items WHERE id=? AND type=?")
          .run(req.params.id, type);
        if (!deleted.changes)
          return res.status(404).json({ error: "记录不存在" });
        audit(req, "删除" + type, req.params.id);
        res.json({ ok: true });
      },
    );
  }
  app.get("/api/admin/users", allow("users.read"), (_req, res) =>
    res.json({
      items: db
        .prepare("SELECT id FROM users ORDER BY created_at")
        .all()
        .map(({ id }) => safeUser(getUser(id))),
    }),
  );
  app.get("/api/admin/role-options", allow("users.write"), (req, res) =>
    res.json({
      items: db
        .prepare("SELECT * FROM roles")
        .all()
        .filter((r) =>
          JSON.parse(r.permissions).every((p) =>
            req.user.permissions.includes(p),
          ),
        )
        .map((r) => ({ id: r.id, name: r.name })),
    }),
  );
  function validateRole(req, id) {
    const role = db.prepare("SELECT * FROM roles WHERE id=?").get(id);
    if (!role) throw fail(400, "角色不存在");
    if (
      JSON.parse(role.permissions).some(
        (p) => !req.user.permissions.includes(p),
      )
    )
      throw fail(403, "不能授予超出自己权限的角色");
    return role;
  }
  const userInput = z
    .object({
      username: str(3, 60).regex(/^[a-zA-Z0-9_.@-]+$/),
      name: str(1, 40),
      roleId: z.string(),
      active: z.boolean(),
      password: password.optional(),
    })
    .strict();
  app.post("/api/admin/users", allow("users.write"), (req, res, next) => {
    try {
      const d = userInput.parse(req.body);
      if (!d.password) throw fail(400, "请设置初始密码");
      validateRole(req, d.roleId);
      const id = randomUUID();
      db.prepare("INSERT INTO users VALUES(?,?,?,?,?,?,1,?)").run(
        id,
        d.username,
        d.name,
        hashPassword(d.password),
        d.roleId,
        d.active ? 1 : 0,
        now(),
      );
      audit(req, "创建管理员", id);
      res.status(201).json({ id });
    } catch (e) {
      next(e);
    }
  });
  app.put("/api/admin/users/:id", allow("users.write"), (req, res, next) => {
    try {
      const d = userInput.parse(req.body),
        u = getUser(req.params.id);
      if (!u) throw fail(404, "管理员不存在");
      validateRole(req, d.roleId);
      validateRole(req, u.role_id);
      if (u.id === req.user.id && (!d.active || d.roleId !== u.role_id))
        throw fail(400, "不能停用自己或修改自己的角色");
      if (u.id === req.user.id && d.password)
        throw fail(400, "请通过个人密码页面修改自己的密码");
      if (
        u.active &&
        u.role_id === "owner" &&
        (!d.active || d.roleId !== "owner") &&
        db
          .prepare(
            "SELECT COUNT(*) n FROM users WHERE active=1 AND role_id='owner'",
          )
          .get().n <= 1
      )
        throw fail(400, "系统必须保留至少一名启用的超级管理员");
      db.transaction(() => {
        db.prepare(
          "UPDATE users SET username=?,name=?,role_id=?,active=? WHERE id=?",
        ).run(d.username, d.name, d.roleId, d.active ? 1 : 0, u.id);
        if (d.password)
          db.prepare(
            "UPDATE users SET password_hash=?,must_change=1 WHERE id=?",
          ).run(hashPassword(d.password), u.id);
        if (!d.active || d.password || d.roleId !== u.role_id)
          db.prepare("DELETE FROM sessions WHERE user_id=?").run(u.id);
        audit(req, "更新管理员", u.id);
      })();
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });
  app.get("/api/admin/roles", allow("roles.read"), (_req, res) =>
    res.json({
      items: db
        .prepare(
          "SELECT r.*, (SELECT COUNT(*) FROM users WHERE role_id=r.id) memberCount FROM roles r",
        )
        .all()
        .map((r) => ({
          ...r,
          permissions: JSON.parse(r.permissions),
          protected: !!r.protected,
        })),
      permissions,
    }),
  );
  const roleInput = z
    .object({
      name: str(2, 40),
      permissions: z
        .array(z.enum(Object.keys(permissions)))
        .max(Object.keys(permissions).length),
    })
    .strict();
  function saveRole(req, res, next) {
    try {
      const d = roleInput.parse(req.body);
      if (d.permissions.some((p) => !req.user.permissions.includes(p)))
        throw fail(403, "不能授予超出自己范围的权限");
      for (const p of d.permissions) {
        if (
          /\.(write|export)$/.test(p) &&
          !d.permissions.includes(p.replace(/\.(write|export)$/, ".read"))
        )
          throw fail(400, "操作权限必须同时启用对应的查看权限");
      }
      const id = req.params.id || randomUUID();
      if (req.params.id) {
        const role = db.prepare("SELECT * FROM roles WHERE id=?").get(id);
        if (!role) throw fail(404, "角色不存在");
        if (role.protected) throw fail(400, "内置超级管理员角色不能修改");
        validateRole(req, id);
        if (req.user.roleId === id) throw fail(400, "不能修改自己的角色权限");
        db.prepare("UPDATE roles SET name=?,permissions=? WHERE id=?").run(
          d.name,
          JSON.stringify([...new Set(d.permissions)]),
          id,
        );
        db.prepare(
          "DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE role_id=?)",
        ).run(id);
      } else
        db.prepare("INSERT INTO roles VALUES(?,?,?,0)").run(
          id,
          d.name,
          JSON.stringify([...new Set(d.permissions)]),
        );
      audit(req, "保存角色权限", id);
      res.status(req.params.id ? 200 : 201).json({ id });
    } catch (e) {
      next(e);
    }
  }
  app.post("/api/admin/roles", allow("roles.write"), saveRole);
  app.put("/api/admin/roles/:id", allow("roles.write"), saveRole);
  app.delete("/api/admin/roles/:id", allow("roles.write"), (req, res, next) => {
    try {
      const r = validateRole(req, req.params.id);
      if (r.protected || r.id === req.user.roleId)
        throw fail(400, "不能删除该角色");
      if (db.prepare("SELECT 1 FROM users WHERE role_id=?").get(r.id))
        throw fail(400, "该角色仍有关联管理员，请先调整成员角色");
      db.prepare("DELETE FROM roles WHERE id=?").run(r.id);
      audit(req, "删除角色", r.id);
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });
  app.get("/api/admin/audit", allow("audit.read"), (req, res) => {
    const page = Math.max(1, Math.min(100000, parseInt(req.query.page) || 1));
    res.json({
      items: db
        .prepare("SELECT * FROM audit ORDER BY id DESC LIMIT 30 OFFSET ?")
        .all((page - 1) * 30),
      total: db.prepare("SELECT COUNT(*) n FROM audit").get().n,
      page,
    });
  });
  app.get("/api/admin/media", allow("media.read"), (_req, res) =>
    res.json({
      items: db.prepare("SELECT * FROM media ORDER BY created_at DESC").all(),
    }),
  );
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  });
  app.post(
    "/api/admin/media",
    allow("media.write"),
    upload.single("file"),
    (req, res, next) => {
      try {
        if (!req.file) throw fail(400, "请选择图片");
        const b = req.file.buffer;
        let ext = "";
        if (
          b.length > 12 &&
          b.subarray(0, 3).equals(Buffer.from([255, 216, 255]))
        )
          ext = "jpg";
        else if (
          b.length > 12 &&
          b
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        )
          ext = "png";
        else if (
          b.length > 12 &&
          b.toString("ascii", 0, 4) === "RIFF" &&
          b.toString("ascii", 8, 12) === "WEBP"
        )
          ext = "webp";
        if (!ext) throw fail(400, "仅支持 JPG、PNG、WEBP 图片");
        const id = randomUUID(),
          file = id + "." + ext,
          url = "uploads/" + file;
        // Multipart filenames arrive as Latin-1 in Busboy. Recover UTF-8 names
        // when the byte sequence is valid, preserving Chinese file labels.
        const originalName = req.file.originalname;
        const decodedName = [...originalName].every(
          (c) => c.codePointAt(0) <= 255,
        )
          ? Buffer.from(originalName, "latin1").toString("utf8")
          : originalName;
        const name = (
          decodedName.includes("\ufffd") ? originalName : decodedName
        ).slice(0, 120);
        const createdAt = now();
        fs.writeFileSync(path.join(uploads, file), b);
        db.prepare("INSERT INTO media VALUES(?,?,?,?,?)").run(
          id,
          name,
          url,
          b.length,
          createdAt,
        );
        audit(req, "上传媒体", id);
        res
          .status(201)
          .json({ id, url, name, size: b.length, created_at: createdAt });
      } catch (e) {
        next(e);
      }
    },
  );
  app.use("/api", (_req, res) => res.status(404).json({ error: "接口不存在" }));
  app.use(
    "/uploads",
    express.static(uploads, { dotfiles: "deny", index: false, maxAge: "1d" }),
  );
  app.use(
    "/assets",
    express.static(path.join(root, "assets"), {
      dotfiles: "deny",
      index: false,
      maxAge: "1d",
    }),
  );
  registerPublicContent(app, db);
  for (const file of [
    "admin.html",
    "styles.css",
    "admin.css",
    "app.js",
    "admin.js",
  ])
    app.get("/" + file, (_req, res) => {
      if (file === "admin.html") res.set("X-Robots-Tag", "noindex, nofollow");
      res.sendFile(path.join(root, file));
    });
  const escapeHtml = (v) =>
    String(v).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  app.get("/index.html", (_req, res) => res.redirect(301, "/"));
  app.get("/", (req, res) => {
    const site = JSON.parse(
      db.prepare("SELECT data FROM settings WHERE key=?").get("site").data,
    );
    let html = fs.readFileSync(path.join(root, "index.html"), "utf8");
    html = html
      .replace(
        /<title>.*?<\/title>/,
        () => "<title>" + escapeHtml(site.seoTitle) + "</title>",
      )
      .replace(
        /<meta\s+name="description"\s+content="[^"]*"[^>]*>/,
        () =>
          '<meta name="description" content="' +
          escapeHtml(site.seoDescription) +
          '">',
      );
    for (const id of [
      "heroTitle",
      "heroAccent",
      "heroDescription",
      "brandIntro",
    ]) {
      const pattern = new RegExp('(<[^>]+id="' + id + '"[^>]*>)[^<]*');
      html = html.replace(pattern, (_match, tag) => tag + escapeHtml(site[id]));
    }
    const serviceCards = db
      .prepare("SELECT * FROM items WHERE type='services' AND published=1")
      .all()
      .map(publicItem)
      .sort((a, b) => a.sort - b.sort)
      .map(
        (v, i) =>
          `<button class="service-card" data-service="${v.id}" aria-label="了解${escapeHtml(v.name)}"><div class="service-image">${v.image ? `<img src="${escapeHtml(v.image)}" alt="${escapeHtml(v.name)}服务" loading="lazy">` : ""}<div class="service-overlay"></div><span class="service-index">${String(i + 1).padStart(2, "0")}</span></div><div class="service-content"><p>${escapeHtml(v.english)}</p><h3>${escapeHtml(v.name)}</h3><span class="service-arrow" aria-hidden="true"><svg class="icon-arrow-up-right" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><use href="/assets/icons.svg#arrow-up-right"></use></svg></span><div class="service-detail">${escapeHtml(v.summary)}</div></div></button>`,
      )
      .join("");
    html = html.replace(
      /<!-- SERVICES_START -->[\s\S]*?<!-- SERVICES_END -->/,
      () => serviceCards,
    );
    const products = db
      .prepare("SELECT * FROM items WHERE type='products' AND published=1")
      .all()
      .map(publicItem)
      .sort((a, b) => a.sort - b.sort);
    html = html.replace(
      /<!-- PRODUCTS_START -->[\s\S]*?<!-- PRODUCTS_END -->/,
      () => renderProducts(products),
    );
    const knowledgeRow = db
      .prepare("SELECT data FROM settings WHERE key='knowledge'")
      .get();
    const currentKnowledge = knowledgeRow
      ? JSON.parse(knowledgeRow.data)
      : knowledge;
    html = renderHome(
      html,
      currentKnowledge,
      homeFields(fs.readFileSync(path.join(root, "index.html"), "utf8")),
      site,
    );
    res.type("html").send(homepageContent(db, site, req, html));
  });
  app.get("/robots.txt", (req, res) =>
    res
      .type("text/plain")
      .send(
        `User-agent: *\nAllow: /\nDisallow: /admin.html\nDisallow: /api/\nDisallow: /uploads/\nSitemap: ${originFor(req)}/sitemap.xml\n`,
      ),
  );
  app.use((_req, res) =>
    res
      .status(404)
      .type("text/html")
      .send(
        '<html lang="zh-CN"><meta charset="utf-8"><title>页面不存在</title><h1>页面不存在</h1><a href="/">返回博士园官网</a></html>',
      ),
  );
  app.use((error, _req, res, _next) => {
    if (error instanceof z.ZodError)
      return res.status(400).json({
        error:
          "请检查输入内容：" +
          error.issues
            .map((i) => i.path.join(".") + " " + i.message)
            .join("；"),
      });
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE")
      return res.status(409).json({ error: "账号或名称已存在" });
    if (error instanceof multer.MulterError)
      return res
        .status(400)
        .json({
          error: error.field === "file" && /\/import$/.test(_req.path)
            ? "导入文件上传失败，请使用不超过 5 MB 的 CSV 或 TSV 文件"
            : "图片上传失败，请使用不超过 5 MB 的图片",
        });
    if (error.status)
      return res.status(error.status).json({ error: error.message });
    console.error(error);
    res.status(500).json({ error: "服务暂时不可用，请稍后重试" });
  });
  return { app, db };
}
module.exports = { createApp };
