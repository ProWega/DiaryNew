const SESSION_ID = "session-istoki-april-2026";

const demoUsers = [
  {
    id: "user-participant-1",
    fullName: "Боря Соколов",
    role: "participant",
    sessionId: SESSION_ID,
    groupId: "group-1",
  },
  {
    id: "user-curator-1",
    fullName: "Марина Чернова",
    role: "curator",
    sessionId: SESSION_ID,
    groupId: "group-1",
  },
  {
    id: "user-organizer-1",
    fullName: "Алексей Волков",
    role: "organizer",
    sessionId: SESSION_ID,
  },
  {
    id: "user-admin-1",
    fullName: "Системный администратор",
    role: "admin",
  },
];

function getViewerById(viewerId) {
  return demoUsers.find((user) => user.id === viewerId) ?? null;
}

function canAccessOrganizerSession(viewer, sessionId) {
  if (!viewer) {
    return false;
  }

  if (viewer.role === "admin") {
    return true;
  }

  return viewer.role === "organizer" && viewer.sessionId === sessionId;
}

module.exports = {
  demoUsers,
  getViewerById,
  canAccessOrganizerSession,
};
