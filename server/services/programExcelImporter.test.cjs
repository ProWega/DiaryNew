"use strict";

const xlsx = require("xlsx");

jest.mock("./llmClient.cjs", () => ({
  callLlm: jest.fn(),
  detectProvider: jest.fn(() => "anthropic"),
  isProviderConfigured: jest.fn(() => true),
}));

const llmClient = require("./llmClient.cjs");
const {
  DEFAULT_STOP_WORDS,
  parseTimeRange,
  parseRussianDate,
  matchStopWord,
  applyEventTypeMapping,
  extractTitle,
  extractRowsFromXlsx,
  pickProgramSheets,
  parseHeuristic,
  parseProgram,
} = require("./programExcelImporter.cjs");

function makeXlsxBuffer(sheets) {
  // sheets: [{ name, rows }]
  const wb = xlsx.utils.book_new();
  for (const sheet of sheets) {
    const ws = xlsx.utils.aoa_to_sheet(sheet.rows);
    xlsx.utils.book_append_sheet(wb, ws, sheet.name);
  }
  return xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
}

describe("parseTimeRange", () => {
  it("parses ISO HH:MM-HH:MM with dash", () => {
    expect(parseTimeRange("09:00-10:30")).toEqual({ start: "09:00", end: "10:30" });
  });
  it("parses with spaces and en-dash", () => {
    expect(parseTimeRange("14:30 – 16:00")).toEqual({ start: "14:30", end: "16:00" });
  });
  it("parses single time without end", () => {
    expect(parseTimeRange("23:00")).toEqual({ start: "23:00", end: "" });
  });
  it("pads single-digit hours", () => {
    expect(parseTimeRange("8:00 - 9:30")).toEqual({ start: "08:00", end: "09:30" });
  });
  it("returns null for non-time text", () => {
    expect(parseTimeRange("ОБЕД")).toBeNull();
    expect(parseTimeRange("")).toBeNull();
  });
});

describe("parseRussianDate", () => {
  it("parses 'X июня' format", () => {
    expect(parseRussianDate("4 июня")).toEqual({ day: 4, month: 6, year: null });
    expect(parseRussianDate("10 ИЮНЯ")).toEqual({ day: 10, month: 6, year: null });
  });
  it("parses with year suffix", () => {
    expect(parseRussianDate("10 июня 2026")).toEqual({ day: 10, month: 6, year: 2026 });
  });
  it("parses ISO format", () => {
    expect(parseRussianDate("2026-06-10")).toEqual({ day: 10, month: 6, year: 2026 });
  });
  it("returns null for non-date text", () => {
    expect(parseRussianDate("Просто текст")).toBeNull();
  });
});

describe("matchStopWord", () => {
  it("matches case-insensitively", () => {
    expect(matchStopWord("ОБЕД", DEFAULT_STOP_WORDS)).toBe("обед");
  });
  it("matches substring", () => {
    expect(matchStopWord("ПЕРЕРЫВ на чай", DEFAULT_STOP_WORDS)).toBeTruthy();
  });
  it("returns null when no match", () => {
    expect(matchStopWord("Панельная дискуссия", DEFAULT_STOP_WORDS)).toBeNull();
  });
});

describe("applyEventTypeMapping", () => {
  it("maps торжественные mероприятия", () => {
    expect(applyEventTypeMapping("Торжественная церемония открытия").type).toBe(
      "Торжественное мероприятие",
    );
  });
  it("maps панельные дискуссии", () => {
    expect(applyEventTypeMapping("Панельная дискуссия о памяти").type).toBe("Панельная дискуссия");
  });
  it("maps мастер-классы", () => {
    expect(applyEventTypeMapping("Мастер-класс по верстке").type).toBe("Мастер-класс");
    expect(applyEventTypeMapping("Практикум по дискуссии").type).toBe("Мастер-класс");
  });
  it("maps экскурсии", () => {
    expect(applyEventTypeMapping("Экскурсия в музей").type).toBe("Экскурсия");
  });
  it("maps рефлексии", () => {
    expect(applyEventTypeMapping("РЕФЛЕКСИЯ у костра").type).toBe("Рефлексия");
  });
  it("falls back to Лекция with low confidence", () => {
    const result = applyEventTypeMapping("Что-то непонятное");
    expect(result.type).toBe("Лекция");
    expect(result.confidence).toBe("low");
  });
});

describe("extractTitle", () => {
  it("takes first non-empty line", () => {
    expect(extractTitle("Заголовок\nОписание\nСпикер")).toBe("Заголовок");
  });
  it("keeps CAPS-LOCK titles as-is (real events are often in caps)", () => {
    expect(extractTitle("ПРАКТИКУМ Письма на фронт\nЗал Невский")).toBe(
      "ПРАКТИКУМ Письма на фронт",
    );
    expect(extractTitle("СВОБОДНЫЙ БЛОК\nЗал Пушкин")).toBe("СВОБОДНЫЙ БЛОК");
  });
  it("returns empty for empty input", () => {
    expect(extractTitle("")).toBe("");
  });
});

describe("extractRowsFromXlsx + pickProgramSheets", () => {
  it("extracts rows from single-sheet file", () => {
    const buffer = makeXlsxBuffer([
      {
        name: "Программа",
        rows: [
          ["08:00", "Завтрак"],
          ["10:00", "Лекция"],
        ],
      },
    ]);
    const sheets = extractRowsFromXlsx(buffer);
    expect(sheets).toHaveLength(1);
    expect(sheets[0].name).toBe("Программа");
    expect(sheets[0].rows).toHaveLength(2);
  });

  it("picks main 'Программа' over noisy variants", () => {
    const sheets = [
      { name: "!!!!Программа", rows: [] },
      { name: "Программа", rows: [] },
      { name: "Программа (копия)", rows: [] },
      { name: "Спикеры", rows: [] },
    ];
    const picked = pickProgramSheets(sheets);
    expect(picked).toHaveLength(1);
    expect(picked[0].name).toBe("Программа");
  });

  it("falls back to non-speakers sheet when no 'Программа'", () => {
    const sheets = [
      { name: "Расписание", rows: [] },
      { name: "Спикеры", rows: [] },
    ];
    const picked = pickProgramSheets(sheets);
    expect(picked).toHaveLength(1);
    expect(picked[0].name).toBe("Расписание");
  });
});

describe("parseHeuristic", () => {
  it("detects day from date-only row, then events with time", () => {
    const sheets = [
      {
        name: "Программа",
        rows: [
          ["4 ИЮНЯ\nПервый день\nФокус дня"],
          ["08:00 - 13:00", "Заезд участников"],
          ["13:00 - 14:00", "ОБЕД"],
          ["14:00 - 15:30", "Панельная дискуссия про память"],
          ["15:30 - 15:45", "ПЕРЕРЫВ"],
          ["15:45 - 17:00", "Мастер-класс по нарративу"],
        ],
      },
    ];
    const result = parseHeuristic(sheets);
    expect(result.days).toHaveLength(1);
    expect(result.days[0].label).toBe("День 1");
    expect(result.days[0].dateLabel).toBe("4 июня");
    expect(result.days[0].events).toHaveLength(5);
    const filtered = result.days[0].events.filter((e) => e.droppedByStopWord);
    expect(filtered).toHaveLength(3); // заезд, обед, перерыв
    const kept = result.days[0].events.filter((e) => !e.droppedByStopWord);
    expect(kept).toHaveLength(2);
    expect(kept[0].type).toBe("Панельная дискуссия");
    expect(kept[1].type).toBe("Мастер-класс");
  });

  it("handles multiple days", () => {
    const sheets = [
      {
        name: "Программа",
        rows: [
          ["4 ИЮНЯ"],
          ["10:00 - 11:00", "Лекция один"],
          ["5 ИЮНЯ"],
          ["10:00 - 11:00", "Лекция два"],
        ],
      },
    ];
    const result = parseHeuristic(sheets);
    expect(result.days).toHaveLength(2);
    expect(result.days[0].dateLabel).toBe("4 июня");
    expect(result.days[1].dateLabel).toBe("5 июня");
  });

  it("emits low_confidence warning when nothing parsed", () => {
    const sheets = [{ name: "Программа", rows: [["мусор"], ["ещё мусор"]] }];
    const result = parseHeuristic(sheets);
    expect(result.warnings.some((w) => w.kind === "low_confidence")).toBe(true);
  });

  it("respects custom stop-words", () => {
    const sheets = [
      {
        name: "Программа",
        rows: [
          ["4 ИЮНЯ"],
          ["10:00 - 11:00", "Лекция важная"],
          ["11:00 - 12:00", "Запретное слово занятие"],
        ],
      },
    ];
    const result = parseHeuristic(sheets, { stopWords: ["запретное слово"] });
    const filtered = result.days[0].events.filter((e) => e.droppedByStopWord);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].droppedByStopWord).toBe("запретное слово");
  });
});

describe("parseProgram (orchestrator)", () => {
  beforeEach(() => {
    llmClient.callLlm.mockReset();
    llmClient.isProviderConfigured.mockReturnValue(true);
    llmClient.detectProvider.mockReturnValue("anthropic");
  });

  it("uses heuristic by default", async () => {
    const buffer = makeXlsxBuffer([
      {
        name: "Программа",
        rows: [["4 июня"], ["10:00 - 11:00", "Лекция важная"]],
      },
    ]);
    const draft = await parseProgram({ buffer, mode: "heuristic" });
    expect(draft.days).toHaveLength(1);
    expect(draft.days[0].events[0].title).toBe("Лекция важная");
    expect(llmClient.callLlm).not.toHaveBeenCalled();
  });

  it("calls LLM when mode=llm and parses JSON response", async () => {
    const buffer = makeXlsxBuffer([{ name: "Программа", rows: [["10:00", "Лекция"]] }]);
    llmClient.callLlm.mockResolvedValueOnce({
      text: JSON.stringify({
        days: [
          {
            label: "День 1",
            dateLabel: "10 июня",
            dateValue: "2026-06-10",
            events: [
              {
                title: "Открытие форума",
                start: "10:00",
                end: "11:00",
                type: "Торжественное мероприятие",
                speakerName: "Иванов И.И.",
                location: "Зал А",
                description: "Описание",
              },
            ],
          },
        ],
      }),
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    const draft = await parseProgram({
      buffer,
      mode: "llm",
      llmConfig: { model: "claude-haiku-4-5", sessionId: "s-1" },
    });
    expect(llmClient.callLlm).toHaveBeenCalled();
    expect(draft.days).toHaveLength(1);
    expect(draft.days[0].events[0].title).toBe("Открытие форума");
    expect(draft.days[0].events[0].type).toBe("Торжественное мероприятие");
    expect(draft.usage).toEqual({ input_tokens: 100, output_tokens: 50 });
  });

  it("falls back to heuristic when LLM returns invalid JSON", async () => {
    const buffer = makeXlsxBuffer([
      {
        name: "Программа",
        rows: [["4 июня"], ["10:00", "Лекция важная"]],
      },
    ]);
    llmClient.callLlm.mockResolvedValueOnce({
      text: "Это не JSON, а просто ответ",
      usage: { input_tokens: 10, output_tokens: 5 },
    });

    const draft = await parseProgram({
      buffer,
      mode: "llm",
      llmConfig: { model: "claude-haiku-4-5", sessionId: "s-1" },
    });
    expect(draft.warnings.some((w) => w.kind === "llm_failed")).toBe(true);
    // эвристика всё равно отработала:
    expect(draft.days).toHaveLength(1);
  });

  it("throws 503 when LLM provider not configured", async () => {
    llmClient.isProviderConfigured.mockReturnValueOnce(false);
    const buffer = makeXlsxBuffer([{ name: "Программа", rows: [["10:00", "L"]] }]);
    await expect(
      parseProgram({
        buffer,
        mode: "llm",
        llmConfig: { model: "claude-haiku-4-5", sessionId: "s-1" },
      }),
    ).rejects.toMatchObject({ status: 503 });
  });

  it("throws 400 when llmConfig missing for llm mode", async () => {
    const buffer = makeXlsxBuffer([{ name: "Программа", rows: [["10:00", "L"]] }]);
    await expect(parseProgram({ buffer, mode: "llm" })).rejects.toMatchObject({
      status: 400,
    });
  });
});
