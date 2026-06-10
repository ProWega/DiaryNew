import { useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { useToast } from "../../components/ui/Toast";
import { jsonApi } from "../../api/jsonApi";
import {
  useBulkInvites,
  useOrganizerCuratorReusableQr,
  useOrganizerReusableQr,
} from "../../api/hooks";

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

/**
 * Карточка выпущенного многоразового QR.
 *
 * Показывает QR-картинку, ссылку и две кнопки: «Копировать» и «Скачать PDF».
 * Для PDF используется существующий механизм invite_batches: каждый выпуск
 * сохраняется как 1-row batch с layout='card', поэтому
 * POST /invite-batches/:batchId/render возвращает PDF, где QR занимает целую
 * страницу A4 (формат «1 QR на лист», как у одноразовых кураторских
 * приглашений из bulk-flow).
 */
function IssuedQrCard({ issued, sessionId, onCopyHint, fileNamePrefix }) {
  const { rerenderBatch } = useBulkInvites(sessionId);
  const [downloading, setDownloading] = useState(false);

  async function handleCopy(url) {
    const ok = await copyToClipboard(url);
    onCopyHint?.(ok ? "Скопировано" : "Не удалось скопировать");
  }

  async function handleDownloadPdf() {
    if (!issued?.batchId) {
      onCopyHint?.("PDF недоступен — пересоздайте QR");
      return;
    }
    setDownloading(true);
    try {
      const blob = await rerenderBatch(issued.batchId, {});
      if (blob) {
        const safeName = (issued.fullName || "QR").replace(/[^\p{L}\p{N}\- _]/gu, "").slice(0, 60);
        downloadBlob(blob, `${fileNamePrefix}-${safeName}.pdf`);
      }
    } catch (error) {
      onCopyHint?.(error?.message || "Не удалось скачать PDF");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="reusable-qr-issued">
      {issued.qrDataUrl ? (
        <img src={issued.qrDataUrl} alt={`QR для ${issued.fullName}`} />
      ) : (
        <span className="subtle">QR недоступен</span>
      )}
      <div className="reusable-qr-issued-body">
        <small className="subtle">
          Действует до {formatDateTime(issued.expiresAt)} · без лимита по числу использований
        </small>
        {issued.url ? (
          <div className="curator-invite-url-row">
            <input type="text" value={issued.url} readOnly onFocus={(e) => e.target.select()} />
            <button type="button" className="ghost-button" onClick={() => handleCopy(issued.url)}>
              Копировать
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={handleDownloadPdf}
              disabled={!issued.batchId || downloading}
              title={
                issued.batchId
                  ? "PDF, 1 QR на лист A4 (как одноразовые кураторские приглашения)"
                  : "PDF недоступен"
              }
            >
              {downloading ? "Готовим…" : "Скачать PDF"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Скачивает PDF с многоразовыми QR для всех людей группы в выбранной роли.
 * Бэкенд сам выпускает magic-link'и (max_uses=NULL) и рендерит layout='card'
 * — каждый QR занимает отдельный лист A4 (тот же формат, что у одноразовых
 * пакетных приглашений).
 */
function useBulkReusablePdf({ sessionId, groupId, role, ttlMinutes, groupName }) {
  const { currentUser } = useAuth();
  const addToast = useToast();
  const userId = currentUser?.id;
  const [downloading, setDownloading] = useState(false);

  async function download() {
    if (!userId || !sessionId || !groupId) return;
    setDownloading(true);
    try {
      const blob = await jsonApi.createOrganizerReusableQrBulkPdf(userId, sessionId, groupId, {
        role,
        ttlMinutes,
      });
      const safeGroup = (groupName || groupId)
        .toString()
        .replace(/[^\p{L}\p{N}\- _]/gu, "")
        .slice(0, 60);
      const prefix = role === "curator" ? "qr-кураторы" : "qr-участники";
      downloadBlob(blob, `${prefix}-${safeGroup}.pdf`);
      addToast("PDF готов", "success");
    } catch (error) {
      addToast(error?.message || "Не удалось сгенерировать PDF", "error");
    } finally {
      setDownloading(false);
    }
  }

  return { download, downloading };
}

function GroupSection({ sessionId, group, ttlMinutes }) {
  const { members, loadingMembers, issueReusableQr, issuingQr } = useOrganizerReusableQr(
    sessionId,
    group.id,
  );
  const [issuedByMember, setIssuedByMember] = useState({});
  const [activeMemberId, setActiveMemberId] = useState(null);
  const [copyHint, setCopyHint] = useState("");
  const bulkPdf = useBulkReusablePdf({
    sessionId,
    groupId: group.id,
    role: "participant",
    ttlMinutes,
    groupName: group.name,
  });

  function showHint(message) {
    setCopyHint(message);
    setTimeout(() => setCopyHint(""), 1500);
  }

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

  return (
    <article className="panel-card reusable-qr-group">
      <header className="panel-head">
        <div>
          <p className="eyebrow">Участники</p>
          <h3>{group.name || "(без названия)"}</h3>
        </div>
        <span className="confidence-tag">{members.length} участников</span>
      </header>

      <div className="reusable-qr-bulk-row">
        <button
          type="button"
          className="primary-button"
          onClick={bulkPdf.download}
          disabled={bulkPdf.downloading || members.length === 0}
          title="PDF: 1 QR на лист A4 для каждого участника группы (как у одноразовых пакетных приглашений)"
        >
          {bulkPdf.downloading ? "Готовим PDF…" : "Скачать PDF всем"}
        </button>
        <small className="subtle">
          Выпустит свежие многоразовые QR для всех участников и сложит их в один PDF.
        </small>
      </div>

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
                  <IssuedQrCard
                    issued={issued}
                    sessionId={sessionId}
                    onCopyHint={showHint}
                    fileNamePrefix="qr-участник"
                  />
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
 * Секция «Кураторы группы». Аналог GroupSection, но для кураторов:
 * — список приходит из listCuratorsForGroup (groups.curator_id +
 *   session_users role='curator');
 * — magic-link выпускается с role='curator' (consume переназначит куратора
 *   на эту группу через upsertUserAssignment);
 * — PDF в формате 1 QR/лист тот же, что у участников.
 */
function CuratorSection({ sessionId, group, ttlMinutes }) {
  const { curators, loadingCurators, issueReusableQr, issuingQr } = useOrganizerCuratorReusableQr(
    sessionId,
    group.id,
  );
  const [issuedByCurator, setIssuedByCurator] = useState({});
  const [activeCuratorId, setActiveCuratorId] = useState(null);
  const [copyHint, setCopyHint] = useState("");
  const bulkPdf = useBulkReusablePdf({
    sessionId,
    groupId: group.id,
    role: "curator",
    ttlMinutes,
    groupName: group.name,
  });

  function showHint(message) {
    setCopyHint(message);
    setTimeout(() => setCopyHint(""), 1500);
  }

  async function handleIssue(curatorId) {
    setActiveCuratorId(curatorId);
    try {
      const invite = await issueReusableQr(curatorId, ttlMinutes);
      if (invite) {
        setIssuedByCurator((prev) => ({ ...prev, [curatorId]: invite }));
      }
    } catch {
      // toast
    } finally {
      setActiveCuratorId(null);
    }
  }

  return (
    <article className="panel-card reusable-qr-group">
      <header className="panel-head">
        <div>
          <p className="eyebrow">Кураторы</p>
          <h3>{group.name || "(без названия)"}</h3>
        </div>
        <span className="confidence-tag">{curators.length} кураторов</span>
      </header>

      <div className="reusable-qr-bulk-row">
        <button
          type="button"
          className="primary-button"
          onClick={bulkPdf.download}
          disabled={bulkPdf.downloading || curators.length === 0}
          title="PDF: 1 QR на лист A4 для каждого куратора группы"
        >
          {bulkPdf.downloading ? "Готовим PDF…" : "Скачать PDF всем"}
        </button>
        <small className="subtle">
          Выпустит свежие многоразовые QR для всех кураторов и сложит их в один PDF.
        </small>
      </div>

      {copyHint ? <p className="subtle">{copyHint}</p> : null}

      {loadingCurators ? (
        <p className="subtle">Загружаем кураторов…</p>
      ) : curators.length === 0 ? (
        <p className="subtle">В этой группе пока нет назначенных кураторов.</p>
      ) : (
        <ul className="reusable-qr-list">
          {curators.map((c) => {
            const issued = issuedByCurator[c.id];
            const isBusy = issuingQr && activeCuratorId === c.id;
            return (
              <li key={c.id} className="reusable-qr-row">
                <div className="reusable-qr-row-head">
                  <strong>{c.fullName || "(без имени)"}</strong>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => handleIssue(c.id)}
                    disabled={isBusy}
                  >
                    {isBusy ? "Выпускаем…" : issued ? "Выпустить ещё" : "Сгенерировать QR"}
                  </button>
                </div>
                {issued ? (
                  <IssuedQrCard
                    issued={issued}
                    sessionId={sessionId}
                    onCopyHint={showHint}
                    fileNamePrefix="qr-куратор"
                  />
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
 * Для каждой группы заезда показывает список участников и кураторов. По клику
 * на «Сгенерировать QR» backend выпускает magic-link с max_uses=NULL (безлимит)
 * и большим TTL (по умолчанию 30 дней). Каждый QR можно скачать как PDF в
 * формате 1 QR на лист A4 (используется тот же layout='card', что у
 * одноразовых кураторских приглашений из bulk-flow).
 */
function ReusableQrPanel({ sessionId, groups = [] }) {
  const [ttlMinutes, setTtlMinutes] = useState(60 * 24 * 30);
  const [audience, setAudience] = useState("participants");

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
            <h2>QR-вход для уже добавленных участников и кураторов</h2>
            <p className="subtle">
              Выпускайте QR-коды, которые человек может сканировать многократно — удобно как бейдж
              на смену. Каждый сгенерированный QR безлимитен по числу использований и работает до
              выбранной даты. Magic-link можно показывать на экране, копировать ссылку или скачать
              PDF (1 QR на лист A4 — как у одноразовых кураторских приглашений).
            </p>
          </div>
        </header>

        <div className="invite-bulk-field">
          <span>Кому выпускаем</span>
          <div className="role-toggle">
            <label>
              <input
                type="radio"
                name="reusable-qr-audience"
                value="participants"
                checked={audience === "participants"}
                onChange={() => setAudience("participants")}
              />
              <span>Участники</span>
            </label>
            <label>
              <input
                type="radio"
                name="reusable-qr-audience"
                value="curators"
                checked={audience === "curators"}
                onChange={() => setAudience("curators")}
              />
              <span>Кураторы</span>
            </label>
          </div>
        </div>

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
        {groups.map((group) =>
          audience === "curators" ? (
            <CuratorSection
              key={`cur-${group.id}`}
              sessionId={sessionId}
              group={group}
              ttlMinutes={ttlMinutes}
            />
          ) : (
            <GroupSection
              key={`mem-${group.id}`}
              sessionId={sessionId}
              group={group}
              ttlMinutes={ttlMinutes}
            />
          ),
        )}
      </div>
    </section>
  );
}

export default ReusableQrPanel;
