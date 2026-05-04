import { useState } from "react";

function RegionMetaForm({ region, onSave }) {
  const [name, setName] = useState(region.name || "");
  const [geographicHint, setGeographicHint] = useState(region.geographicHint || "");
  const [isPublished, setIsPublished] = useState(region.isPublished !== false);
  const [isoCode, setIsoCode] = useState(region.isoCode || "");
  const [orderIdx, setOrderIdx] = useState(region.orderIdx ?? 0);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        geographicHint: geographicHint.trim(),
        isPublished,
        isoCode: isoCode.trim() || null,
        orderIdx: Number(orderIdx) || 0,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="istoki-admin-form" onSubmit={handleSubmit}>
      <label className="istoki-admin-field">
        <span className="istoki-admin-field-label">Код (slug)</span>
        <input className="istoki-admin-input" value={region.code} disabled />
        <span className="istoki-admin-field-hint">Код региона нельзя изменить</span>
      </label>

      <label className="istoki-admin-field">
        <span className="istoki-admin-field-label">Название *</span>
        <input
          className="istoki-admin-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={200}
        />
      </label>

      <label className="istoki-admin-field">
        <span className="istoki-admin-field-label">Географическая подпись</span>
        <input
          className="istoki-admin-input"
          value={geographicHint}
          onChange={(e) => setGeographicHint(e.target.value)}
          maxLength={200}
          placeholder="Например, «Юг России, Крымский полуостров»"
        />
      </label>

      <div className="istoki-admin-field-row">
        <label className="istoki-admin-field">
          <span className="istoki-admin-field-label">ISO 3166-2</span>
          <input
            className="istoki-admin-input"
            value={isoCode}
            onChange={(e) => setIsoCode(e.target.value)}
            maxLength={8}
            placeholder="RU-SEV"
          />
        </label>

        <label className="istoki-admin-field">
          <span className="istoki-admin-field-label">Порядок сортировки</span>
          <input
            className="istoki-admin-input"
            type="number"
            value={orderIdx}
            onChange={(e) => setOrderIdx(e.target.value)}
            min={0}
          />
        </label>
      </div>

      <label className="istoki-admin-checkbox">
        <input
          type="checkbox"
          checked={isPublished}
          onChange={(e) => setIsPublished(e.target.checked)}
        />
        <span>Опубликован (виден на публичной карте)</span>
      </label>

      <div className="istoki-admin-form-actions">
        <button type="submit" className="istoki-admin-button is-primary" disabled={saving}>
          {saving ? "Сохранение…" : "Сохранить"}
        </button>
      </div>
    </form>
  );
}

export default RegionMetaForm;
