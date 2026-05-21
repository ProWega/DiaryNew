"use strict";

/**
 * Репозиторий настраиваемых промптов ИИ-агентов.
 *
 * Один тип агента (`agent_type`) = много версий, ровно одна `is_current = true`
 * (UNIQUE PARTIAL индекс гарантирует). `saveNewVersion` атомарно:
 *   1. вычисляет следующий version,
 *   2. снимает is_current с предыдущей строки,
 *   3. вставляет новую как current.
 *
 * `restoreVersion(versionId)` создаёт НОВУЮ строку (с инкрементом version) на
 * основе старой — это сохраняет аудит-историю «когда был откат» как
 * самостоятельную запись и не воскрешает «погашенную» версию.
 */

const { query } = require("../postgres.cjs");
const { createId } = require("./common.cjs");

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    agentType: row.agent_type,
    name: row.name,
    version: row.version,
    systemText: row.system_text,
    blocksConfig: normalizeBlocks(row.blocks_config),
    model: row.model || null,
    maxTokens: row.max_tokens || null,
    isCurrent: Boolean(row.is_current),
    notes: row.notes || null,
    createdBy: row.created_by || null,
    createdAt: row.created_at,
  };
}

function normalizeBlocks(raw) {
  if (!raw) return [];
  let value = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  return value
    .map((block) => {
      if (!block || typeof block !== "object") return null;
      const key = typeof block.key === "string" ? block.key.trim() : "";
      if (!key) return null;
      return {
        key,
        enabled: block.enabled !== false,
      };
    })
    .filter(Boolean);
}

async function listCurrent() {
  const result = await query(
    `select id, agent_type, name, version, system_text, blocks_config,
            model, max_tokens, is_current, notes, created_by, created_at
       from agent_prompts
      where is_current = true
      order by agent_type asc`,
  );
  return result.rows.map(mapRow);
}

async function getCurrent(agentType) {
  if (!agentType) return null;
  const result = await query(
    `select id, agent_type, name, version, system_text, blocks_config,
            model, max_tokens, is_current, notes, created_by, created_at
       from agent_prompts
      where agent_type = $1 and is_current = true
      limit 1`,
    [agentType],
  );
  return mapRow(result.rows[0]);
}

async function getByVersionId(versionId) {
  if (!versionId) return null;
  const result = await query(
    `select id, agent_type, name, version, system_text, blocks_config,
            model, max_tokens, is_current, notes, created_by, created_at
       from agent_prompts
      where id = $1
      limit 1`,
    [versionId],
  );
  return mapRow(result.rows[0]);
}

async function listHistory(agentType, { limit = 50 } = {}) {
  if (!agentType) return [];
  const result = await query(
    `select id, agent_type, name, version, system_text, blocks_config,
            model, max_tokens, is_current, notes, created_by, created_at
       from agent_prompts
      where agent_type = $1
      order by version desc
      limit $2`,
    [agentType, limit],
  );
  return result.rows.map(mapRow);
}

/**
 * Транзакционно создаёт новую версию: снимает is_current с прошлой и вставляет
 * новую как current. payload: { name, systemText, blocksConfig[], model?, maxTokens?, notes? }.
 */
async function saveNewVersion(agentType, payload, createdBy) {
  if (!agentType) throw new Error("agentType is required");
  const safeBlocks = normalizeBlocks(payload.blocksConfig);
  const id = createId("agent-prompt");

  await query("BEGIN");
  try {
    const latest = await query(
      `select coalesce(max(version), 0) as v from agent_prompts where agent_type = $1`,
      [agentType],
    );
    const nextVersion = (latest.rows[0]?.v || 0) + 1;

    await query(
      `update agent_prompts
          set is_current = false
        where agent_type = $1 and is_current = true`,
      [agentType],
    );

    const inserted = await query(
      `insert into agent_prompts
         (id, agent_type, name, version, system_text, blocks_config,
          model, max_tokens, is_current, notes, created_by)
       values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, true, $9, $10)
       returning id, agent_type, name, version, system_text, blocks_config,
                 model, max_tokens, is_current, notes, created_by, created_at`,
      [
        id,
        agentType,
        payload.name || agentType,
        nextVersion,
        payload.systemText || "",
        JSON.stringify(safeBlocks),
        payload.model || null,
        payload.maxTokens || null,
        payload.notes || null,
        createdBy || null,
      ],
    );

    await query("COMMIT");
    return mapRow(inserted.rows[0]);
  } catch (error) {
    await query("ROLLBACK");
    throw error;
  }
}

/**
 * Откатывается на сохранённую версию — создаёт НОВУЮ строку с тем же контентом,
 * автоинкремент version, помечает is_current = true. Старая версия остаётся
 * в истории (с is_current = false). Если versionId уже current — возвращаем её
 * без изменений (no-op).
 */
async function restoreVersion(versionId, createdBy) {
  const target = await getByVersionId(versionId);
  if (!target) {
    const err = new Error("Версия промпта не найдена");
    err.status = 404;
    throw err;
  }
  if (target.isCurrent) return target;

  return saveNewVersion(
    target.agentType,
    {
      name: target.name,
      systemText: target.systemText,
      blocksConfig: target.blocksConfig,
      model: target.model,
      maxTokens: target.maxTokens,
      notes: `Откат на v${target.version}`,
    },
    createdBy,
  );
}

module.exports = {
  listCurrent,
  getCurrent,
  getByVersionId,
  listHistory,
  saveNewVersion,
  restoreVersion,
  // exports for testing
  __normalizeBlocks: normalizeBlocks,
};
