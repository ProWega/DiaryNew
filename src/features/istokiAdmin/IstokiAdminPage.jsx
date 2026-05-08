import { useEffect, useState } from "react";
import { useAdminRegion, useAdminRegions, useAdminSubmissionsCount } from "./api";
import RegionEditor from "./RegionEditor";
import AnalyticsDashboard from "./AnalyticsDashboard";
import SubmissionsQueue from "./SubmissionsQueue";

const TABS = [
  { id: "regions", label: "Контент" },
  { id: "submissions", label: "Заявки" },
  { id: "analytics", label: "Аналитика" },
];

function TabSwitcher({ tab, setTab, pendingCount }) {
  return (
    <div className="istoki-admin-tabs" role="tablist">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={tab === t.id}
          className="istoki-admin-tab"
          onClick={() => setTab(t.id)}
        >
          {t.label}
          {t.id === "submissions" && pendingCount > 0 && (
            <span className="istoki-admin-tab-badge">{pendingCount}</span>
          )}
        </button>
      ))}
    </div>
  );
}

function IstokiAdminPage() {
  const [tab, setTab] = useState("regions");
  const submissionsCounts = useAdminSubmissionsCount();
  const pendingCount = submissionsCounts.data?.pending ?? 0;

  if (tab === "analytics") {
    return (
      <div className="istoki-admin-shell">
        <aside className="istoki-admin-sidebar">
          <div className="istoki-admin-sidebar-head">
            <h1 className="istoki-admin-title">Истоки</h1>
            <TabSwitcher tab={tab} setTab={setTab} pendingCount={pendingCount} />
          </div>
        </aside>
        <main className="istoki-admin-main">
          <AnalyticsDashboard />
        </main>
      </div>
    );
  }

  if (tab === "submissions") {
    return (
      <div className="istoki-admin-shell">
        <aside className="istoki-admin-sidebar">
          <div className="istoki-admin-sidebar-head">
            <h1 className="istoki-admin-title">Истоки · Заявки</h1>
            <p className="istoki-admin-subtitle">
              {pendingCount > 0 ? `Ждут проверки: ${pendingCount}` : "Очередь модерации пуста"}
            </p>
            <TabSwitcher tab={tab} setTab={setTab} pendingCount={pendingCount} />
          </div>
        </aside>
        <main className="istoki-admin-main">
          <SubmissionsQueue />
        </main>
      </div>
    );
  }

  return <RegionsTab tab={tab} setTab={setTab} pendingCount={pendingCount} />;
}

function RegionsTab({ tab, setTab, pendingCount }) {
  const regionsQuery = useAdminRegions();
  const regions = regionsQuery.data?.regions ?? [];
  const [filter, setFilter] = useState("");
  const [activeCode, setActiveCode] = useState(null);

  useEffect(() => {
    if (!activeCode && regions.length) {
      setActiveCode(regions[0].code);
    }
  }, [regions, activeCode]);

  const filtered = regions.filter((r) => {
    if (!filter.trim()) return true;
    const q = filter.trim().toLowerCase();
    return r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q);
  });

  const regionDetail = useAdminRegion(activeCode);

  return (
    <div className="istoki-admin-shell">
      <aside className="istoki-admin-sidebar">
        <div className="istoki-admin-sidebar-head">
          <h1 className="istoki-admin-title">Истоки · Контент</h1>
          <p className="istoki-admin-subtitle">
            {regions.length} регионов · {regions.filter((r) => r.hasContent).length} с контентом
          </p>
          <TabSwitcher tab={tab} setTab={setTab} pendingCount={pendingCount} />
        </div>

        <input
          className="istoki-admin-search"
          type="search"
          placeholder="Поиск по региону…"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />

        {regionsQuery.isLoading ? (
          <div className="istoki-admin-empty">Загрузка…</div>
        ) : regionsQuery.isError ? (
          <div className="istoki-admin-empty">
            Не удалось загрузить регионы
            <div style={{ marginTop: 6, fontSize: 11, opacity: 0.7 }}>
              {regionsQuery.error?.message || "неизвестная ошибка"}
            </div>
          </div>
        ) : regions.length === 0 ? (
          <div className="istoki-admin-empty">
            БД пуста. Запустите <code>npm&nbsp;run&nbsp;db:seed</code>, чтобы засеять 89 регионов.
          </div>
        ) : filtered.length === 0 ? (
          <div className="istoki-admin-empty">Ничего не найдено по запросу</div>
        ) : (
          <ul className="istoki-admin-region-list">
            {filtered.map((region) => (
              <li key={region.code}>
                <button
                  type="button"
                  className="istoki-admin-region-item"
                  data-active={region.code === activeCode ? "true" : "false"}
                  onClick={() => setActiveCode(region.code)}
                >
                  <span className="istoki-admin-region-name">{region.name}</span>
                  <span className="istoki-admin-region-meta">
                    <span
                      className="istoki-admin-region-dot"
                      data-kind={region.hasContent ? "active" : "empty"}
                    />
                    {region.hasContent
                      ? `${region.counts.podcasts}п · ${region.counts.stories}и · ${region.counts.chronicle}л`
                      : "В работе"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <main className="istoki-admin-main">
        {!activeCode ? (
          <div className="istoki-admin-empty-large">Выберите регион слева</div>
        ) : regionDetail.isLoading ? (
          <div className="istoki-admin-empty-large">Загрузка региона…</div>
        ) : regionDetail.isError ? (
          <div className="istoki-admin-empty-large">Ошибка загрузки региона</div>
        ) : regionDetail.data ? (
          <RegionEditor region={regionDetail.data} />
        ) : null}
      </main>
    </div>
  );
}

export default IstokiAdminPage;
