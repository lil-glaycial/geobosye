const path = require("node:path");
const fs = require("node:fs");
const { randomBytes } = require("node:crypto");
const { openDatabase, setupAdmin } = require("./db");
const root = path.resolve(__dirname, "..");
const dataDir = path.resolve(process.env.DATA_DIR || path.join(root, "data"));
const db = openDatabase(dataDir);
try {
  const username = process.env.ADMIN_USERNAME || "admin";
  const password =
    process.env.ADMIN_PASSWORD || randomBytes(18).toString("base64url");
  if (password.length < 12 || password.length > 128)
    throw new Error("密码长度应为 12–128 位");
  db.transaction(() => {
    setupAdmin(db, username, password);
    const file = path.join(root, ".local-credentials.txt");
    fs.writeFileSync(
      file,
      `北京博士园本地管理后台\n地址：http://localhost:4173/admin.html\n用户名：${username}\n初始密码：${password}\n首次登录需要修改密码。该文件仅用于本地交接，请勿上传或提交到版本库。\n`,
      { mode: 0o600 },
    );
    fs.chmodSync(file, 0o600);
  })();
  console.log(
    "初始化完成。初始账号已写入项目 .local-credentials.txt（仅当前用户可读）。",
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  db.close();
}
