import { AlertCard } from "../../components/ui/Pills";
import { SessionCatalog, SessionEditorForm } from "../../components/admin/AdminComponents";

function SessionsTabPanel({
  sessionCatalog,
  sessionId,
  sessionQuery,
  sessionDraft,
  isCreatingSession,
  isCreatingSessionSaving,
  createSessionError,
  mutationError,
  sessionSaveError,
  saving,
  onQueryChange,
  onSelectSession,
  onStartCreate,
  onChangeSessionDraft,
  onSubmitSession,
  onCancelSession,
}) {
  return (
    <div className="organizer-focus-grid">
      <SessionCatalog
        sessions={sessionCatalog || []}
        selectedSessionId={sessionId}
        query={sessionQuery}
        onQueryChange={onQueryChange}
        onSelectSession={onSelectSession}
      />
      <div className="organizer-section-stack">
        <button
          type="button"
          className="primary-button"
          disabled={saving || isCreatingSessionSaving}
          onClick={onStartCreate}
        >
          Создать заезд
        </button>
        {createSessionError ? (
          <AlertCard
            title="Не удалось создать заезд"
            detail={
              createSessionError.message || "Проверьте заполнение формы и доступ организатора."
            }
            tone="severity-high"
          />
        ) : null}
        {sessionDraft ? (
          <SessionEditorForm
            value={sessionDraft}
            mode={isCreatingSession ? "create" : "edit"}
            preset="organizer"
            saving={saving || isCreatingSessionSaving}
            error={isCreatingSession ? createSessionError : mutationError || sessionSaveError}
            onChange={onChangeSessionDraft}
            onSubmit={onSubmitSession}
            onCancel={onCancelSession}
          />
        ) : null}
      </div>
    </div>
  );
}

export default SessionsTabPanel;
