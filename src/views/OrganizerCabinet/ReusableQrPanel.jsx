import { useState } from "react";
import { useOrganizerReusableQr } from "../../api/hooks";

const TTL_OPTIONS = [
  { value: 60 * 24 * 7, label: "7 дней" },
  { value: 60 * 24 * 30, label: "30 дней" },
  { value: 60 * 24 * 90, label: "90 дней" },
  { value: 60 * 24 * 365, label: "1 год" },
];

function formatDateTime(value) {
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

function GroupSection({ sessionId, group, ttlMinutes }) {
  const { members, loadingMembers, issueReusableQr, issuingQr } = useOrganizerReusableQr(
    sessionId,
    group.id,
  );
  const [issuedByMember, setIssuedByMember] = useState({});
  const [activeMemberId, setActiveMemberId] = useState(null);
  const [copyHint, setCopyHint] = useState("");

  async function handleIssue(memberId) {
    setActiveMemberId(memberId);
    try {
      const invite = await issueReusableQr(memberId, ttlMinutes);
      if (invite) {
        setIssuedByMember((prev) => ({ ...prev, [memberId]: invite }));
      }
    } catch {
      // toast
    } finally {
      setActiveMemberId(null);
    }
  }

  async function handleCopy(url) {
    const ok = await copyToClipboard(url);
    setCopyHint(ok ? "Скопировано" : "Не удалось");
    setTimeout(() => setCopyHint(""), 1500);
  }

  return (
    <article className="panel-card reusable-qr-group">
      <header className="panel-head">
        <div>
          <p className="eyebrow">Группа</p>
          <h3>{group.name || "(без названия)"}</h3>
        </div>
        <span className="confidence-tag">{members.length} участников</span>
      </header>

      {copyHint ? <p className="subtle">{copyHint}</p> : null}

      {loadingMembers ? (
        <p className="subtle">Загружаем участников…</p>
      ) : members.length === 0 ? (
        <p className="subtle">В этой группе пока нет активных участников.</p>
      ) : (
        <ul className="reusable-qr-list">
          {members.map((m) => {
            const issued = issuedByMember[m.userId];
            const isBusy = issuingQr && activeMemberId === m.userId;
            return (
              <li key={m.userId} className="reusable-qr-row">
                <div className="reusable-qr-row-head">
                  <strong>{m.fullName || "(без имени)"}</strong>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => handleIssue(m.userId)}
                    disabled={isBusy}
                  >
                    {isBusy ? "Выпускаем…" : issued ? "Выпустить ещё" : "Сгенерировать QR"}
                  </button>
                </div>
                {issued ? (
                  <div className="reusable-qr-issued">
                    {issued.qrDataUrl ? (
                      <img src={issued.qrDataUrl} alt={`QR для ${m.fullName}`} />
                    ) : (
                      <span className="subtle">QR недоступен</span>
                    )}
                    <div className="reusable-qr-issued-body">
                      <small className="subtle">
                        Действует до {formatDateTime(issued.expiresAt)} · без лимита по числу
                        использований
                      </small>
                      {issued.url ? (
                        <div className="curator-invite-url-row">
                          <input
                            type="text"
                            value={issued.url}
                            readOnly
                            onFocus={(e) => e.target.select()}
                          />
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={() => handleCopy(issued.url)}
                          >
                            Копировать
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}

/**
 * Вкладка «Многоразовые QR» в кабинете организатора.
 *
 * Для каждой группы заезда показывает список участников. По клику на
 * «Сгенерировать QR» backend выпускает magic-link с max_uses=NULL (безлимит)
 * и большим TTL (по умолчанию 30 дней). Участник может сканировать его
 * многократно — например, как QR на бейдже.
 */
function ReusableQrPanel({ sessionId, groups = [] }) {
  const [ttlMinutes, setTtlMinutes] = useState(60 * 24 * 30);

  if (!sessionId) {
    return (
      <article className="panel-card">
        <p className="subtle">Сначала выберите заезд во вкладке «Мои заезды».</p>
      </article>
    );
  }

  if (!groups || groups.length === 0) {
    return (
      <article className="panel-card">
        <p className="subtle">В этом заезде ещё нет групп.</p>
      </article>
    );
  }

  return (
    <section className="reusable-qr-panel">
      <article className="panel-card">
        <header className="panel-head">
          <div>
            <p className="eyebrow">Многоразовые QR</p>
            <h2>QR-вход для уже добавленных участников</h2>
            <p className="subtle">
              Выпускайте QR-коды, которые участник может сканировать многократно — удобно как бейдж
              на смену. Каждый сгенерированный QR безлимитен по числу использований и работает до
              выбранной даты. Magic-link можно показывать на экране, печатать или копировать ссылку.
            </p>
          </div>
        </header>

        <label className="invite-bulk-field">
          <span>Срок действия QR</span>
          <select value={ttlMinutes} onChange={(e) => setTtlMinutes(Number(e.target.value))}>
            {TTL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </article>

      <div className="reusable-qr-groups">
        {groups.map((group) => (
          <GroupSection
            key={group.id}
            sessionId={sessionId}
            group={group}
            ttlMinutes={ttlMinutes}
          />
        ))}
      </div>
    </section>
  );
}

export default ReusableQrPanel;
