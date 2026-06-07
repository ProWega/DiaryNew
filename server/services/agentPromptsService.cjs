"use strict";

/**
 * Сервис разрешения активного промпта для ИИ-агентов системы.
 *
 * Между UI/админом (`agentPromptsStore`) и consumer'ами (curatorChatContext,
 * narrativeBriefLLM, programAnalyticsService) — единый source of truth. Все
 * consumer'ы вызывают `resolvePrompt(agentType)` и получают объект:
 *   { id, agentType, name, version, systemText, blocksConfig, model, maxTokens, source }
 *
 * Кеш: in-memory Map с TTL 60s. После save/restore в этом же процессе следует
 * вручную позвать `invalidateCache(agentType)` — это делает `saveNewVersion`
 * через колбэк (см. server/routes/admin.cjs). Между процессами инвалидация
 * холодная — через 60s максимум.
 *
 * Fallback: если миграция не прошла или БД недоступна, возвращаем
 * `HARDCODED_FALLBACK[agentType]` — копию исходных констант из consumer'ов.
 * Это гарантирует, что система продолжает работать на чистой БД.
 *
 * Каталог блоков (`BLOCK_CATALOG`) — статическая регистрация того, какие
 * блоки контекста существуют для каждого типа агента. Consumer'ы читают
 * `blocksConfig` (массив `{key, enabled}` в порядке отображения) и сами
 * решают, какие данные собирать.
 */

const agentPromptsStore = require("../db/repositories/agentPromptsStore.cjs");

const CACHE_TTL_MS = 60_000;
const cache = new Map();

// ── HARDCODED FALLBACK (зеркало seed'а из migrations/1756_agent_prompts.js) ──
// Используется только если DB недоступна или таблица пуста. Не редактируется
// через админ-UI — после первого `saveNewVersion` всё идёт из БД.

const FALLBACK_CURATOR_CHAT = {
  name: "Чат с ИИ куратора",
  systemText: `Ты — методолог-наставник, помогаешь куратору группы на программе «Дневник пути».

Контекст: куратор работает с группой 6–10 человек на 5–7-дневной смене. У каждого участника свой «этап пути» (поиск / проверка / опора / передача). Состояние каждый день фиксируется по 7-балльной активационной шкале «от Апатии до Паники»: Апатия / Пассивность / Расслабленность / Баланс / Включённость / Перевозбуждённость / Паника. Зоны: низкая активация (Апатия, Пассивность) — состояние накопления, тихое наблюдение; рабочая активация (Расслабленность, Баланс, Включённость) — рабочий ритм; высокая активация (Перевозбуждённость, Паника) — много, стоит пауза или разговор. Концепции мероприятий — задумки авторов программы; они объясняют, ЧТО событие должно вызвать у участников.

Источник данных:
- «Состав группы» — список участников с их этапом пути.
- «Обратная связь участников» — реальные комментарии и рефлексии: имена не-анонимных авторов указаны прямо в записях, анонимные помечены словом «анонимно».
- «Концепции мероприятий» — выгруженные авторами тексты-задумки.

Твой стиль:
1. Отвечай ёмко: 2-4 предложения, если только куратор явно не попросил развёрнуто.
2. Опирайся ТОЛЬКО на данные из блоков выше. Не выдумывай комментарии, имена, статистику.
3. Когда отвечаешь на конкретный вопрос — цитируй короткими фрагментами (1-2 фразы) из комментариев, не пересказывай их своими словами без нужды.
4. При упоминании участника используй его имя из комментариев. Для анонимных — пиши «один участник (анонимно)» или «несколько участников».
5. Если в выбранном контексте мало данных или подходящих записей нет — так и скажи, не додумывай.
6. Не используй диагностические ярлыки: диагноз, скилл, статус, ментор, эксперт, провал, регресс, риск, кейс, метрика, оценка. Не давай оценок «хорошо/плохо» — состояние участника всегда равноправно его текущему контексту.
7. Используй язык программы: путь, тетрадь, запись, заметка, отозвалось, рядом, в стороне, опора, передача, поиск, проверка, спутник, дорога; активационные термины: апатия, пассивность, расслабленность, баланс, включённость, перевозбуждённость, паника, активация.
8. Не давай советов императивом. Говори «можно подойти», «стоит обратить внимание», «возможно, важно побыть рядом».
9. Без эмодзи, без markdown-разметки заголовков. Обычные предложения. Списки в столбик — только если куратор явно попросил «по пунктам».`,
  blocksConfig: [
    { key: "members", enabled: true },
    { key: "feedback", enabled: true },
    { key: "concepts", enabled: true },
  ],
};

const FALLBACK_NARRATIVE_BRIEF = {
  name: "Записка дня",
  systemText: `Ты пишешь «записку к вечерней рефлексии» для куратора группы — короткое (3–5 предложений) сопроводительное эссе к структурированной сводке дня.

Контекст. Это программа «Истоки», «Дневник пути». Участники отмечают состояние по 7-балльной активационной шкале «от Апатии до Паники»: Апатия / Пассивность / Расслабленность / Баланс / Включённость / Перевозбуждённость / Паника. Зоны: низкая активация (Апатия, Пассивность), рабочая (Расслабленность, Баланс, Включённость), высокая (Перевозбуждённость, Паника). Куратор завтра поговорит с группой; записка задаёт ему интонацию и фокус разговора. Тон бережный, конкретный, без давления.

Что нельзя нарушать:
1. Никаких диагностических ярлыков. Не используй слова: диагноз, скилл, статус, ментор, эксперт, провал, регресс, риск, кейс, метрика, оценка, прогресс. Без оценок «хорошо/плохо».
2. Не пиши имён — куратор знает группу, имена в структурированной части записки. В нарративе говори «один из участников», «несколько человек», «в группе».
3. Не повторяй слово в слово данные из JSON. Синтезируй: что задаёт тон дня, кому стоит подойти, какая дуга у группы.
4. Не давай советов «что делать» императивом. Говори «можно подойти», «стоит обратить внимание», «возможно, важно побыть рядом».
5. Без эмодзи, без markdown, только обычные предложения. Минимум 3, максимум 5 предложений. Без вступлений типа «Сегодня в группе...» — начинай сразу с сути.

Формат вывода: только текст записки. Без префиксов, без объяснений.`,
  blocksConfig: [
    { key: "picture", enabled: true },
    { key: "conversationPoints", enabled: true },
    { key: "eventList", enabled: true },
    { key: "programArc", enabled: true },
    { key: "allowedTerms", enabled: true },
    { key: "bannedTerms", enabled: true },
  ],
};

const FALLBACK_PROGRAM_ANALYTICS = {
  name: "Анализ программы",
  systemText: `Ты — аналитик программы «Дневник пути». Тебе показывают структуру смены (дни и мероприятия), задумки авторов (концепции), агрегированную обратную связь от участников. Состояние участников фиксируется по 7-балльной активационной шкале «от Апатии до Паники» (зоны: низкая / рабочая / высокая активация). Твоя задача — написать короткий отчёт (3 раздела по 4–6 предложений каждый) о том, как программа сработала.

Структура отчёта:
1. «Что задумано» — кратко перечисли стержневые мероприятия и их методическую функцию (по концепциям). Без воды, по делу.
2. «Что получилось» — на основании обратной связи: какие события выводили группу в рабочую активацию, где случались просадки в низкую или подъёмы в высокую, на каких темах группа задержалась.
3. «Гипотезы для следующей смены» — 2-3 конкретных наблюдения с обоснованием, что стоит сохранить и что усилить.

Правила:
- Используй язык программы: путь, тетрадь, заметка, отозвалось, опора, передача, поиск, проверка. Избегай: прогресс, метрика, оценка, диагноз.
- Не упоминай имён участников. Группа = коллектив. Допустимо «несколько человек», «часть группы».
- Опирайся ТОЛЬКО на предоставленные данные. Не додумывай статистику, которой нет.
- Без эмодзи и markdown. Заголовки разделов пиши как обычные подзаголовки в строчку: «Что задумано.» — точка.`,
  blocksConfig: [
    { key: "sessionMeta", enabled: true },
    { key: "programDays", enabled: true },
    { key: "aggregatedFeedback", enabled: true },
    { key: "eventConcepts", enabled: true },
  ],
};

const HARDCODED_FALLBACK = {
  curator_chat: FALLBACK_CURATOR_CHAT,
  narrative_brief: FALLBACK_NARRATIVE_BRIEF,
  program_analytics: FALLBACK_PROGRAM_ANALYTICS,
};

function makeFallback(agentType) {
  const base = HARDCODED_FALLBACK[agentType];
  if (!base) {
    return {
      id: null,
      agentType,
      name: agentType,
      version: 0,
      systemText: "",
      blocksConfig: [],
      model: null,
      maxTokens: null,
      isCurrent: false,
      source: "fallback",
    };
  }
  return {
    id: null,
    agentType,
    name: base.name,
    version: 0,
    systemText: base.systemText,
    blocksConfig: [...base.blocksConfig],
    model: null,
    maxTokens: null,
    isCurrent: false,
    source: "fallback",
  };
}

// ── Catalog: какие блоки контекста существуют для каждого agent_type ──────
// Реальные builders подключаются consumer'ами (см. курсорChatContext.cjs).
// Здесь только метаданные для UI: ключ + человеко-читаемый label + описание.

const BLOCK_CATALOG = {
  curator_chat: [
    { key: "members", label: "Состав группы", description: "Список участников + этап пути" },
    { key: "feedback", label: "Обратная связь", description: "Комментарии и рефлексии" },
    {
      key: "concepts",
      label: "Концепции мероприятий",
      description: "Загруженные авторские тексты",
    },
  ],
  narrative_brief: [
    { key: "picture", label: "Картина дня", description: "Состав, отметки, отсутствующие" },
    {
      key: "conversationPoints",
      label: "Точки разговора",
      description: "К кому стоит подойти и почему",
    },
    { key: "eventList", label: "Список мероприятий", description: "События дня + отклик" },
    { key: "programArc", label: "Дуга программы", description: "Дни до/после" },
    { key: "allowedTerms", label: "Допустимый словарь", description: "Методические термины" },
    { key: "bannedTerms", label: "Запрещённые слова", description: "Что не использовать" },
  ],
  program_analytics: [
    { key: "sessionMeta", label: "Метаданные сессии", description: "Цикл, даты, описание" },
    { key: "programDays", label: "Структура программы", description: "Дни и мероприятия" },
    {
      key: "aggregatedFeedback",
      label: "Агрегированная обратная связь",
      description: "Сводка по дням",
    },
    { key: "eventConcepts", label: "Концепции мероприятий", description: "Все extracted_text" },
  ],
};

function listBlockCatalog(agentType) {
  return BLOCK_CATALOG[agentType] ? [...BLOCK_CATALOG[agentType]] : [];
}

function listKnownAgentTypes() {
  return Object.keys(BLOCK_CATALOG);
}

// ── Cache + resolve ────────────────────────────────────────────────────────

function cacheGet(agentType) {
  const entry = cache.get(agentType);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cache.delete(agentType);
    return null;
  }
  return entry.value;
}

function cacheSet(agentType, value) {
  cache.set(agentType, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

function invalidateCache(agentType) {
  if (agentType) {
    cache.delete(agentType);
  } else {
    cache.clear();
  }
}

/**
 * Резолвит активный промпт для агента: cache → DB → fallback.
 * Возвращает копию объекта (consumer'ы свободно мутируют, не задевают кеш).
 */
async function resolvePrompt(agentType) {
  if (!agentType) return makeFallback("unknown");
  const cached = cacheGet(agentType);
  if (cached) return { ...cached };

  let value = null;
  try {
    const row = await agentPromptsStore.getCurrent(agentType);
    if (row) {
      value = { ...row, source: "db" };
    }
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.warn(
        `[agentPromptsService] DB error resolving ${agentType}:`,
        error?.message || error,
      );
    }
  }

  if (!value) value = makeFallback(agentType);
  cacheSet(agentType, value);
  return { ...value };
}

/**
 * Сводный fingerprint текущей версии — для инвалидации downstream-кешей
 * (например, narrative_brief_cache). Не зависит от содержимого system_text;
 * меняется при `saveNewVersion`/`restoreVersion`.
 */
function getPromptFingerprint(resolved) {
  if (!resolved) return "fallback";
  if (!resolved.id) return `fallback:${resolved.agentType}`;
  return `${resolved.agentType}:v${resolved.version}:${String(resolved.id).slice(0, 12)}`;
}

module.exports = {
  resolvePrompt,
  invalidateCache,
  getPromptFingerprint,
  listBlockCatalog,
  listKnownAgentTypes,
  BLOCK_CATALOG,
  HARDCODED_FALLBACK,
  // test seam
  __resetCache: () => cache.clear(),
};
