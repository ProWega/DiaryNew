import ReturnPointsView from "./ReturnPointsView";

const baseSession = {
  sessionId: "session-school-archive",
  sessionLabel: "Школа: октябрь 2025",
};

const sample = {
  points: [
    {
      ...baseSession,
      touchpointIndex: 1,
      weeksAfter: 1,
      scheduledFor: "2025-11-08T00:00:00.000Z",
      invitation: "Прошла неделя — что осталось рядом, а что отдалилось?",
      status: "responded",
      response: {
        id: "r-1",
        content: "Запомнилось, как мы вечером сидели у костра — это держит уже неделю.",
        isAnonymous: false,
        isHiddenFromCurator: false,
        updatedAt: "2025-11-09T20:14:00.000Z",
      },
    },
    {
      ...baseSession,
      touchpointIndex: 2,
      weeksAfter: 4,
      scheduledFor: "2025-11-29T00:00:00.000Z",
      invitation: "Месяц спустя — что подвинулось, что задержалось?",
      status: "available",
      response: null,
    },
    {
      ...baseSession,
      touchpointIndex: 4,
      weeksAfter: 26,
      scheduledFor: "2026-05-02T00:00:00.000Z",
      invitation: "Полгода — какая дорога продолжается?",
      status: "future",
      response: null,
    },
  ],
};

export default {
  title: "Participant/ReturnPointsView",
  component: ReturnPointsView,
  parameters: { layout: "padded" },
};

export const Default = {
  args: { data: sample, onSubmit: () => {}, submitting: false },
};

export const Empty = {
  args: { data: { points: [] }, onSubmit: () => {}, submitting: false },
};

export const SubmittingState = {
  args: { data: sample, onSubmit: () => {}, submitting: true },
};
