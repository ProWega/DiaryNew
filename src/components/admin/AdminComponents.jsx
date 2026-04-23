import { useEffect, useState } from "react";
import MetricBadge from "../MetricBadge";
import {
  AssignmentPicker,
  CapacityMeter,
  EntityToolbar,
  RegistrationStatusBadge,
  SearchFilterBar,
} from "../access/AccessComponents";
import Field from "../ui/Field";
import { SoftPill, StatusPill } from "../ui/Pills";

export function AdminUserDirectory({
  users = [],
  selectedUserId,
  query = "",
  roleFilter = "all",
  statusFilter = "all",
  onQueryChange,
  onRoleFilterChange,
  onStatusFilterChange,
  onSelectUser,
}) {
  const normalizedQuery = query.trim().toLowerCase();
  const filteredUsers = users.filter((user) => {
    const matchesQuery =
      !normalizedQuery ||
      user.fullName.toLowerCase().includes(normalizedQuery) ||
      user.role.toLowerCase().includes(normalizedQuery) ||
      user.email?.toLowerCase().includes(normalizedQuery);
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    const matchesStatus = statusFilter === "all" || user.status === statusFilter;
    return matchesQuery && matchesRole && matchesStatus;
  });

  return (
    <article className="panel-card">
      <EntityToolbar title="Пользователи" description={`${filteredUsers.length} из ${users.length}`}>
        <SoftPill>{users.filter((user) => user.role === "organizer").length} организаторов</SoftPill>
      </EntityToolbar>
      <SearchFilterBar
        query={query}
        onQueryChange={onQueryChange}
        filters={[
          {
            id: "role",
            value: roleFilter,
            onChange: onRoleFilterChange,
            options: [
              { id: "all", label: "Все роли" },
              { id: "participant", label: "Участники" },
              { id: "curator", label: "Кураторы" },
              { id: "organizer", label: "Организаторы" },
              { id: "admin", label: "Админы" },
            ],
          },
          {
            id: "status",
            value: statusFilter,
            onChange: onStatusFilterChange,
            options: [
              { id: "all", label: "Все статусы" },
              { id: "active", label: "Активные" },
              { id: "disabled", label: "Отключённые" },
            ],
          },
        ]}
      />
      <div className="directory-list">
        {filteredUsers.map((user) => (
          <button
            key={user.id}
            type="button"
            className={selectedUserId === user.id ? "directory-row is-active" : "directory-row"}
            onClick={() => onSelectUser(user.id)}
          >
            <span>
              <strong>{user.fullName}</strong>
              <small>{user.email || user.phone || "Контакты не указаны"}</small>
            </span>
            <span className="pill-grid">
              <StatusPill tone={user.status === "disabled" ? "tone-risk" : "tone-ok"}>
                {user.status === "disabled" ? "Отключён" : "Активен"}
              </StatusPill>
              <SoftPill outline>{user.roleLabel}</SoftPill>
            </span>
          </button>
        ))}
        {!filteredUsers.length ? (
          <div className="feedback-card">
            <h2>Пользователи не найдены</h2>
            <p>Измените фильтры или создайте нового пользователя.</p>
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function UserEditorForm({
  value,
  mode = "edit",
  roleOptions = [],
  saving = false,
  disabled = false,
  error,
  onChange,
  onSubmit,
  onCancel,
  onStatusChange,
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
          <p className="eyebrow">{mode === "create" ? "Новый пользователь" : "Карточка пользователя"}</p>
          <h3>{form.fullName || "Заполните профиль"}</h3>
        </div>
        {form.status ? (
          <StatusPill tone={form.status === "disabled" ? "tone-risk" : "tone-ok"}>
            {form.status === "disabled" ? "Отключён" : "Активен"}
          </StatusPill>
        ) : null}
      </div>
      <div className="field-grid">
        <Field label="ФИО / ник" wide>
          <input value={form.fullName || ""} disabled={isDisabled} onChange={(event) => update("fullName", event.target.value)} />
        </Field>
        <Field label="Роль">
          <select value={form.role || "participant"} disabled={isDisabled} onChange={(event) => update("role", event.target.value)}>
            {roleOptions.map((role) => (
              <option key={role.id} value={role.id}>
                {role.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Email">
          <input value={form.email || ""} disabled={isDisabled} onChange={(event) => update("email", event.target.value)} />
        </Field>
        <Field label="Телефон">
          <input value={form.phone || ""} disabled={isDisabled} onChange={(event) => update("phone", event.target.value)} />
        </Field>
        <Field label="Возраст">
          <input value={form.age || ""} disabled={isDisabled} onChange={(event) => update("age", event.target.value)} />
        </Field>
        <Field label="Пол">
          <input value={form.gender || ""} disabled={isDisabled} onChange={(event) => update("gender", event.target.value)} />
        </Field>
      </div>
      {error ? (
        <div className="alert-card severity-high">
          <strong>Ошибка сохранения</strong>
          <p>{error.message || error}</p>
        </div>
      ) : null}
      <div className="card-actions">
        <button type="button" className="primary-button" disabled={isDisabled} onClick={() => onSubmit?.(form)}>
          {saving ? "Сохраняем..." : mode === "create" ? "Создать пользователя" : "Сохранить пользователя"}
        </button>
        {form.id && onStatusChange ? (
          <button
            type="button"
            className="ghost-button"
            disabled={saving}
            onClick={() => onStatusChange(form.status === "disabled" ? "active" : "disabled")}
          >
            {form.status === "disabled" ? "Включить" : "Деактивировать"}
          </button>
        ) : null}
        {onCancel ? (
          <button type="button" className="ghost-button" disabled={saving} onClick={onCancel}>
            Отменить
          </button>
        ) : null}
      </div>
    </article>
  );
}

export function SessionCatalog({ sessions = [], selectedSessionId, query = "", onQueryChange, onSelectSession }) {
  const normalizedQuery = query.trim().toLowerCase();
  const filteredSessions = sessions.filter((session) =>
    !normalizedQuery ||
    session.name.toLowerCase().includes(normalizedQuery) ||
    session.location.toLowerCase().includes(normalizedQuery) ||
    session.registrationStatus.toLowerCase().includes(normalizedQuery),
  );

  return (
    <article className="panel-card">
      <EntityToolbar
        title="Заезды"
        description="Публичная регистрация управляется на уровне заезда"
        query={query}
        onQueryChange={onQueryChange}
        queryPlaceholder="Найти заезд"
      />
      <div className="session-card-grid">
        {filteredSessions.map((session) => (
          <button
            key={session.id}
            type="button"
            className={selectedSessionId === session.id ? "session-card is-active" : "session-card"}
            onClick={() => onSelectSession(session.id)}
          >
            <div className="panel-head">
              <div>
                <strong>{session.name}</strong>
                <p>{[session.cycle, session.dateLabel, session.location].filter(Boolean).join(" · ")}</p>
              </div>
              <RegistrationStatusBadge status={session.registrationStatus} />
            </div>
            <CapacityMeter capacity={session.registrationCapacity} used={session.participantsCount} />
          </button>
        ))}
      </div>
    </article>
  );
}

export function SessionEditorForm({
  value,
  mode = "edit",
  preset = "admin",
  saving = false,
  disabled = false,
  error,
  onChange,
  onSubmit,
  onCancel,
}) {
  const form = value || {};
  const isDisabled = disabled || saving || mode === "view";
  const isOrganizerPreset = preset === "organizer";
  const registrationStatusOptions = isOrganizerPreset
    ? [
        { value: "draft", label: "Черновик" },
        { value: "open", label: "Открыта" },
        { value: "closed", label: "Закрыта" },
      ]
    : [
        { value: "draft", label: "Черновик" },
        { value: "open", label: "Открыта" },
        { value: "closed", label: "Закрыта" },
        { value: "archived", label: "Архив" },
      ];

  function update(key, nextValue) {
    onChange?.({ ...form, [key]: nextValue });
  }

  return (
    <article className="panel-card">
      <div className="panel-head">
        <div>
          <p className="eyebrow">{mode === "create" ? "Новый заезд" : "Параметры заезда"}</p>
          <h3>{form.name || "Название заезда"}</h3>
        </div>
        {form.registrationStatus ? <RegistrationStatusBadge status={form.registrationStatus} /> : null}
      </div>
      <div className="field-grid">
        <Field label="Название" wide>
          <input value={form.name || ""} disabled={isDisabled} onChange={(event) => update("name", event.target.value)} />
        </Field>
        {!isOrganizerPreset ? (
          <>
            <Field label="Цикл / период">
              <input value={form.cycle || ""} disabled={isDisabled} onChange={(event) => update("cycle", event.target.value)} />
            </Field>
            <Field label="Подпись дат">
              <input value={form.dateLabel || ""} disabled={isDisabled} onChange={(event) => update("dateLabel", event.target.value)} />
            </Field>
          </>
        ) : null}
        <Field label="Дата начала">
          <input type="date" value={form.startDate || ""} disabled={isDisabled} onChange={(event) => update("startDate", event.target.value)} />
        </Field>
        <Field label="Дата окончания">
          <input type="date" value={form.endDate || ""} disabled={isDisabled} onChange={(event) => update("endDate", event.target.value)} />
        </Field>
        {isOrganizerPreset ? (
          <>
            <Field label="Открыть регистрацию">
              <input
                type="datetime-local"
                value={String(form.registrationStartsAt || "").slice(0, 16)}
                disabled={isDisabled}
                onChange={(event) => update("registrationStartsAt", event.target.value)}
              />
            </Field>
            <Field label="Закрыть регистрацию">
              <input
                type="datetime-local"
                value={String(form.registrationEndsAt || "").slice(0, 16)}
                disabled={isDisabled}
                onChange={(event) => update("registrationEndsAt", event.target.value)}
              />
            </Field>
            <Field label="Лимит участников">
              <input
                value={form.registrationCapacity ?? ""}
                disabled={isDisabled}
                inputMode="numeric"
                onChange={(event) => update("registrationCapacity", event.target.value)}
              />
            </Field>
            <Field label="Статус регистрации">
              <select
                value={form.registrationStatus || "draft"}
                disabled={isDisabled}
                onChange={(event) => update("registrationStatus", event.target.value)}
              >
                {registrationStatusOptions.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </Field>
          </>
        ) : (
          <Field label="Площадка" wide>
            <input value={form.location || ""} disabled={isDisabled} onChange={(event) => update("location", event.target.value)} />
          </Field>
        )}
        <Field label="Описание" wide>
          <textarea rows={3} value={form.description || ""} disabled={isDisabled} onChange={(event) => update("description", event.target.value)} />
        </Field>
      </div>
      {error ? (
        <div className="alert-card severity-high">
          <strong>Ошибка сохранения</strong>
          <p>{error.message || error}</p>
        </div>
      ) : null}
      <div className="card-actions">
        <button type="button" className="primary-button" disabled={isDisabled} onClick={() => onSubmit?.(form)}>
          {saving ? "Сохраняем..." : mode === "create" ? "Создать заезд" : "Сохранить заезд"}
        </button>
        {onCancel ? (
          <button type="button" className="ghost-button" disabled={saving} onClick={onCancel}>
            Отменить
          </button>
        ) : null}
      </div>
    </article>
  );
}

const STAFF_ROLES = new Set(["organizer", "curator"]);

const ASSIGNMENT_ROLE_FILTERS = [
  { id: "staff", label: "Организаторы и кураторы" },
  { id: "all", label: "Все роли" },
  { id: "organizer", label: "Организаторы" },
  { id: "curator", label: "Кураторы" },
  { id: "participant", label: "Участники" },
  { id: "admin", label: "Администраторы" },
];

const ASSIGNMENT_STATUS_FILTERS = [
  { id: "active", label: "Активные" },
  { id: "all", label: "Все статусы" },
  { id: "disabled", label: "Отключённые" },
  { id: "pending", label: "Ожидают" },
];

const ASSIGNMENT_STATUS_OPTIONS = [
  { id: "active", label: "Активен" },
  { id: "disabled", label: "Доступ снят" },
];

const DEFAULT_ASSIGNMENT_FILTERS = {
  query: "",
  role: "staff",
  sessionId: "all",
  status: "active",
};

function roleUsesGroup(role) {
  return role === "participant" || role === "curator";
}

function normalizeAssignmentValue(value = {}, groups = []) {
  const role = value.role || "participant";
  const sessionId = value.sessionId || "";
  const groupId = roleUsesGroup(role) ? value.groupId || "" : "";
  const groupBelongsToSession = !groupId || groups.some((group) => group.id === groupId && group.sessionId === sessionId);

  return {
    ...value,
    role,
    sessionId,
    groupId: groupBelongsToSession ? groupId : "",
    status: value.status || "active",
  };
}

function AssignmentEditableRow({
  assignment,
  users = [],
  sessions = [],
  groups = [],
  roleOptions = [],
  saving = false,
  disabled = false,
  onSubmit,
}) {
  const [draft, setDraft] = useState(() => normalizeAssignmentValue(assignment, groups));
  const sessionGroups = groups.filter((group) => group.sessionId === draft.sessionId);
  const canUseGroup = roleUsesGroup(draft.role);

  useEffect(() => {
    setDraft(normalizeAssignmentValue(assignment, groups));
  }, [assignment, groups]);

  function update(key, nextValue) {
    setDraft((previous) => normalizeAssignmentValue({ ...previous, [key]: nextValue }, groups));
  }

  return (
    <tr>
      <td>
        <select value={draft.userId || ""} disabled={disabled || saving} onChange={(event) => update("userId", event.target.value)}>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.fullName}
            </option>
          ))}
        </select>
      </td>
      <td>
        <select value={draft.sessionId || ""} disabled={disabled || saving} onChange={(event) => update("sessionId", event.target.value)}>
          {sessions.map((session) => (
            <option key={session.id} value={session.id}>
              {session.name}
            </option>
          ))}
        </select>
      </td>
      <td>
        <select value={draft.role || "participant"} disabled={disabled || saving} onChange={(event) => update("role", event.target.value)}>
          {roleOptions.map((role) => (
            <option key={role.id} value={role.id}>
              {role.label}
            </option>
          ))}
        </select>
      </td>
      <td>
        <select value={draft.groupId || ""} disabled={disabled || saving || !canUseGroup} onChange={(event) => update("groupId", event.target.value)}>
          <option value="">Без группы</option>
          {sessionGroups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
      </td>
      <td>
        <select value={draft.status || "active"} disabled={disabled || saving} onChange={(event) => update("status", event.target.value)}>
          {ASSIGNMENT_STATUS_OPTIONS.map((status) => (
            <option key={status.id} value={status.id}>
              {status.label}
            </option>
          ))}
        </select>
      </td>
      <td>
        <button
          type="button"
          className="ghost-button"
          disabled={disabled || saving || !draft.userId || !draft.sessionId}
          onClick={() => onSubmit?.(normalizeAssignmentValue(draft, groups))}
        >
          Сохранить
        </button>
      </td>
    </tr>
  );
}

export function RoleAssignmentMatrix({
  users = [],
  sessions = [],
  groups = [],
  assignments = [],
  roleOptions = [],
  value,
  filters,
  saving = false,
  disabled = false,
  onFiltersChange,
  onChange,
  onSubmit,
}) {
  const [localFilters, setLocalFilters] = useState(DEFAULT_ASSIGNMENT_FILTERS);
  const activeFilters = { ...DEFAULT_ASSIGNMENT_FILTERS, ...(filters || localFilters) };

  function updateFilter(key, nextValue) {
    const nextFilters = { ...activeFilters, [key]: nextValue };
    if (filters && onFiltersChange) {
      onFiltersChange(nextFilters);
    } else {
      setLocalFilters(nextFilters);
      onFiltersChange?.(nextFilters);
    }
  }

  const normalizedQuery = activeFilters.query.trim().toLowerCase();
  const sessionOptions = [
    { id: "all", label: "Все заезды" },
    ...sessions.map((session) => ({ id: session.id, label: session.name })),
  ];
  const filteredAssignments = assignments.filter((assignment) => {
    const matchesQuery =
      !normalizedQuery ||
      [
        assignment.userName,
        assignment.sessionName,
        assignment.roleLabel,
        assignment.groupName,
        assignment.status,
      ]
        .filter(Boolean)
        .some((item) => String(item).toLowerCase().includes(normalizedQuery));
    const matchesRole =
      activeFilters.role === "all" ||
      (activeFilters.role === "staff" && STAFF_ROLES.has(assignment.role)) ||
      assignment.role === activeFilters.role;
    const matchesSession = activeFilters.sessionId === "all" || assignment.sessionId === activeFilters.sessionId;
    const matchesStatus = activeFilters.status === "all" || assignment.status === activeFilters.status;
    return matchesQuery && matchesRole && matchesSession && matchesStatus;
  });
  const createDraft = normalizeAssignmentValue(value, groups);

  return (
    <article className="panel-card">
      <EntityToolbar title="Назначения" description="Роли и группы внутри конкретных заездов">
        <SoftPill>{filteredAssignments.length} из {assignments.length} назначений</SoftPill>
      </EntityToolbar>
      <SearchFilterBar
        query={activeFilters.query}
        onQueryChange={(nextQuery) => updateFilter("query", nextQuery)}
        disabled={disabled || saving}
        filters={[
          {
            id: "role",
            value: activeFilters.role,
            onChange: (nextRole) => updateFilter("role", nextRole),
            options: ASSIGNMENT_ROLE_FILTERS,
          },
          {
            id: "session",
            value: activeFilters.sessionId,
            onChange: (nextSessionId) => updateFilter("sessionId", nextSessionId),
            options: sessionOptions,
          },
          {
            id: "status",
            value: activeFilters.status,
            onChange: (nextStatus) => updateFilter("status", nextStatus),
            options: ASSIGNMENT_STATUS_FILTERS,
          },
        ]}
      />
      <AssignmentPicker
        users={users}
        sessions={sessions}
        groups={groups}
        value={createDraft}
        roleOptions={roleOptions}
        disabled={disabled || saving}
        onChange={(nextValue) => onChange?.(normalizeAssignmentValue(nextValue, groups))}
      />
      <div className="card-actions">
        <button
          type="button"
          className="primary-button"
          disabled={disabled || saving || !createDraft?.userId || !createDraft?.sessionId}
          onClick={() => onSubmit?.(normalizeAssignmentValue(createDraft, groups))}
        >
          {saving ? "Сохраняем..." : "Создать / обновить назначение"}
        </button>
      </div>
      {filteredAssignments.length ? (
        <div className="table-wrap">
          <table className="data-table is-compact">
            <thead>
              <tr>
                <th>Пользователь</th>
                <th>Заезд</th>
                <th>Роль</th>
                <th>Группа</th>
                <th>Статус</th>
                <th>Действие</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssignments.map((assignment) => (
                <AssignmentEditableRow
                  key={assignment.id}
                  assignment={assignment}
                  users={users}
                  sessions={sessions}
                  groups={groups}
                  roleOptions={roleOptions}
                  saving={saving}
                  disabled={disabled}
                  onSubmit={onSubmit}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="feedback-card">
          <h2>Назначения не найдены</h2>
          <p>Измените фильтры или создайте новое назначение для выбранного заезда.</p>
        </div>
      )}
    </article>
  );
}

export function GroupAssignmentPanel({ groups = [] }) {
  return (
    <article className="panel-card">
      <EntityToolbar title="Группы" description="Справочник групп и кураторов" />
      <div className="group-compare-grid">
        {groups.map((group) => (
          <div key={group.id} className="compare-card">
            <strong>{group.name}</strong>
            <p>{group.sessionName}</p>
            <div className="pill-grid">
              <SoftPill>{group.curatorName || "Куратор не назначен"}</SoftPill>
            </div>
            <p className="lead-text">{group.description || "Описание группы не задано."}</p>
          </div>
        ))}
      </div>
    </article>
  );
}

export function AuditTimeline({ items = [] }) {
  return (
    <article className="panel-card">
      <EntityToolbar title="Аудит" description="Последние действия с доступами и регистрацией" />
      {items.length ? (
        <div className="audit-table-wrap">
          <table className="audit-table">
            <thead>
              <tr>
                <th>Время</th>
                <th>Действие</th>
                <th>Пользователь</th>
                <th>Объект</th>
                <th>Заезд</th>
              </tr>
            </thead>
            <tbody>
              {items.map((entry) => (
                <tr key={entry.id}>
                  <td>{new Date(entry.time).toLocaleString("ru-RU")}</td>
                  <td>
                    <strong>{entry.action}</strong>
                  </td>
                  <td>{entry.actor}</td>
                  <td>
                    {[entry.entityType, entry.entityId].filter(Boolean).join(" · ") || "Системное событие"}
                  </td>
                  <td>{entry.sessionName || "Без привязки"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="feedback-card">
          <h2>Аудит пока пуст</h2>
          <p>Здесь появятся действия администраторов и организаторов.</p>
        </div>
      )}
    </article>
  );
}

export function AdminSummary({ summary }) {
  return (
    <div className="hero-stats">
      <MetricBadge label="Пользователей" value={summary.usersCount} />
      <MetricBadge label="Активных" value={summary.activeUsersCount} />
      <MetricBadge label="Организаторов" value={summary.organizersCount} />
      <MetricBadge label="Открытых регистраций" value={summary.openRegistrationsCount} />
    </div>
  );
}
