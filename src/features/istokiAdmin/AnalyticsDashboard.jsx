import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  useIstokiAnalyticsKpi,
  useIstokiTimeSeries,
  useIstokiTopPodcasts,
  useIstokiTopRegions,
  useIstokiTopStories,
} from "./api";

const RANGES = [
  { id: 7, label: "7 дней" },
  { id: 30, label: "30 дней" },
  { id: 90, label: "90 дней" },
];

const EVENT_TYPES = [
  { id: "", label: "Все события" },
  { id: "region.opened", label: "Открытия региона" },
  { id: "podcast.played", label: "Запуск подкастов" },
  { id: "story.viewed", label: "Просмотры историй" },
];

function formatMinutes(seconds) {
  if (!seconds) return "0 мин";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours} ч ${rest.toString().padStart(2, "0")} мин`;
}

function KpiCard({ label, value, hint }) {
  return (
    <div className="istoki-admin-kpi">
      <span className="istoki-admin-kpi-label">{label}</span>
      <span className="istoki-admin-kpi-value">{value}</span>
      {hint && <span className="istoki-admin-kpi-hint">{hint}</span>}
    </div>
  );
}

function SectionTitle({ title, hint }) {
  return (
    <div className="istoki-admin-section-head">
      <h3 className="istoki-admin-section-title">{title}</h3>
      {hint && <span className="istoki-admin-section-hint">{hint}</span>}
    </div>
  );
}

function TopBar({ items, valueKey, labelKey, emptyText }) {
  if (!items?.length) {
    return <div className="istoki-admin-empty">{emptyText}</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, items.length * 36)}>
      <BarChart data={items} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid horizontal={false} stroke="rgba(229, 213, 184, 0.08)" />
        <XAxis
          type="number"
          tick={{ fill: "rgba(247, 241, 230, 0.6)", fontSize: 12 }}
          allowDecimals={false}
        />
        <YAxis
          type="category"
          dataKey={labelKey}
          width={180}
          tick={{ fill: "rgba(247, 241, 230, 0.85)", fontSize: 12 }}
        />
        <Tooltip
          contentStyle={{
            background: "rgba(20, 12, 14, 0.95)",
            border: "1px solid rgba(229, 213, 184, 0.18)",
            borderRadius: 8,
            color: "#f7f1e6",
          }}
          cursor={{ fill: "rgba(154, 122, 50, 0.15)" }}
        />
        <Bar dataKey={valueKey} fill="#9a7a32" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function AnalyticsDashboard() {
  const [days, setDays] = useState(30);
  const [eventType, setEventType] = useState("");

  const kpi = useIstokiAnalyticsKpi(days);
  const topRegions = useIstokiTopRegions(days);
  const topPodcasts = useIstokiTopPodcasts(days);
  const topStories = useIstokiTopStories(days);
  const timeseries = useIstokiTimeSeries(days, eventType);

  return (
    <div className="istoki-admin-analytics">
      <header className="istoki-admin-analytics-head">
        <div>
          <h2 className="istoki-admin-page-title">Аналитика</h2>
          <p className="istoki-admin-page-subtitle">
            Анонимные счётчики событий: открытия регионов, прослушивания, просмотры. IP хешируется с
            дневной солью.
          </p>
        </div>
        <div className="istoki-admin-range-tabs" role="tablist" aria-label="Период">
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              role="tab"
              className="istoki-admin-range-tab"
              aria-selected={days === r.id}
              onClick={() => setDays(r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </header>

      <section className="istoki-admin-kpi-grid">
        <KpiCard
          label="Открытий портала"
          value={kpi.data?.regionOpens ?? "—"}
          hint={`за ${days} дней`}
        />
        <KpiCard
          label="Уникальных гостей"
          value={kpi.data?.uniqueVisitors ?? "—"}
          hint="по хешу IP"
        />
        <KpiCard
          label="Прослушано"
          value={formatMinutes(kpi.data?.listenedSecTotal)}
          hint="суммарно"
        />
        <KpiCard
          label="Запусков подкастов"
          value={kpi.data?.podcastPlays ?? "—"}
          hint={`+ ${kpi.data?.storyViews ?? 0} просмотров историй`}
        />
      </section>

      <section className="istoki-admin-section">
        <SectionTitle title="Динамика событий" hint={`Шаг: 1 день · период: ${days} дней`} />
        <div className="istoki-admin-event-filter" role="tablist" aria-label="Тип события">
          {EVENT_TYPES.map((t) => (
            <button
              key={t.id || "all"}
              type="button"
              role="tab"
              className="istoki-admin-event-pill"
              aria-selected={eventType === t.id}
              onClick={() => setEventType(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        {timeseries.data?.points?.length ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart
              data={timeseries.data.points}
              margin={{ top: 12, right: 16, bottom: 0, left: 0 }}
            >
              <CartesianGrid stroke="rgba(229, 213, 184, 0.08)" />
              <XAxis dataKey="day" tick={{ fill: "rgba(247, 241, 230, 0.6)", fontSize: 11 }} />
              <YAxis
                tick={{ fill: "rgba(247, 241, 230, 0.6)", fontSize: 12 }}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  background: "rgba(20, 12, 14, 0.95)",
                  border: "1px solid rgba(229, 213, 184, 0.18)",
                  borderRadius: 8,
                  color: "#f7f1e6",
                }}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#c95c36"
                strokeWidth={2}
                dot={{ r: 3, fill: "#c95c36" }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="istoki-admin-empty">Пока нет событий за выбранный период.</div>
        )}
      </section>

      <div className="istoki-admin-tops-grid">
        <section className="istoki-admin-section">
          <SectionTitle title="Топ-5 регионов по открытиям" />
          <TopBar
            items={topRegions.data?.items}
            valueKey="opens"
            labelKey="name"
            emptyText="Нет открытий за период"
          />
        </section>

        <section className="istoki-admin-section">
          <SectionTitle title="Топ-5 подкастов (≥80% прослушки)" />
          <TopBar
            items={topPodcasts.data?.items?.filter((p) => p.completions > 0)}
            valueKey="completions"
            labelKey="title"
            emptyText="Полных прослушек пока нет"
          />
        </section>

        <section className="istoki-admin-section">
          <SectionTitle title="Топ-5 историй" />
          <TopBar
            items={topStories.data?.items}
            valueKey="views"
            labelKey="participantName"
            emptyText="Просмотров историй пока нет"
          />
        </section>
      </div>
    </div>
  );
}

export default AnalyticsDashboard;
