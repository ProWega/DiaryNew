"use strict";

const { randomUUID } = require("crypto");
const { query } = require("../db/postgres.cjs");

/**
 * Writes a row to audit_log. Non-blocking — failures are logged but never thrown
 * so a broken audit path never breaks the operation.
 *
 * @param {{ actorId: string, sessionId?: string|null, action: string,
 *           entityType?: string, entityId?: string, payload?: object }} event
 */
async function logAuditEvent({
  actorId,
  sessionId = null,
  action,
  entityType = null,
  entityId = null,
  payload = {},
}) {
  try {
    await query(
      `INSERT INTO audit_log (id, actor_id, session_id, action, entity_type, entity_id, payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        randomUUID(),
        actorId || null,
        sessionId || null,
        action,
        entityType,
        entityId,
        JSON.stringify(payload),
      ],
    );
  } catch (err) {
    // intentional: audit failure must not surface to the caller
    console.error("[audit] write failed:", err.message);
  }
}

module.exports = { logAuditEvent };
