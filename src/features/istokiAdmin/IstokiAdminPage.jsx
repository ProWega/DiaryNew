import { useEffect, useState } from "react";
import { useAdminRegion, useAdminRegions } from "./api";
import RegionEditor from "./RegionEditor";
import AnalyticsDashboard from "./AnalyticsDashboard";

function IstokiAdminPage() {
  const regionsQuery = useAdminRegions();
  const regions = regionsQuery.data?.regions ?? [];
  const [filter, setFilter] = useState("");
  const [activeCode, setActiveCode] = useState(null);
  const [tab, setTab] = useState("regions");

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

  if (tab === "analytics") {
    return (
      <div className="istoki-admin-shell">
        <aside className="istoki-admin-sidebar">
          <div className="istoki-admin-sidebar-head">
            <h1 className="istoki-admin-title">Истоки</h1>
            <div className="istoki-admin-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={false}
                className="istoki-admin-tab"
                onClick={() => setTab("regions")}
              >
                Контент
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={true}
                className="istoki-admin-tab"
                onClick={() => setTab("analytics")}
              >
                Аналитика
              </button>
            </div>
          </div>
        </aside>
        <main className="istoki-admin-main">
          <AnalyticsDashboard />
        </main>
      </div>
    );
  }

  return (
    <div className="istoki-admin-shell">
      <aside className="istoki-admin-sidebar">
        <div className="istoki-admin-sidebar-head">
          <h1 className="istoki-admin-title">Истоки · Контент</h1>
          <p className="istoki-admin-subtitle">
            {regions.length} регионов · {regions.filter((r) => r.hasContent).length} с контентом
          </p>
          <div className="istoki-admin-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={true}
              className="istoki-admin-tab"
              onClick={() => setTab("regions")}
            >
              Контент
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={false}
              className="istoki-admin-tab"
              onClick={() => setTab("analytics")}
            >
              Аналитика
            </button>
          </div>
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
