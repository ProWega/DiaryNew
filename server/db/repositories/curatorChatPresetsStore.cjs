"use strict";

/**
 * Репозиторий именованных preset'ов контекста для чата куратора.
 *
 * Один preset = (label, filter JSONB, is_default boolean). Один из presets per
 * (session, group, curator) может быть помечен `is_default = true` — он
 * применяется автоматически если в chat-запросе не передан явный filter.
 *
 * UNIQUE partial index на `(session, group, curator) WHERE is_default = true`
 * гарантирует не больше одного default'а. `setDefault` атомарно снимает флаг
 * со всех остальных presets куратора в той же группе.
 */

const { query } = require("../postgres.cjs");
const { createId } = require("./common.cjs");
const { normalizeFilter } = require("../../services/chatContextFilter.cjs");

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    sessionId: row.session_id,
    groupId: row.group_id,
    curatorId: row.curator_id,
    label: row.label,
    filter: normalizeFilter(row.filter),
    isDefault: Boolean(row.is_default),
    createdBy: row.created_by || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function listByCuratorGroup({ sessionId, groupId, curatorId }) {
  const result = await query(
    `select id, session_id, group_id, curator_id, label, filter, is_default,
            created_by, created_at, updated_at
       from curator_chat_presets
      where session_id = $1 and group_id = $2 and curator_id = $3
      order by is_default desc, updated_at desc`,
    [sessionId, groupId, curatorId],
  );
  return result.rows.map(mapRow);
}

async function getDefault({ sessionId, groupId, curatorId }) {
  const result = await query(
    `select id, session_id, group_id, curator_id, label, filter, is_default,
            created_by, created_at, updated_at
       from curator_chat_presets
      where session_id = $1 and group_id = $2 and curator_id = $3
        and is_default = true
      limit 1`,
    [sessionId, groupId, curatorId],
  );
  return mapRow(result.rows[0]);
}

async function getById(presetId) {
  const result = await query(
    `select id, session_id, group_id, curator_id, label, filter, is_default,
            created_by, created_at, updated_at
       from curator_chat_presets
      where id = $1
      limit 1`,
    [presetId],
  );
  return mapRow(result.rows[0]);
}

/**
 * Создаёт новый preset. Если `isDefault = true` — снимает флаг со всех других
 * presets куратора в той же группе атомарно (в транзакции).
 */
async function createPreset({
  sessionId,
  groupId,
  curatorId,
  label,
  filter,
  isDefault = false,
  createdBy,
}) {
  const id = createId("chat-preset");
  const normalized = normalizeFilter(filter);

  // Транзакция: если is_default — сначала очищаем флаг у других, потом insert.
  await query("BEGIN");
  try {
    if (isDefault) {
      await query(
        `update curator_chat_presets
            set is_default = false, updated_at = now()
          where session_id = $1 and group_id = $2 and curator_id = $3
            and is_default = true`,
        [sessionId, groupId, curatorId],
      );
    }
    const result = await query(
      `insert into curator_chat_presets
         (id, session_id, group_id, curator_id, label, filter, is_default, created_by)
       values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
       returning id, session_id, group_id, curator_id, label, filter, is_default,
                 created_by, created_at, updated_at`,
      [
        id,
        sessionId,
        groupId,
        curatorId,
        label,
        JSON.stringify(normalized),
        isDefault,
        createdBy || null,
      ],
    );
    await query("COMMIT");
    return mapRow(result.rows[0]);
  } catch (error) {
    await query("ROLLBACK");
    throw error;
  }
}

/**
 * Patch preset'а. Любые поля опциональны.
 * Если `isDefault = true` → атомарно снимает флаг с других.
 */
async function updatePreset(presetId, { label, filter, isDefault } = {}) {
  await query("BEGIN");
  try {
    // Если устанавливается isDefault — сначала снять с других.
    if (isDefault === true) {
      const existing = await query(
        `select session_id, group_id, curator_id from curator_chat_presets where id = $1`,
        [presetId],
      );
      const row = existing.rows[0];
      if (row) {
        await query(
          `update curator_chat_presets
              set is_default = false, updated_at = now()
            where session_id = $1 and group_id = $2 and curator_id = $3
              and is_default = true and id <> $4`,
          [row.session_id, row.group_id, row.curator_id, presetId],
        );
      }
    }

    const fields = [];
    const values = [];
    let i = 1;

    if (label !== undefined) {
      fields.push(`label = $${i++}`);
      values.push(label);
    }
    if (filter !== undefined) {
      fields.push(`filter = $${i++}::jsonb`);
      values.push(JSON.stringify(normalizeFilter(filter)));
    }
    if (isDefault !== undefined) {
      fields.push(`is_default = $${i++}`);
      values.push(Boolean(isDefault));
    }

    if (!fields.length) {
      await query("COMMIT");
      return getById(presetId);
    }

    fields.push(`updated_at = now()`);
    values.push(presetId);

    const result = await query(
      `update curator_chat_presets
          set ${fields.join(", ")}
        where id = $${i}
        returning id, session_id, group_id, curator_id, label, filter, is_default,
                  created_by, created_at, updated_at`,
      values,
    );
    await query("COMMIT");
    return mapRow(result.rows[0]);
  } catch (error) {
    await query("ROLLBACK");
    throw error;
  }
}

async function deletePreset(presetId) {
  await query(`delete from curator_chat_presets where id = $1`, [presetId]);
}

module.exports = {
  listByCuratorGroup,
  getDefault,
  getById,
  createPreset,
  updatePreset,
  deletePreset,
};
