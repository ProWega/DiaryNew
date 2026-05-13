import { useMemo } from "react";

const DEFAULT_FILTER = {
  includeMembers: true,
  memberIds: [],
  includeDays: true,
  dayIds: [],
  includeConcepts: true,
  eventIds: [],
};

/**
 * Три секции выбора (участники / дни / события) для context-filter'а.
 * Используется и в ChatContextDrawer (куратор), и в CuratorContextBuilder (организатор).
 *
 * Контракт filter: см. server/services/chatContextFilter.cjs
 *   { includeMembers, memberIds[], includeDays, dayIds[], includeConcepts, eventIds[] }
 * Пустой memberIds[] = «все участники группы», аналогично для days и events.
 */
function ChatContextSelectors({ members = [], days = [], events = [], filter, onChange }) {
  const f = useMemo(() => ({ ...DEFAULT_FILTER, ...(filter || {}) }), [filter]);

  const update = (patch) => onChange({ ...f, ...patch });

  const toggleSection = (section, value) => {
    if (section === "members") update({ includeMembers: value });
    else if (section === "days") update({ includeDays: value });
    else update({ includeConcepts: value });
  };

  const toggleId = (key, id) => {
    const arr = new Set(f[key] || []);
    if (arr.has(id)) arr.delete(id);
    else arr.add(id);
    update({ [key]: Array.from(arr) });
  };

  const clearIds = (key) => update({ [key]: [] });

  const eventsWithConcept = events.filter((e) => e.hasConcept);

  return (
    <div className="chat-context-selectors">
      <Section
        title="Состав группы"
        included={f.includeMembers}
        onToggle={(v) => toggleSection("members", v)}
        items={members}
        selected={f.memberIds}
        onToggleId={(id) => toggleId("memberIds", id)}
        onClear={() => clearIds("memberIds")}
        renderLabel={(m) => m.fullName}
        emptyHint="В группе нет активных участников."
      />
      <Section
        title="Комментарии и рефлексии участников"
        included={f.includeDays}
        onToggle={(v) => toggleSection("days", v)}
        items={days}
        selected={f.dayIds}
        onToggleId={(id) => toggleId("dayIds", id)}
        onClear={() => clearIds("dayIds")}
        renderLabel={(d) =>
          d.dateLabel ? `${d.label} · ${d.dateLabel}` : d.label || `День ${d.dayNumber || ""}`
        }
        emptyHint="Дней в сессии пока нет."
      />
      <Section
        title="Концепции мероприятий"
        included={f.includeConcepts}
        onToggle={(v) => toggleSection("concepts", v)}
        items={eventsWithConcept}
        selected={f.eventIds}
        onToggleId={(id) => toggleId("eventIds", id)}
        onClear={() => clearIds("eventIds")}
        renderLabel={(e) => (e.dayLabel ? `${e.title} (${e.dayLabel})` : e.title)}
        emptyHint="Концепции пока не загружены."
      />
    </div>
  );
}

function Section({
  title,
  included,
  onToggle,
  items,
  selected,
  onToggleId,
  onClear,
  renderLabel,
  emptyHint,
}) {
  const selectedSet = new Set(selected || []);
  const allMode = selectedSet.size === 0;

  return (
    <details className="chat-context-section" open={included}>
      <summary className="chat-context-section-summary">
        <label className="chat-context-section-toggle">
          <input type="checkbox" checked={included} onChange={(e) => onToggle(e.target.checked)} />
          <span>{title}</span>
        </label>
        {included ? (
          <span className="subtle chat-context-section-count">
            {allMode ? "все" : `${selectedSet.size} из ${items.length}`}
          </span>
        ) : (
          <span className="subtle chat-context-section-count">отключено</span>
        )}
      </summary>
      {included ? (
        <div className="chat-context-section-body">
          {items.length === 0 ? (
            <p className="subtle">{emptyHint}</p>
          ) : (
            <>
              <ul className="chat-context-checklist">
                {items.map((item) => (
                  <li key={item.id}>
                    <label className="chat-context-checklist-item">
                      <input
                        type="checkbox"
                        checked={allMode || selectedSet.has(item.id)}
                        onChange={() => {
                          if (allMode) {
                            // переход из «все» → выбираем все кроме этого
                            onToggleId(item.id);
                          } else {
                            onToggleId(item.id);
                          }
                        }}
                      />
                      <span>{renderLabel(item)}</span>
                    </label>
                  </li>
                ))}
              </ul>
              {!allMode ? (
                <button type="button" className="ghost-button chat-context-clear" onClick={onClear}>
                  Сбросить выбор (включить все)
                </button>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </details>
  );
}

export default ChatContextSelectors;
