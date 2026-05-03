import { describe, it, expect, beforeEach } from "vitest";
import { getCsrfToken } from "./csrfToken";

describe("getCsrfToken", () => {
  beforeEach(() => {
    // Reset cookies between tests
    document.cookie.split(";").forEach((c) => {
      const name = c.split("=")[0].trim();
      if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    });
  });

  it("returns null when cookie is absent", () => {
    expect(getCsrfToken()).toBeNull();
  });

  it("reads the newdiary_csrf cookie", () => {
    document.cookie = "newdiary_csrf=abc123; path=/";
    expect(getCsrfToken()).toBe("abc123");
  });

  it("decodes URL-encoded values", () => {
    document.cookie = "newdiary_csrf=" + encodeURIComponent("a/b+c=") + "; path=/";
    expect(getCsrfToken()).toBe("a/b+c=");
  });

  it("ignores other cookies that contain the substring", () => {
    document.cookie = "not_newdiary_csrf=fake; path=/";
    expect(getCsrfToken()).toBeNull();
  });

  it("picks the right cookie when multiple are set", () => {
    document.cookie = "session=foo; path=/";
    document.cookie = "newdiary_csrf=correct; path=/";
    document.cookie = "other=bar; path=/";
    expect(getCsrfToken()).toBe("correct");
  });
});
