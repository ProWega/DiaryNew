"use strict";

/**
 * Repository for istoki_submissions — the moderation queue.
 *
 * Each row carries a draft for one of three kinds (podcast / story /
 * chronicle) submitted by an anonymous visitor. Once an admin approves,
 * the draft is fanned out into the live istoki_* table via the existing
 * upsert helpers from istokiStore.cjs.
 */

const crypto = require("node:crypto");
const { query } = require("../postgres.cjs");
const { createId } = require("./common.cjs");
const { upsertPodcast, upsertStory, upsertChronicleEntry } = require("./istokiStore.cjs");

const ALLOWED_KINDS = new Set(["podcast", "story", "chronicle"]);
const ALLOWED_STATUSES = new Set(["pending", "approved", "rejected"]);

function rowToSubmission(row) {
  if (!row) return null;
  return {
    id: row.id,
    kind: row.kind,
    regionCode: row.region_code,
    status: row.status,
    submitterName: row.submitter_name,
    submitterEmail: row.submitter_email,
    draft: row.draft_payload || {},
    moderationNote: row.moderation_note || null,
    reviewedAt: row.reviewed_at,
    reviewedByUserId: row.reviewed_by_user_id || null,
    statusToken: row.status_token,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function publicSubmissionView(submission) {
  if (!submission) return null;
  return {
    id: submission.id,
    kind: submission.kind,
    regionCode: submission.regionCode,
    status: submission.status,
    moderationNote: submission.status === "rejected" ? submission.moderationNote : null,
    createdAt: submission.createdAt,
    reviewedAt: submission.reviewedAt,
  };
}

async function createSubmission({ kind, regionCode, submitterName, submitterEmail, draft }) {
  if (!ALLOWED_KINDS.has(kind)) {
    const err = new Error(`Unknown submission kind: ${kind}`);
    err.status = 400;
    throw err;
  }

  const id = createId("sub");
  const statusToken = crypto.randomBytes(24).toString("base64url");

  const result = await query(
    `
      insert into istoki_submissions
        (id, kind, region_code, status, submitter_name, submitter_email,
         draft_payload, status_token)
      values ($1, $2, $3, 'pending', $4, $5, $6::jsonb, $7)
      returning *
    `,
    [
      id,
      kind,
      regionCode || null,
      submitterName,
      submitterEmail,
      JSON.stringify(draft || {}),
      statusToken,
    ],
  );

  return rowToSubmission(result.rows[0]);
}

async function listSubmissions({ status, regionCode, limit = 50 } = {}) {
  const conditions = [];
  const params = [];

  if (status && ALLOWED_STATUSES.has(status)) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }
  if (regionCode) {
    params.push(regionCode);
    conditions.push(`region_code = $${params.length}`);
  }

  params.push(Math.min(Math.max(Number(limit) || 50, 1), 200));
  const limitParam = params.length;

  const where = conditions.length ? `where ${conditions.join(" and ")}` : "";
  const result = await query(
    `
      select *
      from istoki_submissions
      ${where}
      order by
        case status when 'pending' then 0 when 'approved' then 1 else 2 end,
        created_at desc
      limit $${limitParam}
    `,
    params,
  );

  return result.rows.map(rowToSubmission);
}

async function getSubmissionById(id) {
  const result = await query(`select * from istoki_submissions where id = $1`, [id]);
  return rowToSubmission(result.rows[0]);
}

async function getSubmissionByToken(token) {
  const result = await query(`select * from istoki_submissions where status_token = $1`, [token]);
  return rowToSubmission(result.rows[0]);
}

async function countByStatus() {
  const result = await query(
    `
      select status, count(*)::int as count
      from istoki_submissions
      group by status
    `,
  );
  const out = { pending: 0, approved: 0, rejected: 0 };
  for (const row of result.rows) {
    if (out[row.status] !== undefined) out[row.status] = Number(row.count);
  }
  return out;
}

async function approveSubmission({ id, actorId, note }) {
  const submission = await getSubmissionById(id);
  if (!submission) {
    const err = new Error("Заявка не найдена");
    err.status = 404;
    throw err;
  }
  if (submission.status !== "pending") {
    const err = new Error(
      `Заявка уже ${submission.status === "approved" ? "одобрена" : "отклонена"}`,
    );
    err.status = 409;
    throw err;
  }
  if (!submission.regionCode) {
    const err = new Error("Заявка без региона — задайте регион перед одобрением");
    err.status = 400;
    throw err;
  }

  // Fan out the draft into the appropriate live table. If this throws,
  // the submission stays 'pending' and the admin can retry — better than
  // marking it approved with no live row.
  const d = submission.draft || {};
  if (submission.kind === "podcast") {
    await upsertPodcast({
      regionCode: submission.regionCode,
      title: d.title,
      description: d.description || "",
      audioUrl: d.audioUrl,
      durationSec: Number.isFinite(d.durationSec) ? d.durationSec : 0,
      recordedAt: d.recordedAt || null,
      speakerName: d.speakerName || null,
      orderIdx: 0,
    });
  } else if (submission.kind === "story") {
    await upsertStory({
      regionCode: submission.regionCode,
      participantName: d.participantName,
      ageOrRole: d.ageOrRole,
      beforeText: d.beforeText,
      afterText: d.afterText,
      manifestoQuote: d.manifestoQuote,
      photoUrl: d.photoUrl,
      regionContextHint: d.regionContextHint || null,
      orderIdx: 0,
    });
  } else if (submission.kind === "chronicle") {
    await upsertChronicleEntry({
      regionCode: submission.regionCode,
      eventDate: d.eventDate,
      eventTitle: d.eventTitle,
      participantsCount: Number.isFinite(d.participantsCount) ? d.participantsCount : 0,
      keyInsights: Array.isArray(d.keyInsights) ? d.keyInsights : [],
      orderIdx: 0,
    });
  }

  const result = await query(
    `
      update istoki_submissions set
        status = 'approved',
        moderation_note = $2,
        reviewed_at = now(),
        reviewed_by_user_id = $3,
        updated_at = now()
      where id = $1 and status = 'pending'
      returning *
    `,
    [id, note || null, actorId || null],
  );
  return rowToSubmission(result.rows[0]);
}

async function rejectSubmission({ id, actorId, note }) {
  if (!note || !String(note).trim()) {
    const err = new Error("Причина отказа обязательна");
    err.status = 400;
    throw err;
  }

  const result = await query(
    `
      update istoki_submissions set
        status = 'rejected',
        moderation_note = $2,
        reviewed_at = now(),
        reviewed_by_user_id = $3,
        updated_at = now()
      where id = $1 and status = 'pending'
      returning *
    `,
    [id, String(note).trim(), actorId || null],
  );

  if (!result.rows.length) {
    const err = new Error("Заявка не найдена или уже обработана");
    err.status = 409;
    throw err;
  }
  return rowToSubmission(result.rows[0]);
}

module.exports = {
  ALLOWED_KINDS,
  ALLOWED_STATUSES,
  createSubmission,
  listSubmissions,
  getSubmissionById,
  getSubmissionByToken,
  countByStatus,
  approveSubmission,
  rejectSubmission,
  publicSubmissionView,
};
