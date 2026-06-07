import { useState } from "react";
import Modal from "../ui/Modal";
import JourneyStagePicker from "./JourneyStagePicker";

/**
 * Onboarding-модал, показываемый при первом входе участника в диарий.
 * Содержит JourneyStagePicker (4 этапа).
 *
 * Props:
 *  - open: boolean
 *  - onSubmit: (patch: { journeyStage: JourneyStage|null }) => void
 *  - onSkip: () => void  — закрыть без сохранения
 *  - initialStage?: JourneyStage | null
 *  - saving?: boolean — disable buttons while API call in flight
 */
function JourneyStageOnboardingModal({
  open,
  onSubmit,
  onSkip,
  initialStage = null,
  saving = false,
}) {
  const [stage, setStage] = useState(initialStage);

  function handleSave() {
    onSubmit?.({ journeyStage: stage });
  }

  return (
    <Modal open={open} onClose={onSkip} title="Дневник пути" width="640px">
      <div className="stage-onboarding">
        <p className="subtle">
          Перед тем как начать вести дневник, отметьте, где вы сейчас на пути. Это не оценка —
          просто помогает настроить тон вопросов. Можно сменить в любой день.
        </p>

        <JourneyStagePicker
          value={stage}
          onSelect={setStage}
          variant="grid"
          title="Где вы сейчас на пути?"
          subtitle="Выбор не обязательный — можно пропустить и решить позже."
        />

        <div className="stage-onboarding-actions">
          <button type="button" className="ghost-button" onClick={onSkip} disabled={saving}>
            Решу позже
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={handleSave}
            disabled={saving || stage === null}
          >
            {saving ? "Сохраняем..." : "Сохранить"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default JourneyStageOnboardingModal;
