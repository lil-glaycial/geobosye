import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.resolve(process.env.DATA_DIR || path.join(root, "data"));
const sourcePath = path.join(root, "content", "news-history.json");
const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const dbPath = path.join(dataDir, "bosye.sqlite");

if (!fs.existsSync(dbPath)) {
  throw new Error(`数据库不存在：${dbPath}，请先运行 npm run setup`);
}

fs.mkdirSync(path.join(dataDir, "backups"), { recursive: true });
const db = new Database(dbPath);
try {
  const backupPath = path.join(
    dataDir,
    "backups",
    `before-news-history-${Date.now()}.sqlite`,
  );
  await db.backup(backupPath);
  const insert = db.prepare(
    "INSERT OR IGNORE INTO items (id,type,data,published,created_at,updated_at) VALUES (?,?,?,?,?,?)",
  );
  const now = new Date().toISOString();
  const added = db.transaction(() => {
    let added = 0;
    for (const item of source.items) {
      const id = `wechat-news-${String(item.sequence).padStart(3, "0")}`;
      const summary = item.title;
      const body = "";
      const data = {
        title: item.title,
        summary,
        body,
        image: "",
        sort: item.sequence - 1,
        publishedDate: item.publishedDate,
        account: item.account,
        publishedAt: item.publishedAt,
        imageCount: item.imageCount,
        sourceUrl: item.sourceUrl,
      };
      added += insert.run(id, "news", JSON.stringify(data), 1, now, now)
        .changes;
    }
    // Keep the six editorial demo cards available after the imported history.
    db.prepare(
      "UPDATE items SET data=json_set(data, '$.sort', 10000 + CAST(substr(id, 16) AS INTEGER)) WHERE type='news' AND id LIKE 'demo-news-%'",
    ).run();
    return added;
  })();
  console.log(`已导入 ${added} 篇历史品牌资讯（共 ${source.items.length} 条清单）。`);
  console.log(`数据库备份：${backupPath}`);
} finally {
  db.close();
}
