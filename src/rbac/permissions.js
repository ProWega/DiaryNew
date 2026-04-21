function sameSession(user, subject) {
  if (!subject?.sessionId || !user?.sessionId) {
    return true;
  }

  return user.sessionId === subject.sessionId;
}

function sameGroup(user, subject) {
  if (!subject?.groupId || !user?.groupId) {
    return true;
  }

  return user.groupId === subject.groupId;
}

export function can(user, permission, subject = {}) {
  if (!user) {
    return false;
  }

  if (user.role === "admin") {
    return true;
  }

  switch (permission) {
    case "participant.diary.read":
    case "participant.diary.write":
    case "participant.dynamics.read":
      return (
        user.role === "participant" &&
        sameSession(user, subject) &&
        (!subject.userId || subject.userId === user.id)
      );

    case "group.analytics.read":
      if (!sameSession(user, subject)) {
        return false;
      }

      if (user.role === "organizer") {
        return true;
      }

      return user.role === "curator" && sameGroup(user, subject);

    case "group.notes.write":
    case "group.export":
      return (
        user.role === "curator" &&
        sameSession(user, subject) &&
        sameGroup(user, subject)
      );

    case "session.analytics.read":
    case "program.manage":
    case "users.manage":
    case "ai.manage":
    case "typologies.manage":
      return user.role === "organizer" && sameSession(user, subject);

    case "security.read":
    case "security.manage":
      return user.role === "admin";

    default:
      return false;
  }
}

export function getDefaultRoute(user) {
  if (!user) {
    return "/";
  }

  switch (user.role) {
    case "participant":
      return `/participant/session/${user.sessionId}/today`;
    case "curator":
      return `/curator/session/${user.sessionId}/group/${user.groupId}`;
    case "organizer":
      return `/organizer/session/${user.sessionId}`;
    case "admin":
      return "/admin/security";
    default:
      return "/";
  }
}

export function getNavigationItems(user) {
  if (!user) {
    return [];
  }

  const items = [];

  if (can(user, "participant.diary.read", { sessionId: user.sessionId })) {
    items.push({
      id: "participant-today",
      label: "Сегодня",
      to: `/participant/session/${user.sessionId}/today`,
    });
  }

  if (can(user, "participant.dynamics.read", { sessionId: user.sessionId })) {
    items.push({
      id: "participant-dynamics",
      label: "Моя динамика",
      to: `/participant/session/${user.sessionId}/dynamics`,
    });
  }

  if (
    can(user, "group.analytics.read", {
      sessionId: user.sessionId,
      groupId: user.groupId,
    })
  ) {
    items.push({
      id: "curator-group",
      label: user.role === "organizer" ? "Группы" : "Моя группа",
      to: `/curator/session/${user.sessionId}/group/${user.groupId ?? "group-1"}`,
    });
  }

  if (can(user, "session.analytics.read", { sessionId: user.sessionId })) {
    items.push({
      id: "organizer-session",
      label: "Заезд",
      to: `/organizer/session/${user.sessionId}`,
    });
  }

  if (can(user, "security.read")) {
    items.push({
      id: "admin-security",
      label: "Администрирование",
      to: "/admin/security",
    });
  }

  return items;
}

export function getScopeBadges(user) {
  if (!user) {
    return [];
  }

  const badges = [`Роль: ${user.roleLabel}`];

  if (user.sessionLabel) {
    badges.push(`Заезд: ${user.sessionLabel}`);
  }

  if (user.groupLabel) {
    badges.push(`Группа: ${user.groupLabel}`);
  }

  return badges;
}
