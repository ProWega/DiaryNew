import { Navigate, Route, Routes } from "react-router-dom";
import { useEffect } from "react";
import AppLayout from "./components/AppLayout";
import RouteGuard from "./components/RouteGuard";
import { useAuth } from "./auth/AuthContext";
import AdminSecurityPage from "./pages/AdminSecurityPage";
import CuratorDashboardPage from "./pages/CuratorDashboardPage";
import MagicLinkPage from "./pages/MagicLinkPage";
import OrganizerDashboardPage from "./pages/OrganizerDashboardPage";
import {
  ParticipantDynamicsPage,
  ParticipantSelfKnowledgePage,
  ParticipantTodayPage,
} from "./pages/ParticipantPage";
import RegistrationPage from "./pages/RegistrationPage";
import SetupAdminPage from "./pages/SetupAdminPage";
import IstokiMapPage from "./features/istoki/IstokiMapPage";
import IstokiPublicLayout from "./features/istoki/IstokiPublicLayout";
import IstokiAdminPage from "./features/istokiAdmin/IstokiAdminPage";
import { getDefaultRoute } from "./rbac/permissions";

const APP_TITLE = "Истоки";

function PageTitle({ title, children }) {
  useEffect(() => {
    document.title = title ? `${title} · ${APP_TITLE}` : APP_TITLE;
  }, [title]);

  return children;
}

function AppRouter() {
  const { currentUser } = useAuth();

  return (
    <Routes>
      <Route
        path="/register"
        element={
          currentUser ? (
            <Navigate to={getDefaultRoute(currentUser)} replace />
          ) : (
            <PageTitle title="Регистрация участника">
              <RegistrationPage />
            </PageTitle>
          )
        }
      />
      <Route
        path="/magic"
        element={
          <PageTitle title="Вход по ссылке">
            <MagicLinkPage />
          </PageTitle>
        }
      />
      <Route
        path="/setup/admin"
        element={
          <PageTitle title="Первый администратор">
            <SetupAdminPage />
          </PageTitle>
        }
      />
      <Route
        path="/istoki/map"
        element={
          <PageTitle title="Голоса регионов">
            <IstokiPublicLayout>
              <IstokiMapPage />
            </IstokiPublicLayout>
          </PageTitle>
        }
      />
      <Route
        path="/istoki/region/:regionCode"
        element={
          <PageTitle title="Голоса регионов">
            <IstokiPublicLayout>
              <IstokiMapPage deepLink />
            </IstokiPublicLayout>
          </PageTitle>
        }
      />

      <Route path="/" element={currentUser ? <AppLayout /> : <Navigate to="/register" replace />}>
        <Route index element={<Navigate to={getDefaultRoute(currentUser)} replace />} />

        <Route
          path="participant/session/:sessionId/today"
          element={
            <PageTitle title="Дневник состояния">
              <RouteGuard permission="participant.diary.read">
                <ParticipantTodayPage />
              </RouteGuard>
            </PageTitle>
          }
        />
        <Route
          path="participant/session/:sessionId/self"
          element={
            <PageTitle title="Самопознание">
              <RouteGuard permission="participant.self.read">
                <ParticipantSelfKnowledgePage />
              </RouteGuard>
            </PageTitle>
          }
        />
        <Route
          path="participant/session/:sessionId/dynamics"
          element={
            <PageTitle title="Динамика состояния">
              <RouteGuard permission="participant.dynamics.read">
                <ParticipantDynamicsPage />
              </RouteGuard>
            </PageTitle>
          }
        />
        <Route
          path="curator/session/:sessionId/group/:groupId"
          element={
            <PageTitle title="Кабинет куратора">
              <RouteGuard permission="group.analytics.read">
                <CuratorDashboardPage />
              </RouteGuard>
            </PageTitle>
          }
        />
        <Route
          path="organizer/session/:sessionId"
          element={
            <PageTitle title="Кабинет организатора">
              <RouteGuard permission="session.analytics.read">
                <OrganizerDashboardPage />
              </RouteGuard>
            </PageTitle>
          }
        />
        <Route
          path="admin/security"
          element={
            <PageTitle title="Безопасность и доступ">
              <RouteGuard permission="security.read">
                <AdminSecurityPage />
              </RouteGuard>
            </PageTitle>
          }
        />
        <Route
          path="admin/istoki"
          element={
            <PageTitle title="Истоки · Контент">
              <RouteGuard permission="istoki.regions.manage">
                <IstokiAdminPage />
              </RouteGuard>
            </PageTitle>
          }
        />
        <Route path="*" element={<Navigate to={getDefaultRoute(currentUser)} replace />} />
      </Route>

      <Route
        path="*"
        element={
          currentUser ? (
            <Navigate to={getDefaultRoute(currentUser)} replace />
          ) : (
            <Navigate to="/register" replace />
          )
        }
      />
    </Routes>
  );
}

export default AppRouter;
