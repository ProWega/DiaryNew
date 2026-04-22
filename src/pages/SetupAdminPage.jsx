import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { jsonApi } from "../api/jsonApi";
import { useAuth } from "../auth/AuthContext";
import { getDefaultRoute } from "../rbac/permissions";

function SetupAdminPage() {
  const navigate = useNavigate();
  const { refreshAuth } = useAuth();
  const [form, setForm] = useState({
    setupToken: "",
    fullName: "",
    email: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function update(key, value) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const result = await jsonApi.setupAdmin(form);
      await refreshAuth();
      navigate(getDefaultRoute(result.user), { replace: true });
    } catch (nextError) {
      setError(nextError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="registration-shell">
      <div className="registration-card">
        <p className="eyebrow">Первичная настройка</p>
        <h1>Создать системного администратора</h1>
        <p className="subtle">Этот сценарий доступен только если в базе ещё нет администратора.</p>

        <form className="registration-form" onSubmit={handleSubmit}>
          <label className="field-block is-wide">
            <span>Setup token</span>
            <input
              value={form.setupToken}
              type="password"
              onChange={(event) => update("setupToken", event.target.value)}
            />
          </label>
          <label className="field-block is-wide">
            <span>Имя администратора</span>
            <input value={form.fullName} onChange={(event) => update("fullName", event.target.value)} />
          </label>
          <label className="field-block is-wide">
            <span>Email</span>
            <input value={form.email} onChange={(event) => update("email", event.target.value)} />
          </label>

          {error ? (
            <div className="alert-card severity-high">
              <strong>Не удалось создать администратора</strong>
              <p>{error.message}</p>
            </div>
          ) : null}

          <button type="submit" className="primary-button" disabled={saving || !form.setupToken.trim()}>
            {saving ? "Создаём..." : "Создать администратора"}
          </button>
        </form>
      </div>
    </section>
  );
}

export default SetupAdminPage;
