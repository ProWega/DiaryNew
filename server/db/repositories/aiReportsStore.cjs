"use strict";

/**
 * Репозиторий AI-отчётов (`ai_reports`).
 *
 * Используется для разных scope: `program-analytics` (анализ программы),
 * `group-summary` (потенциально), etc. Версия инкрементируется автоматически
 * per (session_id, scope, [day_id]).
 */

const { query } = require("../postgres.cjs");
const { createId } = require("./common.cjs");

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    sessionId: row.session_id,
    groupId: row.group_id || null,
    scope: row.scope,
    dayId: row.day_id || null,
    title: row.title,
    confidence: row.confidence,
    content: row.content || {},
    version: row.version,
    createdBy: row.created_by || null,
    createdAt: row.created_at,
  };
}

async function insertReport({
  sessionId,
  groupId = null,
  scope,
  dayId = null,
  title,
  confidence = "medium",
  content,
  createdBy = null,
}) {
  if (!sessionId || !scope || !title) {
    throw new Error("sessionId, scope, title are required");
  }
  // Auto-bump version per (session, scope, day_id)
  const versionRes = await query(
    `select coalesce(max(version), 0) as v
       from ai_reports
      where session_id = $1 and scope = $2
        and ($3::text is null or day_id = $3 or day_id is null)`,
    [sessionId, scope, dayId],
  );
  const nextVersion = (versionRes.rows[0]?.v || 0) + 1;

  const id = createId("ai-report");
  const result = await query(
    `insert into ai_reports (id, session_id, group_id, scope, day_id, title, confidence, content, version, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)
     returning id, session_id, group_id, scope, day_id, title, confidence, content, version, created_by, created_at`,
    [
      id,
      sessionId,
      groupId,
      scope,
      dayId,
      title,
      confidence,
      JSON.stringify(content || {}),
      nextVersion,
      createdBy,
    ],
  );
  return mapRow(result.rows[0]);
}

async function listReports({ sessionId, scope, groupId, limit = 50 } = {}) {
  const params = [];
  const conditions = [];
  if (sessionId) {
    params.push(sessionId);
    conditions.push(`session_id = $${params.length}`);
  }
  if (scope) {
    params.push(scope);
    conditions.push(`scope = $${params.length}`);
  }
  if (groupId) {
    params.push(groupId);
    conditions.push(`group_id = $${params.length}`);
  }
  params.push(Math.min(200, Math.max(1, limit)));
  const where = conditions.length ? `where ${conditions.join(" and ")}` : "";
  const result = await query(
    `select id, session_id, group_id, scope, day_id, title, confidence, content, version, created_by, created_at
       from ai_reports ${where}
       order by created_at desc
       limit $${params.length}`,
    params,
  );
  return result.rows.map(mapRow);
}

async function getReport(reportId) {
  if (!reportId) return null;
  const result = await query(
    `select id, session_id, group_id, scope, day_id, title, confidence, content, version, created_by, created_at
       from ai_reports
      where id = $1
      limit 1`,
    [reportId],
  );
  return mapRow(result.rows[0]);
}

module.exports = {
  insertReport,
  listReports,
  getReport,
};
