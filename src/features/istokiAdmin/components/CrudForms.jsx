import { useState } from "react";
import MediaUploader from "./MediaUploader";

function FormShell({ children, onCancel, onSubmit, saving }) {
  return (
    <form
      className="istoki-admin-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(event);
      }}
    >
      {children}
      <div className="istoki-admin-form-actions">
        <button type="button" className="istoki-admin-button" onClick={onCancel} disabled={saving}>
          Отмена
        </button>
        <button type="submit" className="istoki-admin-button is-primary" disabled={saving}>
          {saving ? "Сохранение…" : "Сохранить"}
        </button>
      </div>
    </form>
  );
}

export function PodcastForm({ initial, onSubmit, onCancel }) {
  const [title, setTitle] = useState(initial.title || "");
  const [description, setDescription] = useState(initial.description || "");
  const [audioUrl, setAudioUrl] = useState(initial.audioUrl || "");
  const [durationSec, setDurationSec] = useState(initial.durationSec || 0);
  const [recordedAt, setRecordedAt] = useState(initial.recordedAt || "");
  const [speakerName, setSpeakerName] = useState(initial.speakerName || "");
  const [orderIdx, setOrderIdx] = useState(initial.orderIdx || 0);
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    setSaving(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        audioUrl: audioUrl.trim(),
        durationSec: Number(durationSec) || 0,
        recordedAt: recordedAt || null,
        speakerName: speakerName.trim() || null,
        orderIdx: Number(orderIdx) || 0,
      });
    } catch {
      // toast already shown by caller
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormShell onSubmit={handleSubmit} onCancel={onCancel} saving={saving}>
      <label className="istoki-admin-field">
        <span className="istoki-admin-field-label">Название *</span>
        <input
          className="istoki-admin-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={300}
        />
      </label>
      <label className="istoki-admin-field">
        <span className="istoki-admin-field-label">Описание</span>
        <textarea
          className="istoki-admin-textarea"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
          rows={3}
        />
      </label>
      <div className="istoki-admin-field">
        <span className="istoki-admin-field-label">Аудиофайл *</span>
        <MediaUploader
          kind="audio"
          value={audioUrl}
          onChange={setAudioUrl}
          accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg"
          helpText="MP3, WAV, OGG до 100 МБ"
        />
      </div>
      <div className="istoki-admin-field-row">
        <label className="istoki-admin-field">
          <span className="istoki-admin-field-label">Длительность, сек</span>
          <input
            className="istoki-admin-input"
            type="number"
            value={durationSec}
            onChange={(e) => setDurationSec(e.target.value)}
            min={0}
          />
        </label>
        <label className="istoki-admin-field">
          <span className="istoki-admin-field-label">Дата записи</span>
          <input
            className="istoki-admin-input"
            type="date"
            value={recordedAt}
            onChange={(e) => setRecordedAt(e.target.value)}
          />
        </label>
      </div>
      <label className="istoki-admin-field">
        <span className="istoki-admin-field-label">Спикер</span>
        <input
          className="istoki-admin-input"
          value={speakerName}
          onChange={(e) => setSpeakerName(e.target.value)}
          maxLength={200}
        />
      </label>
      <label className="istoki-admin-field">
        <span className="istoki-admin-field-label">Порядок</span>
        <input
          className="istoki-admin-input"
          type="number"
          value={orderIdx}
          onChange={(e) => setOrderIdx(e.target.value)}
          min={0}
        />
      </label>
    </FormShell>
  );
}

export function StoryForm({ initial, onSubmit, onCancel }) {
  const [participantName, setParticipantName] = useState(initial.participantName || "");
  const [ageOrRole, setAgeOrRole] = useState(initial.ageOrRole || "");
  const [beforeText, setBeforeText] = useState(initial.beforeText || "");
  const [afterText, setAfterText] = useState(initial.afterText || "");
  const [manifestoQuote, setManifestoQuote] = useState(initial.manifestoQuote || "");
  const [photoUrl, setPhotoUrl] = useState(initial.photoUrl || "");
  const [regionContextHint, setRegionContextHint] = useState(initial.regionContextHint || "");
  const [orderIdx, setOrderIdx] = useState(initial.orderIdx || 0);
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    setSaving(true);
    try {
      await onSubmit({
        participantName: participantName.trim(),
        ageOrRole: ageOrRole.trim(),
        beforeText: beforeText.trim(),
        afterText: afterText.trim(),
        manifestoQuote: manifestoQuote.trim(),
        photoUrl: photoUrl.trim(),
        regionContextHint: regionContextHint.trim() || null,
        orderIdx: Number(orderIdx) || 0,
      });
    } catch {
      /* caller toasts */
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormShell onSubmit={handleSubmit} onCancel={onCancel} saving={saving}>
      <div className="istoki-admin-field-row">
        <label className="istoki-admin-field">
          <span className="istoki-admin-field-label">Имя участника *</span>
          <input
            className="istoki-admin-input"
            value={participantName}
            onChange={(e) => setParticipantName(e.target.value)}
            required
            maxLength={200}
          />
        </label>
        <label className="istoki-admin-field">
          <span className="istoki-admin-field-label">Возраст / роль *</span>
          <input
            className="istoki-admin-input"
            value={ageOrRole}
            onChange={(e) => setAgeOrRole(e.target.value)}
            required
            maxLength={200}
            placeholder="32, педагог"
          />
        </label>
      </div>
      <label className="istoki-admin-field">
        <span className="istoki-admin-field-label">«До» *</span>
        <textarea
          className="istoki-admin-textarea"
          value={beforeText}
          onChange={(e) => setBeforeText(e.target.value)}
          required
          maxLength={2000}
          rows={4}
        />
      </label>
      <label className="istoki-admin-field">
        <span className="istoki-admin-field-label">«После» *</span>
        <textarea
          className="istoki-admin-textarea"
          value={afterText}
          onChange={(e) => setAfterText(e.target.value)}
          required
          maxLength={2000}
          rows={4}
        />
      </label>
      <label className="istoki-admin-field">
        <span className="istoki-admin-field-label">Манифест-цитата *</span>
        <textarea
          className="istoki-admin-textarea"
          value={manifestoQuote}
          onChange={(e) => setManifestoQuote(e.target.value)}
          required
          maxLength={1000}
          rows={2}
        />
      </label>
      <div className="istoki-admin-field">
        <span className="istoki-admin-field-label">Фото *</span>
        <MediaUploader
          kind="photo"
          value={photoUrl}
          onChange={setPhotoUrl}
          accept="image/jpeg,image/png,image/webp"
          helpText="JPG, PNG, WebP до 5 МБ"
        />
      </div>
      <label className="istoki-admin-field">
        <span className="istoki-admin-field-label">Подпись локации</span>
        <input
          className="istoki-admin-input"
          value={regionContextHint}
          onChange={(e) => setRegionContextHint(e.target.value)}
          maxLength={200}
          placeholder="Например, «На набережной у Карантинной бухты»"
        />
      </label>
      <label className="istoki-admin-field">
        <span className="istoki-admin-field-label">Порядок</span>
        <input
          className="istoki-admin-input"
          type="number"
          value={orderIdx}
          onChange={(e) => setOrderIdx(e.target.value)}
          min={0}
        />
      </label>
    </FormShell>
  );
}

export function ChronicleForm({ initial, onSubmit, onCancel }) {
  const [eventDate, setEventDate] = useState(initial.eventDate || "");
  const [eventTitle, setEventTitle] = useState(initial.eventTitle || "");
  const [participantsCount, setParticipantsCount] = useState(initial.participantsCount || 0);
  const [keyInsightsRaw, setKeyInsightsRaw] = useState((initial.keyInsights || []).join("\n"));
  const [orderIdx, setOrderIdx] = useState(initial.orderIdx || 0);
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    setSaving(true);
    try {
      await onSubmit({
        eventDate,
        eventTitle: eventTitle.trim(),
        participantsCount: Number(participantsCount) || 0,
        keyInsights: keyInsightsRaw
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .slice(0, 20),
        orderIdx: Number(orderIdx) || 0,
      });
    } catch {
      /* caller toasts */
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormShell onSubmit={handleSubmit} onCancel={onCancel} saving={saving}>
      <div className="istoki-admin-field-row">
        <label className="istoki-admin-field">
          <span className="istoki-admin-field-label">Дата *</span>
          <input
            className="istoki-admin-input"
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            required
          />
        </label>
        <label className="istoki-admin-field">
          <span className="istoki-admin-field-label">Участников</span>
          <input
            className="istoki-admin-input"
            type="number"
            value={participantsCount}
            onChange={(e) => setParticipantsCount(e.target.value)}
            min={0}
          />
        </label>
      </div>
      <label className="istoki-admin-field">
        <span className="istoki-admin-field-label">Название события *</span>
        <input
          className="istoki-admin-input"
          value={eventTitle}
          onChange={(e) => setEventTitle(e.target.value)}
          required
          maxLength={300}
        />
      </label>
      <label className="istoki-admin-field">
        <span className="istoki-admin-field-label">Ключевые инсайты</span>
        <textarea
          className="istoki-admin-textarea"
          value={keyInsightsRaw}
          onChange={(e) => setKeyInsightsRaw(e.target.value)}
          rows={5}
          placeholder="Один инсайт на строку, до 20 строк"
        />
        <span className="istoki-admin-field-hint">Каждая строка — отдельный пункт</span>
      </label>
      <label className="istoki-admin-field">
        <span className="istoki-admin-field-label">Порядок</span>
        <input
          className="istoki-admin-input"
          type="number"
          value={orderIdx}
          onChange={(e) => setOrderIdx(e.target.value)}
          min={0}
        />
      </label>
    </FormShell>
  );
}
