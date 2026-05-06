import { useState } from "react";
import JourneyStageOnboardingModal from "./JourneyStageOnboardingModal";

export default {
  title: "Methodology/JourneyStageOnboardingModal",
  component: JourneyStageOnboardingModal,
  parameters: { layout: "fullscreen" },
};

function Demo({ initialStage = null, initialCarefulMode = false, saving = false }) {
  const [open, setOpen] = useState(true);
  const [submitted, setSubmitted] = useState(null);
  const [skipped, setSkipped] = useState(false);

  function handleSubmit(patch) {
    setSubmitted(patch);
    setOpen(false);
  }

  function handleSkip() {
    setSkipped(true);
    setOpen(false);
  }

  return (
    <div style={{ minHeight: "100vh", padding: "var(--space-6)" }}>
      {!open ? (
        <div style={{ display: "grid", gap: "var(--space-3)", maxWidth: 560 }}>
          <h2>Модал закрыт</h2>
          {submitted ? (
            <pre
              style={{
                padding: "var(--space-3)",
                background: "var(--color-surface-muted)",
                borderRadius: "var(--radius-1)",
              }}
            >
              {JSON.stringify(submitted, null, 2)}
            </pre>
          ) : skipped ? (
            <p>Пропущено («Решу позже»).</p>
          ) : null}
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              setOpen(true);
              setSubmitted(null);
              setSkipped(false);
            }}
          >
            Открыть снова
          </button>
        </div>
      ) : null}

      <JourneyStageOnboardingModal
        open={open}
        onSubmit={handleSubmit}
        onSkip={handleSkip}
        initialStage={initialStage}
        initialCarefulMode={initialCarefulMode}
        saving={saving}
      />
    </div>
  );
}

/** Default — пустой выбор. Кнопка «Сохранить» disabled пока ничего не выбрано. */
export const Default = {
  render: () => <Demo />,
};

/** Preselected — модал открыт со выбранным этапом (например, после возврата). */
export const PreselectedSearch = {
  render: () => <Demo initialStage="search" />,
};

/** WithCareful — кнопка активна благодаря careful, даже если этап не выбран. */
export const WithCareful = {
  render: () => <Demo initialCarefulMode={true} />,
};

/** Saving — состояние «в процессе сохранения», кнопки disabled. */
export const Saving = {
  render: () => <Demo initialStage="verification" saving={true} />,
};
