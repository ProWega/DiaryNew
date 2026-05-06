import { useState } from "react";
import Modal from "../ui/Modal";
import JourneyStagePicker from "./JourneyStagePicker";
import CarefulModeToggle from "./CarefulModeToggle";

/**
 * Onboarding-модал, показываемый при первом входе участника в диарий.
 * Содержит JourneyStagePicker (4 этапа) + CarefulModeToggle (бережно).
 *
 * Методически:
 * - выбор этапа можно пропустить («решу позже» — onSkip)
 * - оба поля независимы: можно выбрать этап без бережно или наоборот
 * - когда оба поля заполнены / только одно — onSubmit получает то что есть
 *
 * Props:
 *  - open: boolean
 *  - onSubmit: (patch: { journeyStage: JourneyStage|null, isCarefulMode: boolean }) => void
 *  - onSkip: () => void  — закрыть без сохранения
 *  - initialStage?: JourneyStage | null
 *  - initialCarefulMode?: boolean
 *  - saving?: boolean — disable buttons while API call in flight
 */
function JourneyStageOnboardingModal({
  open,
  onSubmit,
  onSkip,
  initialStage = null,
  initialCarefulMode = false,
  saving = false,
}) {
  const [stage, setStage] = useState(initialStage);
  const [careful, setCareful] = useState(initialCarefulMode);

  function handleSave() {
    onSubmit?.({ journeyStage: stage, isCarefulMode: careful });
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

        <div className="stage-onboarding-careful">
          <CarefulModeToggle value={careful} onChange={setCareful} />
        </div>

        <div className="stage-onboarding-actions">
          <button type="button" className="ghost-button" onClick={onSkip} disabled={saving}>
            Решу позже
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={handleSave}
            disabled={saving || (stage === null && !careful)}
          >
            {saving ? "Сохраняем..." : "Сохранить"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default JourneyStageOnboardingModal;
