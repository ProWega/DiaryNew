import { useEffect, useState } from "react";
import MetricBadge from "../MetricBadge";
import Field from "../ui/Field";
import { SoftPill } from "../ui/Pills";
import { safeArray } from "./_helpers";

export function ParticipantSearchPanel({
  groups = [],
  participants = [],
  selectedGroupId = "all",
  query = "",
  selectedParticipantId,
  onGroupChange,
  onQueryChange,
  onSelectParticipant,
}) {
  const safeGroups = safeArray(groups);
  const safeParticipants = safeArray(participants);

  return (
    <article className="panel-card">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Фильтры</p>
          <h3>Поиск по участникам</h3>
        </div>
      </div>

      <div className="field-grid">
        <Field label="Группа">
          <select
            value={selectedGroupId}
            onChange={(eventTarget) => onGroupChange?.(eventTarget.target.value)}
          >
            <option value="all">Все группы</option>
            {safeGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Поиск по имени или профилю" wide>
          <input
            value={query}
            placeholder="Например: Анна, moratorium, ресурсный"
            onChange={(eventTarget) => onQueryChange?.(eventTarget.target.value)}
          />
        </Field>
      </div>

      <div className="participant-list">
        {safeParticipants.map((participant) => (
          <button
            key={participant.id}
            type="button"
            className={
              selectedParticipantId === participant.id
                ? "participant-row is-active"
                : "participant-row"
            }
            onClick={() => onSelectParticipant?.(participant.id)}
          >
            <strong>{participant.fullName}</strong>
            <span>
              {participant.groupLabel} · {participant.emotionalProfile}
            </span>
          </button>
        ))}
      </div>
    </article>
  );
}

export function ParticipantDetailsCard({
  participant,
  groups = [],
  saving = false,
  onAssignGroup,
}) {
  const safeGroups = safeArray(groups);
  const [draftGroupId, setDraftGroupId] = useState(participant?.groupId || "");

  useEffect(() => {
    setDraftGroupId(participant?.groupId || "");
  }, [participant?.groupId, participant?.id]);

  async function handleAssignGroup() {
    if (!participant?.id || !draftGroupId || draftGroupId === participant.groupId) {
      return;
    }

    const targetGroup = safeGroups.find((group) => group.id === draftGroupId);
    const confirmed =
      typeof window === "undefined" ||
      window.confirm(
        `Перенести ${participant.fullName} в ${targetGroup?.name || "новую группу"}?\n\nИсторическая групповая аналитика пересчитается по новой группе.`,
      );
    if (!confirmed) {
      return;
    }

    await onAssignGroup?.(draftGroupId, [participant.id]);
  }

  return (
    <article className="panel-card">
      {participant ? (
        <>
          <div className="panel-head">
            <div>
              <p className="eyebrow">Карточка участника</p>
              <h3>{participant.fullName}</h3>
              <p className="subtle">{participant.groupLabel}</p>
            </div>
            <SoftPill>
              {participant.age || "возраст не указан"} · {participant.gender || "пол не указан"}
            </SoftPill>
          </div>

          <div className="hero-stats">
            <MetricBadge
              label="Эмоциональный профиль"
              value={participant.emotionalProfile || "Не рассчитан"}
            />
            <MetricBadge
              label="Статус идентичности"
              value={participant.identityStatus || "Не пройден"}
            />
            <MetricBadge label="Заполнено" value={`${participant.progress?.completion ?? 0}%`} />
            <MetricBadge label="Средняя активация" value={participant.avgActivation || "0.0"} />
          </div>

          <div className="participant-detail-grid">
            <div className="theme-chip-card">
              <strong>Контекст участия</strong>
              <p>
                Участник относится к конкретной группе и связан с мероприятиями выбранной программы.
              </p>
            </div>
            <div className="theme-chip-card">
              <strong>Что смотреть дальше</strong>
              <p>
                Следующий шаг — связать карточку с реальными дневниковыми записями и посещёнными
                мероприятиями.
              </p>
            </div>
          </div>
        </>
      ) : (
        <div className="feedback-card">
          <h2>Участники не найдены</h2>
          <p>Смените фильтр группы или очистите поисковый запрос.</p>
        </div>
      )}
    </article>
  );
}
