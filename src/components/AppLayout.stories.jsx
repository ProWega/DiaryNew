import { MemoryRouter } from "react-router-dom";
import { ParticipantTopbar } from "./AppLayout";

const currentUser = {
  fullName: "Алина Морозова",
};

const bootstrap = {
  sessionInfo: {
    name: "Форум подростковых проектов",
    cycle: "День 1",
    dateLabel: "13–15 июля",
    location: "Сочи",
  },
};

const navigation = [
  {
    id: "participant-today",
    label: "Состояние",
    to: "/participant/session/session-1/today",
  },
  {
    id: "participant-self",
    label: "Узнать себя",
    to: "/participant/session/session-1/self",
  },
  {
    id: "participant-dynamics",
    label: "Динамика",
    to: "/participant/session/session-1/dynamics",
  },
];

export default {
  title: "Participant/Shell",
  component: ParticipantTopbar,
  parameters: {
    layout: "fullscreen",
  },
};

function renderShell(args, initialPath = "/participant/session/session-1/today") {
  return (
    <MemoryRouter initialEntries={[initialPath]}>
      <div className="app-shell">
        <ParticipantTopbar {...args} />
      </div>
    </MemoryRouter>
  );
}

export const ParticipantHeaderDesktop = {
  args: {
    currentUser,
    bootstrap,
    navigation,
    onLogout: () => {},
  },
  render: (args) => renderShell(args),
};

export const ParticipantHeaderMobile = {
  args: ParticipantHeaderDesktop.args,
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
  render: (args) => renderShell(args, "/participant/session/session-1/self"),
};
