function isActiveAssignment(assignment) {
  return assignment?.status !== "disabled";
}

function getAssignments(user) {
  if (Array.isArray(user?.assignments) && user.assignments.length) {
    return user.assignments.filter(isActiveAssignment);
  }

  if (!user?.sessionId) {
    return [];
  }

  return [
    {
      sessionId: user.sessionId,
      groupId: user.groupId,
      role: user.role,
      status: "active",
    },
  ];
}

function hasAssignment(user, role, subject = {}) {
  const sessionId = subject?.sessionId ? String(subject.sessionId) : null;
  const groupId = subject?.groupId ? String(subject.groupId) : null;

  return getAssignments(user).some((assignment) => {
    if (role && assignment.role !== role) {
      return false;
    }

    if (sessionId && String(assignment.sessionId) !== sessionId) {
      return false;
    }

    if (groupId && assignment.groupId && String(assignment.groupId) !== groupId) {
      return false;
    }

    return true;
  });
}

function hasRole(user, role) {
  return user?.role === role || user?.baseRole === role || hasAssignment(user, role);
}

function sameSession(user, subject) {
  if (!subject?.sessionId) {
    return true;
  }

  return String(user?.sessionId || "") === String(subject.sessionId) || hasAssignment(user, null, subject);
}

function sameGroup(user, subject) {
  if (!subject?.groupId) {
    return true;
  }

  return String(user?.groupId || "") === String(subject.groupId) || hasAssignment(user, null, subject);
}

export function can(user, permission, subject = {}) {
  if (!user) {
    return false;
  }

  if (user.role === "admin" || user.baseRole === "admin") {
    return true;
  }

  switch (permission) {
    case "participant.diary.read":
    case "participant.diary.write":
    case "participant.self.read":
    case "participant.dynamics.read":
      return (
        hasRole(user, "participant") &&
        hasAssignment(user, "participant", subject) &&
        (!subject.userId || subject.userId === user.id)
      );

    case "group.analytics.read":
      if (hasRole(user, "organizer")) {
        return true;
      }

      return hasRole(user, "curator") && hasAssignment(user, "curator", subject) && sameGroup(user, subject);

    case "group.notes.write":
    case "group.export":
      return (
        hasRole(user, "curator") &&
        sameSession(user, subject) &&
        sameGroup(user, subject)
      );

    case "session.analytics.read":
    case "program.manage":
    case "users.manage":
    case "ai.manage":
    case "typologies.manage":
      return hasRole(user, "organizer");

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

  const participantAssignment = getAssignments(user).find((assignment) => assignment.role === "participant");
  const curatorAssignment = getAssignments(user).find((assignment) => assignment.role === "curator");
  const organizerAssignment = getAssignments(user).find((assignment) => assignment.role === "organizer");

  switch (user.role) {
    case "participant":
      return `/participant/session/${participantAssignment?.sessionId || user.sessionId}/today`;
    case "curator":
      return `/curator/session/${curatorAssignment?.sessionId || user.sessionId}/group/${curatorAssignment?.groupId || user.groupId}`;
    case "organizer":
      return `/organizer/session/${organizerAssignment?.sessionId || user.sessionId}`;
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
      label: "Состояние",
      to: `/participant/session/${user.sessionId}/today`,
    });
  }

  if (can(user, "participant.self.read", { sessionId: user.sessionId })) {
    items.push({
      id: "participant-self",
      label: "Узнать себя",
      to: `/participant/session/${user.sessionId}/self`,
    });
  }

  if (can(user, "participant.dynamics.read", { sessionId: user.sessionId })) {
    items.push({
      id: "participant-dynamics",
      label: "Динамика",
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
