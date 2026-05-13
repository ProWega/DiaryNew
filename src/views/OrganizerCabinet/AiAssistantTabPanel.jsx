import SessionLlmSettingsCard from "../../components/organizer/SessionLlmSettingsCard";
import CuratorContextBuilder from "../../components/organizer/CuratorContextBuilder";

/**
 * Вкладка «ИИ-помощник» в кабинете организатора (Curator AI v2.1).
 *
 * Два блока:
 *   1. Общие настройки LLM сессии (переехали сюда из «Заездов»).
 *   2. Конструктор контекста для чата куратора: выбор группы и куратора,
 *      управление preset'ами, live preview собранного preamble.
 */
function AiAssistantTabPanel({ sessionId, groups, llmSettings, saving, onUpdateSessionSettings }) {
  return (
    <div className="organizer-tab-panel ai-assistant-tab">
      <header className="organizer-tab-head">
        <p className="eyebrow">ИИ-помощник</p>
        <h2>Настройки и контекст для «Разговора с ИИ»</h2>
        <p className="subtle">
          Здесь вы управляете лимитами и моделями для куратора и видите, какой именно контекст ИИ
          получит при ответе на вопросы куратора.
        </p>
      </header>

      {sessionId && onUpdateSessionSettings ? (
        <SessionLlmSettingsCard
          llmSettings={llmSettings}
          saving={saving}
          onSubmit={onUpdateSessionSettings}
        />
      ) : (
        <p className="subtle">
          Выберите заезд во вкладке «Мои заезды», чтобы увидеть настройки LLM и конструктор
          контекста.
        </p>
      )}

      {sessionId ? <CuratorContextBuilder sessionId={sessionId} groups={groups || []} /> : null}
    </div>
  );
}

export default AiAssistantTabPanel;
