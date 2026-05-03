const pino = require("pino");

const level =
  process.env.LOG_LEVEL ||
  (process.env.NODE_ENV === "test"
    ? "silent"
    : process.env.NODE_ENV === "production"
      ? "info"
      : "debug");

const logger = pino({
  level,
  base: { service: "newdiary-api" },
  redact: {
    paths: ["req.headers.cookie", "req.headers.authorization", "res.headers['set-cookie']"],
    censor: "[redacted]",
  },
});

module.exports = logger;
