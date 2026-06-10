import { useMemo, useState } from "react";
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
 * Скачивает PDF с многоразовыми QR. Если передан `userIds` — печатает только
 * для них; иначе — для всех людей группы в роли. Backend сам выпускает
 * magic-link'и (max_uses=NULL) и рендерит layout='card' (1 QR на лист A4).
 */
function useBulkReusablePdf({ sessionId, groupId, role, ttlMinutes, groupName }) {
  const { currentUser } = useAuth();
  const addToast = useToast();
  const userId = currentUser?.id;
  const [downloading, setDownloading] = useState(false);

  async function download(userIds) {
    if (!userId || !sessionId || !groupId) return;
    setDownloading(true);
    try {
      const blob = await jsonApi.createOrganizerReusableQrBulkPdf(userId, sessionId, groupId, {
        role,
        ttlMinutes,
        userIds: Array.isArray(userIds) && userIds.length ? userIds : undefined,
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

/**
 * Хук, поддерживающий состояние «выбранных через чекбоксы» людей.
 *
 * Хранит `unchecked` (исключения), а не «включённые», чтобы:
 *  — при появлении новых людей в `people` (quick-add) они автоматически
 *    оказывались выбранными без useEffect+setState (cascading renders);
 *  — выборка по умолчанию = все, что и нужно для bulk-PDF.
 */
function useSelection(people) {
  const allIds = useMemo(() => people.map((p) => p.id), [people]);
  const [unchecked, setUnchecked] = useState(() => new Set());

  // Чистим из unchecked id'ы, которых уже нет в people — derived,
  // без useEffect.
  const effectiveUnchecked = useMemo(() => {
    const validIds = new Set(allIds);
    const next = new Set();
    for (const id of unchecked) {
      if (validIds.has(id)) next.add(id);
    }
    return next;
  }, [unchecked, allIds]);

  const selectedIds = useMemo(
    () => allIds.filter((id) => !effectiveUnchecked.has(id)),
    [allIds, effectiveUnchecked],
  );

  function toggle(id) {
    setUnchecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setUnchecked(new Set());
  }

  function selectNone() {
    setUnchecked(new Set(allIds));
  }

  return {
    isSelected: (id) => !effectiveUnchecked.has(id),
    selectedCount: selectedIds.length,
    totalCount: allIds.length,
    toggle,
    selectAll,
    selectNone,
    selectedIds,
  };
}

/**
 * Форма «Добавить нового X в группу». Создаёт юзера (или переиспользует
 * существующего по совпадению ФИО в заезде), привязывает к группе и сразу
 * выпускает многоразовый QR. После успеха — новый человек появляется в
 * списке (members/curators query инвалидируется в хуке).
 */
function AddPersonForm({ personRole, busy, onAdd }) {
  const role = personRole;
  const [fullName, setFullName] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = fullName.trim();
    if (trimmed.length < 2 || busy) return;
    try {
      await onAdd(trimmed);
      setFullName("");
    } catch {
      // toast уже показан хуком
    }
  }

  return (
    <form className="reusable-qr-add-form" onSubmit={handleSubmit}>
      <label className="invite-bulk-field">
        <span>Добавить нового {role === "curator" ? "куратора" : "участника"} в группу</span>
        <div className="reusable-qr-add-row">
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder={role === "curator" ? "Захарова Виктория Ясиновна" : "Иванов Иван Иванович"}
            disabled={busy}
          />
          <button
            type="submit"
            className="primary-button"
            disabled={busy || fullName.trim().length < 2}
          >
            {busy ? "Добавляем…" : "Добавить и выдать QR"}
          </button>
        </div>
      </label>
      <small className="subtle">
        Создаётся новый аккаунт и привязывается к группе. Сразу же выпускается многоразовый QR — он
        попадёт в список ниже отмеченным галочкой.
      </small>
    </form>
  );
}

/**
 * Универсальная секция «Список людей группы + чекбоксы выбора + bulk-PDF +
 * форма добавления». Используется и для участников, и для кураторов —
 * разница только в источнике данных (передаётся уже извлечённый список).
 */
function PeopleSection({
  sessionId,
  group,
  ttlMinutes,
  personRole,
  people,
  loading,
  emptyHint,
  issueReusableQr,
  issuingQr,
  quickAdd,
  quickAdding,
}) {
  const role = personRole;
  const [issuedByPerson, setIssuedByPerson] = useState({});
  const [activePersonId, setActivePersonId] = useState(null);
  const [copyHint, setCopyHint] = useState("");
  const selection = useSelection(people);
  const bulkPdf = useBulkReusablePdf({
    sessionId,
    groupId: group.id,
    role,
    ttlMinutes,
    groupName: group.name,
  });

  function showHint(message) {
    setCopyHint(message);
    setTimeout(() => setCopyHint(""), 1500);
  }

  async function handleIssue(personId) {
    setActivePersonId(personId);
    try {
      const invite = await issueReusableQr(personId, ttlMinutes);
      if (invite) {
        setIssuedByPerson((prev) => ({ ...prev, [personId]: invite }));
      }
    } catch {
      // toast
    } finally {
      setActivePersonId(null);
    }
  }

  async function handleQuickAdd(fullName) {
    const result = await quickAdd(fullName, ttlMinutes);
    if (result?.invite) {
      // Сразу кладём свежий invite в issuedByPerson — UI покажет QR без
      // отдельного клика «Сгенерировать».
      const newId = result.userId || result.invite.userId || result.invite.magicLinkId;
      if (newId) {
        setIssuedByPerson((prev) => ({ ...prev, [newId]: result.invite }));
      }
    }
  }

  const noun = role === "curator" ? "кураторов" : "участников";
  const eyebrow = role === "curator" ? "Кураторы" : "Участники";
  const filePrefix = role === "curator" ? "qr-куратор" : "qr-участник";

  const bulkDisabled = bulkPdf.downloading || selection.selectedCount === 0 || people.length === 0;
  const bulkLabel = bulkPdf.downloading
    ? "Готовим PDF…"
    : selection.selectedCount === selection.totalCount
      ? `Скачать PDF всем (${selection.totalCount})`
      : `Скачать PDF выбранным (${selection.selectedCount} из ${selection.totalCount})`;

  return (
    <article className="panel-card reusable-qr-group">
      <header className="panel-head">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h3>{group.name || "(без названия)"}</h3>
        </div>
        <span className="confidence-tag">
          {people.length} {noun}
        </span>
      </header>

      <AddPersonForm personRole={role} busy={quickAdding} onAdd={handleQuickAdd} />

      <div className="reusable-qr-bulk-row">
        <button
          type="button"
          className="primary-button"
          onClick={() => {
            const ids =
              selection.selectedCount === selection.totalCount ? undefined : selection.selectedIds;
            bulkPdf.download(ids);
          }}
          disabled={bulkDisabled}
          title="PDF: 1 QR на лист A4 для каждого выбранного человека"
        >
          {bulkLabel}
        </button>
        {people.length > 1 ? (
          <div className="reusable-qr-bulk-toggle">
            <button
              type="button"
              className="ghost-button"
              onClick={selection.selectAll}
              disabled={selection.selectedCount === selection.totalCount}
            >
              Выбрать всех
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={selection.selectNone}
              disabled={selection.selectedCount === 0}
            >
              Снять выбор
            </button>
          </div>
        ) : null}
        <small className="subtle">
          Снимите галочки рядом с теми, кого не нужно включать в распечатку.
        </small>
      </div>

      {copyHint ? <p className="subtle">{copyHint}</p> : null}

      {loading ? (
        <p className="subtle">Загружаем {noun}…</p>
      ) : people.length === 0 ? (
        <p className="subtle">{emptyHint}</p>
      ) : (
        <ul className="reusable-qr-list">
          {people.map((p) => {
            const issued = issuedByPerson[p.id];
            const isBusy = issuingQr && activePersonId === p.id;
            const isChecked = selection.isSelected(p.id);
            return (
              <li key={p.id} className="reusable-qr-row">
                <div className="reusable-qr-row-head">
                  <label className="reusable-qr-check">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => selection.toggle(p.id)}
                    />
                    <strong>{p.fullName || "(без имени)"}</strong>
                  </label>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => handleIssue(p.id)}
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
                    fileNamePrefix={filePrefix}
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

function ParticipantsSection({ sessionId, group, ttlMinutes }) {
  const { members, loadingMembers, issueReusableQr, issuingQr, quickAdd, quickAdding } =
    useOrganizerReusableQr(sessionId, group.id);

  // Унифицируем форму к {id, fullName} — members API отдаёт userId.
  const people = useMemo(
    () => members.map((m) => ({ id: m.userId, fullName: m.fullName })),
    [members],
  );

  return (
    <PeopleSection
      sessionId={sessionId}
      group={group}
      ttlMinutes={ttlMinutes}
      personRole="participant"
      people={people}
      loading={loadingMembers}
      emptyHint="В этой группе пока нет активных участников. Добавьте первого через форму выше."
      issueReusableQr={issueReusableQr}
      issuingQr={issuingQr}
      quickAdd={quickAdd}
      quickAdding={quickAdding}
    />
  );
}

function CuratorsSection({ sessionId, group, ttlMinutes }) {
  const { curators, loadingCurators, issueReusableQr, issuingQr, quickAdd, quickAdding } =
    useOrganizerCuratorReusableQr(sessionId, group.id);

  return (
    <PeopleSection
      sessionId={sessionId}
      group={group}
      ttlMinutes={ttlMinutes}
      personRole="curator"
      people={curators}
      loading={loadingCurators}
      emptyHint="В этой группе пока нет назначенных кураторов. Добавьте через форму выше."
      issueReusableQr={issueReusableQr}
      issuingQr={issuingQr}
      quickAdd={quickAdd}
      quickAdding={quickAdding}
    />
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
 *
 * Чекбоксы перед каждым именем позволяют выбрать подмножество для bulk-PDF.
 * Форма «Добавить нового» создаёт юзера, привязывает к группе и сразу
 * выпускает QR.
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
              PDF (1 QR на лист A4 — как у одноразовых кураторских приглашений). Чекбоксами
              отметьте, кого включать в распечатку — или добавьте нового человека прямо из секции.
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
            <CuratorsSection
              key={`cur-${group.id}`}
              sessionId={sessionId}
              group={group}
              ttlMinutes={ttlMinutes}
            />
          ) : (
            <ParticipantsSection
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
