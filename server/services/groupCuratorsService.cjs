"use strict";

/**
 * Список кураторов группы для конструктора контекста в кабинете организатора.
 *
 * Возвращает per-куратор: id / полное имя / число preset'ов / факт наличия
 * default-preset / последняя активность в чате (для группировки «активные
 * сейчас vs не пользовался»).
 */

const { query } = require("../db/postgres.cjs");

async function listCuratorsForGroup({ sessionId, groupId }) {
  // Источник правды о кураторах — groups.curator_id (основное назначение).
  // Дополнительно подмешиваем session_users.role='curator' для случаев, когда
  // куратор привязан только через таблицу session_users.
  const result = await query(
    `with curators as (
       select g.curator_id as user_id
         from groups g
         where g.id = $2 and g.session_id = $1 and g.curator_id is not null
       union
       select su.user_id
         from session_users su
         where su.session_id = $1 and su.group_id = $2
           and su.role = 'curator' and su.status = 'active'
     )
     select
       u.id,
       u.full_name,
       coalesce(p.preset_count, 0)::int as preset_count,
       coalesce(p.has_default, false) as has_default,
       t.last_message_at
     from curators c
     join users u on u.id = c.user_id
     left join (
       select curator_id,
              count(*) as preset_count,
              bool_or(is_default) as has_default
       from curator_chat_presets
       where session_id = $1 and group_id = $2
       group by curator_id
     ) p on p.curator_id = u.id
     left join (
       select curator_id, max(last_message_at) as last_message_at
       from curator_chat_threads
       where session_id = $1 and group_id = $2
       group by curator_id
     ) t on t.curator_id = u.id
     order by u.full_name`,
    [sessionId, groupId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    fullName: row.full_name,
    presetsCount: row.preset_count,
    hasDefaultPreset: Boolean(row.has_default),
    lastMessageAt: row.last_message_at,
  }));
}

module.exports = { listCuratorsForGroup };
