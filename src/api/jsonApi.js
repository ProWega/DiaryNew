import { mockServer } from "./mockServer";

export const jsonApi = {
  listUsers() {
    return mockServer.listUsers();
  },

  getBootstrap(viewerId) {
    return mockServer.getBootstrap({ viewerId });
  },

  getParticipantDiary(viewerId, sessionId) {
    return mockServer.getParticipantDiary({ viewerId, sessionId });
  },

  updateParticipantEntry(viewerId, sessionId, dayId, entryId, patch) {
    return mockServer.updateParticipantEntry({
      viewerId,
      sessionId,
      dayId,
      entryId,
      patch,
    });
  },

  updateParticipantReflection(viewerId, sessionId, dayId, patch) {
    return mockServer.updateParticipantReflection({
      viewerId,
      sessionId,
      dayId,
      patch,
    });
  },

  getCuratorDashboard(viewerId, sessionId, groupId) {
    return mockServer.getCuratorDashboard({
      viewerId,
      sessionId,
      groupId,
    });
  },

  getOrganizerDashboard(viewerId, sessionId) {
    return mockServer.getOrganizerDashboard({
      viewerId,
      sessionId,
    });
  },

  getAdminDashboard(viewerId) {
    return mockServer.getAdminDashboard({ viewerId });
  },
};
