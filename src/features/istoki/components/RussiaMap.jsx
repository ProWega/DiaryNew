// Hardcoded coordinates for the decorative MVP map. Phase C will replace this
// with a TopoJSON-driven full map of all 89 RF subjects.
const REGION_COORDINATES = {
  sevastopol: { cx: 200, cy: 380, labelDx: -8, labelDy: 22, fallbackName: "Севастополь" },
  moscow: { cx: 248, cy: 244, labelDx: 14, labelDy: 4, fallbackName: "Москва" },
  pskov: { cx: 178, cy: 200, labelDx: -10, labelDy: -14, fallbackName: "Псков" },
  spb: { cx: 208, cy: 168, labelDx: 14, labelDy: -2, fallbackName: "Санкт-Петербург" },
  ekaterinburg: { cx: 408, cy: 244, labelDx: 14, labelDy: 4, fallbackName: "Екатеринбург" },
  vladivostok: { cx: 856, cy: 372, labelDx: -10, labelDy: 26, fallbackName: "Владивосток" },
};

const RUSSIA_OUTLINE =
  "M 64 220 C 90 180 130 140 178 132 C 220 122 254 132 280 156 C 296 134 326 120 366 130 C 410 138 446 154 478 170 C 510 188 548 196 590 192 C 632 184 672 168 712 178 C 762 188 808 200 854 224 C 902 248 936 270 950 290 C 940 282 906 290 870 308 C 850 318 854 332 880 358 C 902 382 902 396 880 412 C 850 432 822 432 786 422 C 752 414 730 410 706 422 C 686 434 668 444 640 436 C 612 428 596 410 568 408 C 528 406 488 416 446 408 C 408 402 376 388 348 376 C 318 364 282 364 246 380 C 218 392 196 408 168 410 C 132 412 102 392 80 358 C 64 332 56 296 60 264 C 62 244 62 232 64 220 Z";

function RussiaMap({ activeCode, onRegionSelect, regions = [], isLoading = false }) {
  const regionsByCode = new Map(regions.map((r) => [r.code, r]));

  const points = Object.entries(REGION_COORDINATES).map(([code, coords]) => {
    const data = regionsByCode.get(code);
    const empty = !data?.hasContent;
    const name = data?.name || coords.fallbackName;
    return { code, ...coords, empty, name };
  });

  function handleClick(event) {
    const target = event.target.closest("[data-region-code]");
    if (!target) return;
    if (target.dataset.empty === "true") return;
    onRegionSelect(target.dataset.regionCode);
  }

  function handleKey(event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    const target = event.target.closest("[data-region-code]");
    if (!target) return;
    if (target.dataset.empty === "true") return;
    event.preventDefault();
    onRegionSelect(target.dataset.regionCode);
  }

  return (
    <div className="istoki-map-wrap" data-loading={isLoading ? "true" : "false"}>
      <svg
        className="istoki-map"
        viewBox="0 0 1000 500"
        role="img"
        aria-label="Карта регионов России"
        onClick={handleClick}
        onKeyDown={handleKey}
      >
        <path
          d={RUSSIA_OUTLINE}
          fill="rgba(229, 213, 184, 0.04)"
          stroke="rgba(229, 213, 184, 0.22)"
          strokeWidth="1.5"
        />

        {points.map((region) => {
          const isActive = region.code === activeCode;
          const r = region.empty ? 7 : 9;
          return (
            <g key={region.code}>
              <path
                d={`M ${region.cx - r} ${region.cy} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0`}
                data-region-code={region.code}
                data-region-name={region.name}
                data-empty={region.empty ? "true" : "false"}
                data-active={isActive ? "true" : "false"}
                role={region.empty ? "img" : "button"}
                tabIndex={region.empty ? -1 : 0}
                aria-label={
                  region.empty
                    ? `${region.name} — портал ещё не открыт`
                    : `${region.name} — открыть портал региона`
                }
                aria-pressed={isActive}
              />
              <text
                className={region.empty ? "istoki-map-pin istoki-map-pin-empty" : "istoki-map-pin"}
                x={region.cx + region.labelDx}
                y={region.cy + region.labelDy}
                textAnchor={region.labelDx < 0 ? "end" : "start"}
              >
                {region.name}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="istoki-map-legend">
        <span>
          <span className="istoki-map-legend-dot" data-kind="active" />
          Регион с открытым порталом
        </span>
        <span>
          <span className="istoki-map-legend-dot" data-kind="empty" />
          Архив в работе
        </span>
      </div>
    </div>
  );
}

export default RussiaMap;
