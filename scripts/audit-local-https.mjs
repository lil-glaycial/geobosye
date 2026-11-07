import { createRequire } from "node:module";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import https from "node:https";
import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { createApp } = require("../server/app");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temp = mkdtempSync(path.join(tmpdir(), "bosye-readiness-tls-"));
let server, db;
const previousPublicOrigin = process.env.PUBLIC_ORIGIN;
try {
  process.env.PUBLIC_ORIGIN = "";
  const cert = path.join(temp, "certificate.pem");
  const key = path.join(temp, "key.pem");
  // A temporary trust anchor scoped to this audit process. Certificate checks
  // and hostname validation remain enabled; nothing is installed system-wide.
  execFileSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-sha256",
      "-days",
      "1",
      "-subj",
      "/CN=localhost",
      "-addext",
      "subjectAltName=DNS:localhost,IP:127.0.0.1",
      "-keyout",
      key,
      "-out",
      cert,
    ],
    { stdio: "ignore" },
  );
  const instance = createApp();
  db = instance.db;
  server = https.createServer(
    { cert: readFileSync(cert), key: readFileSync(key) },
    instance.app,
  );
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `https://127.0.0.1:${server.address().port}/`;
  const output = process.argv[2] || "test-results/ai-readiness-after.json";
  const child = spawn(
    process.execPath,
    [path.join(root, "scripts/audit-readiness.mjs"), url, output],
    {
      cwd: root,
      env: {
        ...process.env,
        PUBLIC_ORIGIN: "",
        NODE_EXTRA_CA_CERTS: cert,
        READINESS_REQUIRE_FULL: "1",
      },
      stdio: "inherit",
    },
  );
  process.exitCode = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code) => resolve(code ?? 1));
  });
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  db?.close();
  rmSync(temp, { recursive: true, force: true });
  if (previousPublicOrigin === undefined) delete process.env.PUBLIC_ORIGIN;
  else process.env.PUBLIC_ORIGIN = previousPublicOrigin;
}
