const { parseHTML } = require("linkedom");
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const safeLink = (url) => /^(\/(?!\/)|https?:\/\/|tel:|#)/.test(url);
const safeImage = (url) => /^\/?(assets|uploads)\/[a-zA-Z0-9_.-]+$/.test(url);

function htmlToText(html) {
  const { document } = parseHTML(`<html><body>${html}</body></html>`);
  const inline = (node) => {
    if (node.nodeType === 3) return node.textContent;
    const value = [...node.childNodes].map(inline).join("");
    if (node.localName === "a")
      return `[${value}](${node.getAttribute("href")})`;
    if (["strong", "b"].includes(node.localName)) return `**${value}**`;
    if (node.localName === "br") return "\n";
    return value;
  };
  const block = (node) => {
    const name = node.localName;
    if (!name) return node.textContent.trim();
    if (/^h[2-6]$/.test(name))
      return "#".repeat(Number(name[1])) + " " + inline(node);
    if (["p", "figcaption"].includes(name)) return inline(node);
    if (name === "ul" || name === "ol")
      return [...node.children]
        .map((el, i) => (name === "ul" ? "- " : `${i + 1}. `) + inline(el))
        .join("\n");
    if (name === "table") {
      const rows = [...node.querySelectorAll("tr")].map(
        (row) =>
          "| " +
          [...row.children]
            .map(inline)
            .map((v) => v.replace(/\|/g, "／"))
            .join(" | ") +
          " |",
      );
      if (rows.length)
        rows.splice(
          1,
          0,
          "| " +
            [...node.querySelector("tr").children]
              .map(() => "---")
              .join(" | ") +
            " |",
        );
      return rows.join("\n");
    }
    if (name === "img")
      return `![${node.getAttribute("alt") || ""}](${node.getAttribute("src")})`;
    if (name === "dt") return "### " + inline(node);
    if (name === "dd") return inline(node);
    return [...node.childNodes].map(block).filter(Boolean).join("\n\n");
  };
  return [...document.body.childNodes].map(block).filter(Boolean).join("\n\n");
}

function renderText(text) {
  const inline = (value) =>
    esc(value)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\[([^\]]+)\]\(([^\s)]+)\)/g, (all, label, url) =>
        safeLink(url)
          ? `<a href="${url}"${/^https?:/.test(url) ? ' rel="noopener" target="_blank"' : ""}>${label}</a>`
          : label,
      );
  const lines = String(text).split(/\r?\n/);
  const html = [];
  for (let i = 0; i < lines.length;) {
    const line = lines[i].trim();
    if (!line) {
      i++;
      continue;
    }
    const image = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (image) {
      if (safeImage(image[2]))
        html.push(
          `<figure class="content-photo"><img src="${esc(image[2])}" alt="${esc(image[1])}" loading="lazy"></figure>`,
        );
      i++;
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = Math.max(2, heading[1].length);
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      i++;
      continue;
    }
    if (
      line.startsWith("|") &&
      /^\|[\s:|\-]+\|$/.test(lines[i + 1]?.trim() || "")
    ) {
      const cells = (row) =>
        row
          .trim()
          .replace(/^\||\|$/g, "")
          .split("|")
          .map((v) => inline(v.trim()));
      const headers = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(cells(lines[i]));
        i++;
      }
      html.push(
        `<div class="content-table" role="region" aria-label="资料表格" tabindex="0"><table><thead><tr>${headers.map((v) => `<th scope="col">${v}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((v) => `<td>${v}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`,
      );
      continue;
    }
    if (/^(- |\d+\. )/.test(line)) {
      const ordered = /^\d/.test(line);
      const items = [];
      while (
        i < lines.length &&
        (ordered ? /^\d+\. / : /^- /).test(lines[i].trim())
      ) {
        items.push(inline(lines[i].trim().replace(/^(- |\d+\. )/, "")));
        i++;
      }
      const tag = ordered ? "ol" : "ul";
      html.push(
        `<${tag}>${items.map((v) => `<li>${v}</li>`).join("")}</${tag}>`,
      );
      continue;
    }
    const paragraph = [];
    do {
      paragraph.push(inline(lines[i].trim()));
      i++;
    } while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,6} |\| |- |\d+\. |!\[)/.test(lines[i].trim())
    );
    html.push(`<p>${paragraph.join("<br>")}</p>`);
  }
  return html.join("");
}

module.exports = { htmlToText, renderText };
