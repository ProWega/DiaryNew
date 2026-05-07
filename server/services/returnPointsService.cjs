"use strict";

/**
 * «Точки возврата» — life after smena (methodology v4 §2.6).
 *
 * Soft invitations to «дополнить запись» about a session, anchored on
 * `sessions.end_date` and computed lazily at request time. Five touchpoints
 * per session, indexed 1..5 → weeks 1, 4, 12, 26, 52.
 *
 * The actual responses live in the `return_entries` table; everything else
 * (scheduled date, status) is derived on the fly. No cron, no email yet.
 */

const { query } = require("../db/postgres.cjs");
const { createId } = require("../db/repositories/common.cjs");
const { logAuditEvent } = require("./auditLog.cjs");

const TOUCHPOINT_WEEKS = Object.freeze([1, 4, 12, 26, 52]);
const TOUCHPOINT_INVITATIONS = Object.freeze({
  1: "Прошла неделя — что осталось рядом, а что отдалилось?",
  2: "Месяц спустя — что подвинулось, что задержалось?",
  3: "Три месяца — что из услышанного оказалось вашим?",
  4: "Полгода — какая дорога продолжается?",
  5: "Год — что вспоминается само, без усилия?",
});

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

/**
 * Compute the scheduled JS Date for a given session end_date and touchpoint.
 * Pure helper — exported for unit tests.
 */
function scheduledDateFor(sessionEndDate, touchpointIndex) {
  if (!sessionEndDate) return null;
  const base = new Date(sessionEndDate);
  if (Number.isNaN(base.getTime())) return null;
  const weeks = TOUCHPOINT_WEEKS[touchpointIndex - 1];
  if (weeks == null) return null;
  return new Date(base.getTime() + weeks * MS_PER_WEEK);
}

/**
 * Compute the status of one touchpoint at a moment in time.
 *  - "responded" → user has already written something for this point
 *  - "available" → scheduled date is in the past, no response yet
 *  - "future"    → scheduled date is in the future
 */
function computeStatus({ scheduledFor, now, hasResponse }) {
  if (hasResponse) return "responded";
  if (!scheduledFor) return "future";
  return scheduledFor.getTime() <= now.getTime() ? "available" : "future";
}

/**
 * Build the array of return-point records for one (session, user) pair.
 * Pure — takes pre-fetched session row + responses. Exported for tests.
 */
function buildReturnPointsForSession({ session, responses, now }) {
  return TOUCHPOINT_WEEKS.map((weeks, index) => {
    const touchpointIndex = index + 1;
    const scheduledFor = scheduledDateFor(session.end_date, touchpointIndex);
    const response = responses.find((r) => r.touchpoint_index === touchpointIndex) || null;
    return {
      sessionId: session.id,
      sessionLabel: session.name || session.id,
      touchpointIndex,
      weeksAfter: weeks,
      scheduledFor: scheduledFor ? scheduledFor.toISOString() : null,
      invitation: TOUCHPOINT_INVITATIONS[touchpointIndex],
      status: computeStatus({ scheduledFor, now, hasResponse: Boolean(response) }),
      response: response
        ? {
            id: response.id,
            content: response.content,
            isAnonymous: Boolean(response.is_anonymous),
            isHiddenFromCurator: Boolean(response.is_hidden_from_curator),
            updatedAt: response.updated_at,
          }
        : null,
    };
  });
}

async function fetchParticipantSessions(userId) {
  const result = await query(
    `SELECT s.id, s.name, s.end_date
     FROM sessions s
     JOIN session_users su ON su.session_id = s.id
     WHERE su.user_id = $1
       AND su.role = 'participant'
       AND su.status = 'active'
       AND s.end_date IS NOT NULL`,
    [userId],
  );
  return result.rows;
}

async function fetchResponses(userId, sessionIds) {
  if (sessionIds.length === 0) return new Map();
  const result = await query(
    `SELECT id, session_id, touchpoint_index, content, is_anonymous,
            is_hidden_from_curator, updated_at
     FROM return_entries
     WHERE user_id = $1 AND session_id = ANY($2::text[])`,
    [userId, sessionIds],
  );
  const bySession = new Map();
  for (const row of result.rows) {
    if (!bySession.has(row.session_id)) bySession.set(row.session_id, []);
    bySession.get(row.session_id).push(row);
  }
  return bySession;
}

/**
 * Returns all return points (one per touchpoint × session attended) for the
 * viewer. Past sessions only — sessions without `end_date` are skipped.
 */
async function getReturnPointsForViewer(viewerId) {
  if (!viewerId) {
    const error = new Error("Не передан идентификатор пользователя");
    error.status = 401;
    throw error;
  }

  const sessions = await fetchParticipantSessions(viewerId);
  if (sessions.length === 0) return [];

  const responsesBySession = await fetchResponses(
    viewerId,
    sessions.map((s) => s.id),
  );
  const now = new Date();

  return sessions
    .flatMap((session) =>
      buildReturnPointsForSession({
        session,
        responses: responsesBySession.get(session.id) || [],
        now,
      }),
    )
    .sort((left, right) => {
      // Most recent (and overdue) first; future ones at the bottom.
      const leftKey = left.status === "future" ? 1 : 0;
      const rightKey = right.status === "future" ? 1 : 0;
      if (leftKey !== rightKey) return leftKey - rightKey;
      const leftTime = left.scheduledFor ? new Date(left.scheduledFor).getTime() : 0;
      const rightTime = right.scheduledFor ? new Date(right.scheduledFor).getTime() : 0;
      return rightTime - leftTime;
    });
}

/**
 * Submit a return entry. Upserts on (user_id, session_id, touchpoint_index)
 * so the participant can revise their own response.
 */
async function submitReturnEntry({ viewerId, sessionId, touchpointIndex, patch }) {
  if (!viewerId) {
    const error = new Error("Не передан идентификатор пользователя");
    error.status = 401;
    throw error;
  }
  if (!Number.isInteger(touchpointIndex) || touchpointIndex < 1 || touchpointIndex > 5) {
    const error = new Error("Некорректный индекс точки возврата");
    error.status = 400;
    throw error;
  }

  // Confirm the user actually attended this session — privacy-by-design.
  const access = await query(
    `SELECT 1 FROM session_users
     WHERE user_id = $1 AND session_id = $2 AND role = 'participant'`,
    [viewerId, sessionId],
  );
  if (access.rowCount === 0) {
    const error = new Error("Эта смена недоступна для записи");
    error.status = 403;
    throw error;
  }

  const content = String(patch?.content || "").trim();
  if (!content) {
    const error = new Error("Запись не может быть пустой");
    error.status = 400;
    throw error;
  }

  const isAnonymous = Boolean(patch?.isAnonymous);
  const isHiddenFromCurator = Boolean(patch?.isHiddenFromCurator);

  const result = await query(
    `INSERT INTO return_entries
       (id, user_id, session_id, touchpoint_index, content,
        is_anonymous, is_hidden_from_curator)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (user_id, session_id, touchpoint_index)
     DO UPDATE SET
       content = excluded.content,
       is_anonymous = excluded.is_anonymous,
       is_hidden_from_curator = excluded.is_hidden_from_curator,
       updated_at = now()
     RETURNING id, content, is_anonymous, is_hidden_from_curator, updated_at`,
    [
      createId("return"),
      viewerId,
      sessionId,
      touchpointIndex,
      content,
      isAnonymous,
      isHiddenFromCurator,
    ],
  );

  const row = result.rows[0];

  logAuditEvent({
    actorId: viewerId,
    sessionId,
    action: "methodology.return_entry.write",
    entityType: "return_entry",
    entityId: row.id,
    payload: { touchpointIndex, isAnonymous, isHiddenFromCurator },
  });

  return {
    id: row.id,
    content: row.content,
    isAnonymous: row.is_anonymous,
    isHiddenFromCurator: row.is_hidden_from_curator,
    updatedAt: row.updated_at,
  };
}

module.exports = {
  TOUCHPOINT_WEEKS,
  TOUCHPOINT_INVITATIONS,
  scheduledDateFor,
  computeStatus,
  buildReturnPointsForSession,
  getReturnPointsForViewer,
  submitReturnEntry,
};
