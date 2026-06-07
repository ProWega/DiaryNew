"use strict";

const { query } = require("../db/postgres.cjs");
const { logAuditEvent } = require("./auditLog.cjs");

/**
 * Запись участника об этапе пути. Хранится в `session_users.journey_stage`.
 *
 * Семантика patch:
 *  - { journeyStage: "search" }  — установить этап
 *  - { journeyStage: null }      — сбросить этап
 *  - {} (пустой patch)           — no-op
 *
 * Audit: каждый успешный апдейт пишет событие 'methodology.journey_stage.update'
 * с before/after в payload (через logAuditEvent, без блокировки).
 *
 * Колонка `session_users.is_careful_mode` оставлена в схеме для backward-compat,
 * но приложение её больше не читает и не пишет.
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

  if (!fields.length) {
    return readJourneyStage(viewerId, sessionId);
  }

  const before = await readJourneyStage(viewerId, sessionId);

  values.push(sessionId, viewerId);
  const sessionParam = `$${paramIndex++}`;
  const userParam = `$${paramIndex++}`;

  const result = await query(
    `UPDATE session_users
       SET ${fields.join(", ")}, updated_at = now()
       WHERE session_id = ${sessionParam} AND user_id = ${userParam}
       RETURNING journey_stage`,
    values,
  );

  if (!result.rows.length) {
    throw createError(404, "Участник не найден в этом заезде");
  }

  const after = {
    journeyStage: result.rows[0].journey_stage,
  };

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
    `SELECT journey_stage
       FROM session_users
       WHERE session_id = $1 AND user_id = $2
       LIMIT 1`,
    [sessionId, viewerId],
  );

  if (!result.rows.length) {
    return { journeyStage: null };
  }

  return {
    journeyStage: result.rows[0].journey_stage,
  };
}

function createError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

module.exports = { updateParticipantJourneyStage, readJourneyStage };
