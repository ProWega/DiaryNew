"use strict";

const crypto = require("node:crypto");

/**
 * Privacy-preserving hash of a client IP for the istoki_events table.
 *
 * Composition: sha256(ip + ":" + YYYY-MM-DD + ":" + PROCESS_SALT)
 *
 * - Within one UTC day the same IP hashes to the same value, so we can
 *   count distinct visitors without storing the raw IP.
 * - Across days the rotating date component breaks the link.
 * - PROCESS_SALT is generated once per process boot to defend against
 *   pre-computed rainbow tables of IPv4 space (which is ~4 billion
 *   sha256s — feasible to bake offline, infeasible to bake fresh
 *   per-process-restart).
 *
 * If `ip` is empty / unknown, we still return null instead of hashing
 * an empty string — that would collapse all anonymous events into a
 * single bogus visitor.
 */

const PROCESS_SALT = crypto.randomBytes(16).toString("hex");

function todayYmd() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function hashIp(ip) {
  if (!ip || typeof ip !== "string") return null;
  return crypto.createHash("sha256").update(`${ip}:${todayYmd()}:${PROCESS_SALT}`).digest("hex");
}

module.exports = { hashIp };
