import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "../auth/AuthContext";
import { getDefaultRoute } from "../rbac/permissions";
import FeedbackState from "./FeedbackState";

function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    currentUser,
    logout,
    bootstrap,
    loading,
    usersError,
    bootstrapError,
  } = useAuth();

  useEffect(() => {
    if (currentUser && location.pathname === "/") {
      navigate(getDefaultRoute(currentUser), { replace: true });
    }
  }, [currentUser, location.pathname, navigate]);

  function handleLogout() {
    logout();
    navigate("/register", { replace: true });
  }

  if (usersError || bootstrapError) {
    return (
      <div className="app-shell">
        <FeedbackState
          title="Не удалось загрузить данные приложения"
          description="Проверьте mock API слой или обновите страницу. Интерфейс не стал падать, но данные сейчас недоступны."
        />
      </div>
    );
  }

  if (loading || !currentUser || !bootstrap) {
    return (
      <div className="app-shell">
        <FeedbackState
          title="Загружаем контур доступа"
          description="Получаем профиль пользователя, его права и доступные разделы."
        />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark">ND</div>
          <div>
            <p className="eyebrow">React Sandbox / JSON API / RBAC</p>
            <h1>{bootstrap.sessionInfo.name}</h1>
            <p className="subtle">
              {bootstrap.sessionInfo.cycle} · {bootstrap.sessionInfo.dateLabel} · {bootstrap.sessionInfo.location}
            </p>
          </div>
        </div>

        <div className="header-side">
          <div className="pill-grid">
            <span className="soft-pill">{bootstrap.sessionInfo.scaleNote}</span>
            <span className="soft-pill is-outline">{bootstrap.sessionInfo.aiPolicy}</span>
          </div>

          <div className="user-switcher">
            <span className="role-pill is-active">
              {currentUser.roleLabel}: {currentUser.fullName}
            </span>
            <button type="button" className="ghost-button" onClick={handleLogout}>
              Новая регистрация
            </button>
          </div>
        </div>
      </header>

      <div className="scope-strip">
        <div className="subnav">
          {bootstrap.navigation.map((item) => (
            <NavLink
              key={item.id}
              to={item.to}
              className={({ isActive }) =>
                isActive ? "subnav-pill is-active" : "subnav-pill"
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>

        <div className="pill-grid">
          {bootstrap.scopeBadges.map((badge) => (
            <span key={badge} className="soft-pill is-outline">
              {badge}
            </span>
          ))}
        </div>
      </div>

      <main className="page-grid">
        <Outlet />
      </main>
    </div>
  );
}

export default AppLayout;
