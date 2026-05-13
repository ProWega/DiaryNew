import { useEffect, useRef, useState } from "react";
import {
  useCuratorChatContextOptions,
  useCuratorSessionDays,
  useChatContextPreview,
} from "../../../api/hooks";
import ChatContextSelectors from "../../../components/curator/ChatContextSelectors";
import ChatContextPreview from "./ChatContextPreview";

const DEFAULT_FILTER = {
  includeMembers: true,
  memberIds: [],
  includeDays: true,
  dayIds: [],
  includeConcepts: true,
  eventIds: [],
};

/**
 * Slide-out drawer для выбора контекста чата.
 *
 * - Слева — три секции (members / days / concepts) через ChatContextSelectors.
 * - Справа — live preview через ChatContextPreview (debounced 300ms).
 * - Снизу — кнопки «Применить» (onApply вернёт filter родителю) и «Закрыть».
 */
function ChatContextDrawer({ open, onClose, sessionId, groupId, filter, onApply }) {
  const [draft, setDraft] = useState(filter || DEFAULT_FILTER);

  // Синхронизируем draft с filter при открытии/смене извне.
  useEffect(() => {
    if (open) setDraft(filter || DEFAULT_FILTER);
  }, [open, filter]);

  const { data: options } = useCuratorChatContextOptions(sessionId, groupId);
  const { data: days } = useCuratorSessionDays(sessionId, groupId);
  const {
    preview,
    loading: previewLoading,
    fetchPreview,
  } = useChatContextPreview(sessionId, groupId);

  // Debounce preview-fetch при изменении draft.
  const debounceRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchPreview(draft);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [open, draft, fetchPreview]);

  if (!open) return null;

  return (
    <>
      <div className="chat-context-drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="chat-context-drawer" role="dialog" aria-label="Выбор контекста для ИИ">
        <header className="chat-context-drawer-head">
          <div>
            <p className="eyebrow">Контекст для ИИ</p>
            <h3>Что увидит ИИ при следующем вопросе</h3>
          </div>
          <button type="button" className="ghost-button" onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </header>

        <div className="chat-context-drawer-body">
          <div className="chat-context-drawer-selectors">
            <ChatContextSelectors
              members={options?.members || []}
              days={days || []}
              events={options?.events || []}
              filter={draft}
              onChange={setDraft}
            />
          </div>
          <div className="chat-context-drawer-preview">
            <ChatContextPreview preview={preview} loading={previewLoading} />
          </div>
        </div>

        <footer className="chat-context-drawer-foot">
          <button type="button" className="ghost-button" onClick={() => setDraft(DEFAULT_FILTER)}>
            Сбросить
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              onApply(draft);
              onClose();
            }}
          >
            Применить
          </button>
        </footer>
      </aside>
    </>
  );
}

export default ChatContextDrawer;
