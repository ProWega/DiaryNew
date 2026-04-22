import ParticipantSelfKnowledgeView from "./ParticipantSelfKnowledgeView";

const currentUser = {
  fullName: "Алина Морозова",
};

const sessionInfo = {
  name: "Форум подростковых проектов",
  dateLabel: "13–15 июля",
  location: "Сочи",
};

export default {
  title: "Participant/SelfKnowledge",
  component: ParticipantSelfKnowledgeView,
  args: {
    currentUser,
    sessionInfo,
  },
};

export const Desktop1280 = {};

export const Mobile390 = {
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
};
