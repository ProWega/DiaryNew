import { useEffect, useState } from "react";
import MetricBadge from "../MetricBadge";
import Field from "../ui/Field";
import Tabs from "../ui/Tabs";
import { AlertCard, SoftPill, StatusPill } from "../ui/Pills";
import {
  getEventStatusLabel,
  getEventStatusTone,
  getSeverityTone,
  normalizeList,
} from "../../lib/organizerWorkspace";

export function createProgramDraft() {
  return {
    title: "",
    description: "",
    eventContext: {
      title: "",
      eventType: "Форумное событие",
      venue: "",
      startDate: "",
      endDate: "",
      participantCount: "",
      description: "",
    },
  };
}

export function createParallelEventDraft(day, speakerOptions = [], eventTypes = []) {
  const referenceEvent = day?.events?.[0];

  return {
    title: "",
    start: referenceEvent?.start || "16:00",
    end: referenceEvent?.end || "17:00",
    type: referenceEvent?.type || eventTypes[0] || "Лекция",
    speakerId: referenceEvent?.speakerId || speakerOptions[0]?.id || "",
    location: "",
    track: "Параллельный поток",
    parallelGroup: "P2",
    status: "planned",
    tags: "",
    description: "",
  };
}

export function createProgramDayDraft(program) {
  const nextNumber = (program?.days?.length || 0) + 1;
  return {
    label: `День ${nextNumber}`,
    dateLabel: "",
    dateValue: "",
  };
}

export function ProgramSelector({
  programs,
  currentProgram,
  currentDay,
  activeEventId,
  saving = false,
  onSelectProgram,
  onSelectDay,
  onActivateEvent,
}) {
  if (!programs.length) {
    return (
      <article className="panel-card">
        <div className="feedback-card">
          <h2>Программ пока нет</h2>
          <p>Создайте первую программу под конкретное событие, чтобы добавить мероприятия.</p>
        </div>
      </article>
    );
  }

  return (
    <article className="panel-card">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Каталог программ</p>
          <h3>Каждая программа относится к отдельному событию</h3>
        </div>
      </div>

      <Tabs
        items={programs.map((program) => ({ id: program.id, label: program.title }))}
        activeId={currentProgram?.id}
        disabled={saving}
        onChange={onSelectProgram}
      />

      {currentProgram ? (
        <>
          <div className="program-context-card">
            <strong>{currentProgram.eventContext?.title || currentProgram.title}</strong>
            <p>
              {currentProgram.eventContext?.eventType || "Событие"} ·{" "}
              {currentProgram.eventContext?.venue || "Локация не указана"}
            </p>
            <p>
              {currentProgram.eventContext?.startDate || "Дата не указана"} -{" "}
              {currentProgram.eventContext?.endDate || "Дата не указана"}
            </p>
          </div>

          <Tabs
            items={currentProgram.days.map((day) => ({
              id: day.id,
              label: `${day.label} · ${day.dateLabel}`,
            }))}
            activeId={currentDay?.id}
            onChange={onSelectDay}
          />
        </>
      ) : null}

      {currentDay ? (
        <EventTimeline
          events={currentDay.events}
          activeEventId={activeEventId}
          onActivate={(eventId) => onActivateEvent(currentProgram.id, currentDay.id, eventId)}
        />
      ) : null}
    </article>
  );
}

export function EventTimeline({ events, activeEventId, onActivate }) {
  if (!events.length) {
    return (
      <div className="feedback-card">
        <h2>В этот день нет мероприятий</h2>
        <p>Добавьте мероприятие или параллельный слот в программу дня.</p>
      </div>
    );
  }

  return (
    <div className="timeline-list">
      {events.map((event) => (
        <button
          key={event.id}
          type="button"
          className={activeEventId === event.id ? "timeline-item is-active" : "timeline-item"}
          onClick={() => onActivate(event.id)}
        >
          <strong>{event.title}</strong>
          <span>
            {event.type} · {event.start} - {event.end}
          </span>
          <span>
            {event.speakerName || "Без спикера"} · поток {event.parallelGroup}
          </span>
        </button>
      ))}
    </div>
  );
}

export function ProgramMetaEditor({ program, saving = false, onSave }) {
  const [form, setForm] = useState(() => ({
    title: program.title || "",
    description: program.description || "",
    eventContext: {
      title: program.eventContext?.title || "",
      eventType: program.eventContext?.eventType || "Форумное событие",
      venue: program.eventContext?.venue || "",
      startDate: program.eventContext?.startDate || "",
      endDate: program.eventContext?.endDate || "",
      participantCount: program.eventContext?.participantCount || "",
      description: program.eventContext?.description || "",
    },
  }));

  useEffect(() => {
    setForm({
      title: program.title || "",
      description: program.description || "",
      eventContext: {
        title: program.eventContext?.title || "",
        eventType: program.eventContext?.eventType || "Форумное событие",
        venue: program.eventContext?.venue || "",
        startDate: program.eventContext?.startDate || "",
        endDate: program.eventContext?.endDate || "",
        participantCount: program.eventContext?.participantCount || "",
        description: program.eventContext?.description || "",
      },
    });
  }, [program]);

  function updateEventContext(key, value) {
    setForm((previous) => ({
      ...previous,
      eventContext: { ...previous.eventContext, [key]: value },
    }));
  }

  return (
    <article className="panel-card">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Событие программы</p>
          <h3>{program.eventContext?.title || program.title || "Новая программа"}</h3>
          <p className="subtle">
            {program.eventContext?.eventType || "Форумное событие"} ·{" "}
            {program.eventContext?.venue || "Локация не указана"}
          </p>
        </div>
        <SoftPill>{program.days?.length || 0} дней</SoftPill>
      </div>

      <div className="field-grid">
        <Field label="Название программы" wide>
          <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
        </Field>
        <Field label="Событие" wide>
          <input value={form.eventContext.title} onChange={(event) => updateEventContext("title", event.target.value)} />
        </Field>
        <Field label="Тип события">
          <input value={form.eventContext.eventType} onChange={(event) => updateEventContext("eventType", event.target.value)} />
        </Field>
        <Field label="Площадка">
          <input value={form.eventContext.venue} onChange={(event) => updateEventContext("venue", event.target.value)} />
        </Field>
        <Field label="Дата начала">
          <input value={form.eventContext.startDate} placeholder="2026-04-24" onChange={(event) => updateEventContext("startDate", event.target.value)} />
        </Field>
        <Field label="Дата окончания">
          <input value={form.eventContext.endDate} placeholder="2026-04-26" onChange={(event) => updateEventContext("endDate", event.target.value)} />
        </Field>
        <Field label="Участников">
          <input value={form.eventContext.participantCount} onChange={(event) => updateEventContext("participantCount", event.target.value)} />
        </Field>
        <Field label="Описание программы" wide>
          <textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        </Field>
        <Field label="Описание события" wide>
          <textarea rows={3} value={form.eventContext.description} onChange={(event) => updateEventContext("description", event.target.value)} />
        </Field>
      </div>

      <button type="button" className="primary-button" disabled={saving} onClick={() => void onSave(form)}>
        Сохранить программу
      </button>
    </article>
  );
}

export function ProgramCreateCard({ saving = false, onCreate }) {
  const [form, setForm] = useState(createProgramDraft());

  function updateEventContext(key, value) {
    setForm((previous) => ({
      ...previous,
      eventContext: { ...previous.eventContext, [key]: value },
    }));
  }

  async function handleCreate() {
    const nextWorkspace = await onCreate(form);
    if (nextWorkspace) {
      setForm(createProgramDraft());
    }
  }

  return (
    <article className="panel-card">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Новая программа</p>
          <h3>Создать программу под отдельное событие</h3>
        </div>
      </div>

      <div className="field-grid">
        <Field label="Название программы" wide>
          <input
            value={form.title}
            placeholder="Например, Основная программа форума"
            onChange={(event) => setForm({ ...form, title: event.target.value })}
          />
        </Field>
        <Field label="Событие" wide>
          <input
            value={form.eventContext.title}
            placeholder="Например, Форум Истоки 2026"
            onChange={(event) => updateEventContext("title", event.target.value)}
          />
        </Field>
        <Field label="Тип события">
          <input value={form.eventContext.eventType} onChange={(event) => updateEventContext("eventType", event.target.value)} />
        </Field>
        <Field label="Площадка">
          <input value={form.eventContext.venue} onChange={(event) => updateEventContext("venue", event.target.value)} />
        </Field>
      </div>

      <button type="button" className="primary-button" disabled={saving} onClick={() => void handleCreate()}>
        Создать программу
      </button>
    </article>
  );
}

export function ProgramDayComposer({ program, currentDay, saving = false, onCreate, onUpdate }) {
  const [createForm, setCreateForm] = useState(() => createProgramDayDraft(program));
  const [editForm, setEditForm] = useState(() => ({
    label: currentDay?.label || "",
    dateLabel: currentDay?.dateLabel || "",
    dateValue: currentDay?.dateValue || "",
  }));

  useEffect(() => {
    setCreateForm(createProgramDayDraft(program));
  }, [program]);

  useEffect(() => {
    setEditForm({
      label: currentDay?.label || "",
      dateLabel: currentDay?.dateLabel || "",
      dateValue: currentDay?.dateValue || "",
    });
  }, [currentDay]);

  async function handleCreate() {
    await onCreate(createForm);
    setCreateForm(createProgramDayDraft(program));
  }

  return (
    <article className="panel-card">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Дни программы</p>
          <h3>Создание и редактирование дней</h3>
        </div>
        <SoftPill>{program?.days?.length || 0} дней</SoftPill>
      </div>

      {currentDay ? (
        <>
          <p className="subtle">Редактировать выбранный день</p>
          <div className="field-grid">
            <Field label="Название дня">
              <input value={editForm.label} disabled={saving} onChange={(event) => setEditForm({ ...editForm, label: event.target.value })} />
            </Field>
            <Field label="Подпись даты">
              <input value={editForm.dateLabel} disabled={saving} onChange={(event) => setEditForm({ ...editForm, dateLabel: event.target.value })} />
            </Field>
            <Field label="Дата">
              <input type="date" value={editForm.dateValue || ""} disabled={saving} onChange={(event) => setEditForm({ ...editForm, dateValue: event.target.value })} />
            </Field>
          </div>
          <button type="button" className="ghost-button" disabled={saving} onClick={() => void onUpdate(currentDay.id, editForm)}>
            Сохранить день
          </button>
        </>
      ) : null}

      <div className="field-grid">
        <Field label="Новый день">
          <input value={createForm.label} disabled={saving} onChange={(event) => setCreateForm({ ...createForm, label: event.target.value })} />
        </Field>
        <Field label="Подпись даты">
          <input value={createForm.dateLabel} disabled={saving} onChange={(event) => setCreateForm({ ...createForm, dateLabel: event.target.value })} />
        </Field>
        <Field label="Дата">
          <input type="date" value={createForm.dateValue} disabled={saving} onChange={(event) => setCreateForm({ ...createForm, dateValue: event.target.value })} />
        </Field>
      </div>
      <button type="button" className="primary-button" disabled={saving} onClick={() => void handleCreate()}>
        Добавить день
      </button>
    </article>
  );
}

export function EventEditorCard({
  event,
  eventTypes = [],
  speakersCatalog = [],
  isActive = false,
  saving = false,
  onSave,
  onActivate,
}) {
  const [form, setForm] = useState(() => ({
    title: event.title || "",
    start: event.start || "",
    end: event.end || "",
    type: event.type || "",
    speakerId: event.speakerId || "",
    location: event.location || "",
    track: event.track || "",
    parallelGroup: event.parallelGroup || "",
    status: event.status || "planned",
    tags: normalizeList(event.tags).join(", "),
    description: event.description || "",
  }));

  useEffect(() => {
    setForm({
      title: event.title || "",
      start: event.start || "",
      end: event.end || "",
      type: event.type || "",
      speakerId: event.speakerId || "",
      location: event.location || "",
      track: event.track || "",
      parallelGroup: event.parallelGroup || "",
      status: event.status || "planned",
      tags: normalizeList(event.tags).join(", "),
      description: event.description || "",
    });
  }, [event]);

  function updateField(key, value) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  function handleSave() {
    const speakerName = speakersCatalog.find((speaker) => speaker.id === form.speakerId)?.name || "";
    return onSave({ ...form, speakerName, tags: normalizeList(form.tags) });
  }

  return (
    <article className="panel-card organizer-event-editor">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Мероприятие</p>
          <h3>{event.title}</h3>
          <p className="subtle">
            {event.start} - {event.end} · {event.type} · поток {event.parallelGroup}
          </p>
        </div>

        <div className="pill-grid">
          <StatusPill tone={getEventStatusTone(event.status)}>{getEventStatusLabel(event.status)}</StatusPill>
          {isActive ? <SoftPill>Текущее</SoftPill> : null}
        </div>
      </div>

      <div className="field-grid">
        <Field label="Название" wide>
          <input value={form.title} onChange={(eventTarget) => updateField("title", eventTarget.target.value)} />
        </Field>
        <Field label="Тип мероприятия">
          <select value={form.type} onChange={(eventTarget) => updateField("type", eventTarget.target.value)}>
            {eventTypes.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Спикер">
          <select value={form.speakerId} onChange={(eventTarget) => updateField("speakerId", eventTarget.target.value)}>
            <option value="">Без спикера</option>
            {speakersCatalog.map((speaker) => (
              <option key={speaker.id} value={speaker.id}>
                {speaker.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Начало">
          <input value={form.start} onChange={(eventTarget) => updateField("start", eventTarget.target.value)} />
        </Field>
        <Field label="Окончание">
          <input value={form.end} onChange={(eventTarget) => updateField("end", eventTarget.target.value)} />
        </Field>
        <Field label="Локация">
          <input value={form.location} onChange={(eventTarget) => updateField("location", eventTarget.target.value)} />
        </Field>
        <Field label="Трек">
          <input value={form.track} onChange={(eventTarget) => updateField("track", eventTarget.target.value)} />
        </Field>
        <Field label="Параллель">
          <input value={form.parallelGroup} onChange={(eventTarget) => updateField("parallelGroup", eventTarget.target.value)} />
        </Field>
        <Field label="Теги" wide>
          <input value={form.tags} onChange={(eventTarget) => updateField("tags", eventTarget.target.value)} />
        </Field>
        <Field label="Описание" wide>
          <textarea rows={3} value={form.description} onChange={(eventTarget) => updateField("description", eventTarget.target.value)} />
        </Field>
      </div>

      <div className="card-actions">
        <button type="button" className="primary-button" disabled={saving} onClick={() => void handleSave()}>
          Сохранить мероприятие
        </button>
        <button
          type="button"
          className={isActive ? "ghost-button is-active" : "ghost-button"}
          disabled={saving}
          onClick={() => void onActivate()}
        >
          Сделать текущим
        </button>
      </div>
    </article>
  );
}

export function ParallelEventComposer({ day, speakersCatalog = [], eventTypes = [], saving = false, onSubmit }) {
  const [form, setForm] = useState(() => createParallelEventDraft(day, speakersCatalog, eventTypes));

  useEffect(() => {
    setForm(createParallelEventDraft(day, speakersCatalog, eventTypes));
  }, [day, speakersCatalog, eventTypes]);

  function updateField(key, value) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  async function handleSubmit() {
    const speakerName = speakersCatalog.find((speaker) => speaker.id === form.speakerId)?.name || "";
    await onSubmit({ ...form, speakerName, tags: normalizeList(form.tags) });
    setForm(createParallelEventDraft(day, speakersCatalog, eventTypes));
  }

  return (
    <article className="panel-card">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Новое мероприятие</p>
          <h3>Добавить слот в программу</h3>
        </div>
        <SoftPill>{day.label}</SoftPill>
      </div>

      <div className="field-grid">
        <Field label="Название" wide>
          <input
            value={form.title}
            placeholder="Новая лекция или мастер-класс"
            onChange={(eventTarget) => updateField("title", eventTarget.target.value)}
          />
        </Field>
        <Field label="Тип мероприятия">
          <select value={form.type} onChange={(eventTarget) => updateField("type", eventTarget.target.value)}>
            {eventTypes.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Спикер">
          <select value={form.speakerId} onChange={(eventTarget) => updateField("speakerId", eventTarget.target.value)}>
            <option value="">Без спикера</option>
            {speakersCatalog.map((speaker) => (
              <option key={speaker.id} value={speaker.id}>
                {speaker.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Начало">
          <input value={form.start} onChange={(eventTarget) => updateField("start", eventTarget.target.value)} />
        </Field>
        <Field label="Окончание">
          <input value={form.end} onChange={(eventTarget) => updateField("end", eventTarget.target.value)} />
        </Field>
        <Field label="Локация">
          <input value={form.location} onChange={(eventTarget) => updateField("location", eventTarget.target.value)} />
        </Field>
        <Field label="Трек">
          <input value={form.track} onChange={(eventTarget) => updateField("track", eventTarget.target.value)} />
        </Field>
        <Field label="Параллель">
          <input value={form.parallelGroup} onChange={(eventTarget) => updateField("parallelGroup", eventTarget.target.value)} />
        </Field>
        <Field label="Теги" wide>
          <input value={form.tags} onChange={(eventTarget) => updateField("tags", eventTarget.target.value)} />
        </Field>
        <Field label="Описание" wide>
          <textarea rows={3} value={form.description} onChange={(eventTarget) => updateField("description", eventTarget.target.value)} />
        </Field>
      </div>

      <button type="button" className="primary-button" disabled={saving} onClick={() => void handleSubmit()}>
        Добавить мероприятие
      </button>
    </article>
  );
}

export function GroupsSummary({ groups, alerts, audiencePool }) {
  const groupsWithProfiles = groups.map((group) => {
    const groupParticipants = audiencePool.filter((participant) => participant.groupId === group.id);
    return {
      ...group,
      topProfiles: Array.from(new Set(groupParticipants.map((participant) => participant.emotionalProfile))).slice(0, 2),
    };
  });

  return (
    <div className="organizer-section-stack">
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
          {alerts.map((alert) => (
            <AlertCard key={alert.id} title={alert.title} detail={alert.detail} tone={getSeverityTone(alert.severity)} />
          ))}
        </div>
      </article>
    </div>
  );
}

export function ParticipantSearchPanel({
  groups,
  participants,
  selectedGroupId,
  query,
  selectedParticipantId,
  onGroupChange,
  onQueryChange,
  onSelectParticipant,
}) {
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
          <select value={selectedGroupId} onChange={(eventTarget) => onGroupChange(eventTarget.target.value)}>
            <option value="all">Все группы</option>
            {groups.map((group) => (
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
            onChange={(eventTarget) => onQueryChange(eventTarget.target.value)}
          />
        </Field>
      </div>

      <div className="participant-list">
        {participants.map((participant) => (
          <button
            key={participant.id}
            type="button"
            className={selectedParticipantId === participant.id ? "participant-row is-active" : "participant-row"}
            onClick={() => onSelectParticipant(participant.id)}
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

export function ParticipantDetailsCard({ participant }) {
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
            <MetricBadge label="Эмоциональный профиль" value={participant.emotionalProfile || "Не рассчитан"} />
            <MetricBadge label="Статус идентичности" value={participant.identityStatus || "Не пройден"} />
          </div>

          <div className="participant-detail-grid">
            <div className="theme-chip-card">
              <strong>Контекст участия</strong>
              <p>Участник относится к конкретной группе и связан с мероприятиями выбранной программы.</p>
            </div>
            <div className="theme-chip-card">
              <strong>Что смотреть дальше</strong>
              <p>Следующий шаг — связать карточку с реальными дневниковыми записями и посещёнными мероприятиями.</p>
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
