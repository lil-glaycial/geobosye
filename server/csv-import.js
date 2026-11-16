"use strict";

/**
 * Parse a small UTF-8 CSV/TSV document without pulling a spreadsheet parser
 * into the production bundle. The importer accepts quoted fields, embedded
 * commas/newlines and a UTF-8 BOM (the formats exported by Excel and WPS).
 */
function parseDelimited(input) {
  let text = String(input || "");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const delimiter = detectDelimiter(text);
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          value += '"';
          i += 1;
        } else quoted = false;
      } else value += char;
    } else if (char === '"' && value === "") quoted = true;
    else if (char === delimiter) {
      row.push(value);
      value = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(value);
      value = "";
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
    } else value += char;
  }
  if (quoted) throw new Error("CSV 中存在未闭合的引号");
  if (value !== "" || row.length) {
    row.push(value);
    if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  }
  if (!rows.length) return [];
  const headers = rows.shift().map((header) => header.trim());
  if (!headers.length || headers.some((header) => !header))
    throw new Error("CSV 首行必须包含字段名称");
  const duplicate = headers.find(
    (header, index) => headers.indexOf(header) !== index,
  );
  if (duplicate) throw new Error(`CSV 字段重复：${duplicate}`);
  return rows.map((cells, index) => {
    const row = { __row: index + 2 };
    headers.forEach((header, cellIndex) => {
      row[header] = String(cells[cellIndex] ?? "").trim();
    });
    return row;
  });
}

function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] || "";
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  return tabCount > commaCount ? "\t" : ",";
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(rows) {
  return rows.map((row) => row.map(csvEscape).join(",")).join("\r\n") + "\r\n";
}

module.exports = { parseDelimited, toCsv };
