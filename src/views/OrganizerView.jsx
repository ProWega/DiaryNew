import MetricBadge from "../components/MetricBadge";
import { organizerOverview } from "../data/mockData";
import { formatAverage } from "../lib/metrics";

function OrganizerView() {
  return (
    <section className="role-view">
      <div className="hero-card">
        <div>
          <p className="eyebrow">Роль: организатор / аналитик</p>
          <h2>Общий обзор заезда, проблемных событий и типологий</h2>
          <p className="subtle">
            Этот слой собирает всю аналитику по заезду: сравнение групп, проблемные точки программы, ИИ-отчёты и настройки классификации.
          </p>
        </div>

        <div className="hero-stats">
          <MetricBadge label="Заполнение заезда" value={`${organizerOverview.overallCompletion}%`} />
          <MetricBadge label="Групп" value={`${organizerOverview.groups.length}`} />
          <MetricBadge label="Типологий" value={`${organizerOverview.typologies.length}`} />
          <MetricBadge label="ИИ-отчётов" value={`${organizerOverview.aiReports.length}`} />
        </div>
      </div>

      <div className="organizer-grid">
        <article className="panel-card wide-card">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Сравнение групп</p>
              <h3>Срез по кураторам и рискам</h3>
            </div>
          </div>

          <div className="group-compare-grid">
            {organizerOverview.groups.map((group) => (
              <div key={group.name} className="compare-card">
                <div className="compare-head">
                  <div>
                    <strong>{group.name}</strong>
                    <p>{group.curator}</p>
                  </div>
                  <span className="soft-pill">{group.completion}% заполнено</span>
                </div>

                <div className="compare-metrics">
                  <MetricBadge label="Участников" value={`${group.participants}`} compact />
                  <MetricBadge
                    label="Средняя активация"
                    value={formatAverage(group.avgActivation)}
                    compact
                  />
                  <MetricBadge label="Рисков" value={`${group.riskCases}`} compact />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="panel-card">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Типологии</p>
              <h3>Rule-based классификация участников</h3>
            </div>
          </div>

          <div className="theme-wrap">
            {organizerOverview.typologies.map((item) => (
              <div key={item.name} className="theme-chip-card">
                <strong>{item.name}</strong>
                <span>{item.share}% участников</span>
                <p>{item.description}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="panel-card wide-card">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Проблемные события</p>
              <h3>Что усиливает рост и где теряется ресурс</h3>
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Событие</th>
                  <th>Эффект</th>
                  <th>Риск</th>
                  <th>Тема</th>
                  <th>Действие</th>
                </tr>
              </thead>
              <tbody>
                {organizerOverview.eventHealth.map((row) => (
                  <tr key={row.event}>
                    <td>{row.event}</td>
                    <td>{row.effect}</td>
                    <td>{row.concern}</td>
                    <td>{row.theme}</td>
                    <td>{row.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel-card">
          <div className="panel-head">
            <div>
              <p className="eyebrow">ИИ-аналитика</p>
              <h3>Сгенерированные отчёты</h3>
            </div>
          </div>

          <div className="report-stack">
            {organizerOverview.aiReports.map((report) => (
              <div key={report.title} className="report-card">
                <div className="report-head">
                  <strong>{report.title}</strong>
                  <span className="confidence-tag">
                    confidence: {report.confidence}
                  </span>
                </div>
                <ul className="bullet-list">
                  {report.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </article>

        <article className="panel-card">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Импорт программы</p>
              <h3>CSV / XLSX шаблон</h3>
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table is-compact">
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Event name</th>
                  <th>Type</th>
                  <th>Tags</th>
                </tr>
              </thead>
              <tbody>
                {organizerOverview.importPreview.map((row) => (
                  <tr key={`${row.day}-${row.name}`}>
                    <td>{row.day}</td>
                    <td>{row.start}</td>
                    <td>{row.end}</td>
                    <td>{row.name}</td>
                    <td>{row.type}</td>
                    <td>{row.tags}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel-card">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Governance</p>
              <h3>Политики и ограничения</h3>
            </div>
          </div>

          <div className="theme-wrap">
            {organizerOverview.governance.map((item) => (
              <div key={item.title} className="theme-chip-card">
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}

export default OrganizerView;
