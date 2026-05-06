import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { getDefaultRoute } from "../rbac/permissions";
import FeedbackState from "./FeedbackState";
import { useTheme } from "../hooks/useTheme";
import JourneyStageOnboardingModal from "./methodology/JourneyStageOnboardingModal";
import { useJourneyStageMutation } from "../api/hooks";

// localStorage key — отметка что участник пропустил onboarding в текущей сессии заезда.
// Не блокирует появление модала навсегда: можно стереть ключ или сбросить через настройки.
function journeyStageSkipKey(sessionId) {
  return `newdiary-journey-stage-skipped-${sessionId}`;
}

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
  theme,
  onToggleTheme,
}) {
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const accountRef = useRef(null);
  const sessionInfo = bootstrap?.sessionInfo || {};
  const sessionMeta = [sessionInfo.cycle, sessionInfo.dateLabel, sessionInfo.location].filter(
    Boolean,
  );
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
        {sessionMeta.length ? <p className="subtle">{sessionMeta.join(" · ")}</p> : null}
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
          className="ghost-button theme-toggle"
          aria-label={
            theme === "dark" ? "Переключить на светлую тему" : "Переключить на тёмную тему"
          }
          onClick={onToggleTheme}
        >
          {theme === "dark" ? "Светлая" : "Тёмная"}
        </button>

        <button
          type="button"
          className={
            isAccountOpen ? "participant-account-button is-open" : "participant-account-button"
          }
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

/**
 * Gate-компонент: показывает onboarding-модал participant'у когда journey_stage
 * ещё не выбран И не помечено «решу позже». После сохранения bootstrap
 * рефрешится → journeyStage становится не-null → модал больше не появляется.
 * После «пропустить» помечается localStorage-ключ для текущего sessionId.
 */
function ParticipantJourneyStageGate({ bootstrap }) {
  const sessionId = bootstrap?.sessionInfo?.id ?? null;
  const journeyStage = bootstrap?.journeyStage ?? null;
  const isCarefulMode = bootstrap?.isCarefulMode ?? false;
  const { saving, updateJourneyStage } = useJourneyStageMutation();
  const [skipped, setSkipped] = useState(() => {
    if (!sessionId || typeof window === "undefined") return false;
    return window.localStorage.getItem(journeyStageSkipKey(sessionId)) === "1";
  });

  // Не показываем если уже выбрано или скрыто пользователем.
  const shouldShow = !skipped && journeyStage === null && !isCarefulMode;

  async function handleSubmit(patch) {
    const result = await updateJourneyStage(patch);
    if (result && sessionId && typeof window !== "undefined") {
      // Если пользователь сохранил — значит выбрал. Но на всякий случай сбрасываем skip-флаг.
      window.localStorage.removeItem(journeyStageSkipKey(sessionId));
    }
  }

  function handleSkip() {
    if (sessionId && typeof window !== "undefined") {
      window.localStorage.setItem(journeyStageSkipKey(sessionId), "1");
    }
    setSkipped(true);
  }

  return (
    <JourneyStageOnboardingModal
      open={shouldShow}
      onSubmit={handleSubmit}
      onSkip={handleSkip}
      saving={saving}
    />
  );
}

function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { currentUser, logout, bootstrap, loading, usersError, bootstrapError } = useAuth();

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
    currentUser.role === "participant" && location.pathname.startsWith("/participant/");

  return (
    <div className="app-shell">
      {isParticipantShell ? <ParticipantJourneyStageGate bootstrap={bootstrap} /> : null}
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      {isParticipantShell ? (
        <ParticipantTopbar
          currentUser={currentUser}
          bootstrap={bootstrap}
          navigation={bootstrap.navigation}
          onLogout={handleLogout}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      ) : (
        <>
          <header className="topbar">
            <div className="brand-block">
              <div className="brand-mark" aria-label="Истоки">
                И
              </div>
              <div>
                <p className="eyebrow">Истоки · цифровой кабинет</p>
                <h1>{bootstrap.sessionInfo.name}</h1>
                <p className="subtle">
                  {bootstrap.sessionInfo.cycle} · {bootstrap.sessionInfo.dateLabel} ·{" "}
                  {bootstrap.sessionInfo.location}
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
                <button
                  type="button"
                  className="ghost-button theme-toggle"
                  aria-label={
                    theme === "dark" ? "Переключить на светлую тему" : "Переключить на тёмную тему"
                  }
                  onClick={toggleTheme}
                >
                  {theme === "dark" ? "Светлая" : "Тёмная"}
                </button>
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
                  className={({ isActive }) => (isActive ? "subnav-pill is-active" : "subnav-pill")}
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

      <main id="main-content" className="page-grid">
        <Outlet />
      </main>
    </div>
  );
}

export default AppLayout;
