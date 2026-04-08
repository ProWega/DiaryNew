import MetricBadge from "../components/MetricBadge";

function AdminSecurityView({ dashboard }) {
  return (
    <section className="role-view">
      <div className="hero-card">
        <div>
          <p className="eyebrow">Роль: администратор</p>
          <h2>Безопасность, аудит и правила доступа</h2>
          <p className="subtle">
            Этот экран фиксирует RBAC, политику хранения, анонимизацию ИИ и журнал действий для контроля данных.
          </p>
        </div>

        <div className="hero-stats">
          <MetricBadge label="Ролей" value={`${dashboard.accessMatrix.length}`} />
          <MetricBadge label="Security cards" value={`${dashboard.securityCards.length}`} />
          <MetricBadge label="Audit events" value={`${dashboard.auditLog.length}`} />
        </div>
      </div>

      <div className="organizer-grid">
        <article className="panel-card wide-card">
          <div className="panel-head">
            <div>
              <p className="eyebrow">RBAC</p>
              <h3>Матрица ролей и доступа</h3>
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Роль</th>
                  <th>Доступ</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.accessMatrix.map((row) => (
                  <tr key={row.role}>
                    <td>{row.role}</td>
                    <td>{row.rights}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel-card">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Безопасность</p>
              <h3>Ключевые меры</h3>
            </div>
          </div>

          <div className="theme-wrap">
            {dashboard.securityCards.map((card) => (
              <div key={card.title} className="theme-chip-card">
                <strong>{card.title}</strong>
                <p>{card.detail}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="panel-card">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Аудит</p>
              <h3>Последние действия</h3>
            </div>
          </div>

          <div className="audit-stack">
            {dashboard.auditLog.map((entry) => (
              <div key={`${entry.time}-${entry.actor}`} className="audit-card">
                <span>{entry.time}</span>
                <strong>{entry.actor}</strong>
                <p>{entry.action}</p>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}

export default AdminSecurityView;
