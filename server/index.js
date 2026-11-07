const { createApp } = require("./app");
const https = require("node:https");
const fs = require("node:fs");
const port = Number(process.env.PORT || 4173);
const { app, db } = createApp();
const useTls = !!(process.env.TLS_CERT_FILE && process.env.TLS_KEY_FILE);
if (!!process.env.TLS_CERT_FILE !== !!process.env.TLS_KEY_FILE)
  throw new Error("TLS_CERT_FILE 与 TLS_KEY_FILE 必须同时设置");
const host = process.env.HOST || "127.0.0.1";
const tlsOptions = useTls
  ? {
      cert: fs.readFileSync(process.env.TLS_CERT_FILE),
      key: fs.readFileSync(process.env.TLS_KEY_FILE),
    }
  : null;
const createServer = () =>
  useTls
    ? https.createServer(tlsOptions, app)
    : require("node:http").createServer(app);
const server = createServer().listen(port, host, () =>
  console.log(`北京博士园服务：${useTls ? "https" : "http"}://${host}:${port}`),
);
const servers = [server];
// localhost may resolve to ::1 first. A second loopback socket supports both
// names without exposing the development service on network interfaces.
if (host === "127.0.0.1" && process.env.LOCAL_IPV6 === "1") {
  const ipv6 = createServer();
  ipv6.on("error", (error) => {
    if (["EAFNOSUPPORT", "EADDRNOTAVAIL"].includes(error.code))
      console.warn("本机未启用 IPv6，请使用 127.0.0.1 访问。");
    else {
      console.error(error);
      stop(1);
    }
  });
  ipv6.listen({ host: "::1", port, ipv6Only: true }, () =>
    console.log(`localhost IPv6 支持已启用，端口 ${port}`),
  );
  servers.push(ipv6);
}
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  Promise.all(
    servers.map((current) => new Promise((resolve) => current.close(resolve))),
  ).then(() => {
    db.close();
    process.exit(typeof code === "number" ? code : 0);
  });
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
