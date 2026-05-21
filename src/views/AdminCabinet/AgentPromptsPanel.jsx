import { useCallback, useEffect, useMemo, useState } from "react";
import { jsonApi, ApiError } from "../../api/jsonApi";
import { useAuth } from "../../auth/AuthContext";
import { AlertCard, SoftPill } from "../../components/ui/Pills";
import Modal from "../../components/ui/Modal";

const AGENT_LABELS = {
  curator_chat: "Чат с ИИ куратора",
  narrative_brief: "Записка дня",
  program_analytics: "Анализ программы",
};

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(value);
  }
}

function moveBlock(blocks, index, direction) {
  const next = [...blocks];
  const target = index + direction;
  if (target < 0 || target >= next.length) return next;
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);
  return next;
}

function HistoryList({ history, currentId, busy, onRestore }) {
  if (!history.length) {
    return (
      <p className="subtle">
        История пуста — нажмите «Сохранить как новую версию», чтобы создать первую запись.
      </p>
    );
  }
  return (
    <div className="table-card">
      <table className="data-table">
        <thead>
          <tr>
            <th>Версия</th>
            <th>Создано</th>
            <th>Заметка</th>
            <th>Действие</th>
          </tr>
        </thead>
        <tbody>
          {history.map((row) => (
            <tr key={row.id} className={row.id === currentId ? "is-current" : ""}>
              <td>
                <strong>v{row.version}</strong>
                {row.id === currentId ? <SoftPill>активная</SoftPill> : null}
              </td>
              <td>{formatDate(row.createdAt)}</td>
              <td className="cell-wrap">{row.notes || "—"}</td>
              <td>
                {row.id === currentId ? (
                  <span className="subtle">текущая</span>
                ) : (
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={busy}
                    onClick={() => onRestore(row)}
                  >
                    Откатить
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PreviewModal({
  open,
  agent,
  sessions,
  groups,
  knownModels,
  defaultModel,
  onClose,
  onRun,
  busy,
}) {
  const [sessionId, setSessionId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [userQuestion, setUserQuestion] = useState("");
  const [model, setModel] = useState(defaultModel || "");
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!open) {
      setSessionId("");
      setGroupId("");
      setUserQuestion("");
      setResult(null);
    } else {
      setModel(defaultModel || knownModels[0] || "");
    }
  }, [open, defaultModel, knownModels]);

  const sessionGroups = useMemo(
    () => groups.filter((g) => g.sessionId === sessionId),
    [groups, sessionId],
  );

  async function handleRun(previewOnly) {
    setResult(null);
    const next = await onRun({
      sessionId: sessionId || null,
      groupId: groupId || null,
      userQuestion,
      model: previewOnly ? null : model || null,
      previewOnly,
    });
    setResult(next);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Preview · ${agent?.name || "Агент"}`}
      width="900px"
    >
      <p className="subtle">
        «Собрать preamble» — посмотреть собранный контекст без вызова LLM. «Запустить LLM» — полный
        прогон с выбранной моделью. Ничего не сохраняется.
      </p>
      <div className="field-grid">
        <label className="field-block">
          <span>Заезд</span>
          <select value={sessionId} onChange={(e) => setSessionId(e.target.value)} disabled={busy}>
            <option value="">— не выбран —</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        {agent?.agentType === "curator_chat" ? (
          <label className="field-block">
            <span>Группа</span>
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              disabled={busy || !sessionId}
            >
              <option value="">— не выбрана —</option>
              {sessionGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="field-block">
          <span>Модель (для LLM-прогона)</span>
          <select value={model} onChange={(e) => setModel(e.target.value)} disabled={busy}>
            {knownModels.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="field-block is-wide">
        <span>Вопрос (опционально, для chat-агента)</span>
        <textarea
          rows={3}
          value={userQuestion}
          onChange={(e) => setUserQuestion(e.target.value)}
          placeholder="Например: «Как дела у группы сегодня? К кому стоит подойти?»"
          disabled={busy}
        />
      </label>

      <div className="panel-actions">
        <button
          type="button"
          className="ghost-button"
          disabled={busy}
          onClick={() => handleRun(true)}
        >
          {busy ? "Собираем…" : "Собрать preamble"}
        </button>
        <button
          type="button"
          className="primary-button"
          disabled={busy}
          onClick={() => handleRun(false)}
        >
          {busy ? "Запрашиваем LLM…" : "Запустить LLM"}
        </button>
      </div>

      {result ? (
        <div className="organizer-section-stack" style={{ marginTop: 24 }}>
          {result.error ? (
            <AlertCard title="LLM вернул ошибку" detail={result.error} tone="severity-medium" />
          ) : null}

          {result.previewOnly ? (
            <article className="panel-card">
              <header className="panel-head">
                <strong>Собранный preamble</strong>
                <small className="subtle">
                  {(result.preamble || "").length} символов · {result.durationMs} мс
                </small>
              </header>
              <pre className="diff-block" style={{ whiteSpace: "pre-wrap" }}>
                {result.preamble ||
                  "(пустой preamble — для этого типа агента preamble не собирается, либо не указаны session/group)"}
              </pre>
            </article>
          ) : (
            <>
              <article className="panel-card">
                <header className="panel-head">
                  <strong>Ответ модели</strong>
                  <small className="subtle">
                    {result.model} · {result.durationMs} мс
                    {result.usage
                      ? ` · ${result.usage.inputTokens || 0}+${result.usage.outputTokens || 0} токенов`
                      : ""}
                  </small>
                </header>
                <pre className="diff-block" style={{ whiteSpace: "pre-wrap" }}>
                  {result.output || "(пустой ответ)"}
                </pre>
              </article>
              {result.preamble ? (
                <details className="panel-card">
                  <summary>
                    <strong>Собранный preamble</strong>{" "}
                    <small className="subtle">({result.preamble.length} симв.)</small>
                  </summary>
                  <pre className="diff-block" style={{ whiteSpace: "pre-wrap" }}>
                    {result.preamble}
                  </pre>
                </details>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </Modal>
  );
}

function ProgramAnalyticsActions({ viewerId, sessions, knownModels, busy, setBusy }) {
  const [sessionId, setSessionId] = useState("");
  const [model, setModel] = useState("");
  const [reports, setReports] = useState([]);
  const [error, setError] = useState(null);
  const [openReport, setOpenReport] = useState(null);

  const loadReports = useCallback(
    async (sid) => {
      if (!sid) {
        setReports([]);
        return;
      }
      try {
        const result = await jsonApi.listAiReports(viewerId, {
          sessionId: sid,
          scope: "program-analytics",
        });
        setReports(result.reports || []);
      } catch (err) {
        setError(err);
      }
    },
    [viewerId],
  );

  useEffect(() => {
    loadReports(sessionId);
  }, [sessionId, loadReports]);

  async function handleGenerate() {
    if (!sessionId) return;
    setError(null);
    setBusy(true);
    try {
      const result = await jsonApi.generateProgramAnalyticsReport(viewerId, {
        sessionId,
        model: model || null,
      });
      await loadReports(sessionId);
      setOpenReport(result.report);
      if (result.error) {
        setError(new Error(`LLM ошибка: ${result.error}. Отчёт сохранён с пометкой low.`));
      }
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleOpenReport(reportId) {
    try {
      const result = await jsonApi.getAiReport(viewerId, reportId);
      setOpenReport(result.report);
    } catch (err) {
      setError(err);
    }
  }

  return (
    <article className="panel-card" style={{ marginTop: 24 }}>
      <header className="panel-head">
        <div>
          <p className="eyebrow">Анализ программы</p>
          <h4>Запустить отчёт по сессии</h4>
          <p className="subtle">
            Использует текущий промпт и блоки. Отчёт сохраняется в ai_reports.
          </p>
        </div>
      </header>

      {error ? <AlertCard title="Ошибка" detail={error.message} tone="severity-medium" /> : null}

      <div className="field-grid">
        <label className="field-block">
          <span>Заезд</span>
          <select value={sessionId} onChange={(e) => setSessionId(e.target.value)} disabled={busy}>
            <option value="">— выберите —</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field-block">
          <span>Модель (опционально)</span>
          <select value={model} onChange={(e) => setModel(e.target.value)} disabled={busy}>
            <option value="">— дефолт агента —</option>
            {knownModels.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="panel-actions">
        <button
          type="button"
          className="primary-button"
          disabled={busy || !sessionId}
          onClick={handleGenerate}
        >
          {busy ? "Генерируем…" : "Сгенерировать отчёт"}
        </button>
      </div>

      {reports.length ? (
        <div className="table-card" style={{ marginTop: 16 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Версия</th>
                <th>Заголовок</th>
                <th>Создано</th>
                <th>Уверенность</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id}>
                  <td>v{r.version}</td>
                  <td>{r.title}</td>
                  <td>{formatDate(r.createdAt)}</td>
                  <td>{r.confidence}</td>
                  <td>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => handleOpenReport(r.id)}
                    >
                      Открыть
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <Modal
        open={Boolean(openReport)}
        onClose={() => setOpenReport(null)}
        title={openReport ? `Отчёт · ${openReport.title} (v${openReport.version})` : ""}
        width="900px"
      >
        {openReport ? (
          <>
            <p className="subtle">
              {formatDate(openReport.createdAt)} · модель: {openReport.content?.model || "—"}
            </p>
            {openReport.content?.sections?.length ? (
              <div className="organizer-section-stack">
                {openReport.content.sections.map((sec, idx) => (
                  <article key={idx} className="panel-card">
                    <strong>{sec.heading}</strong>
                    <p style={{ whiteSpace: "pre-wrap" }}>{sec.body}</p>
                  </article>
                ))}
              </div>
            ) : (
              <pre className="diff-block" style={{ whiteSpace: "pre-wrap" }}>
                {openReport.content?.rawText || "(пустой отчёт)"}
              </pre>
            )}
          </>
        ) : null}
      </Modal>
    </article>
  );
}

function AgentPromptsPanel({ sessions = [], groups = [] }) {
  const { currentUser } = useAuth();
  const viewerId = currentUser?.id;

  const [agents, setAgents] = useState([]);
  const [catalog, setCatalog] = useState({});
  const [knownModels, setKnownModels] = useState([]);
  const [activeType, setActiveType] = useState(null);
  const [history, setHistory] = useState([]);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const loadAgents = useCallback(async () => {
    if (!viewerId) return;
    try {
      const result = await jsonApi.listAgentPrompts(viewerId);
      setAgents(result.agents || []);
      setCatalog(result.catalog || {});
      setKnownModels(result.knownModels || []);
      setActiveType((current) => current || result.agents?.[0]?.agentType || null);
    } catch (err) {
      setError(err);
    }
  }, [viewerId]);

  const loadHistory = useCallback(
    async (agentType) => {
      if (!viewerId || !agentType) return;
      try {
        const result = await jsonApi.getAgentPromptHistory(viewerId, agentType);
        setHistory(result.history || []);
      } catch (err) {
        setError(err);
      }
    },
    [viewerId],
  );

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  useEffect(() => {
    if (!activeType) return;
    const agent = agents.find((a) => a.agentType === activeType);
    if (agent) {
      setDraft({
        name: agent.name || "",
        systemText: agent.systemText || "",
        blocksConfig: [...(agent.blocksConfig || [])],
        model: agent.model || "",
        maxTokens: agent.maxTokens || "",
        notes: "",
      });
    }
    loadHistory(activeType);
  }, [activeType, agents, loadHistory]);

  const activeAgent = useMemo(
    () => agents.find((a) => a.agentType === activeType) || null,
    [agents, activeType],
  );
  const activeCatalog = catalog[activeType] || [];

  function handleBlockToggle(key) {
    setDraft((d) => ({
      ...d,
      blocksConfig: d.blocksConfig.map((b) => (b.key === key ? { ...b, enabled: !b.enabled } : b)),
    }));
  }

  function handleBlockMove(index, direction) {
    setDraft((d) => ({ ...d, blocksConfig: moveBlock(d.blocksConfig, index, direction) }));
  }

  function handleAddCatalogBlock(key) {
    setDraft((d) => {
      if (d.blocksConfig.some((b) => b.key === key)) return d;
      return { ...d, blocksConfig: [...d.blocksConfig, { key, enabled: true }] };
    });
  }

  async function handleSave() {
    if (!draft || !activeType) return;
    setError(null);
    setBusy(true);
    try {
      await jsonApi.saveAgentPrompt(viewerId, activeType, {
        name: draft.name || AGENT_LABELS[activeType] || activeType,
        systemText: draft.systemText,
        blocksConfig: draft.blocksConfig,
        model: draft.model || null,
        maxTokens: draft.maxTokens ? Number(draft.maxTokens) : null,
        notes: draft.notes || null,
      });
      await loadAgents();
      await loadHistory(activeType);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleRestore(row) {
    if (
      !confirm(
        `Откатить ${AGENT_LABELS[activeType] || activeType} на v${row.version}? Это создаст новую версию.`,
      )
    )
      return;
    setError(null);
    setBusy(true);
    try {
      await jsonApi.restoreAgentPrompt(viewerId, row.id);
      await loadAgents();
      await loadHistory(activeType);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function handlePreviewRun({ sessionId, groupId, userQuestion, model, previewOnly }) {
    setError(null);
    setBusy(true);
    try {
      return await jsonApi.previewAgentPrompt(viewerId, activeType, {
        systemText: draft.systemText,
        blocksConfig: draft.blocksConfig,
        model: previewOnly ? null : model || draft.model || null,
        maxTokens: draft.maxTokens ? Number(draft.maxTokens) : null,
        sessionId,
        groupId,
        userQuestion,
        previewOnly: Boolean(previewOnly),
      });
    } catch (err) {
      setError(err);
      return {
        output: "",
        error: err.message || String(err),
        preamble: "",
        model: "",
        durationMs: 0,
        previewOnly: Boolean(previewOnly),
      };
    } finally {
      setBusy(false);
    }
  }

  if (!viewerId) {
    return <p className="subtle">Авторизуйтесь как администратор.</p>;
  }

  return (
    <div className="organizer-tab-panel agent-prompts-panel">
      <header className="organizer-tab-head">
        <p className="eyebrow">ИИ-агенты</p>
        <h2>Промпты и порядок сбора контекста</h2>
        <p className="subtle">
          Здесь вы редактируете системные промпты и порядок preamble-блоков для всех LLM-агентов
          системы. Каждое сохранение = новая версия. История правок и откат — справа.
        </p>
      </header>

      {error ? (
        <AlertCard
          title={error instanceof ApiError ? `HTTP ${error.status}` : "Ошибка"}
          detail={error.message || String(error)}
          tone="severity-high"
        />
      ) : null}

      <div className="admin-shell" style={{ gridTemplateColumns: "260px 1fr" }}>
        <aside className="admin-sidebar">
          <div className="admin-sidebar-head">
            <strong>Агенты</strong>
          </div>
          <nav className="admin-side-nav">
            {agents.map((agent) => (
              <button
                key={agent.agentType}
                type="button"
                className={
                  activeType === agent.agentType ? "admin-side-link is-active" : "admin-side-link"
                }
                onClick={() => setActiveType(agent.agentType)}
              >
                <span>{AGENT_LABELS[agent.agentType] || agent.name || agent.agentType}</span>
                <small>
                  {agent.isCurrent ? `v${agent.version} активна` : agent.notes || "fallback"}
                </small>
              </button>
            ))}
          </nav>
        </aside>

        <div className="admin-content">
          {!draft || !activeAgent ? (
            <p className="subtle">Выберите агента слева.</p>
          ) : (
            <>
              <article className="panel-card">
                <header className="panel-head">
                  <div>
                    <p className="eyebrow">Редактор v{activeAgent.version || 0}</p>
                    <h3>{AGENT_LABELS[activeType] || draft.name}</h3>
                  </div>
                  <div className="panel-actions">
                    <button
                      type="button"
                      className="ghost-button"
                      disabled={busy}
                      onClick={() => setPreviewOpen(true)}
                    >
                      Preview
                    </button>
                    <button
                      type="button"
                      className="primary-button"
                      disabled={busy || !draft.systemText.trim()}
                      onClick={handleSave}
                    >
                      {busy ? "Сохраняем…" : "Сохранить как новую версию"}
                    </button>
                  </div>
                </header>

                <label className="field-block is-wide">
                  <span>Имя агента</span>
                  <input
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    disabled={busy}
                  />
                </label>

                <label className="field-block is-wide">
                  <span>System prompt</span>
                  <textarea
                    rows={18}
                    value={draft.systemText}
                    onChange={(e) => setDraft({ ...draft, systemText: e.target.value })}
                    disabled={busy}
                    style={{ fontFamily: "monospace", fontSize: 13 }}
                  />
                  <small className="subtle">
                    {draft.systemText.length} символов (лимит 20 000)
                  </small>
                </label>

                <div className="field-grid">
                  <label className="field-block">
                    <span>Модель (опционально)</span>
                    <select
                      value={draft.model || ""}
                      onChange={(e) => setDraft({ ...draft, model: e.target.value })}
                      disabled={busy}
                    >
                      <option value="">— дефолт для этого агента —</option>
                      {knownModels.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                      {draft.model && !knownModels.includes(draft.model) ? (
                        <option value={draft.model}>{draft.model} (legacy)</option>
                      ) : null}
                    </select>
                  </label>
                  <label className="field-block">
                    <span>Max tokens</span>
                    <input
                      type="number"
                      min="32"
                      max="8000"
                      value={draft.maxTokens}
                      onChange={(e) => setDraft({ ...draft, maxTokens: e.target.value })}
                      placeholder="дефолт по агенту"
                      disabled={busy}
                    />
                  </label>
                </div>

                <label className="field-block is-wide">
                  <span>Заметка к сохранению</span>
                  <input
                    value={draft.notes}
                    onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                    placeholder="Например: «убрал упоминание метрик»"
                    disabled={busy}
                  />
                </label>
              </article>

              <article className="panel-card">
                <header className="panel-head">
                  <div>
                    <p className="eyebrow">Блоки контекста</p>
                    <h4>Что собирается в preamble и в каком порядке</h4>
                    <p className="subtle">
                      Используйте стрелки для изменения порядка, чекбокс — для отключения блока.
                      Каталог снизу — какие блоки доступны для этого типа агента.
                    </p>
                  </div>
                </header>

                <ol className="reorder-list">
                  {draft.blocksConfig.map((block, index) => {
                    const meta = activeCatalog.find((b) => b.key === block.key);
                    return (
                      <li key={block.key} className="reorder-list-item">
                        <span className="reorder-handle">{index + 1}.</span>
                        <label className="reorder-toggle">
                          <input
                            type="checkbox"
                            checked={block.enabled !== false}
                            onChange={() => handleBlockToggle(block.key)}
                            disabled={busy}
                          />
                          <span>
                            <strong>{meta?.label || block.key}</strong>
                            {meta?.description ? (
                              <small className="subtle"> — {meta.description}</small>
                            ) : null}
                          </span>
                        </label>
                        <div className="reorder-actions">
                          <button
                            type="button"
                            className="ghost-button"
                            disabled={busy || index === 0}
                            onClick={() => handleBlockMove(index, -1)}
                            aria-label="Выше"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className="ghost-button"
                            disabled={busy || index === draft.blocksConfig.length - 1}
                            onClick={() => handleBlockMove(index, +1)}
                            aria-label="Ниже"
                          >
                            ↓
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ol>

                {activeCatalog.length ? (
                  <div className="panel-actions" style={{ flexWrap: "wrap", marginTop: 8 }}>
                    <small className="subtle">Доступные блоки:</small>
                    {activeCatalog
                      .filter((meta) => !draft.blocksConfig.some((b) => b.key === meta.key))
                      .map((meta) => (
                        <button
                          key={meta.key}
                          type="button"
                          className="ghost-button"
                          disabled={busy}
                          onClick={() => handleAddCatalogBlock(meta.key)}
                        >
                          + {meta.label}
                        </button>
                      ))}
                  </div>
                ) : null}
              </article>

              <article className="panel-card">
                <header className="panel-head">
                  <div>
                    <p className="eyebrow">История версий</p>
                    <h4>Откат через создание новой записи</h4>
                  </div>
                </header>
                <HistoryList
                  history={history}
                  currentId={activeAgent.id}
                  busy={busy}
                  onRestore={handleRestore}
                />
              </article>

              {activeType === "program_analytics" ? (
                <ProgramAnalyticsActions
                  viewerId={viewerId}
                  sessions={sessions}
                  knownModels={knownModels}
                  busy={busy}
                  setBusy={setBusy}
                />
              ) : null}
            </>
          )}
        </div>
      </div>

      <PreviewModal
        open={previewOpen}
        agent={activeAgent}
        sessions={sessions}
        groups={groups}
        knownModels={knownModels}
        defaultModel={draft?.model || knownModels[0] || ""}
        busy={busy}
        onClose={() => setPreviewOpen(false)}
        onRun={handlePreviewRun}
      />
    </div>
  );
}

export default AgentPromptsPanel;
