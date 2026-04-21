const { query } = require("../postgres.cjs");
const { roleLabels } = require("./common.cjs");
const { listSessions } = require("./sessionStore.cjs");

async function getUsers() {
  const result = await query(`
    select *
    from users
    order by
      case role
        when 'admin' then 1
        when 'organizer' then 2
        when 'curator' then 3
        else 4
      end,
      full_name
  `);

  return result.rows.map((row) => ({
    id: row.id,
    fullName: row.full_name,
    role: row.role,
    roleLabel: roleLabels[row.role] || row.role,
    email: row.email || "",
    phone: row.phone || "",
    age: row.age ?? "",
    gender: row.gender || "",
    status: row.status || "active",
    meta: row.meta || {},
  }));
}

async function getGroups() {
  const result = await query(`
    select g.*, s.name as session_name, u.full_name as curator_name
    from groups g
    left join sessions s on s.id = g.session_id
    left join users u on u.id = g.curator_id
    order by s.start_date desc nulls last, g.name
  `);

  return result.rows.map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    sessionName: row.session_name || "",
    name: row.name,
    curatorId: row.curator_id || "",
    curatorName: row.curator_name || "",
    description: row.description || "",
  }));
}

async function getAssignments() {
  const result = await query(`
    select
      su.*,
      u.full_name,
      s.name as session_name,
      g.name as group_name
    from session_users su
    join users u on u.id = su.user_id
    join sessions s on s.id = su.session_id
    left join groups g on g.id = su.group_id
    order by s.start_date desc nulls last, u.full_name
  `);

  return result.rows.map((row) => ({
    id: `${row.session_id}:${row.user_id}`,
    sessionId: row.session_id,
    sessionName: row.session_name,
    userId: row.user_id,
    userName: row.full_name,
    groupId: row.group_id || "",
    groupName: row.group_name || "",
    role: row.role,
    roleLabel: roleLabels[row.role] || row.role,
    status: row.status || "active",
  }));
}

async function getAuditLog() {
  const result = await query(`
    select a.*, u.full_name as actor_name, s.name as session_name
    from audit_log a
    left join users u on u.id = a.actor_id
    left join sessions s on s.id = a.session_id
    order by a.created_at desc
    limit 30
  `);

  return result.rows.map((row) => ({
    id: row.id,
    time: row.created_at,
    actor: row.actor_name || "Система",
    sessionName: row.session_name || "",
    action: row.action,
    entityType: row.entity_type || "",
    entityId: row.entity_id || "",
    payload: row.payload || {},
  }));
}

async function getAdminWorkspace() {
  const [users, sessions, groups, assignments, auditLog] = await Promise.all([
    getUsers(),
    listSessions(),
    getGroups(),
    getAssignments(),
    getAuditLog(),
  ]);

  return {
    title: "Кабинет системного администратора",
    meta: {
      storageMode: "postgres",
      updatedAt: new Date().toISOString(),
    },
    summary: {
      usersCount: users.length,
      activeUsersCount: users.filter((user) => user.status === "active").length,
      organizersCount: users.filter((user) => user.role === "organizer").length,
      sessionsCount: sessions.length,
      openRegistrationsCount: sessions.filter((session) => session.registrationStatus === "open").length,
    },
    roleOptions: [
      { id: "participant", label: "Участник" },
      { id: "curator", label: "Куратор" },
      { id: "organizer", label: "Организатор" },
      { id: "admin", label: "Администратор" },
    ],
    registrationStatuses: [
      { id: "draft", label: "Черновик" },
      { id: "open", label: "Открыта" },
      { id: "closed", label: "Закрыта" },
      { id: "archived", label: "Архив" },
    ],
    users,
    sessions,
    groups,
    assignments,
    auditLog,
  };
}

module.exports = {
  getAdminWorkspace,
};
