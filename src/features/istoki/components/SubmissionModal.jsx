import { useEffect, useMemo, useState } from "react";
import Modal from "../../../components/ui/Modal";
import { useCreateSubmission } from "../api";

const KIND_OPTIONS = [
  {
    id: "story",
    title: "Личная история",
    summary: "Текст «до и после» — про опыт, который вы пережили на заезде",
    fields: ["имя участника", "роль", "до и после", "цитата-манифест", "фото"],
  },
  {
    id: "podcast",
    title: "Подкаст",
    summary: "Аудиозапись разговора, размышления или интервью",
    fields: ["название", "ссылка на аудио", "длительность", "дата записи"],
  },
  {
    id: "chronicle",
    title: "Событие летописи",
    summary: "Запись о состоявшемся заезде или мероприятии",
    fields: ["дата", "название события", "число участников", "ключевые инсайты"],
  },
];

const EMPTY_DRAFTS = {
  story: {
    participantName: "",
    ageOrRole: "",
    beforeText: "",
    afterText: "",
    manifestoQuote: "",
    photoUrl: "",
    regionContextHint: "",
  },
  podcast: {
    title: "",
    description: "",
    audioUrl: "",
    durationSec: "",
    recordedAt: "",
    speakerName: "",
  },
  chronicle: {
    eventDate: "",
    eventTitle: "",
    participantsCount: "",
    keyInsightsRaw: "",
  },
};

function StepIndicator({ step }) {
  const labels = ["Тип", "Содержание", "Контакты"];
  return (
    <div className="istoki-submit-steps">
      {labels.map((label, idx) => {
        const num = idx + 1;
        return (
          <div
            key={label}
            className="istoki-submit-step"
            data-state={step === num ? "active" : step > num ? "done" : "todo"}
          >
            <span className="istoki-submit-step-num">{num}</span>
            <span className="istoki-submit-step-label">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function buildPayload(kind, draft) {
  if (kind === "story") {
    return {
      participantName: draft.participantName.trim(),
      ageOrRole: draft.ageOrRole.trim(),
      beforeText: draft.beforeText.trim(),
      afterText: draft.afterText.trim(),
      manifestoQuote: draft.manifestoQuote.trim(),
      photoUrl: draft.photoUrl.trim(),
      regionContextHint: draft.regionContextHint.trim() || null,
    };
  }
  if (kind === "podcast") {
    return {
      title: draft.title.trim(),
      description: draft.description.trim() || "",
      audioUrl: draft.audioUrl.trim(),
      durationSec: draft.durationSec ? Number(draft.durationSec) : 0,
      recordedAt: draft.recordedAt || null,
      speakerName: draft.speakerName.trim() || null,
    };
  }
  if (kind === "chronicle") {
    return {
      eventDate: draft.eventDate,
      eventTitle: draft.eventTitle.trim(),
      participantsCount: draft.participantsCount ? Number(draft.participantsCount) : 0,
      keyInsights: draft.keyInsightsRaw
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 20),
    };
  }
  return {};
}

function isContentValid(kind, draft) {
  if (kind === "story") {
    return (
      draft.participantName.trim() &&
      draft.ageOrRole.trim() &&
      draft.beforeText.trim() &&
      draft.afterText.trim() &&
      draft.manifestoQuote.trim() &&
      draft.photoUrl.trim()
    );
  }
  if (kind === "podcast") {
    return draft.title.trim() && draft.audioUrl.trim();
  }
  if (kind === "chronicle") {
    return draft.eventDate && draft.eventTitle.trim();
  }
  return false;
}

function SubmissionModal({ open, onClose, regionCode, regionName }) {
  const [step, setStep] = useState(1);
  const [kind, setKind] = useState(null);
  const [drafts, setDrafts] = useState(EMPTY_DRAFTS);
  const [contact, setContact] = useState({ name: "", email: "", consent: false });
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);

  const submitMutation = useCreateSubmission();

  // Reset state every time the modal re-opens.
  useEffect(() => {
    if (!open) return;
    setStep(1);
    setKind(null);
    setDrafts(EMPTY_DRAFTS);
    setContact({ name: "", email: "", consent: false });
    setSuccess(null);
    setError(null);
  }, [open]);

  const draft = kind ? drafts[kind] : null;
  const updateDraft = (field, value) => {
    setDrafts((prev) => ({ ...prev, [kind]: { ...prev[kind], [field]: value } }));
  };

  const canProceedFromContent = useMemo(
    () => Boolean(kind) && draft && isContentValid(kind, draft),
    [kind, draft],
  );

  const canSubmit = useMemo(
    () =>
      Boolean(kind) &&
      contact.name.trim() &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim()) &&
      contact.consent &&
      !submitMutation.isPending,
    [kind, contact, submitMutation.isPending],
  );

  async function handleSubmit() {
    if (!canSubmit || !kind) return;
    setError(null);
    try {
      const result = await submitMutation.mutateAsync({
        kind,
        regionCode,
        submitterName: contact.name.trim(),
        submitterEmail: contact.email.trim(),
        draft: buildPayload(kind, drafts[kind]),
      });
      setSuccess(result);
    } catch (err) {
      setError(err?.message || "Не удалось отправить заявку");
    }
  }

  function handleCopyStatusUrl() {
    if (!success) return;
    const fullUrl = `${window.location.origin}${success.statusUrl}`;
    navigator.clipboard?.writeText(fullUrl).catch(() => {
      /* clipboard API may be denied — silently ignore */
    });
  }

  if (success) {
    return (
      <Modal open={open} onClose={onClose} title="Спасибо за заявку" width="540px">
        <div className="istoki-submit-success">
          <p>
            Заявка <strong>#{success.id}</strong> принята и попадёт к редакции. Мы рассмотрим её в
            течение нескольких дней.
          </p>
          <p className="istoki-submit-success-hint">
            Сохраните ссылку — она показывает текущий статус заявки и причину, если её отклонят:
          </p>
          <div className="istoki-submit-status-url">
            <code>{`${typeof window !== "undefined" ? window.location.origin : ""}${success.statusUrl}`}</code>
            <button type="button" className="istoki-submit-button" onClick={handleCopyStatusUrl}>
              Скопировать
            </button>
          </div>
          <div className="istoki-submit-actions">
            <button type="button" className="istoki-submit-button" onClick={onClose}>
              Закрыть
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Поделиться историей · ${regionName || "регион"}`}
      width="640px"
    >
      <div className="istoki-submit">
        <StepIndicator step={step} />

        {step === 1 && (
          <div className="istoki-submit-kinds">
            {KIND_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className="istoki-submit-kind-card"
                data-active={kind === option.id ? "true" : "false"}
                onClick={() => setKind(option.id)}
              >
                <h3 className="istoki-submit-kind-title">{option.title}</h3>
                <p className="istoki-submit-kind-summary">{option.summary}</p>
                <ul className="istoki-submit-kind-fields">
                  {option.fields.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </button>
            ))}
          </div>
        )}

        {step === 2 && kind === "story" && (
          <div className="istoki-submit-form">
            <label className="istoki-submit-field">
              <span>Имя участника</span>
              <input
                type="text"
                value={draft.participantName}
                onChange={(e) => updateDraft("participantName", e.target.value)}
                maxLength={200}
              />
            </label>
            <label className="istoki-submit-field">
              <span>Возраст и роль (например, «32, педагог»)</span>
              <input
                type="text"
                value={draft.ageOrRole}
                onChange={(e) => updateDraft("ageOrRole", e.target.value)}
                maxLength={200}
              />
            </label>
            <label className="istoki-submit-field">
              <span>Что было до</span>
              <textarea
                rows={4}
                value={draft.beforeText}
                onChange={(e) => updateDraft("beforeText", e.target.value)}
                maxLength={2000}
              />
            </label>
            <label className="istoki-submit-field">
              <span>Что стало после</span>
              <textarea
                rows={4}
                value={draft.afterText}
                onChange={(e) => updateDraft("afterText", e.target.value)}
                maxLength={2000}
              />
            </label>
            <label className="istoki-submit-field">
              <span>Цитата-манифест (одно предложение)</span>
              <textarea
                rows={2}
                value={draft.manifestoQuote}
                onChange={(e) => updateDraft("manifestoQuote", e.target.value)}
                maxLength={1000}
              />
            </label>
            <label className="istoki-submit-field">
              <span>Ссылка на фото (внешний URL)</span>
              <input
                type="url"
                placeholder="https://…"
                value={draft.photoUrl}
                onChange={(e) => updateDraft("photoUrl", e.target.value)}
                maxLength={500}
              />
            </label>
            <label className="istoki-submit-field">
              <span>Где сделано фото (необязательно)</span>
              <input
                type="text"
                value={draft.regionContextHint}
                onChange={(e) => updateDraft("regionContextHint", e.target.value)}
                maxLength={200}
              />
            </label>
          </div>
        )}

        {step === 2 && kind === "podcast" && (
          <div className="istoki-submit-form">
            <label className="istoki-submit-field">
              <span>Название эпизода</span>
              <input
                type="text"
                value={draft.title}
                onChange={(e) => updateDraft("title", e.target.value)}
                maxLength={300}
              />
            </label>
            <label className="istoki-submit-field">
              <span>Описание (необязательно)</span>
              <textarea
                rows={3}
                value={draft.description}
                onChange={(e) => updateDraft("description", e.target.value)}
                maxLength={2000}
              />
            </label>
            <label className="istoki-submit-field">
              <span>Ссылка на аудио (SoundCloud / Я.Музыка / Drive)</span>
              <input
                type="url"
                placeholder="https://…"
                value={draft.audioUrl}
                onChange={(e) => updateDraft("audioUrl", e.target.value)}
                maxLength={500}
              />
            </label>
            <div className="istoki-submit-row">
              <label className="istoki-submit-field">
                <span>Длительность, сек</span>
                <input
                  type="number"
                  min={0}
                  value={draft.durationSec}
                  onChange={(e) => updateDraft("durationSec", e.target.value)}
                />
              </label>
              <label className="istoki-submit-field">
                <span>Дата записи</span>
                <input
                  type="date"
                  value={draft.recordedAt}
                  onChange={(e) => updateDraft("recordedAt", e.target.value)}
                />
              </label>
            </div>
            <label className="istoki-submit-field">
              <span>Имя спикера (необязательно)</span>
              <input
                type="text"
                value={draft.speakerName}
                onChange={(e) => updateDraft("speakerName", e.target.value)}
                maxLength={200}
              />
            </label>
          </div>
        )}

        {step === 2 && kind === "chronicle" && (
          <div className="istoki-submit-form">
            <div className="istoki-submit-row">
              <label className="istoki-submit-field">
                <span>Дата события</span>
                <input
                  type="date"
                  value={draft.eventDate}
                  onChange={(e) => updateDraft("eventDate", e.target.value)}
                />
              </label>
              <label className="istoki-submit-field">
                <span>Число участников</span>
                <input
                  type="number"
                  min={0}
                  value={draft.participantsCount}
                  onChange={(e) => updateDraft("participantsCount", e.target.value)}
                />
              </label>
            </div>
            <label className="istoki-submit-field">
              <span>Название</span>
              <input
                type="text"
                value={draft.eventTitle}
                onChange={(e) => updateDraft("eventTitle", e.target.value)}
                maxLength={300}
              />
            </label>
            <label className="istoki-submit-field">
              <span>Ключевые инсайты (по одному в строке, до 20)</span>
              <textarea
                rows={5}
                placeholder="Один инсайт на строке"
                value={draft.keyInsightsRaw}
                onChange={(e) => updateDraft("keyInsightsRaw", e.target.value)}
              />
            </label>
          </div>
        )}

        {step === 3 && (
          <div className="istoki-submit-form">
            <label className="istoki-submit-field">
              <span>Ваше имя</span>
              <input
                type="text"
                value={contact.name}
                onChange={(e) => setContact({ ...contact, name: e.target.value })}
                maxLength={120}
              />
            </label>
            <label className="istoki-submit-field">
              <span>Email для статуса заявки</span>
              <input
                type="email"
                value={contact.email}
                onChange={(e) => setContact({ ...contact, email: e.target.value })}
                maxLength={120}
              />
            </label>
            <label className="istoki-submit-consent">
              <input
                type="checkbox"
                checked={contact.consent}
                onChange={(e) => setContact({ ...contact, consent: e.target.checked })}
              />
              <span>
                Согласен на публикацию материала на «Картe Истоков» после модерации редакции.
              </span>
            </label>
            {error && <div className="istoki-submit-error">{error}</div>}
          </div>
        )}

        <div className="istoki-submit-actions">
          {step > 1 && (
            <button
              type="button"
              className="istoki-submit-button is-ghost"
              onClick={() => setStep(step - 1)}
              disabled={submitMutation.isPending}
            >
              Назад
            </button>
          )}
          {step === 1 && (
            <button
              type="button"
              className="istoki-submit-button"
              onClick={() => setStep(2)}
              disabled={!kind}
            >
              Продолжить →
            </button>
          )}
          {step === 2 && (
            <button
              type="button"
              className="istoki-submit-button"
              onClick={() => setStep(3)}
              disabled={!canProceedFromContent}
            >
              К контактам →
            </button>
          )}
          {step === 3 && (
            <button
              type="button"
              className="istoki-submit-button is-primary"
              onClick={handleSubmit}
              disabled={!canSubmit}
            >
              {submitMutation.isPending ? "Отправляем…" : "Отправить заявку"}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default SubmissionModal;
