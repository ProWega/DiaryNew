const dotenv = require("dotenv");

dotenv.config();

const appMode =
  process.env.APP_MODE ||
  (process.env.NODE_ENV === "production" ? "production" : "development");

function isProductionMode() {
  return appMode === "production";
}

function isDevelopmentMode() {
  return !isProductionMode();
}

function isDevAuthEnabled() {
  return isDevelopmentMode();
}

function getAppBaseUrl() {
  return process.env.APP_BASE_URL || "http://localhost:5173";
}

function getAuthSessionSecret() {
  const secret = process.env.AUTH_SESSION_SECRET || "";
  if (!secret && isProductionMode()) {
    throw new Error("AUTH_SESSION_SECRET is required in production");
  }
  return secret || "newdiary-development-session-secret";
}

function getSetupToken() {
  return process.env.SETUP_TOKEN || "";
}

function getMagicLinkTtlMinutes() {
  const value = Number(process.env.MAGIC_LINK_TTL_MINUTES || 60);
  return Number.isFinite(value) && value > 0 ? value : 60;
}

function getAuthSessionTtlDays() {
  const value = Number(process.env.AUTH_SESSION_TTL_DAYS || 14);
  return Number.isFinite(value) && value > 0 ? value : 14;
}

function getCookieName() {
  return process.env.AUTH_COOKIE_NAME || "newdiary_session";
}

function shouldUseSecureCookies() {
  const value = String(process.env.AUTH_COOKIE_SECURE || "").toLowerCase();
  if (value) {
    return ["1", "true", "yes", "secure"].includes(value);
  }
  return isProductionMode();
}

function getCookieSameSite() {
  const value = String(process.env.AUTH_COOKIE_SAMESITE || "lax").toLowerCase();
  return ["lax", "strict", "none"].includes(value) ? value : "lax";
}

function getClientFeatures() {
  return {
    appMode,
    devAuth: isDevAuthEnabled(),
    magicLinks: true,
    setup: Boolean(getSetupToken()),
  };
}

module.exports = {
  appMode,
  getAppBaseUrl,
  getAuthSessionSecret,
  getAuthSessionTtlDays,
  getClientFeatures,
  getCookieName,
  getCookieSameSite,
  getMagicLinkTtlMinutes,
  getSetupToken,
  isDevAuthEnabled,
  isDevelopmentMode,
  isProductionMode,
  shouldUseSecureCookies,
};
