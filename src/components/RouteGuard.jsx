import { useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { can } from "../rbac/permissions";
import FeedbackState from "./FeedbackState";

function RouteGuard({ permission, children }) {
  const { currentUser } = useAuth();
  const params = useParams();
  const subject = {
    sessionId: params.sessionId,
    groupId: params.groupId,
    userId: params.userId,
  };

  if (!can(currentUser, permission, subject)) {
    return (
      <FeedbackState
        title="Доступ ограничен"
        description="Маршрут существует, но текущая роль не может просматривать эти данные в выбранном контуре заезда или группы."
      />
    );
  }

  return children;
}

export default RouteGuard;
