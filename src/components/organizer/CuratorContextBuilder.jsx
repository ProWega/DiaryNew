import { useEffect, useMemo, useRef, useState } from "react";
import {
  useOrganizerCuratorsForGroup,
  useOrganizerCuratorChatPresets,
  useOrganizerChatContextOptions,
  useOrganizerChatContextPreview,
} from "../../api/hooks";
import ChatContextSelectors from "../curator/ChatContextSelectors";
import ChatContextPreview from "../../views/CuratorBrief/chat/ChatContextPreview";
import ChatContextPresetList from "../../views/CuratorBrief/chat/ChatContextPresetList";

const DEFAULT_FILTER = {
  includeMembers: true,
  memberIds: [],
  includeDays: true,
  dayIds: [],
  includeConcepts: true,
  eventIds: [],
};

/**
 * Конструктор контекста для конкретного куратора (organizer-side).
 *
 * Поток: select группы → select куратора → presets (если есть) + ChatContextSelectors
 * + live preview. Сохранение делается от лица организатора (audit log).
 */
function CuratorContextBuilder({ sessionId, groups }) {
  const [groupId, setGroupId] = useState(groups[0]?.id || null);
  const [curatorId, setCuratorId] = useState(null);
  const [filter, setFilter] = useState(DEFAULT_FILTER);
  const [activePresetId, setActivePresetId] = useState(null);

  // Synchronize groupId when groups list updates.
  useEffect(() => {
    if (!groups.length) {
      setGroupId(null);
      return;
    }
    if (!groups.find((g) => g.id === groupId)) {
      setGroupId(groups[0].id);
    }
  }, [groups, groupId]);

  const { data: curatorsApi } = useOrganizerCuratorsForGroup(sessionId, groupId);
  const { data: contextOptions } = useOrganizerChatContextOptions(sessionId, groupId);

  // Источник кураторов: workspace-данные группы (быстрый, есть сразу) +
  // обогащение через API (presetsCount / hasDefaultPreset / lastMessageAt).
  const selectedGroup = groups.find((g) => g.id === groupId) || null;
  const curators = useMemo(() => {
    const map = new Map();
    if (selectedGroup?.curatorId) {
      map.set(selectedGroup.curatorId, {
        id: selectedGroup.curatorId,
        fullName: selectedGroup.curator || selectedGroup.curatorId,
        presetsCount: 0,
        hasDefaultPreset: false,
        lastMessageAt: null,
      });
    }
    for (const c of curatorsApi || []) {
      const existing = map.get(c.id) || { id: c.id };
      map.set(c.id, { ...existing, ...c });
    }
    return Array.from(map.values()).sort((a, b) =>
      (a.fullName || "").localeCompare(b.fullName || ""),
    );
  }, [selectedGroup, curatorsApi]);

  // Auto-select first curator when list loads.
  useEffect(() => {
    if (!curators.length) {
      setCuratorId(null);
      return;
    }
    if (!curators.find((c) => c.id === curatorId)) {
      setCuratorId(curators[0].id);
    }
  }, [curators, curatorId]);

  const {
    data: presets,
    createPreset,
    updatePreset,
    deletePreset,
    saving,
  } = useOrganizerCuratorChatPresets(sessionId, groupId, curatorId);

  const {
    preview,
    loading: previewLoading,
    fetchPreview,
  } = useOrganizerChatContextPreview(sessionId, groupId, curatorId);

  // Reset filter to default-preset (or DEFAULT_FILTER) when curator changes.
  const curatorReadyRef = useRef({ groupId: null, curatorId: null });
  useEffect(() => {
    if (
      curatorReadyRef.current.groupId === groupId &&
      curatorReadyRef.current.curatorId === curatorId
    ) {
      return;
    }
    curatorReadyRef.current = { groupId, curatorId };
    if (!presets) {
      setFilter(DEFAULT_FILTER);
      setActivePresetId(null);
      return;
    }
    const def = presets.find((p) => p.isDefault);
    if (def) {
      setFilter(def.filter);
      setActivePresetId(def.id);
    } else {
      setFilter(DEFAULT_FILTER);
      setActivePresetId(null);
    }
  }, [groupId, curatorId, presets]);

  // Debounced preview refresh on filter change.
  const debounceRef = useRef(null);
  useEffect(() => {
    if (!sessionId || !groupId || !curatorId) return undefined;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchPreview(filter);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [sessionId, groupId, curatorId, filter, fetchPreview]);

  const days = contextOptions?.days || [];

  const selectedCurator = curators?.find((c) => c.id === curatorId) || null;

  return (
    <article className="panel-card curator-context-builder">
      <header className="panel-head">
        <div>
          <p className="eyebrow">Конструктор контекста</p>
          <h3>Что увидит ИИ для конкретного куратора</h3>
          <p className="subtle">
            Выберите группу и куратора, отредактируйте набор данных и (при желании) сохраните как
            именованный шаблон. Шаблон с пометкой ★ применяется автоматически.
          </p>
        </div>
      </header>

      <div className="curator-context-builder-toolbar">
        <label className="curator-context-builder-field">
          <span className="subtle">Группа</span>
          <select
            value={groupId || ""}
            onChange={(e) => setGroupId(e.target.value || null)}
            disabled={!groups.length}
          >
            {!groups.length ? <option value="">Нет групп в заезде</option> : null}
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name || g.id}
              </option>
            ))}
          </select>
        </label>

        <label className="curator-context-builder-field">
          <span className="subtle">Куратор</span>
          <select
            value={curatorId || ""}
            onChange={(e) => setCuratorId(e.target.value || null)}
            disabled={!curators?.length}
          >
            {!curators?.length ? <option value="">У группы нет кураторов</option> : null}
            {(curators || []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.fullName}
                {c.hasDefaultPreset ? " · ★" : ""}
                {c.presetsCount ? ` (${c.presetsCount})` : ""}
              </option>
            ))}
          </select>
        </label>

        {selectedCurator?.lastMessageAt ? (
          <span className="subtle">
            Последний вопрос: {formatDate(selectedCurator.lastMessageAt)}
          </span>
        ) : selectedCurator ? (
          <span className="subtle">Этот куратор ещё не задавал вопросов ИИ.</span>
        ) : null}
      </div>

      {curatorId ? (
        <>
          <ChatContextPresetList
            presets={presets || []}
            activePresetId={activePresetId}
            onApply={(p) => {
              setFilter(p.filter);
              setActivePresetId(p.id);
            }}
            onCreate={createPreset}
            onUpdate={updatePreset}
            onDelete={deletePreset}
            saving={saving}
            currentFilter={filter}
          />

          <div className="curator-context-builder-body">
            <div className="curator-context-builder-selectors">
              <ChatContextSelectors
                members={contextOptions?.members || []}
                days={days}
                events={contextOptions?.events || []}
                filter={filter}
                onChange={(next) => {
                  setFilter(next);
                  setActivePresetId(null);
                }}
              />
            </div>
            <div className="curator-context-builder-preview">
              <ChatContextPreview preview={preview} loading={previewLoading} />
            </div>
          </div>
        </>
      ) : (
        <p className="subtle">Выберите куратора, чтобы увидеть его шаблоны и preview.</p>
      )}
    </article>
  );
}

function formatDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("ru-RU", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default CuratorContextBuilder;
