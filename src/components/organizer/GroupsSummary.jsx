import { useEffect, useMemo, useState } from "react";
import MetricBadge from "../MetricBadge";
import {
  EventImpactBarChart,
  MultiLineTrendChart,
  RiskScatterChart,
  StackedDistributionChart,
} from "../Charts";
import Field from "../ui/Field";
import { AlertCard, SoftPill } from "../ui/Pills";
import { getSeverityTone } from "../../lib/organizerWorkspace";
import {
  buildGroupDistributionRows,
  buildGroupDraftMap,
  buildGroupTrendSeries,
  buildOrganizerEventDeltaRows,
  buildOrganizerScatterData,
  buildRoster,
  getOrganizerDataStateCard,
  safeArray,
} from "./_helpers";

export function GroupsSummary({
  groups = [],
  alerts = [],
  audiencePool = [],
  curatorCandidates = [],
  dataState = "ready",
  eventPulse = [],
  groupPulse = [],
  participantScatter = [],
  operationalBrief = [],
  saving = false,
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
  onAssignCurator,
  onAssignParticipants,
}) {
  const safeGroups = safeArray(groups);
  const safeAlerts = safeArray(alerts);
  const safeAudiencePool = safeArray(audiencePool);
  const safeCuratorCandidates = safeArray(curatorCandidates);
  const safeEventPulse = safeArray(eventPulse);
  const safeGroupPulse = safeArray(groupPulse);
  const safeOperationalBrief = safeArray(operationalBrief);
  const [createDraft, setCreateDraft] = useState({ name: "", description: "" });
  const [groupDrafts, setGroupDrafts] = useState(() => buildGroupDraftMap(safeGroups));
  const [rosterGroupId, setRosterGroupId] = useState("all");
  const [rosterQuery, setRosterQuery] = useState("");
  const [selectedParticipantIds, setSelectedParticipantIds] = useState([]);
  const [targetGroupId, setTargetGroupId] = useState(safeGroups[0]?.id || "");
  const dataStateCard = getOrganizerDataStateCard(dataState);

  useEffect(() => {
    setGroupDrafts((previous) => {
      const next = buildGroupDraftMap(safeGroups);
      Object.entries(previous || {}).forEach(([groupId, draft]) => {
        if (next[groupId]) {
          next[groupId] = { ...next[groupId], ...draft };
        }
      });
      return next;
    });
  }, [safeGroups]);

  useEffect(() => {
    if (!safeGroups.some((group) => group.id === targetGroupId)) {
      setTargetGroupId(safeGroups[0]?.id || "");
    }
  }, [safeGroups, targetGroupId]);

  const groupsWithProfiles = useMemo(
    () =>
      safeGroups.map((group) => {
        const groupParticipants = safeAudiencePool.filter(
          (participant) => participant.groupId === group.id,
        );
        return {
          ...group,
          topProfiles: Array.from(
            new Set(
              groupParticipants.map((participant) => participant.emotionalProfile).filter(Boolean),
            ),
          ).slice(0, 3),
          participantsList: groupParticipants.slice(0, 4),
        };
      }),
    [safeAudiencePool, safeGroups],
  );
  const trendSeries = useMemo(
    () => buildGroupTrendSeries(safeGroupPulse, safeEventPulse),
    [safeEventPulse, safeGroupPulse],
  );
  const distributionRows = useMemo(
    () => buildGroupDistributionRows(safeGroupPulse).filter((row) => row.total > 0),
    [safeGroupPulse],
  );
  const eventDeltaRows = useMemo(
    () => buildOrganizerEventDeltaRows(safeEventPulse),
    [safeEventPulse],
  );
  const scatterData = useMemo(
    () => buildOrganizerScatterData(participantScatter, safeGroups),
    [participantScatter, safeGroups],
  );
  const roster = useMemo(
    () => buildRoster(safeAudiencePool, rosterGroupId, rosterQuery),
    [rosterGroupId, rosterQuery, safeAudiencePool],
  );
  const attentionCards = safeOperationalBrief.length
    ? safeOperationalBrief
    : safeAlerts.map((alert) => ({
        id: alert.id,
        title: alert.title,
        evidence: alert.detail,
        severity: alert.severity,
      }));

  function updateGroupDraft(groupId, patch) {
    setGroupDrafts((previous) => ({
      ...previous,
      [groupId]: {
        ...(previous[groupId] || {}),
        ...patch,
      },
    }));
  }

  function toggleParticipantSelection(participantId) {
    setSelectedParticipantIds((previous) =>
      previous.includes(participantId)
        ? previous.filter((value) => value !== participantId)
        : [...previous, participantId],
    );
  }

  async function handleCreateGroup() {
    if (!createDraft.name.trim()) {
      return;
    }

    const nextWorkspace = await onCreateGroup?.(createDraft);
    if (nextWorkspace) {
      setCreateDraft({ name: "", description: "" });
    }
  }

  async function handleSaveGroup(groupId) {
    const draft = groupDrafts[groupId];
    if (!draft?.name?.trim()) {
      return;
    }

    await onUpdateGroup?.(groupId, {
      name: draft.name,
      description: draft.description,
    });
  }

  async function handleSaveCurator(groupId) {
    const draft = groupDrafts[groupId];
    await onAssignCurator?.(groupId, draft?.curatorId || "");
  }

  async function handleDelete(group) {
    const confirmed =
      typeof window === "undefined" ||
      window.confirm(
        `Удалить группу "${group.name}"? Это действие доступно только для пустой группы без куратора.`,
      );
    if (!confirmed) {
      return;
    }

    await onDeleteGroup?.(group.id);
  }

  async function handleMoveParticipants() {
    if (!targetGroupId || !selectedParticipantIds.length) {
      return;
    }

    const targetGroup = safeGroups.find((group) => group.id === targetGroupId);
    const confirmed =
      typeof window === "undefined" ||
      window.confirm(
        `Перенести ${selectedParticipantIds.length} участников в ${targetGroup?.name || "выбранную группу"}?\n\nИсторическая групповая аналитика пересчитается по новой группе.`,
      );
    if (!confirmed) {
      return;
    }

    const nextWorkspace = await onAssignParticipants?.(targetGroupId, selectedParticipantIds);
    if (nextWorkspace) {
      setSelectedParticipantIds([]);
    }
  }

  return (
    <div className="organizer-section-stack">
      {dataStateCard ? (
        <article className="panel-card organizer-state-card">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Состояние данных</p>
              <h3>{dataStateCard.title}</h3>
            </div>
          </div>
          <p className="subtle">{dataStateCard.description}</p>
        </article>
      ) : null}

      <article className="panel-card">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Операционный cockpit</p>
            <h3>Группы, риски и ритм заезда на реальных данных</h3>
          </div>
          <SoftPill>{safeGroups.length} групп</SoftPill>
        </div>

        <div className="organizer-analytics-grid">
          <MultiLineTrendChart
            title="Пульс групп по событиям"
            description="Каждая линия показывает, как меняется среднее состояние группы по ходу программы."
            series={trendSeries}
            labels={safeEventPulse.map((event, index) => `${index + 1}`)}
            emptyLabel="Недостаточно ответов для сравнения траекторий групп."
          />
          <EventImpactBarChart
            title="Резкие переходы программы"
            description="Сдвиг среднего состояния относительно предыдущего события с ответами."
            data={eventDeltaRows}
            emptyLabel="Пока нет переходов, которые можно посчитать по событиям."
          />
          <StackedDistributionChart
            title="Распределение состояний по группам"
            description="Чем шире сегмент, тем больше реальных ответов этой зоны внутри группы."
            rows={distributionRows}
            emptyLabel="Нет ответов для распределения по группам."
          />
          <RiskScatterChart
            title="Участники: среднее состояние, амплитуда и заполнение"
            description="Размер точки = заполнение, цвет = текущая группа."
            data={scatterData}
            emptyLabel="Пока нет участнических траекторий для scatter-графика."
          />
        </div>
      </article>

      <article className="panel-card">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Сигналы внимания</p>
            <h3>Что стоит обсудить с кураторами и оргкомандой первым делом</h3>
          </div>
        </div>

        <div className="alert-list">
          {attentionCards.length ? (
            attentionCards.map((item) => (
              <AlertCard
                key={item.id}
                title={item.title}
                detail={item.evidence || item.detail}
                tone={getSeverityTone(item.severity)}
              />
            ))
          ) : (
            <p className="subtle">Пока нет подтвержденных сигналов внимания.</p>
          )}
        </div>
      </article>

      <article className="panel-card">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Распределение по группам</p>
            <h3>Ручное и batch-распределение участников</h3>
          </div>
          <SoftPill outline>{selectedParticipantIds.length} выбрано</SoftPill>
        </div>

        <div className="field-grid">
          <Field label="Фильтр по текущей группе">
            <select
              value={rosterGroupId}
              onChange={(eventTarget) => setRosterGroupId(eventTarget.target.value)}
            >
              <option value="all">Все группы</option>
              {safeGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Поиск по участникам" wide>
            <input
              value={rosterQuery}
              placeholder="Например: Анна, группа 2"
              onChange={(eventTarget) => setRosterQuery(eventTarget.target.value)}
            />
          </Field>
          <Field label="Перенести в группу">
            <select
              value={targetGroupId}
              onChange={(eventTarget) => setTargetGroupId(eventTarget.target.value)}
            >
              <option value="">Выберите группу</option>
              {safeGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <p className="subtle organizer-policy-note">
          Перенос участника работает ретроактивно: историческая групповая аналитика пересчитывается
          по новой группе.
        </p>

        <div className="organizer-roster-list">
          {roster.map((participant) => {
            const checked = selectedParticipantIds.includes(participant.id);
            return (
              <label
                key={participant.id}
                className={checked ? "organizer-roster-row is-selected" : "organizer-roster-row"}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleParticipantSelection(participant.id)}
                />
                <div>
                  <strong>{participant.fullName}</strong>
                  <span>
                    {participant.groupLabel || "Без группы"} ·{" "}
                    {participant.progress?.completion ?? 0}% заполнения
                  </span>
                </div>
              </label>
            );
          })}
        </div>

        <div className="card-actions">
          <button
            type="button"
            className="primary-button"
            disabled={saving || !targetGroupId || !selectedParticipantIds.length}
            onClick={() => void handleMoveParticipants()}
          >
            Перенести выбранных
          </button>
        </div>
      </article>

      <article className="panel-card">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Новая группа</p>
            <h3>Создать рабочую группу для заезда</h3>
          </div>
        </div>

        <div className="field-grid">
          <Field label="Название группы">
            <input
              value={createDraft.name}
              placeholder="Например: Северный круг"
              onChange={(eventTarget) =>
                setCreateDraft((previous) => ({ ...previous, name: eventTarget.target.value }))
              }
            />
          </Field>
          <Field label="Фокус группы" wide>
            <textarea
              rows={3}
              value={createDraft.description}
              placeholder="Коротко: чем отличается группа и на что смотреть в динамике."
              onChange={(eventTarget) =>
                setCreateDraft((previous) => ({
                  ...previous,
                  description: eventTarget.target.value,
                }))
              }
            />
          </Field>
        </div>

        <div className="card-actions">
          <button
            type="button"
            className="primary-button"
            disabled={saving || !createDraft.name.trim()}
            onClick={() => void handleCreateGroup()}
          >
            Создать группу
          </button>
        </div>
      </article>
      <article className="panel-card">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Группы</p>
            <h3>Сводка по кураторам и состоянию группы</h3>
          </div>
        </div>

        <div className="group-compare-grid">
          {groupsWithProfiles.map((group) => (
            <div key={group.id} className="compare-card">
              <div className="compare-head">
                <div>
                  <strong>{group.name}</strong>
                  <p>{group.curator}</p>
                </div>
                <SoftPill>{group.completion}% заполнения</SoftPill>
              </div>

              <div className="compare-metrics">
                <MetricBadge label="Участников" value={group.participants} compact />
                <MetricBadge label="Средняя активация" value={group.avgActivation} compact />
                <MetricBadge label="Рисков" value={group.riskCases} compact />
              </div>

              <p className="lead-text">{group.focus}</p>

              <div className="tag-row">
                {group.topProfiles.map((profile) => (
                  <span key={profile} className="tag-chip">
                    {profile}
                  </span>
                ))}
              </div>

              <div className="field-grid">
                <Field label="Название группы">
                  <input
                    value={groupDrafts[group.id]?.name || group.name || ""}
                    onChange={(eventTarget) =>
                      updateGroupDraft(group.id, { name: eventTarget.target.value })
                    }
                  />
                </Field>
                <Field label="Куратор">
                  <select
                    value={groupDrafts[group.id]?.curatorId || ""}
                    onChange={(eventTarget) =>
                      updateGroupDraft(group.id, { curatorId: eventTarget.target.value })
                    }
                  >
                    <option value="">Не назначен</option>
                    {safeCuratorCandidates.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.fullName}
                        {candidate.assignedGroupId && candidate.assignedGroupId !== group.id
                          ? ` — сейчас ${candidate.assignedGroupName}`
                          : ""}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Описание / фокус" wide>
                  <textarea
                    rows={3}
                    value={groupDrafts[group.id]?.description || group.description || ""}
                    onChange={(eventTarget) =>
                      updateGroupDraft(group.id, { description: eventTarget.target.value })
                    }
                  />
                </Field>
              </div>

              {group.participantsList?.length ? (
                <div className="organizer-inline-roster">
                  {group.participantsList.map((participant) => (
                    <span key={participant.id} className="tag-chip">
                      {participant.fullName}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="card-actions">
                <button
                  type="button"
                  className="primary-button"
                  disabled={saving || !String(groupDrafts[group.id]?.name || "").trim()}
                  onClick={() => void handleSaveGroup(group.id)}
                >
                  Сохранить группу
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  disabled={saving}
                  onClick={() => void handleSaveCurator(group.id)}
                >
                  Назначить куратора
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  disabled={saving || group.participants > 0 || Boolean(group.curatorId)}
                  onClick={() => void handleDelete(group)}
                >
                  Удалить
                </button>
              </div>
            </div>
          ))}
        </div>
      </article>

      <article className="panel-card">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Сигналы внимания</p>
            <h3>Куда смотреть в первую очередь</h3>
          </div>
        </div>

        <div className="alert-list">
          {safeAlerts.map((alert) => (
            <AlertCard
              key={alert.id}
              title={alert.title}
              detail={alert.detail}
              tone={getSeverityTone(alert.severity)}
            />
          ))}
        </div>
      </article>
    </div>
  );
}
