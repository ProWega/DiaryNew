import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import {
  AdminSummary,
  AdminUserDirectory,
  AuditTimeline,
  GroupAssignmentPanel,
  RoleAssignmentMatrix,
  SessionCatalog,
  SessionEditorForm,
  UserEditorForm,
} from "../components/admin/AdminComponents";
import { RegistrationAccessPanel } from "../components/access/AccessComponents";
import { AlertCard, SoftPill } from "../components/ui/Pills";
import { getDefaultRoute } from "../rbac/permissions";

const ADMIN_SECTIONS = [
  { id: "users", label: "Пользователи", description: "Профили, роли и статусы" },
  { id: "sessions", label: "Заезды", description: "Карточки и регистрация" },
  { id: "assignments", label: "Назначения", description: "Доступы по заездам" },
  { id: "audit", label: "Аудит", description: "Последние действия" },
];

const EMPTY_USER = {
  fullName: "",
  role: "organizer",
  email: "",
  phone: "",
  age: "",
  gender: "",
  status: "active",
};

const EMPTY_SESSION = {
  name: "",
  cycle: "",
  dateLabel: "",
  location: "",
  startDate: "",
  endDate: "",
  description: "",
  registrationStatus: "draft",
  registrationCapacity: "",
  registrationPolicy: { mode: "public", note: "" },
};

function AccountSwitchPanel({ users = [], currentUserId, saving = false, onSwitch }) {
  return (
    <div className="panel-card">
      <div className="admin-sidebar-head">
        <p className="eyebrow">Тестовый режим</p>
        <strong>Переключение аккаунта</strong>
      </div>
      <div className="field-grid">
        <label className="field-block is-wide">
          <span>Аккаунт</span>
          <select
            value={currentUserId || ""}
            disabled={saving}
            onChange={(event) => onSwitch(event.target.value)}
          >
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.roleLabel}: {user.fullName}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="subtle">Переход выполняется сразу в кабинет выбранной роли.</p>
    </div>
  );
}

function MagicLinkPanel({
  users = [],
  sessions = [],
  groups = [],
  selectedUserId,
  selectedSessionId,
  saving = false,
  onCreate,
}) {
  const [mode, setMode] = useState("login");
  const [targetUserId, setTargetUserId] = useState(selectedUserId || users[0]?.id || "");
  const [sessionId, setSessionId] = useState(selectedSessionId || sessions[0]?.id || "");
  const [role, setRole] = useState("participant");
  const [groupId, setGroupId] = useState("");
  const [fullName, setFullName] = useState("");
  const [link, setLink] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setTargetUserId((current) => current || selectedUserId || users[0]?.id || "");
  }, [selectedUserId, users]);

  useEffect(() => {
    setSessionId((current) => current || selectedSessionId || sessions[0]?.id || "");
  }, [selectedSessionId, sessions]);

  const sessionGroups = groups.filter((group) => group.sessionId === sessionId);

  async function handleCreateLink() {
    setSubmitting(true);
    setError(null);
    setLink(null);

    try {
      const payload =
        mode === "login"
          ? { purpose: "login", targetUserId }
          : { purpose: "invite", sessionId, role, groupId, fullName };
      const nextLink = await onCreate?.(payload);
      setLink(nextLink);
    } catch (nextError) {
      setError(nextError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <article className="panel-card">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Magic links</p>
          <h3>Ссылки входа и приглашения</h3>
          <p className="subtle">Ссылка одноразовая: после открытия создаётся безопасная сессия.</p>
        </div>
      </div>

      <div className="field-grid">
        <label className="field-block">
          <span>Тип ссылки</span>
          <select value={mode} disabled={saving || submitting} onChange={(event) => setMode(event.target.value)}>
            <option value="login">Вход пользователя</option>
            <option value="invite">Приглашение участника</option>
          </select>
        </label>

        {mode === "login" ? (
          <label className="field-block">
            <span>Пользователь</span>
            <select value={targetUserId} disabled={saving || submitting} onChange={(event) => setTargetUserId(event.target.value)}>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.roleLabel}: {user.fullName}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <>
            <label className="field-block">
              <span>Заезд</span>
              <select value={sessionId} disabled={saving || submitting} onChange={(event) => setSessionId(event.target.value)}>
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-block">
              <span>Роль</span>
              <select value={role} disabled={saving || submitting} onChange={(event) => setRole(event.target.value)}>
                <option value="participant">Участник</option>
                <option value="curator">Куратор</option>
                <option value="organizer">Организатор</option>
              </select>
            </label>
            <label className="field-block">
              <span>Группа</span>
              <select value={groupId} disabled={saving || submitting || role === "organizer"} onChange={(event) => setGroupId(event.target.value)}>
                <option value="">Автоматически</option>
                {sessionGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-block">
              <span>Имя для нового пользователя</span>
              <input value={fullName} disabled={saving || submitting} onChange={(event) => setFullName(event.target.value)} />
            </label>
          </>
        )}
      </div>

      {error ? (
        <div className="alert-card severity-high">
          <strong>Не удалось создать ссылку</strong>
          <p>{error.message || error}</p>
        </div>
      ) : null}

      {link?.url ? (
        <label className="field-block is-wide">
          <span>Готовая ссылка</span>
          <input readOnly value={link.url} onFocus={(event) => event.target.select()} />
        </label>
      ) : null}

      <button type="button" className="ghost-button" disabled={saving || submitting} onClick={handleCreateLink}>
        {submitting ? "Создаём..." : "Создать magic link"}
      </button>
    </article>
  );
}

function AdminCabinetView({
  workspace,
  initialTab = "users",
  saving = false,
  mutationError,
  onCreateUser,
  onUpdateUser,
  onUpdateUserStatus,
  onUpsertAssignment,
  onCreateSession,
  onUpdateSession,
  onUpdateRegistration,
  onCreateMagicLink = async () => null,
}) {
  const navigate = useNavigate();
  const { users: authUsers, currentUser, features, switchUser } = useAuth();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [userQuery, setUserQuery] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("all");
  const [userStatusFilter, setUserStatusFilter] = useState("all");
  const [selectedUserId, setSelectedUserId] = useState(workspace.users[0]?.id || null);
  const [userDraft, setUserDraft] = useState(workspace.users[0] || EMPTY_USER);
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  const [sessionQuery, setSessionQuery] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState(workspace.sessions[0]?.id || null);
  const [sessionDraft, setSessionDraft] = useState(workspace.sessions[0] || EMPTY_SESSION);
  const [registrationDraft, setRegistrationDraft] = useState(workspace.sessions[0] || EMPTY_SESSION);
  const [isCreatingSession, setIsCreatingSession] = useState(!workspace.sessions.length);

  const [assignmentDraft, setAssignmentDraft] = useState({
    userId: workspace.users.find((user) => user.role === "organizer")?.id || workspace.users[0]?.id || "",
    sessionId: workspace.sessions[0]?.id || "",
    role: "organizer",
    groupId: "",
    status: "active",
  });
  const [assignmentFilters, setAssignmentFilters] = useState({
    query: "",
    role: "staff",
    sessionId: "all",
    status: "active",
  });

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const selectedUser = useMemo(
    () => workspace.users.find((user) => user.id === selectedUserId) || null,
    [selectedUserId, workspace.users],
  );

  const selectedSession = useMemo(
    () => workspace.sessions.find((session) => session.id === selectedSessionId) || null,
    [selectedSessionId, workspace.sessions],
  );

  useEffect(() => {
    if (!isCreatingUser) {
      setUserDraft(selectedUser || workspace.users[0] || EMPTY_USER);
    }
  }, [isCreatingUser, selectedUser, workspace.users]);

  useEffect(() => {
    if (!isCreatingSession) {
      const nextSession = selectedSession || workspace.sessions[0] || EMPTY_SESSION;
      setSessionDraft(nextSession);
      setRegistrationDraft(nextSession);
    }
  }, [isCreatingSession, selectedSession, workspace.sessions]);

  useEffect(() => {
    if (!workspace.sessions.length) {
      setIsCreatingSession(true);
      setSelectedSessionId(null);
      setSessionDraft(EMPTY_SESSION);
      setRegistrationDraft(EMPTY_SESSION);
    }
  }, [workspace.sessions.length]);

  async function handleUserSubmit(form) {
    if (isCreatingUser) {
      await onCreateUser(form);
      setIsCreatingUser(false);
      setUserDraft(EMPTY_USER);
      return;
    }

    if (form.id) {
      await onUpdateUser(form.id, form);
    }
  }

  async function handleSessionSubmit(form) {
    if (isCreatingSession || !form.id) {
      const nextWorkspace = await onCreateSession(form);
      if (!nextWorkspace) {
        return;
      }
      setIsCreatingSession(false);
      setSessionDraft(EMPTY_SESSION);
      return;
    }

    if (form.id) {
      await onUpdateSession(form.id, form);
    }
  }

  function handleAccountSwitch(userId) {
    const nextUser = authUsers.find((user) => user.id === userId);

    if (!nextUser) {
      return;
    }

    switchUser(nextUser.id);
    navigate(getDefaultRoute(nextUser), { replace: true });
  }

  return (
    <section className="role-view">
      <div className="hero-card">
        <div>
          <p className="eyebrow">Системный администратор</p>
          <h2>Пользователи, организаторы, заезды и публичная регистрация</h2>
          <p className="subtle">
            Администратор управляет всеми ролями и назначениями, а также может открыть или закрыть регистрацию на любой заезд.
          </p>
        </div>
        <AdminSummary summary={workspace.summary} />
      </div>

      {mutationError ? (
        <AlertCard title="Не удалось сохранить изменения" detail={mutationError.message} tone="severity-high" />
      ) : null}

      <div className="admin-shell">
        <aside className="admin-sidebar" aria-label="Разделы администратора">
          <div className="admin-sidebar-head">
            <p className="eyebrow">Навигация</p>
            <strong>Администрирование</strong>
          </div>
          <nav className="admin-side-nav">
            {ADMIN_SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                className={activeTab === section.id ? "admin-side-link is-active" : "admin-side-link"}
                onClick={() => setActiveTab(section.id)}
              >
                <span>{section.label}</span>
                <small>{section.description}</small>
              </button>
            ))}
          </nav>
          {features.devAuth ? (
            <AccountSwitchPanel
              users={authUsers}
              currentUserId={currentUser?.id}
              saving={saving}
              onSwitch={handleAccountSwitch}
            />
          ) : null}
          <div className="admin-sidebar-meta">
            <SoftPill>Storage: {workspace.meta?.storageMode || "postgres"}</SoftPill>
            <SoftPill outline>Обновлено: {new Date(workspace.meta?.updatedAt || Date.now()).toLocaleString("ru-RU")}</SoftPill>
          </div>
        </aside>

        <div className="admin-content">
          {activeTab === "users" ? (
            <div className="organizer-focus-grid">
              <AdminUserDirectory
                users={workspace.users}
                selectedUserId={selectedUserId}
                query={userQuery}
                roleFilter={userRoleFilter}
                statusFilter={userStatusFilter}
                onQueryChange={setUserQuery}
                onRoleFilterChange={setUserRoleFilter}
                onStatusFilterChange={setUserStatusFilter}
                onSelectUser={(userId) => {
                  setIsCreatingUser(false);
                  setSelectedUserId(userId);
                }}
              />
              <div className="organizer-section-stack">
                <button
                  type="button"
                  className="primary-button"
                  disabled={saving}
                  onClick={() => {
                    setIsCreatingUser(true);
                    setUserDraft(EMPTY_USER);
                  }}
                >
                  Создать пользователя
                </button>
                <UserEditorForm
                  value={userDraft}
                  mode={isCreatingUser ? "create" : "edit"}
                  roleOptions={workspace.roleOptions}
                  saving={saving}
                  onChange={setUserDraft}
                  onSubmit={handleUserSubmit}
                  onCancel={() => setIsCreatingUser(false)}
                  onStatusChange={(status) => userDraft.id && onUpdateUserStatus(userDraft.id, status)}
                />
                <MagicLinkPanel
                  users={workspace.users}
                  sessions={workspace.sessions}
                  groups={workspace.groups}
                  selectedUserId={selectedUserId}
                  selectedSessionId={selectedSessionId}
                  saving={saving}
                  onCreate={onCreateMagicLink}
                />
              </div>
            </div>
          ) : null}

          {activeTab === "sessions" ? (
            <div className="organizer-focus-grid">
              <SessionCatalog
                sessions={workspace.sessions}
                selectedSessionId={selectedSessionId}
                query={sessionQuery}
                onQueryChange={setSessionQuery}
                onSelectSession={(sessionId) => {
                  setIsCreatingSession(false);
                  setSelectedSessionId(sessionId);
                }}
              />
              <div className="organizer-section-stack">
                <button
                  type="button"
                  className="primary-button"
                  disabled={saving || isCreatingSession}
                  onClick={() => {
                    setIsCreatingSession(true);
                    setSessionDraft(EMPTY_SESSION);
                    setRegistrationDraft(EMPTY_SESSION);
                  }}
                >
                  Создать заезд
                </button>
                <SessionEditorForm
                  value={sessionDraft}
                  mode={isCreatingSession || !sessionDraft?.id ? "create" : "edit"}
                  saving={saving}
                  onChange={setSessionDraft}
                  onSubmit={handleSessionSubmit}
                  onCancel={() => setIsCreatingSession(!workspace.sessions.length)}
                />
                {!isCreatingSession && sessionDraft?.id ? (
                  <RegistrationAccessPanel
                    value={registrationDraft}
                    saving={saving}
                    onChange={setRegistrationDraft}
                    onSubmit={(form) => onUpdateRegistration(sessionDraft.id, form)}
                  />
                ) : null}
              </div>
            </div>
          ) : null}

          {activeTab === "assignments" ? (
            <div className="organizer-section-stack">
              <RoleAssignmentMatrix
                users={workspace.users}
                sessions={workspace.sessions}
                groups={workspace.groups}
                assignments={workspace.assignments}
                roleOptions={workspace.roleOptions}
                value={assignmentDraft}
                filters={assignmentFilters}
                saving={saving}
                onChange={setAssignmentDraft}
                onFiltersChange={setAssignmentFilters}
                onSubmit={(form) => onUpsertAssignment(form.userId, form)}
              />
              <GroupAssignmentPanel groups={workspace.groups} />
            </div>
          ) : null}

          {activeTab === "audit" ? <AuditTimeline items={workspace.auditLog} /> : null}
        </div>
      </div>
    </section>
  );
}

export default AdminCabinetView;
