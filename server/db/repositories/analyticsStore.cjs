const { query } = require("../postgres.cjs");
const { getRawUser } = require("./userStore.cjs");

function average(values) {
  const finite = values.map(Number).filter(Number.isFinite);
  if (!finite.length) {
    return 0;
  }
  return finite.reduce((sum, value) => sum + value, 0) / finite.length;
}

function amplitude(values) {
  const finite = values.map(Number).filter(Number.isFinite);
  if (!finite.length) {
    return 0;
  }
  return Math.max(...finite) - Math.min(...finite);
}

function getMemberStatus(levels) {
  if (levels.some((level) => level >= 6) || amplitude(levels) >= 4) {
    return "risk";
  }

  if (levels.some((level) => level >= 5 || level <= 1) || amplitude(levels) >= 3) {
    return "watch";
  }

  return "ok";
}

async function ensureCuratorAccess(viewerId, sessionId, groupId) {
  const row = await getRawUser(viewerId, sessionId);
  if (!row) {
    const error = new Error("Пользователь не найден");
    error.status = 401;
    throw error;
  }

  if (row.effective_role === "admin" || row.effective_role === "organizer") {
    return row;
  }

  if (row.effective_role === "curator" && row.group_id === groupId) {
    return row;
  }

  const error = new Error("Недостаточно прав для просмотра группы");
  error.status = 403;
  throw error;
}

async function getCuratorDashboard({ viewerId, sessionId, groupId }) {
  await ensureCuratorAccess(viewerId, sessionId, groupId);

  const groupResult = await query(
    `
      select g.*, u.full_name as curator_name
      from groups g
      left join users u on u.id = g.curator_id
      where g.id = $1 and g.session_id = $2
      limit 1
    `,
    [groupId, sessionId],
  );
  const group = groupResult.rows[0];

  if (!group) {
    const error = new Error("Группа не найдена");
    error.status = 404;
    throw error;
  }

  const membersResult = await query(
    `
      select u.*, su.group_id, g.name as group_name, ta.typology
      from session_users su
      join users u on u.id = su.user_id
      join groups g on g.id = su.group_id
      left join typology_assignments ta on ta.user_id = u.id and ta.session_id = su.session_id
      where su.session_id = $1 and su.group_id = $2 and su.role = 'participant'
      order by u.full_name
    `,
    [sessionId, groupId],
  );

  const eventResult = await query(
    `
      select e.id, e.title
      from program_events e
      join program_days d on d.id = e.day_id
      where e.session_id = $1
      order by d.day_number, e.sort_order, e.start_time
    `,
    [sessionId],
  );

  const entriesResult = await query(
    `
      select de.user_id, de.event_id, de.state_level, de.comment
      from diary_entries de
      join session_users su on su.user_id = de.user_id and su.session_id = de.session_id
      where de.session_id = $1 and su.group_id = $2
    `,
    [sessionId, groupId],
  );
  const entriesByUser = new Map();
  const entriesByEvent = new Map();

  for (const row of entriesResult.rows) {
    if (!entriesByUser.has(row.user_id)) {
      entriesByUser.set(row.user_id, []);
    }
    entriesByUser.get(row.user_id).push(row);

    if (!entriesByEvent.has(row.event_id)) {
      entriesByEvent.set(row.event_id, []);
    }
    entriesByEvent.get(row.event_id).push(row);
  }

  const members = membersResult.rows.map((member) => {
    const entries = entriesByUser.get(member.id) || [];
    const levels = entries.map((entry) => Number(entry.state_level)).filter(Number.isFinite);
    const memberAverage = average(levels);

    return {
      id: member.id,
      name: member.full_name,
      status: getMemberStatus(levels),
      trajectory: eventResult.rows.map((event) => {
        const entry = entries.find((item) => item.event_id === event.id);
        return Number.isFinite(Number(entry?.state_level)) ? Number(entry.state_level) : 3;
      }),
      typology: member.typology || member.meta?.emotionalProfile || "не рассчитано",
      average: memberAverage,
      amplitude: amplitude(levels),
      note:
        getMemberStatus(levels) === "risk"
          ? "Есть признаки перегруза, стоит проверить состояние лично."
          : "Траектория без критических скачков.",
      themes: ["комментарии", "динамика", member.meta?.identityStatus || "identity"],
    };
  });

  const allLevels = entriesResult.rows.map((entry) => Number(entry.state_level)).filter(Number.isFinite);
  const completion = eventResult.rows.length && members.length
    ? Math.round((entriesResult.rows.length / (eventResult.rows.length * members.length)) * 100)
    : 0;

  const heatmap = {
    columns: members.map((member) => member.name.split(" ")[0]),
    rows: eventResult.rows.slice(0, 8).map((event) => ({
      label: event.title,
      values: members.map((member) => {
        const entries = entriesByUser.get(member.id) || [];
        const entry = entries.find((item) => item.event_id === event.id);
        return Number.isFinite(Number(entry?.state_level)) ? Number(entry.state_level) : 3;
      }),
    })),
  };

  const alertsResult = await query(
    `
      select *
      from risk_signals
      where session_id = $1 and (group_id = $2 or group_id is null)
      order by created_at desc
      limit 5
    `,
    [sessionId, groupId],
  );

  const clustersResult = await query(
    `
      select label, count(*)::int as count
      from comment_clusters
      where session_id = $1 and (group_id = $2 or group_id is null)
      group by label
      order by count desc, label
      limit 6
    `,
    [sessionId, groupId],
  );

  const reportResult = await query(
    `
      select *
      from ai_reports
      where session_id = $1 and (group_id = $2 or group_id is null)
      order by created_at desc
      limit 1
    `,
    [sessionId, groupId],
  );
  const report = reportResult.rows[0];

  return {
    sessionId,
    groupId,
    groupName: group.name,
    curator: group.curator_name || "Куратор не назначен",
    participantsCount: members.length,
    completion,
    averageActivation: average(allLevels),
    riskCases: members.filter((member) => member.status === "risk" || member.status === "watch").length,
    heatmap,
    alerts: alertsResult.rows.map((alert) => ({
      id: alert.id,
      severity: alert.severity,
      title: alert.title,
      detail: alert.detail,
    })),
    topThemes: clustersResult.rows.length
      ? clustersResult.rows
      : [{ label: "перегруз / нет пауз", count: entriesResult.rows.filter((entry) => entry.comment).length }],
    aiSummary: {
      confidence: report?.confidence || "medium",
      bullets: report?.content?.bullets || [
        "Группа сохраняет рабочую динамику.",
        "Риски возникают в плотных практикумах и переходах.",
      ],
      recommendation: report?.content?.recommendation || "Добавить короткую паузу после интенсивных блоков.",
    },
    members,
  };
}

async function getAdminDashboard() {
  const auditResult = await query(
    `
      select a.*, u.full_name as actor_name
      from audit_log a
      left join users u on u.id = a.actor_id
      order by a.created_at desc
      limit 10
    `,
  );

  return {
    accessMatrix: [
      { role: "Участник", rights: "Заполнение своего дневника и просмотр своей динамики" },
      { role: "Куратор", rights: "Аналитика только своей группы" },
      { role: "Организатор", rights: "Управление программой, группами, опросами и отчётами заезда" },
      { role: "Администратор", rights: "Пользователи, безопасность, аудит и интеграции" },
    ],
    securityCards: [
      { title: "RBAC", detail: "Доступ ограничивается ролью, заездом и группой." },
      { title: "PostgreSQL", detail: "Основные данные хранятся в нормализованных таблицах." },
      { title: "AI privacy", detail: "ИИ-контур должен получать обезличенные агрегаты." },
    ],
    auditLog: auditResult.rows.map((row) => ({
      time: new Date(row.created_at).toLocaleString("ru-RU"),
      actor: row.actor_name || "Система",
      action: row.action,
    })),
  };
}

module.exports = {
  getAdminDashboard,
  getCuratorDashboard,
};
