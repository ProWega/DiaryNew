"use strict";

/**
 * Репозиторий пакетов приглашений (invite_batches).
 *
 * Каждый пакет — один клик «Сгенерировать PDF» / выпуск magic-link'ов:
 *   { id, sessionId, layout, title, footer, ttlMinutes,
 *     invites: jsonb [{ groupId, groupName, role, fullName,
 *                       url, expiresAt, magicLinkId }],
 *     groupsCount, invitesCount, createdAt, createdBy }
 *
 * Используется:
 *  - organizer bulk invites (история выпусков + re-render PDF без новых
 *    magic-link'ов);
 *  - admin single magic-link (после persistInviteBatch куратор видит его
 *    в кабинете);
 *  - curator invites (одиночные и bulk по xlsx).
 *
 * URL magic-link'а в jsonb хранится в open form (не хеш), потому что
 * `auth_magic_links` хранит только token_hash и восстановить URL после
 * выпуска невозможно. Доступ к invite_batches — через RBAC роуты
 * (requireOrganizer / requireCurator + ensureCuratorAccess).
 *
 * До 2026-06-09 эти функции жили в server/services/inviteDocumentService.cjs
 * — вынесли сюда, чтобы curator-роуты не зависели от tажёлого сервиса с
 * pdfkit/pdf-lib/qrcode.
 */

const { query } = require("../postgres.cjs");
const { createId } = require("./common.cjs");

/**
 * Сохраняет один пакет приглашений. Возвращает {id, createdAt}.
 *
 * `invites` — массив объектов с минимум {groupId, fullName, role, url,
 * expiresAt}. Опционально {groupName, magicLinkId, meta}.
 */
async function persistInviteBatch({
  sessionId,
  actorId,
  invites,
  layout,
  title,
  footer,
  ttlMinutes,
}) {
  if (!sessionId) {
    const err = new Error("sessionId обязателен");
    err.status = 400;
    throw err;
  }
  if (!Array.isArray(invites)) {
    const err = new Error("invites должен быть массивом");
    err.status = 400;
    throw err;
  }

  const id = createId("invite-batch");
  const uniqueGroups = new Set(invites.map((i) => i.groupId || i.groupName).filter(Boolean));
  const result = await query(
    `insert into invite_batches
       (id, session_id, created_by, layout, title, footer, ttl_minutes,
        invites, groups_count, invites_count)
     values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)
     returning id, created_at`,
    [
      id,
      sessionId,
      actorId || null,
      layout || "card",
      title || null,
      footer || null,
      ttlMinutes != null ? Number(ttlMinutes) : null,
      JSON.stringify(invites),
      uniqueGroups.size,
      invites.length,
    ],
  );
  return { id: result.rows[0].id, createdAt: result.rows[0].created_at };
}

function mapBatchRow(row, { includeInvites = false } = {}) {
  if (!row) return null;
  return {
    id: row.id,
    sessionId: row.session_id,
    createdBy: row.created_by || null,
    layout: row.layout || "card",
    title: row.title || null,
    footer: row.footer || null,
    ttlMinutes: row.ttl_minutes || null,
    groupsCount: row.groups_count || 0,
    invitesCount: row.invites_count || 0,
    createdAt: row.created_at,
    ...(includeInvites ? { invites: Array.isArray(row.invites) ? row.invites : [] } : {}),
  };
}

async function listInviteBatches({ sessionId, limit = 50 }) {
  const result = await query(
    `select id, session_id, created_by, layout, title, footer, ttl_minutes,
            groups_count, invites_count, created_at
       from invite_batches
       where session_id = $1
       order by created_at desc
       limit $2`,
    [sessionId, Math.min(200, Math.max(1, limit))],
  );
  return result.rows.map((row) => mapBatchRow(row));
}

async function getInviteBatch(batchId) {
  if (!batchId) return null;
  const result = await query(
    `select id, session_id, created_by, layout, title, footer, ttl_minutes,
            invites, groups_count, invites_count, created_at
       from invite_batches
       where id = $1
       limit 1`,
    [batchId],
  );
  return mapBatchRow(result.rows[0], { includeInvites: true });
}

/**
 * Все пакеты сессии — с jsonb invites. Используется для curator-эндпоинта,
 * которому нужно собрать актуальный список инвайтов своей группы со статусом.
 */
async function getInviteBatchesForSession(sessionId) {
  if (!sessionId) return [];
  const result = await query(
    `select id, session_id, created_by, layout, title, footer, ttl_minutes,
            invites, groups_count, invites_count, created_at
       from invite_batches
       where session_id = $1
       order by created_at desc`,
    [sessionId],
  );
  return result.rows.map((row) => mapBatchRow(row, { includeInvites: true }));
}

/**
 * Возвращает плоский список инвайтов для конкретной группы со статусом:
 *
 *   { magicLinkId, fullName, role, url, expiresAt, createdAt, createdBy,
 *     consumedAt, status: 'pending' | 'consumed' | 'expired' }
 *
 * Алгоритм:
 *   1. Берёт все батчи сессии (`getInviteBatchesForSession`).
 *   2. Из каждого батча разворачивает `invites jsonb` и фильтрует по `groupId`.
 *   3. Собирает `magicLinkId`s и одной выборкой получает `consumed_at`
 *      из `auth_magic_links` (lookup map).
 *   4. Считает статус: consumed > expired > pending.
 *
 * Сортировка результата — от свежих к старым.
 */
async function getInvitesForGroup({ sessionId, groupId }) {
  if (!sessionId || !groupId) return [];

  const batches = await getInviteBatchesForSession(sessionId);
  const flat = [];
  for (const batch of batches) {
    for (const inv of batch.invites || []) {
      if (inv.groupId !== groupId) continue;
      flat.push({
        magicLinkId: inv.magicLinkId || null,
        fullName: inv.fullName || "",
        role: inv.role || "participant",
        url: inv.url || null,
        expiresAt: inv.expiresAt || null,
        createdAt: batch.createdAt,
        createdBy: batch.createdBy || null,
        batchId: batch.id,
      });
    }
  }

  if (!flat.length) return [];

  // Один SELECT по всем magicLinkId сразу (если есть).
  const magicLinkIds = flat.map((i) => i.magicLinkId).filter(Boolean);
  const consumedMap = new Map();
  if (magicLinkIds.length) {
    const consumedRes = await query(
      `select id, consumed_at from auth_magic_links where id = ANY($1::text[])`,
      [magicLinkIds],
    );
    for (const row of consumedRes.rows) {
      consumedMap.set(row.id, row.consumed_at);
    }
  }

  const now = Date.now();
  return flat.map((inv) => {
    const consumedAt = inv.magicLinkId ? consumedMap.get(inv.magicLinkId) || null : null;
    const expiresMs = inv.expiresAt ? new Date(inv.expiresAt).getTime() : null;
    let status = "pending";
    if (consumedAt) status = "consumed";
    else if (expiresMs && expiresMs < now) status = "expired";
    return { ...inv, consumedAt, status };
  });
}

module.exports = {
  persistInviteBatch,
  listInviteBatches,
  getInviteBatch,
  getInviteBatchesForSession,
  getInvitesForGroup,
};
