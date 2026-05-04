import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import RussiaMap from "./components/RussiaMap";
import RegionPortalDrawer from "./components/RegionPortalDrawer";
import { useIstokiRegion, useIstokiRegions } from "./api";

function matchesQuery(region, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return region.name.toLowerCase().includes(q) || region.code.toLowerCase().includes(q);
}

function IstokiMapPage({ deepLink = false }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const params = useParams();
  const navigate = useNavigate();

  const regionsQuery = useIstokiRegions();
  const regions = regionsQuery.data?.regions ?? [];
  const regionCodes = useMemo(() => new Set(regions.map((r) => r.code)), [regions]);

  useEffect(() => {
    if (!deepLink) return;
    const code = params.regionCode;
    if (regionsQuery.isLoading) return;
    if (code && regionCodes.has(code)) {
      navigate(`/istoki/map?region=${code}`, { replace: true });
    } else {
      navigate("/istoki/map", { replace: true });
    }
  }, [deepLink, params.regionCode, navigate, regionsQuery.isLoading, regionCodes]);

  const activeCode = searchParams.get("region");
  const regionDetailQuery = useIstokiRegion(activeCode);
  const activeRegion = regionDetailQuery.data ?? null;

  // ── Search & filter state, mirrored to URL for shareability ────────
  const queryParam = searchParams.get("q") ?? "";
  const onlyContent = searchParams.get("filter") === "content";
  const [highlightCode, setHighlightCode] = useState(null);
  const highlightTimer = useRef(null);

  function updateParams(next) {
    setSearchParams(
      (prev) => {
        const out = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(next)) {
          if (value === null || value === "" || value === false) {
            out.delete(key);
          } else {
            out.set(key, String(value));
          }
        }
        return out;
      },
      { replace: true },
    );
  }

  // Whenever the search text changes, surface the first matching region
  // by lighting it up for 2.5s. Triggered only on q changes, not on every
  // render — and the region must actually have content, otherwise the
  // map keeps it dimmed and we'd be highlighting an unclickable shape.
  useEffect(() => {
    if (!queryParam.trim() || !regions.length) {
      setHighlightCode(null);
      return undefined;
    }
    const match = regions.find((r) => r.hasContent && matchesQuery(r, queryParam));
    if (!match) {
      setHighlightCode(null);
      return undefined;
    }
    setHighlightCode(match.code);
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setHighlightCode(null), 2500);
    return () => {
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryParam, regions.length]);

  const filteredRegions = useMemo(() => {
    return regions.filter((r) => {
      if (!matchesQuery(r, queryParam)) return false;
      if (onlyContent && !r.hasContent) return false;
      return true;
    });
  }, [regions, queryParam, onlyContent]);

  const visibleCount = filteredRegions.length;
  const populatedCount = filteredRegions.filter((r) => r.hasContent).length;

  function handleSelect(code) {
    updateParams({ region: code });
  }

  function handleClose() {
    updateParams({ region: null });
  }

  return (
    <main>
      <section className="istoki-hero">
        <span className="istoki-hero-eyebrow">Голоса регионов</span>
        <h1 className="istoki-hero-title">
          Карта <em>истóков</em>
        </h1>
        <p className="istoki-hero-lead">
          Это не статистика присутствия – это живой архив человеческого опыта. Выберите регион,
          чтобы услышать голоса участников, прочитать истории жизненных изменений и увидеть летопись
          заездов, которая там состоялась.
        </p>
      </section>

      <div className="istoki-search-bar" role="search">
        <label className="istoki-search-input-wrap">
          <span className="istoki-search-icon" aria-hidden="true">
            ⌕
          </span>
          <input
            type="search"
            className="istoki-search-input"
            placeholder="Найти регион…"
            value={queryParam}
            onChange={(event) => updateParams({ q: event.target.value })}
            aria-label="Поиск региона по названию"
          />
          {queryParam && (
            <button
              type="button"
              className="istoki-search-clear"
              onClick={() => updateParams({ q: null })}
              aria-label="Очистить поиск"
            >
              ×
            </button>
          )}
        </label>
        <label className="istoki-search-toggle">
          <input
            type="checkbox"
            checked={onlyContent}
            onChange={(event) => updateParams({ filter: event.target.checked ? "content" : null })}
          />
          <span>Только с контентом</span>
        </label>
        <div className="istoki-search-summary">
          {queryParam || onlyContent ? (
            <>
              Найдено <strong>{visibleCount}</strong> · из них с контентом{" "}
              <strong>{populatedCount}</strong>
            </>
          ) : (
            <>89 субъектов · 3 с контентом</>
          )}
        </div>
      </div>

      {regionsQuery.isError ? (
        <div className="istoki-empty" style={{ padding: "60px 16px" }}>
          Не удалось загрузить регионы. Попробуйте обновить страницу.
        </div>
      ) : (
        <RussiaMap
          activeCode={activeCode}
          highlightCode={highlightCode}
          onRegionSelect={handleSelect}
          regions={filteredRegions}
          isLoading={regionsQuery.isLoading}
        />
      )}

      {activeCode && activeRegion && (
        <RegionPortalDrawer region={activeRegion} onClose={handleClose} />
      )}
    </main>
  );
}

export default IstokiMapPage;
