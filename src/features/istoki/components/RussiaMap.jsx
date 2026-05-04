import { useEffect, useState } from "react";
import RF_REGISTRY from "../../../../server/seed/data/istoki-rf-subjects.json";

const REGISTRY_BY_NAME = new Map(RF_REGISTRY.map((entry) => [entry.name, entry]));
const TOTAL_SUBJECTS = RF_REGISTRY.length;
const PATHS_URL = "/istoki/russia-paths.json";

// Brand palette mirrors src/styles/tokens.css :154-183. Inlined so we don't
// fight CSS specificity on the data-driven attributes used by Playwright.
const FILL_DIM = "rgba(79, 87, 89, 0.32)";
const STROKE_DIM = "rgba(79, 87, 89, 0.55)";
const FILL_BASE = "rgba(229, 213, 184, 0.18)";
const STROKE_BASE = "rgba(229, 213, 184, 0.35)";
const FILL_HOVER = "#9a7a32"; // --istoki-gold
const FILL_ACTIVE = "#c95c36"; // --istoki-terracotta
const STROKE_HIGHLIGHT = "#e5d5b8"; // --istoki-sand

function fillFor({ empty, isActive, hovered }) {
  if (isActive) return FILL_ACTIVE;
  if (empty) return FILL_DIM;
  return hovered ? FILL_HOVER : FILL_BASE;
}

function strokeFor({ empty, isActive, hovered }) {
  if (empty) return STROKE_DIM;
  if (isActive || hovered) return STROKE_HIGHLIGHT;
  return STROKE_BASE;
}

function RussiaMap({ activeCode, onRegionSelect, regions = [], isLoading = false }) {
  const [paths, setPaths] = useState(null);
  const [pathsError, setPathsError] = useState(false);
  const [tooltip, setTooltip] = useState(null);
  const [hoveredKey, setHoveredKey] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(PATHS_URL)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => {
        if (!cancelled) setPaths(data);
      })
      .catch(() => {
        if (!cancelled) setPathsError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const regionsByCode = new Map(regions.map((region) => [region.code, region]));
  const populatedCount = regions.filter((region) => region.hasContent).length;
  const dimmedCount = Math.max(TOTAL_SUBJECTS - populatedCount, 0);

  function attemptSelect(meta) {
    if (!meta) return;
    const region = regionsByCode.get(meta.code);
    if (!region?.hasContent) return;
    onRegionSelect(meta.code);
  }

  function handleMove(event) {
    setTooltip((prev) => (prev ? { ...prev, x: event.clientX, y: event.clientY } : prev));
  }

  if (pathsError) {
    return (
      <div className="istoki-map-wrap">
        <div className="istoki-empty" style={{ padding: "60px 16px" }}>
          Не удалось загрузить геоданные карты. Попробуйте обновить страницу.
        </div>
      </div>
    );
  }

  return (
    <div
      className="istoki-map-wrap"
      data-loading={isLoading || !paths ? "true" : "false"}
      onMouseMove={handleMove}
    >
      <svg
        className="istoki-map"
        viewBox={`0 0 ${paths?.width ?? 1000} ${paths?.height ?? 500}`}
        role="img"
        aria-label="Карта регионов России"
      >
        {paths?.features.map((feature, index) => {
          const meta = REGISTRY_BY_NAME.get(feature.name);
          const region = meta ? regionsByCode.get(meta.code) : null;
          const empty = !region?.hasContent;
          const isActive = Boolean(meta?.code) && meta.code === activeCode;
          const key = `${feature.name}-${index}`;
          const hovered = hoveredKey === key;
          return (
            <path
              key={key}
              d={feature.d}
              data-region-code={meta?.code || ""}
              data-region-name={feature.name}
              data-empty={empty ? "true" : "false"}
              data-active={isActive ? "true" : "false"}
              role={empty ? "img" : "button"}
              tabIndex={empty ? -1 : 0}
              aria-label={
                empty
                  ? `${feature.name} — портал ещё не открыт`
                  : `${feature.name} — открыть портал региона`
              }
              aria-pressed={isActive}
              fill={fillFor({ empty, isActive, hovered })}
              stroke={strokeFor({ empty, isActive, hovered })}
              strokeWidth={isActive ? 1.6 : hovered ? 1.4 : 0.9}
              style={{
                cursor: empty ? "default" : "pointer",
                outline: "none",
                transition: "fill 200ms ease, stroke 200ms ease",
              }}
              onClick={() => attemptSelect(meta)}
              onMouseEnter={(event) => {
                setHoveredKey(key);
                setTooltip({
                  x: event.clientX,
                  y: event.clientY,
                  name: feature.name,
                  hasContent: !empty,
                });
              }}
              onMouseLeave={() => {
                setHoveredKey(null);
                setTooltip(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  attemptSelect(meta);
                }
              }}
            />
          );
        })}
      </svg>

      {tooltip && (
        <div className="istoki-map-tooltip" style={{ left: tooltip.x + 14, top: tooltip.y + 14 }}>
          <span className="istoki-map-tooltip-name">{tooltip.name}</span>
          <span className="istoki-map-tooltip-status">
            {tooltip.hasContent ? "Открыть портал" : "Архив в работе"}
          </span>
        </div>
      )}

      <div className="istoki-map-legend">
        <span>
          <span className="istoki-map-legend-dot" data-kind="active" />
          {populatedCount} с контентом
        </span>
        <span>
          <span className="istoki-map-legend-dot" data-kind="empty" />
          {dimmedCount} в работе
        </span>
      </div>
    </div>
  );
}

export default RussiaMap;
