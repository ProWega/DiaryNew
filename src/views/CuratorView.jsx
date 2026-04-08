import { HeatmapGrid, Sparkline } from "../components/Charts";
import MetricBadge from "../components/MetricBadge";
import { curatorOverview } from "../data/mockData";
import { formatAverage, getStatusTone } from "../lib/metrics";

function CuratorView() {
  return (
    <section className="role-view">
      <div className="hero-card">
        <div>
          <p className="eyebrow">Роль: куратор группы</p>
          <h2>{curatorOverview.groupName}: риски, траектории и темы</h2>
          <p className="subtle">
            Видимость ограничена своей группой. Здесь собраны агрегаты, сигналы риска, индивидуальные траектории и заметки.
          </p>
        </div>

        <div className="hero-stats">
          <MetricBadge label="Участников" value={`${curatorOverview.participantsCount}`} />
          <MetricBadge label="Заполнение" value={`${curatorOverview.completion}%`} />
          <MetricBadge
            label="Средняя активация"
            value={formatAverage(curatorOverview.averageActivation)}
          />
          <MetricBadge label="Риски" value={`${curatorOverview.riskCases}`} />
        </div>
      </div>

      <div className="curator-layout">
        <article className="panel-card wide-card">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Карта группы</p>
              <h3>Heatmap событий и участников</h3>
            </div>
            <span className="soft-pill">Куратор: {curatorOverview.curator}</span>
          </div>

          <HeatmapGrid
            columns={curatorOverview.heatmap.columns}
            rows={curatorOverview.heatmap.rows}
          />
        </article>

        <article className="panel-card side-card">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Сигналы риска</p>
              <h3>Кому нужно внимание сегодня</h3>
            </div>
          </div>

          <div className="alert-list">
            {curatorOverview.alerts.map((alert) => (
              <div key={alert.id} className={`alert-card severity-${alert.severity}`}>
                <strong>{alert.title}</strong>
                <p>{alert.detail}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="panel-card">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Топ-темы комментариев</p>
              <h3>Кластеры по группе</h3>
            </div>
          </div>

          <div className="theme-wrap">
            {curatorOverview.topThemes.map((theme) => (
              <div key={theme.label} className="theme-chip-card">
                <strong>{theme.label}</strong>
                <span>{theme.count} комментариев</span>
              </div>
            ))}
          </div>
        </article>

        <article className="panel-card">
          <div className="panel-head">
            <div>
              <p className="eyebrow">ИИ-сводка</p>
              <h3>Что происходит с группой</h3>
            </div>
            <span className="confidence-tag">
              confidence: {curatorOverview.aiSummary.confidence}
            </span>
          </div>

          <ul className="bullet-list">
            {curatorOverview.aiSummary.bullets.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="lead-text">{curatorOverview.aiSummary.recommendation}</p>
        </article>
      </div>

      <div className="member-grid">
        {curatorOverview.members.map((member) => {
          const tone = getStatusTone(member.status);

          return (
            <article key={member.id} className="member-card">
              <div className="member-head">
                <div>
                  <p className="eyebrow">Участник</p>
                  <h3>{member.name}</h3>
                </div>
                <span className={`status-pill ${tone.className}`}>{tone.label}</span>
              </div>

              <Sparkline values={member.trajectory} />

              <div className="member-metrics">
                <MetricBadge label="Типология" value={member.typology} compact />
                <MetricBadge label="Среднее" value={formatAverage(member.average)} compact />
                <MetricBadge label="Амплитуда" value={`${member.amplitude}`} compact />
              </div>

              <p className="member-note">{member.note}</p>

              <div className="tag-row">
                {member.themes.map((theme) => (
                  <span key={theme} className="tag-chip">
                    {theme}
                  </span>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default CuratorView;
