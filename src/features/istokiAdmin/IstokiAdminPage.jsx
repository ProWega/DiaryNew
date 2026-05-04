import { useEffect, useState } from "react";
import { useAdminRegion, useAdminRegions } from "./api";
import RegionEditor from "./RegionEditor";

function IstokiAdminPage() {
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
          <div className="istoki-admin-empty">Не удалось загрузить регионы</div>
        ) : filtered.length === 0 ? (
          <div className="istoki-admin-empty">Ничего не найдено</div>
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
