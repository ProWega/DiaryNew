"use strict";

/**
 * Импортер программы заезда из Excel-файла.
 *
 * Поддерживает два режима:
 *  - heuristic: чистая JS-логика (regex на время, дату, маппинг типов по ключевым словам);
 *  - llm: отдаёт сериализованное содержимое таблицы в LLM, ждёт строгий JSON.
 *
 * Возвращает DraftProgram — структуру, которую UI показывает в preview, после
 * чего отдельный commit-эндпоинт сохраняет её через стандартный
 * `createProgram`/`createProgramDay`/upsert event пайплайн (НЕ дублируем SQL).
 */

const xlsx = require("xlsx");
const { callLlm, detectProvider, isProviderConfigured } = require("./llmClient.cjs");

const DEFAULT_STOP_WORDS = [
  "завтрак",
  "обед",
  "ужин",
  "полдник",
  "перерыв",
  "перекус",
  "перекур",
  "кофе-брейк",
  "кофе брейк",
  "трансфер",
  "заезд",
  "заселение",
  "регистрация",
  "регистрация участников",
  "отбой",
  "подъём",
  "подъем",
  "выезд",
  "приезд",
  "тех. перерыв",
  "технический",
  "ланч",
  "перерыв на чай",
  "санитарный",
  "пересадка",
  "зарядка",
  "итоги дня",
  "подготовка ко сну",
  "установка на день",
  "трапеза",
  "трапезная",
  "столовая",
];

// Сначала пытаемся узкие категории, фоллбэк — Лекция.
const EVENT_TYPE_KEYWORDS = [
  ["Торжественное мероприятие", ["торжеств", "церемония", "открыти", "закрыти", "награждени"]],
  ["Панельная дискуссия", ["панельная дискусс", "панель ", "круглый стол", "обсуждение"]],
  ["Мастер-класс", ["мастер-класс", "мастер класс", "практикум", "семинар"]],
  ["Экскурсия", ["экскурсия", "погружение", "выезд на", "посещение"]],
  ["Групповая работа", ["групповая работа", "работа в группах", "командная работа"]],
  ["Рефлексия", ["рефлексия", "круг рефлексии", "разговор по итог", "разбор дня"]],
  ["Лекция", ["лекция", "выступление", "доклад", "встреча с", "интерактивная сессия"]],
];

const RUSSIAN_MONTHS = [
  ["январ", 1],
  ["феврал", 2],
  ["март", 3],
  ["апрел", 4],
  ["май", 5],
  ["мая", 5],
  ["июн", 6],
  ["июл", 7],
  ["август", 8],
  ["сентябр", 9],
  ["октябр", 10],
  ["ноябр", 11],
  ["декабр", 12],
];

// Лист считается релевантным программе если в названии есть «программ» (case-insensitive)
// и нет явного исключения (спикеры, бриф, копия и т.д.).
const SHEET_INCLUDE_PATTERN = /программ/i;
const SHEET_EXCLUDE_PATTERN = /(копи|спикер|бриф|детск|общая|backup)/i;

// -------- Утилиты --------

function normalizeText(value) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .trim();
}

function lowerNoSpaces(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

/**
 * Парсит "8:00 - 13:30", "8:00-13:30", "08:00–10:30" → { start: "08:00", end: "13:30" }.
 * Поддерживает разные тире и пробелы. Если только один time — return { start, end:"" }.
 */
function parseTimeRange(text) {
  const match = String(text || "").match(
    /(\d{1,2})[:.](\d{2})\s*(?:[-–—]\s*(\d{1,2})[:.](\d{2}))?/,
  );
  if (!match) return null;
  const start = `${pad2(Number(match[1]))}:${pad2(Number(match[2]))}`;
  const end = match[3] && match[4] ? `${pad2(Number(match[3]))}:${pad2(Number(match[4]))}` : "";
  return { start, end };
}

/**
 * Парсит дату из текста: "4 июня", "10 июня 2026", "2026-06-10".
 * Возвращает { day, month, year? } или null. Год опционален — может остаться пустым.
 */
function parseRussianDate(text) {
  const value = lowerNoSpaces(text);
  if (!value) return null;
  // ISO формат
  const iso = value.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    return { day: Number(iso[3]), month: Number(iso[2]), year: Number(iso[1]) };
  }
  // "4 июня"
  const ru = value.match(/(\d{1,2})\s*([а-яё]+)(?:\s*(\d{4}))?/);
  if (ru) {
    const day = Number(ru[1]);
    const monthWord = ru[2];
    const year = ru[3] ? Number(ru[3]) : null;
    for (const [prefix, num] of RUSSIAN_MONTHS) {
      if (monthWord.startsWith(prefix)) {
        return { day, month: num, year };
      }
    }
  }
  return null;
}

function formatIsoDate({ year, month, day }) {
  if (!year || !month || !day) return "";
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function formatDateLabel({ day, month }) {
  if (!day || !month) return "";
  const monthLabel = RUSSIAN_MONTHS.find(([, num]) => num === month);
  if (!monthLabel) return "";
  // Берём корень и добавляем падежное окончание для родительного.
  const labels = {
    1: "января",
    2: "февраля",
    3: "марта",
    4: "апреля",
    5: "мая",
    6: "июня",
    7: "июля",
    8: "августа",
    9: "сентября",
    10: "октября",
    11: "ноября",
    12: "декабря",
  };
  return `${day} ${labels[month] || ""}`.trim();
}

/**
 * Проверяет, попадает ли текст под список стоп-слов. Сравнение substring,
 * case-insensitive. Если попадает — возвращаем какое именно стоп-слово сработало.
 */
function matchStopWord(text, stopWords) {
  const haystack = lowerNoSpaces(text);
  if (!haystack) return null;
  for (const word of stopWords) {
    const needle = lowerNoSpaces(word);
    if (!needle) continue;
    if (haystack.includes(needle)) return word;
  }
  return null;
}

/**
 * Маппит title на стандартный event_type. Если ничего не подошло — "Лекция",
 * confidence: "low".
 */
function applyEventTypeMapping(title) {
  const value = lowerNoSpaces(title);
  for (const [type, keywords] of EVENT_TYPE_KEYWORDS) {
    for (const kw of keywords) {
      if (value.includes(kw)) return { type, confidence: "high" };
    }
  }
  return { type: "Лекция", confidence: "low" };
}

// -------- Извлечение из xlsx --------

/**
 * Читает xlsx buffer → массив листов { name, rows: string[][] }.
 * Пустые ячейки нормализуются в "". Multiline-ячейки оставляем как есть.
 */
function extractRowsFromXlsx(buffer) {
  const wb = xlsx.read(buffer, { type: "buffer", cellDates: false });
  const result = [];
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    if (!sheet) continue;
    const rows = xlsx.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      blankrows: false,
      raw: false,
    });
    result.push({ name, rows: rows.map((row) => row.map((cell) => normalizeText(cell))) });
  }
  return result;
}

/**
 * Возвращает СПИСОК всех листов файла, в названии которых есть «программ»
 * (за вычетом обычно-не-программных «спикеры», «бриф»). Это список листов-
 * КАНДИДАТОВ, из которых организатор может выбрать в UI. Сюда специально
 * включаем разные варианты: «!!!Программа», «Программа (копия)»,
 * «Программа (для бейджей)», «Программа ОБЩАЯ» — пусть юзер сам решит.
 */
function listProgramSheetCandidates(sheets) {
  const SHEET_HARD_EXCLUDE = /(спикер|бриф|не брать)/i;
  return sheets
    .filter((s) => SHEET_INCLUDE_PATTERN.test(s.name) && !SHEET_HARD_EXCLUDE.test(s.name))
    .map((s) => s.name);
}

/**
 * Возвращает СПИСОК листов для парсинга. Если передан `sheetName` — используем
 * именно его (валидация: лист должен существовать). Иначе автоопределение:
 * берём один «чистый» лист (короткое имя, без префикса-восклицания, без
 * «копия», «общая», «бейдж» и т.п.).
 */
function pickProgramSheets(sheets, { sheetName } = {}) {
  if (sheetName) {
    const exact = sheets.find((s) => s.name === sheetName);
    if (exact) return [exact];
    // Если переданный лист не найден — fallback на автовыбор (warning ниже).
  }

  const relevant = sheets.filter(
    (s) => SHEET_INCLUDE_PATTERN.test(s.name) && !SHEET_EXCLUDE_PATTERN.test(s.name),
  );
  if (relevant.length) {
    // Сортируем: короткое имя без префиксов-восклицаний — приоритетнее.
    const sorted = [...relevant].sort((a, b) => {
      const aPenalty = /^[!?*\s]/.test(a.name) ? 100 : 0;
      const bPenalty = /^[!?*\s]/.test(b.name) ? 100 : 0;
      if (aPenalty !== bPenalty) return aPenalty - bPenalty;
      return a.name.length - b.name.length;
    });
    return [sorted[0]];
  }
  // fallback: всё, что не «Спикеры», берём только первый, чтобы избежать дублей.
  const fallback = sheets.filter((s) => !/спикер/i.test(s.name));
  return fallback.length ? [fallback[0]] : [];
}

// -------- Эвристический парсинг --------

/**
 * Разбирает строку таблицы. КРИТИЧНО: время ищем ТОЛЬКО в первой непустой
 * ячейке. Иначе случайные «14:00» в описании события («сбор в 14:00 о
 * памяти…») затирают реальное время из соседней колонки.
 *
 * Возвращает { time, date, eventCells }:
 *  - time — если первая ячейка матчится регексом времени;
 *  - date — если строка содержит дату (типичная day-header строка);
 *  - eventCells — массив { col, text } для каждой непустой ячейки ПОСЛЕ
 *    колонки времени. Каждый element — потенциально параллельное событие
 *    (col 1 → группа A, col 2 → B, …). Если ячейка одна — обычное событие.
 *
 * Колонка времени НЕ включается в eventCells. Если строка не содержит времени,
 * eventCells пустой.
 */
function inspectRow(row, rowIndex) {
  // Сохраняем индексы колонок (без filter(Boolean), чтобы col-маппинг был точным).
  const rawCells = row.map((c) => normalizeText(c));
  const nonEmpty = rawCells.map((c, idx) => ({ idx, c })).filter((x) => x.c);
  if (!nonEmpty.length) return null;

  const firstCell = nonEmpty[0].c;
  const time = parseTimeRange(firstCell);

  if (time) {
    // Event-строка. Все остальные непустые ячейки — кандидаты на (параллельные)
    // события. Нумеруем «логический» столбец от 0 (для parallel_group A,B,C…),
    // НЕ от физического (некоторые xlsx содержат пустые колонки между).
    const eventCells = nonEmpty.slice(1).map((x, logicalIdx) => ({
      col: logicalIdx,
      text: x.c,
    }));
    return { time, date: null, eventCells, sourceRow: rowIndex };
  }

  // Не event. Может быть строкой-заголовком дня. Сканируем все ячейки на дату.
  for (const x of nonEmpty) {
    const d = parseRussianDate(x.c);
    if (d) {
      return { time: null, date: d, eventCells: [], sourceRow: rowIndex };
    }
  }

  return { time: null, date: null, eventCells: [], sourceRow: rowIndex };
}

// Колонка → буква параллельного потока (A, B, C, D, E, F, G…).
function parallelGroupFromCol(col) {
  return String.fromCharCode("A".charCodeAt(0) + Math.max(0, Math.min(25, col)));
}

/**
 * Извлекает заголовок (title) из мультилинейного описания: первая непустая
 * строка. Намеренно НЕ пропускаем CAPS-prefix — реальные события часто пишутся
 * целиком капсом («ПРАКТИКУМ Письма на фронт», «СВОБОДНЫЙ БЛОК»). Категории
 * («Деловая программа», «Тренерский блок») живут только в шапке листа и
 * не попадают в event-ячейки.
 */
function extractTitle(text) {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return lines[0] || "";
}

/**
 * Описание = всё содержимое описания минус title. Может быть многострочным,
 * содержать имена спикеров (часто в CAPS LOCK).
 */
function extractDescription(text, title) {
  const trimmed = text.replace(title, "").trim();
  // Убираем повторяющиеся пустые строки
  return trimmed.replace(/\n{3,}/g, "\n\n");
}

/**
 * Heuristic parser. Каждый лист → массив дней. Дни определяются по строкам,
 * содержащим только дату («4 ИЮНЯ») без времени.
 */
function parseHeuristic(sheets, { stopWords = DEFAULT_STOP_WORDS, sheetName } = {}) {
  const programSheets = pickProgramSheets(sheets, { sheetName });
  const days = [];
  let currentDay = null;
  let dayIndex = 0;
  let totalRows = 0;
  let parsedEvents = 0;
  let filteredCount = 0;
  let baselineYear = null;

  for (const sheet of programSheets) {
    for (let i = 0; i < sheet.rows.length; i++) {
      totalRows++;
      const inspection = inspectRow(sheet.rows[i], i);
      if (!inspection) continue;
      const { time, date, eventCells } = inspection;

      // Строка-заголовок дня: есть дата, нет времени.
      if (date && !time) {
        dayIndex++;
        const yearForDay = date.year || baselineYear || null;
        if (date.year) baselineYear = date.year;
        currentDay = {
          label: `День ${dayIndex}`,
          dateLabel: formatDateLabel(date),
          dateValue: formatIsoDate({ ...date, year: yearForDay }),
          events: [],
        };
        days.push(currentDay);
        continue;
      }

      // Строка-событие: есть время. Если ещё нет текущего дня — создаём «День 1» без даты.
      if (time && eventCells.length) {
        if (!currentDay) {
          dayIndex++;
          currentDay = {
            label: `День ${dayIndex}`,
            dateLabel: "",
            dateValue: "",
            events: [],
          };
          days.push(currentDay);
        }

        for (const cell of eventCells) {
          const title = extractTitle(cell.text);
          if (!title) continue;
          const droppedByStopWord = matchStopWord(title, stopWords);
          const mapping = applyEventTypeMapping(title);
          const event = {
            title,
            start: time.start,
            end: time.end || "",
            type: mapping.type,
            speakerName: "",
            location: "",
            description: extractDescription(cell.text, title),
            // Несколько колонок в одной строке → параллельные опции (A, B, C…).
            // Одна колонка → группа A (обычное событие).
            parallelGroup: eventCells.length > 1 ? parallelGroupFromCol(cell.col) : "A",
            tags: [],
            // preview-only:
            sourceRow: inspection.sourceRow,
            confidence: mapping.confidence,
            droppedByStopWord,
          };
          currentDay.events.push(event);
          if (droppedByStopWord) {
            filteredCount++;
          } else {
            parsedEvents++;
          }
        }
      }
    }
  }

  const warnings = [];
  if (parsedEvents === 0) {
    warnings.push({
      kind: "low_confidence",
      message:
        "Не удалось распознать ни одного события — попробуйте режим ИИ или проверьте, есть ли в файле колонка со временем.",
    });
  } else {
    const sparseDays = days.filter(
      (d) => d.events.filter((e) => !e.droppedByStopWord).length < 3,
    ).length;
    if (sparseDays && sparseDays === days.length) {
      warnings.push({
        kind: "low_confidence",
        message:
          "В каждом дне распознано меньше 3 событий — возможно, шаблон файла нестандартный. Попробуйте режим ИИ.",
      });
    }
  }

  return {
    title: "",
    description: "",
    status: "draft",
    eventContext: {
      title: "",
      eventType: "Форумное событие",
      venue: "",
      startDate: days[0]?.dateValue || "",
      endDate: days[days.length - 1]?.dateValue || "",
      participantCount: 0,
      description: "",
    },
    days,
    selectedSheet: programSheets[0]?.name || null,
    availableSheets: listProgramSheetCandidates(sheets),
    stats: {
      sheets: programSheets.length,
      totalRows,
      parsedEvents,
      filteredCount,
    },
    warnings,
  };
}

// -------- LLM-режим --------

/**
 * Делает текстовое представление таблицы для LLM: один лист = один блок,
 * каждая строка `<номер> | <ячейка1> | <ячейка2> | ...`.
 */
function serializeSheetsForLlm(sheets, { maxRowsPerSheet = 400 } = {}) {
  const parts = [];
  for (const sheet of sheets) {
    const lines = [`=== Лист: ${sheet.name} ===`];
    const limit = Math.min(sheet.rows.length, maxRowsPerSheet);
    for (let i = 0; i < limit; i++) {
      const cells = sheet.rows[i].map((c) => c.replace(/\s+/g, " ").trim());
      lines.push(`${i}\t${cells.join(" | ")}`);
    }
    if (sheet.rows.length > limit) {
      lines.push(`… (обрезано ещё ${sheet.rows.length - limit} строк)`);
    }
    parts.push(lines.join("\n"));
  }
  return parts.join("\n\n");
}

function buildLlmSystemPrompt(stopWords) {
  return `Ты — парсер расписаний программ заездов. На входе — содержимое таблицы Excel.

Верни СТРОГО JSON со структурой:
{
  "days": [
    {
      "label": "День 1",
      "dateLabel": "10 июня",
      "dateValue": "2026-06-10",
      "events": [
        {
          "title": "Заголовок мероприятия",
          "start": "09:00",
          "end": "10:30",
          "type": "Лекция|Мастер-класс|Панельная дискуссия|Торжественное мероприятие|Экскурсия|Групповая работа|Рефлексия|Поддержка|Логистика",
          "speakerName": "Иванов И.И., регалии",
          "location": "Зал А",
          "description": "Расширенное описание из ячейки"
        }
      ]
    }
  ]
}

Правила:
1. Пропусти строки про приёмы пищи, перерывы, трансферы, заселение, регистрацию,
   отбой, технические моменты. Стоп-слова: ${stopWords.join(", ")}.
   Они не должны попасть в events.
2. Тип события определяй по заголовку: лекция/выступление → "Лекция";
   мастер-класс/практикум/семинар → "Мастер-класс"; панель/дискуссия/круглый стол → "Панельная дискуссия";
   церемония/открытие/закрытие/торжественное → "Торжественное мероприятие";
   экскурсия/посещение → "Экскурсия"; работа в группах → "Групповая работа";
   рефлексия/разбор дня → "Рефлексия". Если непонятно — "Лекция".
3. Время в формате HH:MM (24h). "9 утра" → "09:00", "14:30 – 16:00" → start="14:30", end="16:00".
4. dateValue — ISO YYYY-MM-DD, если в файле есть год. Если года нет — оставь "".
5. Не выдумывай. Если поле пустое — пиши "".
6. Никакого текста вне JSON.`;
}

async function parseWithLlm({ sheets, sessionId, model, stopWords, maxTokens, sheetName }) {
  if (!isProviderConfigured(detectProvider(model))) {
    throw createImportError(503, `Провайдер для модели ${model} не настроен (нет API-ключа).`);
  }
  const programSheets = pickProgramSheets(sheets, { sheetName });
  const systemText = buildLlmSystemPrompt(stopWords);
  const tableText = serializeSheetsForLlm(programSheets);

  const result = await callLlm({
    model,
    maxTokens: maxTokens || 4096,
    systemBlocks: [{ text: systemText, cacheable: false }],
    messages: [{ role: "user", content: tableText }],
    // Большие расписания на Opus-моделях легко уходят за 30с дефолта.
    timeoutMs: 120_000,
  });

  const raw = result.text || "";
  // Иногда модель оборачивает JSON в ```json ... ```
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/, "")
    .trim();
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (error) {
    return {
      llmFailed: true,
      llmError: error.message,
      rawResponse: raw.slice(0, 500),
      usage: result.usage,
    };
  }

  const days = Array.isArray(parsed.days) ? parsed.days : [];
  let parsedEvents = 0;
  const normalizedDays = days.map((day, idx) => {
    const events = (Array.isArray(day.events) ? day.events : []).map((evt) => {
      const droppedByStopWord = matchStopWord(evt.title || "", stopWords);
      if (!droppedByStopWord) parsedEvents++;
      return {
        title: String(evt.title || "").trim(),
        start: String(evt.start || "").trim(),
        end: String(evt.end || "").trim(),
        type: String(evt.type || "Лекция").trim(),
        speakerName: String(evt.speakerName || "").trim(),
        location: String(evt.location || "").trim(),
        description: String(evt.description || "").trim(),
        parallelGroup: "A",
        tags: [],
        sourceRow: null,
        confidence: "high",
        droppedByStopWord,
      };
    });
    return {
      label: String(day.label || `День ${idx + 1}`).trim(),
      dateLabel: String(day.dateLabel || "").trim(),
      dateValue: String(day.dateValue || "").trim(),
      events,
    };
  });

  return {
    title: "",
    description: "",
    status: "draft",
    eventContext: {
      title: "",
      eventType: "Форумное событие",
      venue: "",
      startDate: normalizedDays[0]?.dateValue || "",
      endDate: normalizedDays[normalizedDays.length - 1]?.dateValue || "",
      participantCount: 0,
      description: "",
    },
    days: normalizedDays,
    selectedSheet: programSheets[0]?.name || null,
    availableSheets: listProgramSheetCandidates(sheets),
    stats: {
      sheets: programSheets.length,
      totalRows: programSheets.reduce((sum, s) => sum + s.rows.length, 0),
      parsedEvents,
      filteredCount: normalizedDays.reduce(
        (sum, d) => sum + d.events.filter((e) => e.droppedByStopWord).length,
        0,
      ),
    },
    warnings: [],
    usage: result.usage,
    model,
  };
}

// -------- Main orchestrator --------

/**
 * Главная точка входа. Принимает buffer xlsx + опции, возвращает DraftProgram.
 */
async function parseProgram({
  buffer,
  mode = "heuristic",
  stopWords = DEFAULT_STOP_WORDS,
  llmConfig = null,
  sheetName = null,
}) {
  if (!Buffer.isBuffer(buffer) && !(buffer instanceof Uint8Array)) {
    throw createImportError(400, "Ожидается buffer файла .xlsx");
  }
  const sheets = extractRowsFromXlsx(buffer);
  if (!sheets.length) {
    throw createImportError(400, "Файл пустой или не содержит читаемых листов.");
  }

  const sanitizedStopWords = Array.isArray(stopWords)
    ? stopWords.map((w) => String(w || "").trim()).filter(Boolean)
    : DEFAULT_STOP_WORDS;

  if (mode === "llm") {
    if (!llmConfig?.model) {
      throw createImportError(400, "Для ИИ-режима укажите model.");
    }
    const llmResult = await parseWithLlm({
      sheets,
      sessionId: llmConfig.sessionId,
      model: llmConfig.model,
      stopWords: sanitizedStopWords,
      maxTokens: llmConfig.maxTokens,
      sheetName,
    });
    if (llmResult.llmFailed) {
      // Soft-fallback: эвристика + warning.
      const fallback = parseHeuristic(sheets, {
        stopWords: sanitizedStopWords,
        sheetName,
      });
      fallback.warnings.unshift({
        kind: "llm_failed",
        message: `ИИ не смог структурировать ответ (${llmResult.llmError}). Использован локальный парсер.`,
      });
      fallback.llmUsage = llmResult.usage;
      return fallback;
    }
    return llmResult;
  }

  return parseHeuristic(sheets, { stopWords: sanitizedStopWords, sheetName });
}

function createImportError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

module.exports = {
  DEFAULT_STOP_WORDS,
  EVENT_TYPE_KEYWORDS,
  // Чистые функции (для тестов):
  parseTimeRange,
  parseRussianDate,
  matchStopWord,
  applyEventTypeMapping,
  extractTitle,
  extractRowsFromXlsx,
  pickProgramSheets,
  listProgramSheetCandidates,
  serializeSheetsForLlm,
  parseHeuristic,
  // Orchestrator:
  parseProgram,
  parseWithLlm,
};
