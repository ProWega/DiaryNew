import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { getDefaultRoute } from "../rbac/permissions";

function RegistrationPage() {
  const navigate = useNavigate();
  const {
    currentUser,
    users,
    switchUser,
    registrationOptions,
    registrationLoading,
    registrationError,
    registrationSubmitting,
    registerParticipant,
  } = useAuth();
  const [fullName, setFullName] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const adminUser = users.find((user) => user.role === "admin" || user.id === "user-admin-1");

  async function handleSubmit(event) {
    event.preventDefault();
    const nextUser = await registerParticipant({
      fullName,
      sessionId: selectedSessionId,
    });

    if (nextUser) {
      navigate(getDefaultRoute(nextUser), { replace: true });
    }
  }

  function handleAdminLogin() {
    if (!adminUser) {
      return;
    }

    switchUser(adminUser.id);
    navigate(getDefaultRoute(adminUser), { replace: true });
  }

  return (
    <section className="registration-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <div className="registration-card">
        <p className="eyebrow">Регистрация участника</p>
        <h1>Выберите событие и создайте профиль участника</h1>
        <p className="subtle">
          После регистрации вы сразу попадёте в свой дневник состояния по выбранному событию.
        </p>

        <form className="registration-form" onSubmit={handleSubmit}>
          <label className="field-block is-wide">
            <span>Как вас зовут</span>
            <input
              value={fullName}
              placeholder="Имя и фамилия"
              onChange={(event) => setFullName(event.target.value)}
            />
          </label>

          <label className="field-block is-wide">
            <span>Событие</span>
            <select
              value={selectedSessionId}
              onChange={(event) => setSelectedSessionId(event.target.value)}
              disabled={registrationLoading}
            >
              <option value="">Выберите событие</option>
              {registrationOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <div className="registration-option-list">
            {registrationOptions.map((item) => (
              <button
                key={item.id}
                type="button"
                className={
                  selectedSessionId === item.id
                    ? "registration-option is-active"
                    : "registration-option"
                }
                onClick={() => setSelectedSessionId(item.id)}
              >
                <strong>{item.label}</strong>
                <span>{item.description}</span>
              </button>
            ))}
          </div>

          {registrationError ? (
            <div className="alert-card severity-high">
              <strong>Не удалось зарегистрироваться</strong>
              <p>{registrationError.message}</p>
            </div>
          ) : null}

          <button
            type="submit"
            className="primary-button"
            disabled={registrationSubmitting || registrationLoading || !fullName.trim() || !selectedSessionId}
          >
            {registrationSubmitting ? "Создаём профиль..." : "Зарегистрироваться"}
          </button>

          <button
            type="button"
            className="ghost-button"
            disabled={!adminUser}
            onClick={handleAdminLogin}
          >
            Войти как системный администратор
          </button>
        </form>

        {currentUser ? (
          <p className="subtle">
            Сейчас активен профиль: {currentUser.fullName}. Можно зарегистрировать ещё одного
            участника и сразу переключиться на него.
          </p>
        ) : null}
      </div>
    </section>
  );
}

export default RegistrationPage;
