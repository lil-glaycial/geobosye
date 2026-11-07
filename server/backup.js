const fs = require("node:fs");
const path = require("node:path");
const Database = require("better-sqlite3");
const dataDir = path.resolve(
  process.env.DATA_DIR || path.join(__dirname, "../data"),
);
const destination = path.resolve(
  process.argv[2] ||
    path.join(
      dataDir,
      "backups",
      new Date().toISOString().replace(/[:.]/g, "-"),
    ),
);
async function run() {
  fs.mkdirSync(destination, { recursive: true, mode: 0o700 });
  const db = new Database(path.join(dataDir, "bosye.sqlite"), {
    readonly: true,
  });
  try {
    await db.backup(path.join(destination, "bosye.sqlite"));
    fs.chmodSync(path.join(destination, "bosye.sqlite"), 0o600);
    if (fs.existsSync(path.join(dataDir, "uploads")))
      fs.cpSync(
        path.join(dataDir, "uploads"),
        path.join(destination, "uploads"),
        { recursive: true },
      );
    console.log("备份已完成：" + destination);
  } finally {
    db.close();
  }
}
run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
