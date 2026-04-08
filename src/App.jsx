import { useMemo, useState } from "react";
import ParticipantView from "./views/ParticipantView";
import CuratorView from "./views/CuratorView";
import OrganizerView from "./views/OrganizerView";
import AdminView from "./views/AdminView";
import { participantHistory, roleOptions, sessionInfo } from "./data/mockData";
import {
  buildPortrait,
  calculateMetrics,
  formatAverage,
} from "./lib/metrics";

function App() {
  const currentDay = participantHistory[1];
  const [selectedRole, setSelectedRole] = useState("participant");
  const [participantTab, setParticipantTab] = useState("today");
  const [selectedHistoryDay, setSelectedHistoryDay] = useState(currentDay.id);
  const [todayEvents, setTodayEvents] = useState(currentDay.events);
  const [reflection, setReflection] = useState(currentDay.reflection);

  const liveHistory = useMemo(
    () =>
      participantHistory.map((day) =>
        day.id === currentDay.id
          ? {
              ...day,
              events: todayEvents,
              reflection,
            }
          : day,
      ),
    [currentDay.id, reflection, todayEvents],
  );

  const selectedDay =
    liveHistory.find((day) => day.id === selectedHistoryDay) || liveHistory[0];
  const todayMetrics = useMemo(() => calculateMetrics(todayEvents), [todayEvents]);
  const todayPortrait = useMemo(
    () => buildPortrait(todayEvents, todayMetrics),
    [todayEvents, todayMetrics],
  );
  const overallTrajectory = useMemo(
    () =>
      liveHistory.flatMap((day) =>
        day.events.map((event) => ({
          label: `${day.label}: ${event.title}`,
          stateId: event.stateId,
        })),
      ),
    [liveHistory],
  );
  const overallAverages = useMemo(
    () =>
      liveHistory.map((day) => ({
        day: day.label,
        value: calculateMetrics(day.events).average,
      })),
    [liveHistory],
  );

  function updateEventState(eventId, stateId) {
    setTodayEvents((previous) =>
      previous.map((event) =>
        event.id === eventId
          ? {
              ...event,
              stateId,
            }
          : event,
      ),
    );
  }

  function updateEventComment(eventId, comment) {
    setTodayEvents((previous) =>
      previous.map((event) =>
        event.id === eventId
          ? {
              ...event,
              comment,
            }
          : event,
      ),
    );
  }

  function updateEventConfidence(eventId) {
    setTodayEvents((previous) =>
      previous.map((event) =>
        event.id === eventId
          ? {
              ...event,
              confidence: event.confidence === "low" ? "high" : "low",
            }
          : event,
      ),
    );
  }

  return (
    <div className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark">И</div>
          <div>
            <p className="eyebrow">{sessionInfo.sandboxBadge}</p>
            <h1>{sessionInfo.name}</h1>
            <p className="subtle">
              {sessionInfo.cycle} · {sessionInfo.dateLabel} · {sessionInfo.location}
            </p>
          </div>
        </div>

        <div className="header-side">
          <div className="pill-grid">
            <span className="soft-pill">{sessionInfo.scaleNote}</span>
            <span className="soft-pill is-outline">{sessionInfo.aiPolicy}</span>
          </div>

          <div className="role-switch">
            {roleOptions.map((role) => (
              <button
                key={role.id}
                type="button"
                className={selectedRole === role.id ? "role-pill is-active" : "role-pill"}
                onClick={() => setSelectedRole(role.id)}
              >
                {role.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="page-grid">
        {selectedRole === "participant" ? (
          <ParticipantView
            participantTab={participantTab}
            setParticipantTab={setParticipantTab}
            todayEvents={todayEvents}
            todayMetrics={todayMetrics}
            todayPortrait={todayPortrait}
            reflection={reflection}
            setReflection={setReflection}
            updateEventState={updateEventState}
            updateEventComment={updateEventComment}
            updateEventConfidence={updateEventConfidence}
            liveHistory={liveHistory}
            selectedDay={selectedDay}
            setSelectedHistoryDay={setSelectedHistoryDay}
            overallTrajectory={overallTrajectory}
            overallAverages={overallAverages}
            formatAverage={formatAverage}
          />
        ) : null}
        {selectedRole === "curator" ? <CuratorView /> : null}
        {selectedRole === "organizer" ? <OrganizerView /> : null}
        {selectedRole === "admin" ? <AdminView /> : null}
      </main>
    </div>
  );
}

export default App;
