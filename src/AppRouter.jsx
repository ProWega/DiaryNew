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
import { getDefaultRoute } from "./rbac/permissions";

function AppRouter() {
  const { currentUser } = useAuth();

  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        <Route
          index
          element={
            currentUser ? (
              <Navigate to={getDefaultRoute(currentUser)} replace />
            ) : null
          }
        />

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
        <Route
          path="*"
          element={
            currentUser ? (
              <Navigate to={getDefaultRoute(currentUser)} replace />
            ) : null
          }
        />
      </Route>
    </Routes>
  );
}

export default AppRouter;
