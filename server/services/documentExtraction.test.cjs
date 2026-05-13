"use strict";

const { extractText } = require("./documentExtraction.cjs");

describe("documentExtraction.extractText — text/plain", () => {
  it("returns plain text content for text/plain", async () => {
    const buffer = Buffer.from("Концепция: 7 слов о будущем России.", "utf8");
    const result = await extractText(buffer, "text/plain");
    expect(result.text).toBe("Концепция: 7 слов о будущем России.");
    expect(result.truncated).toBe(false);
    expect(result.originalChars).toBe(result.text.length);
  });

  it("returns plain text content for text/markdown", async () => {
    const buffer = Buffer.from("# Заголовок\n\nОдин абзац.", "utf8");
    const result = await extractText(buffer, "text/markdown");
    expect(result.text).toContain("Заголовок");
    expect(result.text).toContain("Один абзац");
  });

  it("normalises whitespace and CRLF", async () => {
    const buffer = Buffer.from("строка1\r\n\r\n\r\n\r\nстрока2   с   пробелами", "utf8");
    const result = await extractText(buffer, "text/plain");
    expect(result.text).toBe("строка1\n\nстрока2 с пробелами");
  });

  it("truncates to limitChars and reports originalChars", async () => {
    const long = "А".repeat(20000);
    const buffer = Buffer.from(long, "utf8");
    const result = await extractText(buffer, "text/plain", { limitChars: 1000 });
    expect(result.text.length).toBe(1000);
    expect(result.truncated).toBe(true);
    expect(result.originalChars).toBe(20000);
  });

  it("throws 400 for unsupported MIME", async () => {
    await expect(extractText(Buffer.from("..."), "application/zip")).rejects.toMatchObject({
      status: 400,
    });
  });

  it("returns empty result for empty buffer", async () => {
    const result = await extractText(Buffer.alloc(0), "text/plain");
    expect(result.text).toBe("");
    expect(result.originalChars).toBe(0);
  });
});
