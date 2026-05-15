"use strict";

/**
 * Параллельные мероприятия: явный выбор участника + честная статистика куратора.
 *
 * Слот = (session_id, day_id, start_time). Если в слоте >1 события с разными
 * `program_events.parallel_group` — это параллельный слот. Участник делает
 * явный выбор «иду на event X», и только после этого карточка слота
 * превращается в обычную (с stepper + комментом).
 *
 * Таблица хранит выбор отдельно от `diary_entries`:
 *   - не путаем «я был на этом» с «я написал коммент»;
 *   - смена выбора не теряет предыдущий коммент (он остаётся в diary_entries
 *     для куратора в архиве).
 *
 * UNIQUE(user, session, day, slot_key) гарантирует один выбор на слот.
 * Индекс по event_id — для быстрого подсчёта «N выбрали этот блок» в статистике.
 *
 * См. docs/architecture/methodology-mapping.md (раздел про потоки/параллели).
 */

exports.up = async (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS participant_parallel_selections (
      id           text PRIMARY KEY,
      user_id      text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      session_id   text NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      day_id       text NOT NULL REFERENCES program_days(id) ON DELETE CASCADE,
      slot_key     text NOT NULL,
      event_id     text NOT NULL REFERENCES program_events(id) ON DELETE CASCADE,
      selected_at  timestamptz NOT NULL DEFAULT now(),
      UNIQUE (user_id, session_id, day_id, slot_key)
    );
  `);

  pgm.sql(`
    CREATE INDEX IF NOT EXISTS participant_parallel_selections_event_idx
      ON participant_parallel_selections (event_id);
  `);

  pgm.sql(`
    CREATE INDEX IF NOT EXISTS participant_parallel_selections_session_day_idx
      ON participant_parallel_selections (session_id, day_id);
  `);
};

exports.down = async (pgm) => {
  pgm.sql(`DROP INDEX IF EXISTS participant_parallel_selections_session_day_idx;`);
  pgm.sql(`DROP INDEX IF EXISTS participant_parallel_selections_event_idx;`);
  pgm.sql(`DROP TABLE IF EXISTS participant_parallel_selections;`);
};
