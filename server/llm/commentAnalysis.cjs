const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";
const DEFAULT_OLLAMA_MODEL = "qwen2.5:3b-instruct-q4_K_M";
const DEFAULT_TIMEOUT_MS = 420000;
const DEFAULT_NUM_CTX = 4096;
const DEFAULT_NUM_PREDICT = 512;

const ANALYSIS_MODES = new Set(["scope", "events", "event"]);
const MAX_SCOPE_EVENTS_FOR_MODEL = 6;
const MAX_SCOPE_FEEDBACK_PER_EVENT = 4;
const MAX_SCOPE_FEEDBACK_CHARS = 260;
const MAX_EVENT_FEEDBACK_ITEMS = 10;
const MAX_EVENT_FEEDBACK_CHARS = 320;
const MAX_DAY_REFLECTION_EXCERPTS = 3;
const MAX_PROMPT_SETTING_CHARS = 2400;

const DEFAULT_LLM_PROMPT_SETTINGS = {
  systemPrompt:
    "Ты помогаешь куратору образовательного события быстро увидеть рабочие сигналы в обратной связи группы. Пиши бережно, без диагнозов и без решений за человека.",
  scopePrompt:
    "Собери короткий кураторский бриф по срезу: что происходит, на какие события обратить внимание, какие вопросы задать группе и какие ближайшие действия безопасны.",
  eventPrompt:
    "Разбери обратную связь по одному событию: главный сигнал, подтверждения из ответов, риски, вопросы для уточнения и 1-2 ближайших действия куратора.",
};

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function trimText(value) {
  return String(value || "").trim();
}

function numberOrNull(value) {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function numberOrZero(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function positiveIntegerOr(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function truncateText(value, maxLength) {
  const text = trimText(value).replace(/\s+/g, " ");

  if (!maxLength || text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 1)}…`;
}

function normalizeAnalysisMode(value) {
  return ANALYSIS_MODES.has(value) ? value : "scope";
}

function normalizePromptSetting(value, fallback) {
  const text = truncateText(value, MAX_PROMPT_SETTING_CHARS);
  return text || fallback;
}

function normalizeLlmPromptSettings(value = {}) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};

  return {
    systemPrompt: normalizePromptSetting(source.systemPrompt, DEFAULT_LLM_PROMPT_SETTINGS.systemPrompt),
    scopePrompt: normalizePromptSetting(source.scopePrompt, DEFAULT_LLM_PROMPT_SETTINGS.scopePrompt),
    eventPrompt: normalizePromptSetting(source.eventPrompt, DEFAULT_LLM_PROMPT_SETTINGS.eventPrompt),
  };
}

function normalizeJsonObject(value) {
  if (!value) {
    return {};
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    return value;
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function stripMarkdownJsonFence(value) {
  const text = trimText(value);
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : text;
}

function stripModelThinking(value) {
  return String(value || "").replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

function parseModelJson(value) {
  const cleaned = stripMarkdownJsonFence(stripModelThinking(value));

  try {
    return { data: JSON.parse(cleaned), error: null };
  } catch (error) {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");

    if (start !== -1 && end > start) {
      try {
        return { data: JSON.parse(cleaned.slice(start, end + 1)), error: null };
      } catch (nestedError) {
        return { data: null, error: nestedError.message };
      }
    }

    return { data: null, error: error.message };
  }
}

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function resolveReportScope(dashboard, { scopeId, dayId } = {}) {
  const scopes = asArray(dashboard?.reportScopes);

  if (scopeId) {
    return scopes.find((scope) => scope.scopeId === scopeId) || dashboard;
  }

  if (dayId) {
    return scopes.find((scope) => scope.dayId === dayId || scope.scopeId === dayId) || dashboard;
  }

  const firstDayScope = scopes.find((scope) => scope.dayId);
  return firstDayScope || scopes[0] || dashboard;
}

function getEventPulse(event, eventPulse) {
  return asArray(eventPulse).find((item) => item.id === event.id) || event || {};
}

function getParticipantPoint(participant, eventId) {
  return asArray(participant?.trajectory).find((point) => point.eventId === eventId) || null;
}

function createParticipantRefs(participants) {
  const refs = new Map();

  asArray(participants).forEach((participant, index) => {
    refs.set(participant.id, `P${String(index + 1).padStart(3, "0")}`);
  });

  return refs;
}

function getQuestionById(event) {
  return new Map(asArray(event?.reflectionQuestions).map((question) => [question.id, question]));
}

function normalizeReflectionAnswers(value) {
  const source = normalizeJsonObject(value);

  return Object.fromEntries(
    Object.entries(source)
      .map(([key, answer]) => [String(key).trim(), trimText(answer)])
      .filter(([key, answer]) => key && answer),
  );
}

function collectEventFeedback({ events, eventPulse, participants, feedbackLimit, feedbackMaxChars }) {
  const participantRefs = createParticipantRefs(participants);

  return asArray(events).map((event) => {
    const pulse = getEventPulse(event, eventPulse);
    const questionsById = getQuestionById(event);
    const feedback = [];
    let omittedFeedbackCount = 0;
    let commentsCount = 0;
    let reflectionAnswersCount = 0;

    const pushFeedback = (item) => {
      if (!item.text) {
        return;
      }

      if (feedback.length >= feedbackLimit) {
        omittedFeedbackCount += 1;
        return;
      }

      feedback.push(item);
    };

    for (const participant of asArray(participants)) {
      const point = getParticipantPoint(participant, event.id);
      if (!point?.answered) {
        continue;
      }

      const participantRef = participantRefs.get(participant.id) || "P000";
      const base = {
        participantRef,
        participantStatus: participant.status || "unknown",
        stateLevel: numberOrNull(point?.stateLevel),
        answered: Boolean(point?.answered),
      };
      const comment = truncateText(point?.comment, feedbackMaxChars);

      if (comment) {
        commentsCount += 1;
        pushFeedback({
          ...base,
          kind: "comment",
          text: comment,
        });
      }

      Object.entries(normalizeReflectionAnswers(point?.reflectionAnswers)).forEach(([questionId, answer]) => {
        const question = questionsById.get(questionId);
        const text = truncateText(answer, feedbackMaxChars);
        if (!text) {
          return;
        }
        reflectionAnswersCount += 1;
        pushFeedback({
          ...base,
          kind: "reflectionAnswer",
          questionId,
          question: question?.text || questionId,
          text,
        });
      });
    }

    return {
      id: event.id,
      title: trimText(event.title) || "Событие без названия",
      type: trimText(event.type),
      timeLabel: trimText(event.timeLabel),
      dayLabel: trimText(event.dayLabel),
      reflectionQuestions: asArray(event.reflectionQuestions).map((question) => ({
        id: question.id,
        text: trimText(question.text),
        required: Boolean(question.required),
      })),
      metrics: {
        completion: numberOrZero(pulse.completion),
        answersCount: numberOrZero(pulse.answersCount),
        commentsCount: numberOrZero(pulse.commentsCount || commentsCount),
        feedbackCount: commentsCount + reflectionAnswersCount,
        reflectionAnswersCount,
        riskAnswersCount: numberOrZero(pulse.riskAnswersCount),
        averageStateLevel: numberOrNull(pulse.averageStateLevel),
        amplitude: numberOrNull(pulse.amplitude),
        deltaFromPrevious: numberOrNull(pulse.deltaFromPrevious),
      },
      feedback,
      omittedFeedbackCount,
    };
  });
}

function collectDayReflections(reflectionPrep) {
  return asArray(reflectionPrep?.dayReflections).map((day) => ({
    id: day.id,
    label: trimText(day.label),
    dateLabel: trimText(day.dateLabel),
    responsesCount: numberOrZero(day.responsesCount),
    freeTextCount: numberOrZero(day.freeTextCount),
    answeredPromptsCount: numberOrZero(day.answeredPromptsCount),
    excerpts: asArray(day.excerpts)
      .map((excerpt) => truncateText(excerpt, 220))
      .filter(Boolean)
      .slice(0, MAX_DAY_REFLECTION_EXCERPTS),
  }));
}

function collectOpenRisks(reflectionPrep) {
  return asArray(reflectionPrep?.openRisks).map((risk) => ({
    severity: risk.severity || "unknown",
    title: truncateText(risk.title, 240),
    detail: truncateText(risk.detail, 500),
  }));
}

function hasEventAnalysisSignal(event) {
  return (
    asArray(event?.feedback).length > 0 ||
    numberOrZero(event?.omittedFeedbackCount) > 0 ||
    numberOrZero(event?.metrics?.riskAnswersCount) > 0
  );
}

function formatPercentValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${Math.round(number)}%` : "н/д";
}

function formatStateValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `, состояние ${number}` : "";
}

function formatFeedbackLine(item) {
  const prefix = `${item.participantRef}${formatStateValue(item.stateLevel)}`;
  if (item.kind === "reflectionAnswer") {
    return `${prefix}, вопрос "${item.question || item.questionId}": ${item.text}`;
  }
  return `${prefix}, комментарий: ${item.text}`;
}

function buildCompactPromptInput(input) {
  const lines = [
    `Режим: ${input.mode}. Срез: ${input.scope?.label || "без названия"}; группа: ${input.scope?.groupName || "не указана"}.`,
    [
      `Покрытие: участников ${numberOrZero(input.coverage?.participantsCount)}`,
      `заполнение ${formatPercentValue(input.coverage?.completion)}`,
      `feedback-фрагментов ${numberOrZero(input.coverage?.feedbackCount)}`,
      `ответов итоговой рефлексии ${numberOrZero(input.coverage?.dayReflectionResponses)}`,
      `открытых рисков ${numberOrZero(input.coverage?.openRisksCount)}`,
    ].join("; "),
  ];

  if (numberOrZero(input.coverage?.eventsOmittedFromModel) > 0) {
    lines.push(`Не вошло в prompt значимых событий: ${numberOrZero(input.coverage.eventsOmittedFromModel)}.`);
  }

  lines.push("События и обратная связь:");

  if (!asArray(input.events).length) {
    lines.push("Нет событий в выбранном срезе.");
  }

  asArray(input.events).forEach((event, index) => {
    const metrics = event.metrics || {};
    const meta = [
      event.dayLabel,
      event.timeLabel,
      event.type,
      `заполнение ${formatPercentValue(metrics.completion)}`,
      `ответов ${numberOrZero(metrics.answersCount)}`,
      `feedback ${numberOrZero(metrics.feedbackCount)}`,
      `рисков ${numberOrZero(metrics.riskAnswersCount)}`,
      Number.isFinite(Number(metrics.averageStateLevel)) ? `среднее состояние ${metrics.averageStateLevel}` : "",
      Number.isFinite(Number(metrics.deltaFromPrevious)) ? `переход ${metrics.deltaFromPrevious}` : "",
    ]
      .filter(Boolean)
      .join(", ");
    const questionText = asArray(event.reflectionQuestions)
      .map((question) => `${question.id}: ${question.text}`)
      .join(" | ");

    lines.push(`${index + 1}. ${event.title}${meta ? ` [${meta}]` : ""}`);
    if (questionText) {
      lines.push(`Вопросы события: ${questionText}`);
    }
    if (asArray(event.feedback).length) {
      lines.push(`Feedback: ${asArray(event.feedback).map(formatFeedbackLine).join(" | ")}`);
    } else {
      lines.push("Feedback: нет текстовой обратной связи; можно использовать только метрики и явно снизить confidence.");
    }
    if (numberOrZero(event.omittedFeedbackCount) > 0) {
      lines.push(`Не вошло feedback-фрагментов по событию: ${numberOrZero(event.omittedFeedbackCount)}.`);
    }
  });

  const reflectionExcerpts = asArray(input.dayReflections).flatMap((day) =>
    asArray(day.excerpts).map((excerpt) => `${day.label || day.dateLabel || "день"}: ${excerpt}`),
  );

  if (reflectionExcerpts.length) {
    lines.push("Итоговая рефлексия дня:");
    lines.push(reflectionExcerpts.join(" | "));
  }

  if (asArray(input.openRisks).length) {
    lines.push("Открытые риски:");
    lines.push(asArray(input.openRisks).map((risk) => `${risk.severity}: ${risk.title}; ${risk.detail}`).join(" | "));
  }

  return lines.join("\n");
}

function collectCommentAnalysisInput(dashboard, { scopeId, dayId, mode, eventId } = {}) {
  const analysisMode = normalizeAnalysisMode(mode);
  const scope = resolveReportScope(dashboard, { scopeId, dayId });
  const scopedDashboard = scope === dashboard ? dashboard : { ...dashboard, ...scope };
  const events = asArray(scopedDashboard.events);
  const eventPulse = asArray(scopedDashboard.eventPulse);
  const participants = asArray(scopedDashboard.participantRows || scopedDashboard.members);
  const reflectionPrep = scopedDashboard.reflectionPrep || {};
  const feedbackLimit = analysisMode === "event" ? MAX_EVENT_FEEDBACK_ITEMS : MAX_SCOPE_FEEDBACK_PER_EVENT;
  const feedbackMaxChars = analysisMode === "event" ? MAX_EVENT_FEEDBACK_CHARS : MAX_SCOPE_FEEDBACK_CHARS;
  const eventSummaries = collectEventFeedback({
    events,
    eventPulse,
    participants,
    feedbackLimit,
    feedbackMaxChars,
  });
  const dayReflections = collectDayReflections(reflectionPrep);
  const dayReflectionResponses = dayReflections.reduce((sum, item) => sum + item.responsesCount, 0);
  const dayReflectionFreeText = dayReflections.reduce((sum, item) => sum + item.freeTextCount, 0);
  const commentsCount = eventSummaries.reduce((sum, event) => sum + numberOrZero(event.metrics.commentsCount), 0);
  const feedbackCount = eventSummaries.reduce(
    (sum, event) => sum + numberOrZero(event.metrics.feedbackCount) + numberOrZero(event.omittedFeedbackCount),
    0,
  );
  let promptEvents = [];
  let eventsOmittedFromModel = 0;

  if (analysisMode === "event") {
    const targetEvent = eventSummaries.find((event) => event.id === eventId);
    if (!targetEvent) {
      throw createHttpError(400, "Для event-анализа нужен существующий eventId.");
    }
    promptEvents = [targetEvent];
  } else if (analysisMode === "events") {
    promptEvents = eventSummaries;
  } else {
    const relevantEvents = eventSummaries.filter(hasEventAnalysisSignal);
    promptEvents = relevantEvents.slice(0, MAX_SCOPE_EVENTS_FOR_MODEL);
    eventsOmittedFromModel = Math.max(0, relevantEvents.length - promptEvents.length);
  }

  return {
    mode: analysisMode,
    eventId: analysisMode === "event" ? eventId : null,
    scope: {
      sessionId: dashboard.sessionId,
      groupId: dashboard.groupId,
      groupName: trimText(dashboard.groupName),
      scopeId: scopedDashboard.scopeId || scopeId || "all",
      dayId: scopedDashboard.dayId || dayId || null,
      label: trimText(scopedDashboard.label || scopedDashboard.dateLabel || "Все дни"),
    },
    coverage: {
      participantsCount: numberOrZero(scopedDashboard.participantsCount),
      completion: numberOrZero(scopedDashboard.completion),
      progress: scopedDashboard.progress || {},
      eventsCount: events.length,
      eventsWithResponses: eventPulse.filter(
        (event) => event.hasResponses || numberOrZero(event.answersCount) > 0,
      ).length,
      commentsCount,
      feedbackCount,
      dayReflectionResponses,
      dayReflectionFreeText,
      openRisksCount: asArray(reflectionPrep.openRisks).length,
      eventsProvidedToModel: promptEvents.length,
      eventsOmittedFromModel,
    },
    events: promptEvents,
    dayReflections,
    openRisks: collectOpenRisks(reflectionPrep),
  };
}

function getJsonContract(mode) {
  if (mode === "scope") {
    return '{"coverage":{"confidence":"low|medium|high","reason":""},"daySummary":{"summary":"","recommendedActions":[""]},"eventSummaries":[{"eventId":"","title":"","summary":"","riskLevel":"low|medium|high","evidence":[""],"questions":[""],"actions":[""]}],"eventAnalyses":[],"followUpQuestions":[""]}';
  }

  return '{"coverage":{"confidence":"low|medium|high","reason":""},"daySummary":{"summary":"","recommendedActions":[]},"eventSummaries":[],"eventAnalyses":[{"eventId":"","title":"","summary":"","riskLevel":"low|medium|high","confidence":"low|medium|high","evidence":[""],"questions":[""],"actions":[""]}],"followUpQuestions":[""]}';
}

function buildCommentAnalysisMessages(input, promptSettings = {}) {
  const settings = normalizeLlmPromptSettings(promptSettings);
  const modePrompt = input.mode === "scope" ? settings.scopePrompt : settings.eventPrompt;
  const modeInstruction =
    input.mode === "scope"
      ? "Проанализируй весь срез для куратора группы."
      : input.mode === "events"
        ? "Сделай отдельный анализ по каждому событию текущего среза."
        : "Сделай анализ только одного указанного события.";

  return [
    {
      role: "system",
      content: [
        "Ты аналитический помощник куратора образовательного события.",
        "Анализируй только переданные обезличенные комментарии, ответы на вопросы события и метрики.",
        "Не ставь диагнозы, не делай выводы о личности участника, не называй участников иначе чем P001/P002 и не придумывай факты.",
        "Если данных мало или feedback отсутствует, явно снижай confidence и формулируй выводы как гипотезы или вопросы.",
        "Отделяй факты из данных от интерпретаций. Не предлагай медицинские, юридические или психологические диагнозы.",
        "Верни строго валидный JSON без Markdown, без пояснений до или после JSON.",
        settings.systemPrompt,
      ].join(" "),
    },
    {
      role: "user",
      content: [
        "/no_think",
        modeInstruction,
        modePrompt,
        "Фокус ответа: короткая кураторская сводка, evidence из данных, риски/слепые зоны, вопросы для уточнения и 1-2 ближайших действия.",
        "Ограничения длины: summary до 260 символов; evidence/questions/actions короткими пунктами; не цитируй больше 12 слов подряд из одного feedback-фрагмента.",
        `JSON schema: ${getJsonContract(input.mode)}`,
        "Входные данные:",
        buildCompactPromptInput(input),
      ].join("\n\n"),
    },
  ];
}

function normalizeTextArray(value, limit = 6) {
  if (Array.isArray(value)) {
    return value.map((item) => trimText(item)).filter(Boolean).slice(0, limit);
  }
  const text = trimText(value);
  return text ? [text].slice(0, limit) : [];
}

function normalizeRiskLevel(value) {
  return ["low", "medium", "high"].includes(value) ? value : "medium";
}

function normalizeConfidence(value) {
  return ["low", "medium", "high"].includes(value) ? value : "low";
}

function normalizeEventAnalysisItem(item, index, fallbackEvent = null) {
  if (typeof item === "string") {
    return {
      eventId: fallbackEvent?.id || `event-summary-${index + 1}`,
      title: fallbackEvent?.title || `Сигнал ${index + 1}`,
      summary: item,
      riskLevel: "medium",
      confidence: fallbackEvent?.metrics?.completion >= 70 ? "medium" : "low",
      evidence: [],
      questions: [],
      actions: [],
    };
  }

  const source = item && typeof item === "object" ? item : {};
  const summary = trimText(source.summary || source.text || source.signal || source.finding);
  if (!summary && !fallbackEvent) {
    return null;
  }

  return {
    eventId: source.eventId || source.id || fallbackEvent?.id || `event-summary-${index + 1}`,
    title: source.title || fallbackEvent?.title || `Сигнал ${index + 1}`,
    summary: summary || "Модель не вернула отдельную сводку по событию.",
    riskLevel: normalizeRiskLevel(source.riskLevel || source.risk || source.severity),
    confidence: normalizeConfidence(source.confidence || source.coverage?.confidence || "low"),
    evidence: normalizeTextArray(source.evidence || source.signals || source.proofs, 5),
    questions: normalizeTextArray(source.questions || source.followUpQuestions, 4),
    actions: normalizeTextArray(source.actions || source.recommendedActions, 3),
  };
}

function buildEventFallbackAnalysis(event, reason = "no-feedback") {
  const hasFeedback = numberOrZero(event?.metrics?.feedbackCount) > 0;
  const hasRisk = numberOrZero(event?.metrics?.riskAnswersCount) > 0;
  const summary = hasFeedback
    ? "Модель не вернула отдельный анализ события; используйте метрики и feedback как рабочую гипотезу."
    : "По событию нет текстовой обратной связи; выводы можно строить только по заполненности и шкале состояния.";

  return {
    eventId: event.id,
    title: event.title,
    summary,
    riskLevel: hasRisk ? "medium" : "low",
    confidence: hasFeedback ? "low" : "low",
    evidence: [
      `заполнение ${formatPercentValue(event?.metrics?.completion)}`,
      `ответов ${numberOrZero(event?.metrics?.answersCount)}`,
      `feedback ${numberOrZero(event?.metrics?.feedbackCount)}`,
      hasRisk ? `риск-ответов ${numberOrZero(event?.metrics?.riskAnswersCount)}` : "",
      reason === "no-feedback" ? "нет текстовой обратной связи" : "",
    ].filter(Boolean),
    questions: ["Что участникам помогло или помешало именно в этой точке программы?"],
    actions: hasFeedback ? ["Проверить сигнал в живом разговоре с группой."] : ["Не делать выводов без уточняющего вопроса группе."],
  };
}

function normalizeModelAnalysis(data, input) {
  if (!data || typeof data !== "object") {
    return data;
  }

  const mode = input?.mode || "scope";
  const coverageSource = data.coverage || {};
  const daySummarySource = data.daySummary || {};
  const eventSummariesSource = asArray(data.eventSummaries).length
    ? asArray(data.eventSummaries)
    : mode === "scope"
      ? asArray(data.events)
      : [];
  const eventAnalysesSource = asArray(data.eventAnalyses).length
    ? asArray(data.eventAnalyses)
    : mode !== "scope"
      ? asArray(data.events)
      : [];
  const eventSummaries = eventSummariesSource
    .map((event, index) => normalizeEventAnalysisItem(event, index, input?.events?.[index]))
    .filter(Boolean)
    .map(({ confidence, questions, actions, ...event }) => event);
  let eventAnalyses = eventAnalysesSource
    .map((event, index) => normalizeEventAnalysisItem(event, index, input?.events?.[index]))
    .filter(Boolean);

  if (mode === "event" && !eventAnalyses.length && (data.summary || data.actions || data.questions)) {
    eventAnalyses = [
      normalizeEventAnalysisItem(
        {
          eventId: input?.events?.[0]?.id,
          title: input?.events?.[0]?.title,
          summary: data.summary,
          actions: data.actions,
          questions: data.questions,
          evidence: data.evidence,
          confidence: data.confidence,
          riskLevel: data.riskLevel,
        },
        0,
        input?.events?.[0],
      ),
    ].filter(Boolean);
  }

  if (mode !== "scope") {
    const byId = new Map(eventAnalyses.map((event) => [event.eventId, event]));
    for (const event of asArray(input?.events)) {
      if (!byId.has(event.id)) {
        const fallback = buildEventFallbackAnalysis(
          event,
          hasEventAnalysisSignal(event) ? "missing-model-analysis" : "no-feedback",
        );
        eventAnalyses.push(fallback);
        byId.set(event.id, fallback);
      }
    }
  }

  return {
    coverage: {
      confidence: normalizeConfidence(
        coverageSource.confidence || data.confidence || (Number(input?.coverage?.completion || 0) >= 70 ? "medium" : "low"),
      ),
      reason: trimText(coverageSource.reason || data.reason),
    },
    daySummary: {
      summary: trimText(daySummarySource.summary || data.summary),
      recommendedActions: normalizeTextArray(
        daySummarySource.recommendedActions || data.actions || data.recommendedActions,
        5,
      ),
    },
    eventSummaries,
    eventAnalyses,
    dayReflectionSummary: {
      summary: trimText(data.dayReflectionSummary?.summary || data.reflectionSummary),
    },
    followUpQuestions: normalizeTextArray(data.followUpQuestions || data.questions, 6),
  };
}

async function callOllamaChat({ messages, model, baseUrl, timeoutMs, numCtx, numPredict }) {
  if (typeof fetch !== "function") {
    throw new Error("Global fetch недоступен. Для Ollama-прототипа нужен Node.js 18+.");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        think: false,
        format: "json",
        keep_alive: "10m",
        options: {
          temperature: 0.15,
          top_p: 0.8,
          num_ctx: numCtx,
          num_predict: numPredict,
        },
      }),
      signal: controller.signal,
    });

    const payloadText = await response.text();

    if (!response.ok) {
      throw new Error(`Ollama вернул ${response.status}: ${payloadText || response.statusText}`);
    }

    const payload = payloadText ? JSON.parse(payloadText) : {};
    const content = payload.message?.content || payload.response || "";

    if (!content && payload.message?.thinking) {
      throw new Error("Ollama вернул только thinking без JSON-ответа. Проверьте, что локальная Ollama поддерживает параметр think:false.");
    }

    return {
      model: payload.model || model,
      content,
      raw: payload,
    };
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`Ollama не ответил за ${timeoutMs} мс`);
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function analyzeCuratorCommentsWithOllama(dashboard, options = {}) {
  const mode = normalizeAnalysisMode(options.mode);
  const promptSettings = normalizeLlmPromptSettings(
    options.promptSettings || dashboard?.llmCommentAnalysis?.promptSettings,
  );
  const input = collectCommentAnalysisInput(dashboard, {
    scopeId: options.scopeId,
    dayId: options.dayId,
    mode,
    eventId: options.eventId,
  });
  const messages = buildCommentAnalysisMessages(input, promptSettings);
  const model = options.model || process.env.OLLAMA_MODEL || DEFAULT_OLLAMA_MODEL;
  const baseUrl = process.env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_BASE_URL;
  const timeoutMs = positiveIntegerOr(process.env.OLLAMA_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
  const numCtx = positiveIntegerOr(process.env.OLLAMA_NUM_CTX, DEFAULT_NUM_CTX);
  const numPredict = positiveIntegerOr(process.env.OLLAMA_NUM_PREDICT, DEFAULT_NUM_PREDICT);
  const provider = { name: "ollama", baseUrl, model, timeoutMs, numCtx, numPredict, think: false, mode };

  if (options.previewOnly) {
    return {
      provider,
      previewOnly: true,
      input,
      messages,
      promptSettings,
    };
  }

  const ollama = await callOllamaChat({ messages, model, baseUrl, timeoutMs, numCtx, numPredict });
  const parsed = parseModelJson(ollama.content);

  return {
    provider: { ...provider, model: ollama.model },
    previewOnly: false,
    mode,
    eventId: input.eventId,
    inputCoverage: input.coverage,
    analysis: parsed.data ? normalizeModelAnalysis(parsed.data, input) : null,
    parseError: parsed.error,
    rawText: parsed.data ? "" : ollama.content,
  };
}

module.exports = {
  DEFAULT_LLM_PROMPT_SETTINGS,
  DEFAULT_OLLAMA_BASE_URL,
  DEFAULT_OLLAMA_MODEL,
  analyzeCuratorCommentsWithOllama,
  buildCommentAnalysisMessages,
  collectCommentAnalysisInput,
  normalizeLlmPromptSettings,
  parseModelJson,
};
