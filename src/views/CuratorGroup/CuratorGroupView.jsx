import { useCuratorGroupOverview, useCuratorGroupInvitations } from "../../api/hooks";
import FeedbackState from "../../components/FeedbackState";
import MetricsStrip from "./MetricsStrip";
import MembersRosterTable from "./MembersRosterTable";
import InvitationsPanel from "./InvitationsPanel";

/**
 * Вкладка «Состав группы» — четвёртая в кабинете куратора (после
 * Записка/Чат/Старый дашборд). Содержит:
 *   1. Полоску метрик (активны сегодня / рефлексия / pending invites / средняя активация)
 *   2. Ростер участников (имя / этап / состояние сегодня-вчера / рефлексия / последний коммент)
 *   3. Панель приглашений: создание одиночных и пачкой, список с QR
 */
function CuratorGroupView({ sessionId, groupId }) {
  const {
    data: overview,
    loading: overviewLoading,
    error: overviewError,
    refresh: refreshOverview,
  } = useCuratorGroupOverview(sessionId, groupId);
  const {
    data: invitationsData,
    loading: invitationsLoading,
    refresh: refreshInvitations,
  } = useCuratorGroupInvitations(sessionId, groupId);

  function handleInvitationsChanged() {
    refreshInvitations();
    refreshOverview();
  }

  if (overviewLoading && !overview) {
    return (
      <FeedbackState
        title="Загружаем состав группы"
        description="Считаем участников, рефлексию и pending invites."
      />
    );
  }

  if (overviewError) {
    return (
      <FeedbackState
        title="Не удалось загрузить состав группы"
        description={overviewError?.message || "Попробуйте обновить страницу."}
        actionLabel="Повторить"
        onAction={refreshOverview}
      />
    );
  }

  const metrics = overview?.metrics || {
    totalMembers: 0,
    activeToday: 0,
    reflectionsDone: 0,
    pendingInvites: 0,
    avgActivationToday: null,
  };
  const members = overview?.members || [];
  const invitations = invitationsData?.invitations || [];

  return (
    <div className="curator-group-layout">
      <MetricsStrip metrics={metrics} />
      <MembersRosterTable members={members} />
      <InvitationsPanel
        sessionId={sessionId}
        groupId={groupId}
        invitations={invitations}
        loading={invitationsLoading}
        onChanged={handleInvitationsChanged}
      />
    </div>
  );
}

export default CuratorGroupView;
