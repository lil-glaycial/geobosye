import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const label = "com.bosye.website.local";
const domain = `gui/${process.getuid()}`;
const service = `${domain}/${label}`;
const plist = path.join(homedir(), "Library/LaunchAgents", `${label}.plist`);
const action = process.argv[2] || "start";
const xml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c],
  );
if (process.platform !== "darwin")
  throw new Error(
    "本地常驻服务仅适用于 macOS；其他环境请使用 npm start 或进程管理器。",
  );
function loaded() {
  try {
    execFileSync("launchctl", ["print", service], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
async function unload() {
  if (!loaded()) return;
  execFileSync("launchctl", ["bootout", service], { stdio: "inherit" });
  for (let attempt = 0; attempt < 50 && loaded(); attempt++)
    await new Promise((resolve) => setTimeout(resolve, 100));
  if (loaded()) throw new Error("旧服务仍在停止，请稍后重试。");
}
if (action === "stop") {
  await unload();
  console.log("本地官网服务已停止。再次运行 npm run start:local 即可启动。");
} else if (action === "status") {
  console.log(loaded() ? "本地服务已载入" : "本地服务未载入");
  if (loaded())
    execFileSync("launchctl", ["print", service], { stdio: "inherit" });
} else if (["start", "restart"].includes(action)) {
  mkdirSync(path.dirname(plist), { recursive: true });
  const logs = path.join(root, "data/local-service");
  mkdirSync(logs, { recursive: true, mode: 0o700 });
  writeFileSync(
    plist,
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${label}</string>
<key>ProgramArguments</key><array><string>${xml(process.execPath)}</string><string>${xml(path.join(root, "server/index.js"))}</string></array>
<key>WorkingDirectory</key><string>${xml(root)}</string>
<key>EnvironmentVariables</key><dict><key>NODE_ENV</key><string>development</string><key>HOST</key><string>127.0.0.1</string><key>LOCAL_IPV6</key><string>1</string><key>PORT</key><string>4173</string><key>DATA_DIR</key><string>${xml(path.join(root, "data"))}</string></dict>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/><key>ThrottleInterval</key><integer>5</integer>
<key>StandardOutPath</key><string>${xml(path.join(logs, "stdout.log"))}</string>
<key>StandardErrorPath</key><string>${xml(path.join(logs, "stderr.log"))}</string>
</dict></plist>
`,
    { mode: 0o600 },
  );
  execFileSync("plutil", ["-lint", plist], { stdio: "inherit" });
  if (action === "restart") await unload();
  if (!loaded())
    execFileSync("launchctl", ["bootstrap", domain, plist], {
      stdio: "inherit",
    });
  execFileSync("launchctl", ["kickstart", service], { stdio: "inherit" });
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const response = await fetch("http://127.0.0.1:4173/api/health", {
        signal: AbortSignal.timeout(1000),
      });
      ready = response.ok && (await response.json()).ok === true;
      if (ready) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!ready)
    throw new Error(`服务未能启动，请检查 ${path.join(logs, "stderr.log")}`);
  console.log(
    "本地官网已由 macOS 持续运行，仅监听本机。后台：http://localhost:4173/admin.html",
  );
} else throw new Error("可用操作：start、restart、stop、status");
