"use strict";

/**
 * Тесты `curatorChatContext.buildPreamble` для нового feedback-блока.
 * Мокаем `query()` из postgres.cjs, чтобы не подключаться к реальной БД.
 */

jest.mock("../db/postgres.cjs", () => ({
  query: jest.fn(),
}));

jest.mock("../db/repositories/eventConceptsStore.cjs", () => ({
  listBySession: jest.fn(async () => []),
}));

const { query } = require("../db/postgres.cjs");
const { buildPreamble } = require("./curatorChatContext.cjs");

// Хелпер: устанавливает порядок ответов на последовательные `query()`-вызовы.
// Порядок promise.all внутри buildPreamble:
//   [members, comments, reflections, conceptsRaw (mocked separately), stateLevels]
function mockQueryQueue(responses) {
  const queue = [...responses];
  query.mockImplementation(async () => {
    if (!queue.length) {
      throw new Error("Unexpected extra query() call in test");
    }
    return queue.shift();
  });
}

function rows(arr) {
  return { rows: arr };
}

describe("curatorChatContext.buildPreamble — feedback block", () => {
  beforeEach(() => {
    query.mockReset();
  });

  it("group, comments, and reflections render with names for non-anonymous", async () => {
    mockQueryQueue([
      // 1. members
      rows([
        { id: "u-1", full_name: "Иван Петров", journey_stage: "поиск", is_careful_mode: false },
        { id: "u-2", full_name: "Анна Кузнецова", journey_stage: "опора", is_careful_mode: true },
      ]),
      // 2. comments
      rows([
        {
          id: "de-1",
          user_id: "u-1",
          event_id: "e-1",
          day_id: "d-1",
          state_id: "balance",
          state_level: 3,
          comment: "Хорошо настроился",
          responded_at: "2026-05-13T09:00:00Z",
          is_anonymous: false,
          is_hidden_from_curator: false,
          full_name: "Иван Петров",
          event_title: "Утренний круг",
          start_time: "2026-05-13T09:00:00Z",
          end_time: "2026-05-13T10:30:00Z",
          day_label: "День 1",
          date_label: "13 мая",
          day_number: 1,
        },
      ]),
      // 3. reflections
      rows([
        {
          id: "dr-1",
          user_id: "u-1",
          day_id: "d-1",
          free_text: "День оказался насыщенным",
          answers: {},
          responded_at: "2026-05-13T22:00:00Z",
          is_anonymous: false,
          is_hidden_from_curator: false,
          full_name: "Иван Петров",
          day_label: "День 1",
          date_label: "13 мая",
          day_number: 1,
        },
      ]),
      // 5. state levels
      rows([{ id: "balance", level: 3, label: "Лад", short_label: "Лад" }]),
    ]);

    const preamble = await buildPreamble({
      sessionId: "s-1",
      groupId: "g-1",
      filter: {},
    });

    expect(preamble.membersBlock).toContain("Иван Петров — этап: поиск");
    expect(preamble.membersBlock).toContain("Анна Кузнецова — этап: опора; режим «бережно»");
    expect(preamble.feedbackBlock).toContain("## Обратная связь участников");
    expect(preamble.feedbackBlock).toContain("Мероприятие: «Утренний круг»");
    expect(preamble.feedbackBlock).toContain("Иван Петров · отметил «лад»");
    expect(preamble.feedbackBlock).toContain("Хорошо настроился");
    expect(preamble.feedbackBlock).toContain("Рефлексия дня (свободный текст)");
  });

  it("anonymous comments hide name, hidden-from-curator entries are dropped", async () => {
    mockQueryQueue([
      // members
      rows([]),
      // comments: 3 entries — normal, anonymous, hidden
      rows([
        {
          id: "de-1",
          user_id: "u-1",
          event_id: "e-1",
          day_id: "d-1",
          state_id: null,
          state_level: null,
          comment: "Открытый комментарий",
          responded_at: "2026-05-13T09:00:00Z",
          is_anonymous: false,
          is_hidden_from_curator: false,
          full_name: "Иван Петров",
          event_title: "Круг",
          start_time: null,
          end_time: null,
          day_label: "День 1",
          date_label: "13 мая",
          day_number: 1,
        },
        {
          id: "de-2",
          user_id: "u-2",
          event_id: "e-1",
          day_id: "d-1",
          state_id: null,
          state_level: null,
          comment: "Анонимная реплика",
          responded_at: "2026-05-13T09:05:00Z",
          is_anonymous: true,
          is_hidden_from_curator: false,
          full_name: "Анна Кузнецова",
          event_title: "Круг",
          start_time: null,
          end_time: null,
          day_label: "День 1",
          date_label: "13 мая",
          day_number: 1,
        },
        {
          id: "de-3",
          user_id: "u-3",
          event_id: "e-1",
          day_id: "d-1",
          state_id: null,
          state_level: null,
          comment: "Скрытый от куратора",
          responded_at: "2026-05-13T09:10:00Z",
          is_anonymous: false,
          is_hidden_from_curator: true,
          full_name: "Скрытый Участник",
          event_title: "Круг",
          start_time: null,
          end_time: null,
          day_label: "День 1",
          date_label: "13 мая",
          day_number: 1,
        },
      ]),
      // reflections: empty
      rows([]),
      // state levels
      rows([]),
    ]);

    const preamble = await buildPreamble({
      sessionId: "s-1",
      groupId: "g-1",
      filter: {},
    });

    // Открытый — есть с именем
    expect(preamble.feedbackBlock).toContain("Иван Петров");
    expect(preamble.feedbackBlock).toContain("Открытый комментарий");
    // Анонимный — есть, без имени, с меткой «анонимно»
    expect(preamble.feedbackBlock).toContain("анонимно");
    expect(preamble.feedbackBlock).toContain("Анонимная реплика");
    expect(preamble.feedbackBlock).not.toContain("Анна Кузнецова");
    // Скрытый — отброшен полностью
    expect(preamble.feedbackBlock).not.toContain("Скрытый от куратора");
    expect(preamble.feedbackBlock).not.toContain("Скрытый Участник");
  });

  it("memberIds filter does not drop anonymous comments by other users", async () => {
    mockQueryQueue([
      // members (passes through filter)
      rows([{ id: "u-1", full_name: "Иван", journey_stage: "поиск", is_careful_mode: false }]),
      // comments
      rows([
        {
          id: "de-1",
          user_id: "u-1",
          event_id: "e-1",
          day_id: "d-1",
          state_id: null,
          state_level: null,
          comment: "Иванов комментарий",
          responded_at: "2026-05-13T09:00:00Z",
          is_anonymous: false,
          is_hidden_from_curator: false,
          full_name: "Иван",
          event_title: "Круг",
          start_time: null,
          end_time: null,
          day_label: "День 1",
          date_label: "",
          day_number: 1,
        },
        {
          id: "de-2",
          user_id: "u-other",
          event_id: "e-1",
          day_id: "d-1",
          state_id: null,
          state_level: null,
          comment: "Анонимная от чужого",
          responded_at: "2026-05-13T09:05:00Z",
          is_anonymous: true,
          is_hidden_from_curator: false,
          full_name: "Чужой Участник",
          event_title: "Круг",
          start_time: null,
          end_time: null,
          day_label: "День 1",
          date_label: "",
          day_number: 1,
        },
      ]),
      // reflections
      rows([]),
      // state levels
      rows([]),
    ]);

    const preamble = await buildPreamble({
      sessionId: "s-1",
      groupId: "g-1",
      filter: { memberIds: ["u-1"] },
    });

    expect(preamble.feedbackBlock).toContain("Иван");
    expect(preamble.feedbackBlock).toContain("Иванов комментарий");
    expect(preamble.feedbackBlock).toContain("Анонимная от чужого");
    expect(preamble.feedbackBlock).toContain("анонимно");
    expect(preamble.feedbackBlock).not.toContain("Чужой Участник");
  });

  it("includeDays=false suppresses the feedback block entirely", async () => {
    mockQueryQueue([
      rows([]), // members
      // никаких других запросов не должно быть
    ]);

    const preamble = await buildPreamble({
      sessionId: "s-1",
      groupId: "g-1",
      filter: { includeDays: false },
    });

    expect(preamble.feedbackBlock).toBe("");
  });

  it("reflections with structured answers render Ум/Сердце/Воля", async () => {
    mockQueryQueue([
      rows([]),
      rows([]),
      rows([
        {
          id: "dr-1",
          user_id: "u-1",
          day_id: "d-1",
          free_text: "",
          answers: { mind: "Думал много", heart: "Чувствовал тепло", will: "Сделал шаг" },
          responded_at: "2026-05-13T22:00:00Z",
          is_anonymous: false,
          is_hidden_from_curator: false,
          full_name: "Иван",
          day_label: "День 1",
          date_label: "13 мая",
          day_number: 1,
        },
      ]),
      rows([]),
    ]);

    const preamble = await buildPreamble({
      sessionId: "s-1",
      groupId: "g-1",
      filter: {},
    });

    expect(preamble.feedbackBlock).toContain("Рефлексия дня (методические оси)");
    expect(preamble.feedbackBlock).toContain("Ум: «Думал много»");
    expect(preamble.feedbackBlock).toContain("Сердце: «Чувствовал тепло»");
    expect(preamble.feedbackBlock).toContain("Воля: «Сделал шаг»");
  });

  it("empty feedback says so explicitly (not silent)", async () => {
    mockQueryQueue([
      rows([]),
      rows([]), // no comments
      rows([]), // no reflections
      rows([]),
    ]);

    const preamble = await buildPreamble({
      sessionId: "s-1",
      groupId: "g-1",
      filter: {},
    });

    expect(preamble.feedbackBlock).toContain("## Обратная связь участников");
    expect(preamble.feedbackBlock).toContain(
      "(в выбранном контексте нет комментариев и рефлексий)",
    );
  });
});
