import { useRef, useState } from "react";
import { useCuratorInvitationMutations } from "../../api/hooks";

const TTL_OPTIONS = [
  { value: 60 * 24, label: "24 часа" },
  { value: 60 * 48, label: "48 часов" },
  { value: 60 * 24 * 7, label: "7 дней" },
  { value: 60 * 24 * 30, label: "30 дней" },
];

const STATUS_LABEL = {
  pending: "Pending",
  consumed: "Прошёл",
  expired: "Истёк",
};

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function formatDateTime(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("ru-RU", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(value);
  }
}

async function copyToClipboard(text) {
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const tmp = document.createElement("textarea");
      tmp.value = text;
      document.body.appendChild(tmp);
      tmp.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(tmp);
      return ok;
    } catch {
      return false;
    }
  }
}

/**
 * Панель «Приглашения» в кабинете куратора.
 *
 * Содержит:
 *   1. Ввод одиночного приглашения (ФИО + выбор TTL + кнопка)
 *   2. Загрузку xlsx (1 столбец «ФИО») + ссылку на шаблон
 *   3. Список выпущенных invites с QR/URL/статусом
 */
function InvitationsPanel({ sessionId, groupId, invitations, loading, onChanged }) {
  const xlsxInputRef = useRef(null);
  const [fullName, setFullName] = useState("");
  const [ttlMinutes, setTtlMinutes] = useState(60 * 24);
  const [copyHint, setCopyHint] = useState("");

  const {
    createSingle,
    createBulkXlsx,
    downloadTemplate,
    creatingSingle,
    creatingBulk,
    downloadingTemplate,
  } = useCuratorInvitationMutations(sessionId, groupId);

  async function handleCreateSingle() {
    const name = fullName.trim();
    if (name.length < 2) return;
    try {
      await createSingle({ fullName: name, ttlMinutes });
      setFullName("");
      onChanged?.();
    } catch {
      // toast уже показан
    }
  }

  async function handleXlsxChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      await createBulkXlsx({ file, ttlMinutes });
      onChanged?.();
    } catch {
      // toast
    } finally {
      if (xlsxInputRef.current) xlsxInputRef.current.value = "";
    }
  }

  async function handleDownloadTemplate() {
    const blob = await downloadTemplate();
    if (blob) downloadBlob(blob, "curator-names-template.xlsx");
  }

  async function handleCopy(url) {
    const ok = await copyToClipboard(url);
    setCopyHint(ok ? "Скопировано" : "Не удалось");
    setTimeout(() => setCopyHint(""), 1500);
  }

  return (
    <article className="panel-card curator-group-invites">
      <header className="panel-head">
        <div>
          <p className="eyebrow">Приглашения</p>
          <h3>Magic-link для участников группы</h3>
          <p className="subtle">
            Куратор может пригласить нового участника по ФИО или загрузить xlsx со списком. Если в
            заезде уже есть человек с таким ФИО — приглашение будет на него; группа автоматически
            обновится при первом входе.
          </p>
        </div>
      </header>

      <div className="invite-bulk-step">
        <label className="invite-bulk-field">
          <span>ФИО нового участника</span>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Иванов Иван Иванович"
            disabled={creatingSingle}
          />
        </label>
        <label className="invite-bulk-field">
          <span>Срок действия ссылки</span>
          <select
            value={ttlMinutes}
            onChange={(e) => setTtlMinutes(Number(e.target.value))}
            disabled={creatingSingle || creatingBulk}
          >
            {TTL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <div className="invite-bulk-actions">
          <button
            type="button"
            className="primary-button"
            onClick={handleCreateSingle}
            disabled={creatingSingle || fullName.trim().length < 2}
          >
            {creatingSingle ? "Создаём…" : "Пригласить"}
          </button>
        </div>
      </div>

      <div className="invite-bulk-step">
        <label className="invite-bulk-field">
          <span>Загрузить xlsx со списком ФИО</span>
          <input
            ref={xlsxInputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={handleXlsxChange}
            disabled={creatingBulk}
          />
        </label>
        <button
          type="button"
          className="ghost-button"
          onClick={handleDownloadTemplate}
          disabled={downloadingTemplate}
        >
          {downloadingTemplate ? "Готовим…" : "Скачать шаблон"}
        </button>
      </div>

      <section className="curator-invite-list">
        <header className="panel-head">
          <div>
            <p className="eyebrow">Выпущенные ссылки</p>
            <h4>QR для отображения / распечатки</h4>
          </div>
          {copyHint ? <span className="confidence-tag">{copyHint}</span> : null}
        </header>

        {loading ? (
          <p className="subtle">Загружаем приглашения…</p>
        ) : invitations.length === 0 ? (
          <p className="subtle">Пока нет приглашений. Создайте первое выше.</p>
        ) : (
          <ul className="curator-invite-grid">
            {invitations.map((inv) => (
              <li
                key={inv.magicLinkId || `${inv.fullName}-${inv.createdAt}`}
                className={`curator-invite-card is-${inv.status}`}
              >
                <div className="curator-invite-qr">
                  {inv.qrDataUrl ? (
                    <img src={inv.qrDataUrl} alt={`QR для ${inv.fullName}`} />
                  ) : (
                    <span className="subtle">QR недоступен</span>
                  )}
                </div>
                <div className="curator-invite-body">
                  <strong>{inv.fullName || "(без имени)"}</strong>
                  <span
                    className={`status-pill tone-${inv.status === "pending" ? "watch" : inv.status === "consumed" ? "ok" : "silent"}`}
                  >
                    {STATUS_LABEL[inv.status] || inv.status}
                  </span>
                  <small className="subtle">
                    {inv.status === "consumed" && inv.consumedAt
                      ? `Прошёл ${formatDateTime(inv.consumedAt)}`
                      : inv.status === "expired"
                        ? `Истёк ${formatDateTime(inv.expiresAt)}`
                        : `До ${formatDateTime(inv.expiresAt)}`}
                  </small>
                  <small className="subtle">Создано {formatDateTime(inv.createdAt)}</small>
                  {inv.url ? (
                    <div className="curator-invite-url-row">
                      <input
                        type="text"
                        value={inv.url}
                        readOnly
                        onFocus={(e) => e.target.select()}
                      />
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => handleCopy(inv.url)}
                      >
                        Копировать
                      </button>
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}

export default InvitationsPanel;
