import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

const targetUrl = process.argv[2] || "http://127.0.0.1:4173/";
const reportPath = process.argv[3] || "test-results/ai-readiness.json";
const evaluator =
  process.env.READINESS_EVALUATOR_DIR ||
  "/Users/peaklin/items/agent/ai-agent-ready";
const { discoverUrlInventory } = await import(
  pathToFileURL(path.join(evaluator, "app/discovery.mjs"))
);
const { scanSite } = await import(
  pathToFileURL(path.join(evaluator, "app/scanner.mjs"))
);
const { safeFetch } = await import(
  pathToFileURL(path.join(evaluator, "app/fetch.mjs"))
);
const target = new URL(targetUrl);
const isLocal = ["127.0.0.1", "localhost", "[::1]"].includes(target.hostname);

// The public evaluator blocks private networks. For local verification only,
// use real HTTP responses restricted to this exact loopback host and port.
// TLS validation stays enabled; no content, inventory or score is fabricated.
async function localFetch(url, options = {}, redirects = 0) {
  const parsed = new URL(url);
  if (
    parsed.hostname !== target.hostname ||
    parsed.port !== target.port ||
    !["http:", "https:"].includes(parsed.protocol)
  )
    throw new Error("Local audit may only request its target host and port");
  try {
    const response = await fetch(url, {
      headers: options.headers || { Accept: options.accept || "*/*" },
      redirect: "manual",
      signal: AbortSignal.timeout(
        Math.max(
          1,
          Math.min(
            options.timeoutMs || 10000,
            (options.deadlineMs || Date.now() + 10000) - Date.now(),
          ),
        ),
      ),
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (location && redirects < 5)
        return localFetch(new URL(location, url).href, options, redirects + 1);
    }
    return {
      url: response.url,
      finalUrl: response.url,
      status: response.status,
      headers: Object.fromEntries(response.headers),
      contentType: response.headers.get("content-type") || "",
      body: await response.text(),
      error: null,
    };
  } catch (error) {
    return {
      url,
      finalUrl: url,
      status: 0,
      headers: {},
      contentType: "",
      body: "",
      error: error.message,
    };
  }
}
const fetchImpl = isLocal ? localFetch : safeFetch;
const deadlineMs = Date.now() + 60000;
const inventory = await discoverUrlInventory(targetUrl, {
  fetchFn: fetchImpl,
  deadlineMs,
});
const report = await scanSite({ targetUrl, inventory, fetchImpl, deadlineMs });
const evaluatorFiles = [
  "app/scanner.mjs",
  "app/discovery.mjs",
  "app/catalog.mjs",
  "app/content-assets.mjs",
  "app/report.mjs",
  "app/fetch.mjs",
  "app/transport.mjs",
];
const sourceHashes = Object.fromEntries(
  await Promise.all(
    evaluatorFiles.map(async (file) => [
      file,
      createHash("sha256")
        .update(await fs.readFile(path.join(evaluator, file)))
        .digest("hex"),
    ]),
  ),
);
await fs.mkdir(path.dirname(reportPath), { recursive: true });
await fs.writeFile(
  reportPath,
  JSON.stringify(
    {
      verification: {
        target: targetUrl,
        evaluatedAt: new Date().toISOString(),
        evaluator,
        evaluatorVersion: JSON.parse(
          await fs.readFile(path.join(evaluator, "package.json"), "utf8"),
        ).version,
        sourceHashes,
        transport: isLocal
          ? "Real loopback HTTP/TLS, private-network-only adapter; original discovery and scoring unchanged"
          : "Original safeFetch",
        scope: isLocal
          ? "Local implementation verification; public deployment is not verified"
          : "Public website verification",
      },
      report,
      inventory,
    },
    null,
    2,
  ),
);
console.log(`${report.score}/100 (${reportPath})`);
for (const dimension of report.dimensions) {
  console.log(`${dimension.name}: ${dimension.score}/${dimension.max}`);
  for (const check of dimension.checks)
    if (check.earned < check.max)
      console.log(
        `  ${check.name}: ${check.earned}/${check.max} — ${check.summary}`,
      );
}
if (process.env.READINESS_REQUIRE_FULL === "1" && report.score !== 100)
  process.exitCode = 1;
