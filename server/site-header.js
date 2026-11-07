const fs = require("node:fs");
const path = require("node:path");
const { parseHTML } = require("linkedom");

// The homepage is the single source for navigation labels and ordering.
function siteHeader(pathname) {
  const source = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
  const markup = source.match(
    /<header class="site-header">[\s\S]*?<\/header>/,
  )[0];
  const { document } = parseHTML(markup);
  const header = document.querySelector("header");
  header.querySelectorAll("[href]").forEach((link) => {
    const href = link.getAttribute("href");
    if (href.startsWith("#"))
      link.setAttribute("href", href === "#top" ? "/" : "/" + href);
  });
  header.querySelectorAll("img[src]").forEach((img) => {
    const src = img.getAttribute("src");
    if (!src.startsWith("/")) img.setAttribute("src", "/" + src);
  });
  header.querySelectorAll(".main-nav a").forEach((link) => {
    const href = link.getAttribute("href");
    const current =
      pathname === href ||
      (href !== "/" && !href.includes("#") && pathname.startsWith(href + "/"));
    link.classList.toggle("active", current);
    if (current) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  return header.outerHTML;
}
module.exports = { siteHeader };
