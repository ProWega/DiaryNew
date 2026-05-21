import { useRef, useState } from "react";
import { useBulkInvites } from "../../api/hooks";

const TEMPLATE_ACCEPT = ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const LETTERHEAD_ACCEPT = ".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg";

const LAYOUT_OPTIONS = [
  {
    id: "card",
    label: "Карточка-приглашение",
    description: "1 на страницу, большой QR, для печати как «бейдж».",
  },
  {
    id: "table",
    label: "Компактная таблица",
    description: "10–15 строк на страницу: маленький QR + имя + ссылка.",
  },
];

const TTL_OPTIONS = [
  { value: 60 * 24, label: "24 часа" },
  { value: 60 * 48, label: "48 часов" },
  { value: 60 * 24 * 7, label: "7 дней" },
  { value: 60 * 24 * 30, label: "30 дней" },
];

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function InviteBulkPanel({ sessionId, sessionCatalog = [], onSelectSession }) {
  const xlsxInputRef = useRef(null);
  const letterInputRef = useRef(null);
  const [xlsxFile, setXlsxFile] = useState(null);
  const [letterFile, setLetterFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [layout, setLayout] = useState("card");
  const [title, setTitle] = useState("");
  const [footer, setFooter] = useState("");
  const [ttlMinutes, setTtlMinutes] = useState(60 * 24);
  const [errorMessage, setErrorMessage] = useState(null);

  const {
    previewInvites,
    generateInvites,
    downloadTemplate,
    previewing,
    generating,
    downloadingTemplate,
  } = useBulkInvites(sessionId);

  const sessions = Array.isArray(sessionCatalog) ? sessionCatalog : [];
  const currentSession = sessions.find((s) => s.id === sessionId) || null;

  async function handleDownloadTemplate() {
    setErrorMessage(null);
    try {
      const blob = await downloadTemplate();
      if (blob) downloadBlob(blob, "invites-template.xlsx");
    } catch (error) {
      setErrorMessage(error?.message || "Не удалось скачать шаблон");
    }
  }

  if (!sessionId) {
    return (
      <article className="panel-card invite-bulk-panel">
        <header className="panel-head">
          <p className="eyebrow">Пригласить участников</p>
          <h2>Сначала выберите заезд</h2>
          <p className="subtle">
            Откройте вкладку «Мои заезды» и выберите заезд — после этого здесь появится конструктор
            приглашений.
          </p>
        </header>
        {sessions.length > 0 ? (
          <label className="invite-bulk-field">
            <span>Заезд</span>
            <select value="" onChange={(e) => onSelectSession?.(e.target.value)}>
              <option value="" disabled>
                — выберите заезд —
              </option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name || s.title || s.id}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </article>
    );
  }

  async function handleXlsxChange(event) {
    setErrorMessage(null);
    const file = event.target.files?.[0] || null;
    setXlsxFile(file);
    setPreview(null);
    if (!file) return;
    try {
      const result = await previewInvites(file);
      if (result) setPreview(result);
    } catch (error) {
      setErrorMessage(error?.message || "Ошибка парсинга");
    }
  }

  function handleLetterheadChange(event) {
    setLetterFile(event.target.files?.[0] || null);
  }

  function resetAll() {
    setXlsxFile(null);
    setLetterFile(null);
    setPreview(null);
    setErrorMessage(null);
    if (xlsxInputRef.current) xlsxInputRef.current.value = "";
    if (letterInputRef.current) letterInputRef.current.value = "";
  }

  async function handleGenerate() {
    setErrorMessage(null);
    if (!xlsxFile) {
      setErrorMessage("Сначала загрузите xlsx-шаблон");
      return;
    }
    try {
      const blob = await generateInvites({
        file: xlsxFile,
        letterhead: letterFile,
        layout,
        title: title.trim() || undefined,
        footer: footer.trim() || undefined,
        ttlMinutes,
      });
      if (blob) {
        const filename = `invites-${sessionId}-${new Date().toISOString().slice(0, 10)}.pdf`;
        downloadBlob(blob, filename);
      }
    } catch (error) {
      setErrorMessage(error?.message || "Не удалось сгенерировать PDF");
    }
  }

  const sessionLabel = currentSession?.name || currentSession?.title || "";
  const defaultTitle = sessionLabel ? `Приглашения · ${sessionLabel}` : "Приглашения участников";

  return (
    <article className="panel-card invite-bulk-panel">
      <header className="panel-head">
        <p className="eyebrow">Пригласить участников</p>
        <h2>Пакетные приглашения через xlsx → PDF с QR</h2>
        <p className="subtle">
          Скачайте шаблон, заполните по группам и участникам, загрузите обратно и получите готовый
          PDF: имя + кликабельная ссылка + QR-код. Magic-link выдаётся на 24 часа по умолчанию.
        </p>
      </header>

      <div className="invite-bulk-steps">
        {sessions.length > 0 ? (
          <section className="invite-bulk-step">
            <h3>Заезд</h3>
            <label className="invite-bulk-field">
              <span>Приглашения создаются для выбранного заезда</span>
              <select value={sessionId} onChange={(e) => onSelectSession?.(e.target.value)}>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name || s.title || s.id}
                  </option>
                ))}
              </select>
            </label>
          </section>
        ) : null}

        <section className="invite-bulk-step">
          <h3>1. Шаблон</h3>
          <button
            type="button"
            className="ghost-button invite-bulk-template-link"
            onClick={handleDownloadTemplate}
            disabled={downloadingTemplate}
          >
            {downloadingTemplate ? "Готовим шаблон…" : "↓ Скачать пустой шаблон xlsx"}
          </button>
          <p className="subtle">
            Три колонки: <strong>Группа</strong> · <strong>Куратор</strong> ·{" "}
            <strong>Участник</strong>. Повторяйте название группы для каждого участника. Если группа
            ещё не создана в заезде — будет создана автоматически.
          </p>
        </section>

        <section className="invite-bulk-step">
          <h3>2. Заполненный шаблон</h3>
          <input
            ref={xlsxInputRef}
            type="file"
            accept={TEMPLATE_ACCEPT}
            onChange={handleXlsxChange}
            disabled={previewing || generating}
          />
          {xlsxFile ? <small className="subtle">{xlsxFile.name}</small> : null}
          {previewing ? <small className="subtle">Анализируем…</small> : null}
        </section>

        {preview ? (
          <section className="invite-bulk-preview">
            <h3>3. Проверка</h3>
            <p className="invite-bulk-stats">
              <strong>
                {preview.stats.groupsCount} групп · {preview.stats.curatorsCount} кураторов ·{" "}
                {preview.stats.participantsCount} участников
              </strong>
            </p>
            {(preview.warnings || []).length ? (
              <div className="invite-bulk-warnings">
                {preview.warnings.map((w, idx) => (
                  <p key={idx} className="alert-card severity-medium">
                    ⚠ {w.message}
                  </p>
                ))}
              </div>
            ) : null}
            <div className="invite-bulk-groups">
              {preview.groups.map((g) => (
                <details key={g.name}>
                  <summary>
                    <strong>{g.name}</strong>
                    <span className="subtle">
                      {g.curator ? ` · куратор: ${g.curator}` : " · без куратора"}
                      {` · участников: ${g.participants.length}`}
                    </span>
                  </summary>
                  <ol className="invite-bulk-participants">
                    {g.participants.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ol>
                </details>
              ))}
            </div>
          </section>
        ) : null}

        {preview ? (
          <section className="invite-bulk-step">
            <h3>4. Настройка документа</h3>

            <label className="invite-bulk-field">
              <span>Название документа</span>
              <input
                type="text"
                value={title}
                placeholder={defaultTitle}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>

            <label className="invite-bulk-field">
              <span>Подвал (опционально)</span>
              <input
                type="text"
                value={footer}
                placeholder="Например: «Истоки 2026 · оргкомитет»"
                onChange={(e) => setFooter(e.target.value)}
              />
            </label>

            <fieldset className="invite-bulk-layouts">
              <legend>Лайаут PDF</legend>
              {LAYOUT_OPTIONS.map((opt) => (
                <label key={opt.id} className="invite-bulk-layout-option">
                  <input
                    type="radio"
                    name="invite-layout"
                    value={opt.id}
                    checked={layout === opt.id}
                    onChange={() => setLayout(opt.id)}
                  />
                  <span>
                    <strong>{opt.label}</strong>
                    <small className="subtle">{opt.description}</small>
                  </span>
                </label>
              ))}
            </fieldset>

            <label className="invite-bulk-field">
              <span>Срок действия ссылок</span>
              <select value={ttlMinutes} onChange={(e) => setTtlMinutes(Number(e.target.value))}>
                {TTL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="invite-bulk-field">
              <span>Фирменный бланк (опционально, PDF/PNG/JPEG)</span>
              <input
                ref={letterInputRef}
                type="file"
                accept={LETTERHEAD_ACCEPT}
                onChange={handleLetterheadChange}
                disabled={generating}
              />
              {letterFile ? <small className="subtle">{letterFile.name}</small> : null}
            </label>

            {errorMessage ? <p className="alert-card severity-high">{errorMessage}</p> : null}

            <div className="invite-bulk-actions">
              <button type="button" className="ghost-button" onClick={resetAll}>
                Сбросить
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={handleGenerate}
                disabled={generating || preview.stats.participantsCount === 0}
              >
                {generating
                  ? "Создаём magic-link и PDF…"
                  : `Сгенерировать PDF (${preview.stats.curatorsCount + preview.stats.participantsCount} приглашений)`}
              </button>
            </div>
            <p className="subtle invite-bulk-footnote">
              Magic-link создаются <strong>в момент клика</strong> и записываются в базу. Каждое
              нажатие выдаёт <em>новые</em> ссылки — старые останутся валидными до истечения срока.
            </p>
          </section>
        ) : null}

        {errorMessage && !preview ? (
          <p className="alert-card severity-high">{errorMessage}</p>
        ) : null}
      </div>
    </article>
  );
}

export default InviteBulkPanel;
