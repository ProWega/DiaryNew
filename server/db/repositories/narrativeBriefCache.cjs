"use strict";

/**
 * Репозиторий persistent-кеша narrative-brief.
 *
 * Ключ кеша: `(session_id, group_id, day_id, fingerprint, model)`. Fingerprint
 * считается в `narrativeBriefLLM.cjs` из стабильной серии inputs (members,
 * entries, events, concepts, prompt-version) — любые изменения данных дают
 * новый отпечаток и, как следствие, кеш-miss.
 *
 * Стратегия версий: при force-regenerate ставим `is_current=false` всем строкам
 * `(session, group, day)`, потом INSERT'им новую с `is_current=true`. Старые
 * записи живут до удаления заезда (CASCADE) — они полезны для аудита и
 * сравнения моделей на одних и тех же входах.
 */

const { query } = require("../postgres.cjs");
const { createId } = require("./common.cjs");

async function findCurrent({ sessionId, groupId, dayId, fingerprint, model }) {
  if (!sessionId || !groupId || !dayId || !fingerprint || !model) return null;
  const result = await query(
    `select id, narrative_text, model, input_tokens, output_tokens,
            cache_read_tokens, generated_at, generated_by
       from narrative_brief_cache
       where session_id = $1
         and group_id   = $2
         and day_id     = $3
         and fingerprint = $4
         and model      = $5
         and is_current = true
       order by generated_at desc
       limit 1`,
    [sessionId, groupId, dayId, fingerprint, model],
  );
  if (!result.rows.length) return null;
  const row = result.rows[0];
  return {
    id: row.id,
    narrativeText: row.narrative_text,
    model: row.model,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    cacheReadTokens: row.cache_read_tokens,
    generatedAt: row.generated_at,
    generatedBy: row.generated_by,
  };
}

/**
 * Помечает все current-записи для `(session, group, day)` как stale.
 * Вызывается перед force-regenerate, чтобы новый insert встал как
 * единственный `is_current=true`.
 */
async function markStale({ sessionId, groupId, dayId }) {
  await query(
    `update narrative_brief_cache
       set is_current = false
     where session_id = $1
       and group_id   = $2
       and day_id     = $3
       and is_current = true`,
    [sessionId, groupId, dayId],
  );
}

/**
 * Вставка новой версии narrative. UPSERT по UNIQUE-ключу — если ровно тот же
 * fingerprint+model уже был (например, два параллельных вызова regen) — берём
 * существующий row.
 */
async function insertNarrative({
  sessionId,
  groupId,
  dayId,
  fingerprint,
  model,
  narrativeText,
  inputTokens = 0,
  outputTokens = 0,
  cacheReadTokens = 0,
  generatedBy,
}) {
  const id = createId("brief-cache");
  const result = await query(
    `insert into narrative_brief_cache
       (id, session_id, group_id, day_id, fingerprint, model,
        narrative_text, input_tokens, output_tokens, cache_read_tokens,
        generated_by, is_current)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
     on conflict (session_id, group_id, day_id, fingerprint, model)
       do update set
         narrative_text    = excluded.narrative_text,
         input_tokens      = excluded.input_tokens,
         output_tokens     = excluded.output_tokens,
         cache_read_tokens = excluded.cache_read_tokens,
         generated_by      = excluded.generated_by,
         generated_at      = now(),
         is_current        = true
     returning id, generated_at`,
    [
      id,
      sessionId,
      groupId,
      dayId,
      fingerprint,
      model,
      narrativeText,
      inputTokens,
      outputTokens,
      cacheReadTokens,
      generatedBy,
    ],
  );
  return result.rows[0] || { id, generated_at: new Date().toISOString() };
}

/**
 * История версий narrative для (session, group, day) — для отладки и для
 * потенциального UI «версии записки» (не делается в этом релизе).
 */
async function listHistory({ sessionId, groupId, dayId, limit = 20 }) {
  const result = await query(
    `select id, model, narrative_text, input_tokens, output_tokens,
            cache_read_tokens, generated_at, generated_by, is_current
       from narrative_brief_cache
       where session_id = $1 and group_id = $2 and day_id = $3
       order by generated_at desc
       limit $4`,
    [sessionId, groupId, dayId, limit],
  );
  return result.rows.map((row) => ({
    id: row.id,
    model: row.model,
    narrativeText: row.narrative_text,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    cacheReadTokens: row.cache_read_tokens,
    generatedAt: row.generated_at,
    generatedBy: row.generated_by,
    isCurrent: row.is_current,
  }));
}

module.exports = {
  findCurrent,
  markStale,
  insertNarrative,
  listHistory,
};
