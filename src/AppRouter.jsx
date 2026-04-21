import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import RouteGuard from "./components/RouteGuard";
import { useAuth } from "./auth/AuthContext";
import AdminSecurityPage from "./pages/AdminSecurityPage";
import CuratorDashboardPage from "./pages/CuratorDashboardPage";
import OrganizerDashboardPage from "./pages/OrganizerDashboardPage";
import {
  ParticipantDynamicsPage,
  ParticipantTodayPage,
} from "./pages/ParticipantPage";
import RegistrationPage from "./pages/RegistrationPage";
import { getDefaultRoute } from "./rbac/permissions";

function AppRouter() {
  const { currentUser } = useAuth();

  return (
    <Routes>
      <Route
        path="/register"
        element={
          currentUser ? <Navigate to={getDefaultRoute(currentUser)} replace /> : <RegistrationPage />
        }
      />

      <Route
        path="/"
        element={currentUser ? <AppLayout /> : <Navigate to="/register" replace />}
      >
        <Route index element={<Navigate to={getDefaultRoute(currentUser)} replace />} />

        <Route
          path="participant/session/:sessionId/today"
          element={
            <RouteGuard permission="participant.diary.read">
              <ParticipantTodayPage />
            </RouteGuard>
          }
        />
        <Route
          path="participant/session/:sessionId/dynamics"
          element={
            <RouteGuard permission="participant.dynamics.read">
              <ParticipantDynamicsPage />
            </RouteGuard>
          }
        />
        <Route
          path="curator/session/:sessionId/group/:groupId"
          element={
            <RouteGuard permission="group.analytics.read">
              <CuratorDashboardPage />
            </RouteGuard>
          }
        />
        <Route
          path="organizer/session/:sessionId"
          element={
            <RouteGuard permission="session.analytics.read">
              <OrganizerDashboardPage />
            </RouteGuard>
          }
        />
        <Route
          path="admin/security"
          element={
            <RouteGuard permission="security.read">
              <AdminSecurityPage />
            </RouteGuard>
          }
        />
        <Route path="*" element={<Navigate to={getDefaultRoute(currentUser)} replace />} />
      </Route>

      <Route
        path="*"
        element={currentUser ? <Navigate to={getDefaultRoute(currentUser)} replace /> : <Navigate to="/register" replace />}
      />
    </Routes>
  );
}

export default AppRouter;
