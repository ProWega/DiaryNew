"use strict";

const { query } = require("../db/postgres.cjs");
const { logAuditEvent } = require("./auditLog.cjs");

/**
 * Methodology v4: запись участника об этапе пути и/или флаге careful_mode.
 * Хранится в `session_users.journey_stage` и `session_users.is_careful_mode`
 * (см. миграцию 1751000000000_journey_stage_and_careful_mode).
 *
 * Семантика patch:
 *  - { journeyStage: "search" }                       — только этап
 *  - { isCarefulMode: true }                          — только бережно
 *  - { journeyStage: null }                           — сброс этапа
 *  - { journeyStage: "support", isCarefulMode: true } — оба сразу
 *  - {} (пустой patch)                                — no-op
 *
 * Audit: каждый успешный апдейт пишет событие 'methodology.journey_stage.update'
 * с полным before/after diff в payload (без блокировки, через logAuditEvent).
 */
async function updateParticipantJourneyStage({ viewerId, sessionId, patch }) {
  if (!viewerId || !sessionId) {
    throw createError(400, "viewerId и sessionId обязательны");
  }

  const safePatch = patch || {};
  const fields = [];
  const values = [];
  let paramIndex = 1;

  if (Object.prototype.hasOwnProperty.call(safePatch, "journeyStage")) {
    fields.push(`journey_stage = $${paramIndex++}`);
    values.push(safePatch.journeyStage ?? null);
  }
  if (Object.prototype.hasOwnProperty.call(safePatch, "isCarefulMode")) {
    fields.push(`is_careful_mode = $${paramIndex++}`);
    values.push(Boolean(safePatch.isCarefulMode));
  }

  if (!fields.length) {
    // No-op patch — return current state without writing.
    return readJourneyStage(viewerId, sessionId);
  }

  // Read current state for audit before/after.
  const before = await readJourneyStage(viewerId, sessionId);

  values.push(sessionId, viewerId);
  const sessionParam = `$${paramIndex++}`;
  const userParam = `$${paramIndex++}`;

  const result = await query(
    `UPDATE session_users
       SET ${fields.join(", ")}, updated_at = now()
       WHERE session_id = ${sessionParam} AND user_id = ${userParam}
       RETURNING journey_stage, is_careful_mode`,
    values,
  );

  if (!result.rows.length) {
    throw createError(404, "Участник не найден в этом заезде");
  }

  const row = result.rows[0];
  const after = {
    journeyStage: row.journey_stage,
    isCarefulMode: row.is_careful_mode,
  };

  // Non-blocking audit write.
  logAuditEvent({
    actorId: viewerId,
    sessionId,
    action: "methodology.journey_stage.update",
    entityType: "session_user",
    entityId: viewerId,
    payload: { before, after },
  });

  return after;
}

async function readJourneyStage(viewerId, sessionId) {
  const result = await query(
    `SELECT journey_stage, is_careful_mode
       FROM session_users
       WHERE session_id = $1 AND user_id = $2
       LIMIT 1`,
    [sessionId, viewerId],
  );

  if (!result.rows.length) {
    return { journeyStage: null, isCarefulMode: false };
  }

  return {
    journeyStage: result.rows[0].journey_stage,
    isCarefulMode: result.rows[0].is_careful_mode,
  };
}

function createError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

module.exports = { updateParticipantJourneyStage, readJourneyStage };
