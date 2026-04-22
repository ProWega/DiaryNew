import Field from "../ui/Field";
import { SoftPill, StatusPill } from "../ui/Pills";

const STATUS_META = {
  draft: { label: "Черновик", tone: "tone-watch" },
  open: { label: "Регистрация открыта", tone: "tone-ok" },
  closed: { label: "Закрыта", tone: "tone-risk" },
  archived: { label: "Архив", tone: "" },
};

export function RegistrationStatusBadge({ status = "draft" }) {
  const meta = STATUS_META[status] || STATUS_META.draft;
  return <StatusPill tone={meta.tone}>{meta.label}</StatusPill>;
}

export function CapacityMeter({ capacity, used = 0, label = "Места" }) {
  const hasCapacity = capacity !== null && capacity !== undefined && capacity !== "";
  const numericCapacity = hasCapacity ? Number(capacity) : 0;
  const numericUsed = Number(used || 0);
  const percent = hasCapacity && numericCapacity > 0
    ? Math.min(100, Math.round((numericUsed / numericCapacity) * 100))
    : 0;

  return (
    <div className="capacity-meter">
      <div className="capacity-head">
        <strong>{label}</strong>
        <span>{hasCapacity ? `${numericUsed} / ${numericCapacity}` : `${numericUsed} участников · лимит не задан`}</span>
      </div>
      <div className="capacity-track">
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export function AccessToggle({ checked, disabled = false, onChange, onLabel = "Включено", offLabel = "Выключено" }) {
  return (
    <button
      type="button"
      className={checked ? "access-toggle is-on" : "access-toggle"}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span />
      {checked ? onLabel : offLabel}
    </button>
  );
}

export function EntityToolbar({
  title,
  description,
  children,
  query,
  onQueryChange,
  queryPlaceholder = "Поиск",
}) {
  return (
    <div className="entity-toolbar">
      <div>
        <p className="eyebrow">{title}</p>
        {description ? <p className="subtle">{description}</p> : null}
      </div>
      <div className="entity-toolbar-actions">
        {onQueryChange ? (
          <input
            value={query}
            placeholder={queryPlaceholder}
            onChange={(event) => onQueryChange(event.target.value)}
          />
        ) : null}
        {children}
      </div>
    </div>
  );
}

export function SearchFilterBar({ query, onQueryChange, filters = [], disabled = false }) {
  return (
    <div className="search-filter-bar">
      <input
        value={query}
        placeholder="Поиск по названию, роли, группе"
        disabled={disabled}
        onChange={(event) => onQueryChange(event.target.value)}
      />
      {filters.map((filter) => (
        <select
          key={filter.id}
          value={filter.value}
          disabled={disabled}
          onChange={(event) => filter.onChange(event.target.value)}
        >
          {filter.options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      ))}
    </div>
  );
}

export function AssignmentPicker({
  users = [],
  sessions = [],
  groups = [],
  value,
  disabled = false,
  onChange,
  roleOptions = [],
}) {
  const form = value || {};
  const sessionGroups = groups.filter((group) => group.sessionId === form.sessionId);
  const canUseGroup = ["participant", "curator"].includes(form.role || "participant");

  function update(key, nextValue) {
    onChange({ ...form, [key]: nextValue });
  }

  return (
    <div className="field-grid">
      <Field label="Пользователь">
        <select value={form.userId || ""} disabled={disabled} onChange={(event) => update("userId", event.target.value)}>
          <option value="">Выберите пользователя</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.fullName}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Заезд">
        <select value={form.sessionId || ""} disabled={disabled} onChange={(event) => update("sessionId", event.target.value)}>
          <option value="">Выберите заезд</option>
          {sessions.map((session) => (
            <option key={session.id} value={session.id}>
              {session.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Роль">
        <select value={form.role || "participant"} disabled={disabled} onChange={(event) => update("role", event.target.value)}>
          {roleOptions.map((role) => (
            <option key={role.id} value={role.id}>
              {role.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Группа">
        <select value={form.groupId || ""} disabled={disabled || !canUseGroup} onChange={(event) => update("groupId", event.target.value)}>
          <option value="">Без группы</option>
          {sessionGroups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Статус">
        <select value={form.status || "active"} disabled={disabled} onChange={(event) => update("status", event.target.value)}>
          <option value="active">Активен</option>
          <option value="disabled">Доступ снят</option>
        </select>
      </Field>
    </div>
  );
}

export function RegistrationGateCard({ session, onSelect, selected = false }) {
  return (
    <button
      type="button"
      className={selected ? "registration-gate-card is-active" : "registration-gate-card"}
      onClick={() => onSelect?.(session.id)}
    >
      <div>
        <strong>{session.name}</strong>
        <p>{[session.cycle, session.dateLabel, session.location].filter(Boolean).join(" · ")}</p>
      </div>
      <RegistrationStatusBadge status={session.registrationStatus} />
      <CapacityMeter capacity={session.registrationCapacity} used={session.participantsCount} />
    </button>
  );
}

export function RegistrationAccessPanel({
  value,
  mode = "edit",
  saving = false,
  disabled = false,
  error,
  onChange,
  onSubmit,
  onCancel,
}) {
  const form = value || {};
  const isDisabled = disabled || saving || mode === "view";

  function update(key, nextValue) {
    onChange?.({ ...form, [key]: nextValue });
  }

  return (
    <article className="panel-card">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Доступ к регистрации</p>
          <h3>Публикация заезда для участников</h3>
          <p className="subtle">Участники видят только открытые заезды в рамках окна регистрации и лимита мест.</p>
        </div>
        <RegistrationStatusBadge status={form.registrationStatus || form.status} />
      </div>

      <div className="field-grid">
        <Field label="Статус">
          <select
            value={form.registrationStatus || form.status || "draft"}
            disabled={isDisabled}
            onChange={(event) => update("registrationStatus", event.target.value)}
          >
            <option value="draft">Черновик</option>
            <option value="open">Открыта</option>
            <option value="closed">Закрыта</option>
            <option value="archived">Архив</option>
          </select>
        </Field>
        <Field label="Лимит участников">
          <input
            value={form.registrationCapacity ?? form.capacity ?? ""}
            disabled={isDisabled}
            inputMode="numeric"
            onChange={(event) => update("registrationCapacity", event.target.value)}
          />
        </Field>
        <Field label="Открыть с">
          <input
            type="datetime-local"
            value={String(form.registrationStartsAt || form.startsAt || "").slice(0, 16)}
            disabled={isDisabled}
            onChange={(event) => update("registrationStartsAt", event.target.value)}
          />
        </Field>
        <Field label="Закрыть после">
          <input
            type="datetime-local"
            value={String(form.registrationEndsAt || form.endsAt || "").slice(0, 16)}
            disabled={isDisabled}
            onChange={(event) => update("registrationEndsAt", event.target.value)}
          />
        </Field>
        <Field label="Публичная заметка" wide>
          <textarea
            rows={3}
            value={form.registrationPolicy?.note || form.policy?.note || ""}
            disabled={isDisabled}
            onChange={(event) =>
              update("registrationPolicy", {
                ...(form.registrationPolicy || form.policy || {}),
                mode: "public",
                note: event.target.value,
              })
            }
          />
        </Field>
      </div>

      {error ? (
        <div className="alert-card severity-high">
          <strong>Не удалось сохранить доступ</strong>
          <p>{error.message || error}</p>
        </div>
      ) : null}

      <div className="card-actions">
        <button type="button" className="primary-button" disabled={isDisabled} onClick={() => onSubmit?.(form)}>
          {saving ? "Сохраняем..." : "Сохранить доступ"}
        </button>
        {onCancel ? (
          <button type="button" className="ghost-button" disabled={saving} onClick={onCancel}>
            Отменить
          </button>
        ) : null}
        <SoftPill outline>Публичная регистрация на уровне заезда</SoftPill>
      </div>
    </article>
  );
}
