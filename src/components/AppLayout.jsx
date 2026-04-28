import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { getDefaultRoute } from "../rbac/permissions";
import FeedbackState from "./FeedbackState";

function getInitials(fullName = "") {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);

  return (
    parts
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "И"
  );
}

export function ParticipantTopbar({
  currentUser,
  bootstrap,
  navigation = [],
  onLogout,
}) {
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const accountRef = useRef(null);
  const sessionInfo = bootstrap?.sessionInfo || {};
  const sessionMeta = [
    sessionInfo.cycle,
    sessionInfo.dateLabel,
    sessionInfo.location,
  ].filter(Boolean);
  const firstName = currentUser.fullName?.trim().split(/\s+/)[0] || "Аккаунт";

  useEffect(() => {
    if (!isAccountOpen) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (!accountRef.current?.contains(event.target)) {
        setIsAccountOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsAccountOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isAccountOpen]);

  function handleLogout() {
    setIsAccountOpen(false);
    onLogout();
  }

  return (
    <header className="participant-topbar">
      <div className="participant-topbar-context">
        <p className="eyebrow">Личный кабинет</p>
        <h1>{sessionInfo.name}</h1>
        {sessionMeta.length ? (
          <p className="subtle">{sessionMeta.join(" · ")}</p>
        ) : null}
      </div>

      <nav className="participant-nav" aria-label="Разделы участника">
        {navigation.map((item) => (
          <NavLink
            key={item.id}
            to={item.to}
            className={({ isActive }) =>
              isActive ? "participant-nav-pill is-active" : "participant-nav-pill"
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="participant-account" ref={accountRef}>
        <button
          type="button"
          className={isAccountOpen ? "participant-account-button is-open" : "participant-account-button"}
          aria-haspopup="menu"
          aria-expanded={isAccountOpen}
          onClick={() => setIsAccountOpen((value) => !value)}
        >
          <span className="participant-account-avatar" aria-hidden="true">
            {getInitials(currentUser.fullName)}
          </span>
          <span>{firstName}</span>
        </button>

        {isAccountOpen ? (
          <div className="participant-account-menu" role="menu">
            <div className="participant-account-menu-head">
              <span>Аккаунт</span>
              <strong>{currentUser.fullName}</strong>
            </div>
            <button type="button" role="menuitem" onClick={handleLogout}>
              Выйти
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}

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

  const isParticipantShell =
    currentUser.role === "participant" &&
    location.pathname.startsWith("/participant/");

  return (
    <div className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      {isParticipantShell ? (
        <ParticipantTopbar
          currentUser={currentUser}
          bootstrap={bootstrap}
          navigation={bootstrap.navigation}
          onLogout={handleLogout}
        />
      ) : (
        <>
          <header className="topbar">
            <div className="brand-block">
              <div className="brand-mark" aria-label="Истоки">И</div>
              <div>
                <p className="eyebrow">Истоки · цифровой кабинет</p>
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
        </>
      )}

      <main className="page-grid">
        <Outlet />
      </main>
    </div>
  );
}

export default AppLayout;
