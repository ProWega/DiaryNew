"use strict";

/**
 * Извлечение plain-text из загруженных концепций мероприятий.
 *
 * Поддерживаемые форматы:
 *  • application/pdf                                              → pdfjs-dist
 *  • application/vnd.openxmlformats-officedocument.wordprocessingml.document
 *                                                                 → mammoth
 *  • text/plain, text/markdown                                    → buffer.toString
 *
 * Контракт: возвращает `{ text, truncated, originalChars }`.
 *  • Если оригинал длиннее `limitChars` — `text` обрезается, `truncated=true`,
 *    `originalChars` хранит реальную длину для UI «обрезано, было N».
 *  • Ленивый `require` для тяжёлых парсеров — модули подтягиваются только
 *    когда реально нужен соответствующий формат (cold start ~50ms vs 500ms).
 */

const DEFAULT_LIMIT = 12000;

async function extractText(buffer, mime, { limitChars = DEFAULT_LIMIT } = {}) {
  const raw = await extractRaw(buffer, mime);
  const cleaned = normaliseWhitespace(raw);
  const originalChars = cleaned.length;
  const truncated = originalChars > limitChars;
  const text = truncated ? cleaned.slice(0, limitChars) : cleaned;
  return { text, truncated, originalChars };
}

async function extractRaw(buffer, mime) {
  if (!buffer || !buffer.length) return "";

  if (mime === "application/pdf") {
    return await extractPdfText(buffer);
  }
  if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return await extractDocxText(buffer);
  }
  if (mime === "text/plain" || mime === "text/markdown") {
    return buffer.toString("utf8");
  }

  throw Object.assign(new Error(`Неподдерживаемый MIME для концепции: ${mime}`), {
    status: 400,
  });
}

async function extractPdfText(buffer) {
  // Legacy build pdfjs-dist — стабильно работает в node-окружении без DOM.
  // Динамический import потому что pdfjs — ESM-only.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    disableFontFace: true,
  });
  const doc = await loadingTask.promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i += 1) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
    pages.push(text);
  }
  await doc.destroy();
  return pages.join("\n\n");
}

async function extractDocxText(buffer) {
  const mammoth = require("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value || "";
}

function normaliseWhitespace(text) {
  return String(text || "")
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

module.exports = {
  extractText,
  DEFAULT_LIMIT,
};
