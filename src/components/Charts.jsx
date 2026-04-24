import { useId } from "react";
import { stateScale } from "../data/mockData";

const DEFAULT_PALETTE = [
  "#6fb9c8",
  "#8dbf4f",
  "#f4b84a",
  "#e97864",
  "#8978d4",
  "#3f8f72",
  "#cc7a3f",
];

const DEFAULT_DOMAIN = [0, stateScale.length - 1];
const DEFAULT_MARGIN = { top: 22, right: 28, bottom: 26, left: 30 };
const stateByLevel = Object.fromEntries(stateScale.map((item) => [item.level, item]));

function isFiniteNumber(value) {
  return Number.isFinite(Number(value));
}

function clamp(value, min, max) {
  if (!isFiniteNumber(value)) {
    return min;
  }

  return Math.max(min, Math.min(Number(value), max));
}

function normalizeDomain(domain = DEFAULT_DOMAIN) {
  const min = isFiniteNumber(domain[0]) ? Number(domain[0]) : DEFAULT_DOMAIN[0];
  const max = isFiniteNumber(domain[1]) ? Number(domain[1]) : DEFAULT_DOMAIN[1];
  return min === max ? [min, min + 1] : [Math.min(min, max), Math.max(min, max)];
}

function getAutoDomain(values, fallback = DEFAULT_DOMAIN, includeZero = false) {
  const finiteValues = values.map(Number).filter(Number.isFinite);

  if (!finiteValues.length) {
    return normalizeDomain(fallback);
  }

  const min = Math.min(...finiteValues, includeZero ? 0 : Infinity);
  const max = Math.max(...finiteValues, includeZero ? 0 : -Infinity);
  const padding = Math.max((max - min) * 0.12, 0.4);
  return normalizeDomain([Math.floor((min - padding) * 10) / 10, Math.ceil((max + padding) * 10) / 10]);
}

function getState(value) {
  const level = Math.round(clamp(value, 0, stateScale.length - 1));
  return stateByLevel[level] || stateScale[0];
}

function normalizeData({ data, values = [], labels = [] }) {
  if (Array.isArray(data) && data.length) {
    return data.map((item, index) => ({
      id: item.id ?? `point-${index}`,
      label: item.label ?? labels[index] ?? `#${index + 1}`,
      value: Number(item.value ?? item.y ?? item.count ?? 0),
      group: item.group,
      tone: item.tone,
      color: item.color,
      meta: item.meta ?? {},
      raw: item,
    }));
  }

  return values.map((value, index) => ({
    id: `point-${index}`,
    label: labels[index] ?? `#${index + 1}`,
    value: Number(value),
    group: undefined,
    tone: undefined,
    color: undefined,
    meta: {},
    raw: value,
  }));
}

function normalizeSeries({ series, data, values, labels, palette = DEFAULT_PALETTE }) {
  if (Array.isArray(series) && series.length) {
    return series.map((item, index) => ({
      id: item.id ?? `series-${index}`,
      label: item.label ?? item.name ?? `Серия ${index + 1}`,
      color: item.color ?? palette[index % palette.length],
      data: normalizeData({
        data: item.data,
        values: item.values ?? [],
        labels: item.labels ?? labels ?? [],
      }),
      meta: item.meta ?? {},
    }));
  }

  return [
    {
      id: "series-0",
      label: "Состояние",
      color: palette[0],
      data: normalizeData({ data, values, labels }),
      meta: {},
    },
  ];
}

function getX(index, count, width, margin) {
  if (count <= 1) {
    return width / 2;
  }

  const effectiveWidth = width - margin.left - margin.right;
  return margin.left + index * (effectiveWidth / (count - 1));
}

function getY(value, domain, height, margin) {
  const [min, max] = normalizeDomain(domain);
  const effectiveHeight = height - margin.top - margin.bottom;
  const ratio = (clamp(value, min, max) - min) / (max - min);
  return height - margin.bottom - ratio * effectiveHeight;
}

function getXFromValue(value, domain, width, margin) {
  const [min, max] = normalizeDomain(domain);
  const effectiveWidth = width - margin.left - margin.right;
  const ratio = (clamp(value, min, max) - min) / (max - min);
  return margin.left + ratio * effectiveWidth;
}

function buildPath(points, curve = "smooth") {
  if (points.length === 0) {
    return "";
  }

  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`;
  }

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];

    if (curve === "straight") {
      path += ` L ${current.x} ${current.y}`;
      continue;
    }

    const midpointX = (previous.x + current.x) / 2;
    path += ` Q ${midpointX} ${previous.y}, ${current.x} ${current.y}`;
  }

  return path;
}

function ChartLegend({ items }) {
  if (!items?.length) {
    return null;
  }

  return (
    <div className="chart-legend">
      {items.map((item) => (
        <span key={item.id ?? item.label} className="chart-legend-item">
          <span className="chart-legend-swatch" style={{ background: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function ChartShell({
  title,
  description,
  compact = false,
  empty = false,
  emptyLabel = "Нет данных для отображения",
  legend,
  children,
  className = "",
}) {
  return (
    <div className={`chart-shell chart-frame ${compact ? "is-compact" : ""} ${className}`.trim()}>
      {(title || description || legend?.length) ? (
        <div className="chart-toolbar">
          <div className="chart-header">
            {title ? <h3>{title}</h3> : null}
            {description && !compact ? <p>{description}</p> : null}
          </div>
          <ChartLegend items={legend} />
        </div>
      ) : null}
      {empty ? <div className="chart-empty">{emptyLabel}</div> : children}
    </div>
  );
}

function renderGridLines({ ticks, domain, width, height, margin, showGrid }) {
  if (!showGrid) {
    return null;
  }

  return ticks.map((tick) => {
    const y = getY(tick.value, domain, height, margin);
    return (
      <g key={`grid-${tick.value}`}>
        <line
          x1={margin.left}
          x2={width - margin.right}
          y1={y}
          y2={y}
          stroke="rgba(64, 72, 80, 0.12)"
          strokeDasharray="5 8"
        />
        {tick.label ? (
          <text x={8} y={y + 4} fontSize="11" fill="rgba(49, 59, 66, 0.64)">
            {tick.label}
          </text>
        ) : null}
      </g>
    );
  });
}

function renderThresholds({ thresholds = [], domain, width, height, margin }) {
  return thresholds.map((threshold, index) => {
    const y = getY(threshold.value, domain, height, margin);
    return (
      <g key={threshold.id ?? `threshold-${index}`}>
        <line
          x1={margin.left}
          x2={width - margin.right}
          y1={y}
          y2={y}
          stroke={threshold.color ?? "#d97757"}
          strokeDasharray={threshold.dash ?? "8 8"}
          strokeWidth="2"
        />
        {threshold.label ? (
          <text
            x={width - margin.right}
            y={y - 6}
            textAnchor="end"
            fontSize="11"
            fill={threshold.color ?? "#8b4a35"}
          >
            {threshold.label}
          </text>
        ) : null}
      </g>
    );
  });
}

function renderAnnotations({ annotations = [], domain, width, height, margin, xCount }) {
  return annotations.map((annotation, index) => {
    const color = annotation.color ?? "#4f6975";

    if (Number.isFinite(annotation.value)) {
      const y = getY(annotation.value, domain, height, margin);
      return (
        <g key={annotation.id ?? `annotation-y-${index}`}>
          <line x1={margin.left} x2={width - margin.right} y1={y} y2={y} stroke={color} strokeDasharray="3 6" />
          <text x={margin.left + 8} y={y - 6} fontSize="11" fill={color}>
            {annotation.label}
          </text>
        </g>
      );
    }

    if (Number.isFinite(annotation.index)) {
      const x = getX(annotation.index, xCount, width, margin);
      return (
        <g key={annotation.id ?? `annotation-x-${index}`}>
          <line x1={x} x2={x} y1={margin.top} y2={height - margin.bottom} stroke={color} strokeDasharray="3 6" />
          <text x={x + 6} y={margin.top + 12} fontSize="11" fill={color}>
            {annotation.label}
          </text>
        </g>
      );
    }

    return null;
  });
}

export function EmotionLineChart({
  data,
  values = [],
  labels = [],
  series,
  title,
  description = "Ось Y отражает уровень активации по шкале состояний.",
  compact = false,
  bands,
  showBands = bands ?? true,
  showGrid = true,
  showLabels = true,
  showPoints = true,
  showLegend = false,
  emptyLabel = "Нет отметок состояния",
  yDomain = DEFAULT_DOMAIN,
  thresholds = [],
  annotations = [],
  palette = DEFAULT_PALETTE,
  height,
  curve = "smooth",
  onPointClick,
}) {
  const gradientId = useId();
  const width = 760;
  const chartHeight = height ?? (compact ? 150 : 260);
  const margin = compact ? { top: 18, right: 18, bottom: 20, left: 18 } : DEFAULT_MARGIN;
  const normalizedSeries = normalizeSeries({ series, data, values, labels, palette });
  const nonEmptySeries = normalizedSeries.filter((item) => item.data.length);
  const xCount = Math.max(1, ...normalizedSeries.map((item) => item.data.length), labels.length);
  const xLabels = labels.length ? labels : nonEmptySeries[0]?.data.map((item) => item.label) ?? [];
  const domain = normalizeDomain(yDomain);
  const legend = showLegend
    ? normalizedSeries.map((item) => ({ id: item.id, label: item.label, color: item.color }))
    : [];
  const gridTicks = stateScale.map((state) => ({
    value: state.level,
    label: compact ? "" : state.shortLabel,
  }));
  const empty = nonEmptySeries.length === 0;

  return (
    <ChartShell
      title={title}
      description={description}
      compact={compact}
      empty={empty}
      emptyLabel={emptyLabel}
      legend={legend}
    >
      <div className="chart-svg-wrap">
        <svg
          viewBox={`0 0 ${width} ${chartHeight}`}
          className="chart-svg"
          role="img"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={palette[0]} />
              <stop offset="45%" stopColor={palette[1] ?? palette[0]} />
              <stop offset="100%" stopColor={palette[2] ?? palette[0]} />
            </linearGradient>
          </defs>

          {showBands
            ? stateScale.map((state) => {
                const top = getY(state.level + 0.5, domain, chartHeight, margin);
                const bottom = getY(state.level - 0.5, domain, chartHeight, margin);
                const y = Math.min(top, bottom);
                const bandHeight = Math.abs(bottom - top);

                return (
                  <rect
                    key={state.id}
                    x={margin.left}
                    y={Math.max(margin.top, y)}
                    width={width - margin.left - margin.right}
                    height={Math.max(4, bandHeight)}
                    fill={state.surface}
                    opacity={0.52}
                    rx="16"
                  />
                );
              })
            : null}

          {renderGridLines({ ticks: gridTicks, domain, width, height: chartHeight, margin, showGrid })}
          {renderThresholds({ thresholds, domain, width, height: chartHeight, margin })}
          {renderAnnotations({ annotations, domain, width, height: chartHeight, margin, xCount })}

          {normalizedSeries.map((item, seriesIndex) => {
            const points = item.data.map((point, index) => ({
              ...point,
              x: getX(index, xCount, width, margin),
              y: getY(point.value, domain, chartHeight, margin),
              state: getState(point.value),
            }));
            const path = buildPath(points, curve);

            return (
              <g key={item.id}>
                {path ? (
                  <path
                    d={path}
                    fill="none"
                    stroke={series ? item.color : `url(#${gradientId})`}
                    strokeWidth={compact ? 4 : 5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={seriesIndex > 0 ? 0.82 : 1}
                  />
                ) : null}

                {showPoints
                  ? points.map((point, pointIndex) => (
                      <g
                        key={`${item.id}-${point.id}`}
                        className={onPointClick ? "chart-click-target" : ""}
                        onClick={() => onPointClick?.(point, item)}
                      >
                        <circle
                          cx={point.x}
                          cy={point.y}
                          r={compact ? 6 : 10}
                          fill={point.color ?? point.state.surface}
                          stroke={series ? item.color : point.state.color}
                          strokeWidth={compact ? 2 : 3}
                        />
                        {!compact && !series ? (
                          <text x={point.x} y={point.y + 4} textAnchor="middle" fontSize="12">
                            {point.state.icon}
                          </text>
                        ) : null}
                        {!compact && point.meta?.flag ? (
                          <text x={point.x + 12} y={point.y - 10} fontSize="13">
                            {point.meta.flag}
                          </text>
                        ) : null}
                        <title>
                          {item.label}: {point.label} — {point.value}
                        </title>
                      </g>
                    ))
                  : null}
              </g>
            );
          })}
        </svg>
      </div>

      {showLabels ? (
        <div className={`chart-labels ${compact ? "is-compact" : ""}`}>
          {xLabels.map((label, index) => (
            <div key={`${label}-${index}`} className="chart-label">
              <span>{label}</span>
            </div>
          ))}
        </div>
      ) : null}
    </ChartShell>
  );
}

export function MultiLineTrendChart(props) {
  return (
    <EmotionLineChart
      showBands={false}
      showLegend
      description="Сравнение нескольких траекторий по общей шкале."
      {...props}
    />
  );
}

export function Sparkline({
  data,
  values = [],
  color = "#6fb9c8",
  height = 56,
  width = 180,
  strokeWidth = 3,
  showPoints = true,
  yDomain,
}) {
  const pointsData = normalizeData({ data, values });
  const domain = normalizeDomain(yDomain ?? getAutoDomain(pointsData.map((item) => item.value), DEFAULT_DOMAIN));
  const margin = { top: 8, right: 8, bottom: 8, left: 8 };
  const points = pointsData.map((point, index) => ({
    ...point,
    x: getX(index, Math.max(1, pointsData.length), width, margin),
    y: getY(point.value, domain, height, margin),
  }));
  const path = buildPath(points);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="sparkline" aria-hidden="true">
      {path ? (
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      {showPoints
        ? points.map((point, index) => (
            <circle key={`spark-${index}`} cx={point.x} cy={point.y} r="3.5" fill={color} />
          ))
        : null}
    </svg>
  );
}

export function HeatmapGrid({
  columns = [],
  rows = [],
  title,
  description,
  showLegend = false,
  emptyLabel = "Нет данных для тепловой карты",
}) {
  const safeColumns = columns.length ? columns : [];
  const safeRows = rows.length ? rows : [];
  const empty = !safeColumns.length || !safeRows.length;

  return (
    <ChartShell
      title={title}
      description={description}
      empty={empty}
      emptyLabel={emptyLabel}
      legend={showLegend ? stateScale.map((state) => ({ id: state.id, label: state.label, color: state.color })) : []}
    >
      <div className="heatmap">
        <div
          className="heatmap-grid"
          style={{
            gridTemplateColumns: `minmax(112px, 180px) repeat(${safeColumns.length}, minmax(82px, 1fr))`,
          }}
        >
          <div className="heatmap-corner">Событие / группа</div>
          {safeColumns.map((column) => (
            <div key={column} className="heatmap-column">
              {column}
            </div>
          ))}

          {safeRows.map((row) => (
            <div key={row.label} className="heatmap-row">
              <div className="heatmap-row-label">{row.label}</div>
              {safeColumns.map((column, index) => {
                const value = row.values[index];

                if (value === undefined) {
                  return (
                    <div key={`${row.label}-${column}`} className="heatmap-cell is-empty">
                      <span>·</span>
                      <strong>Нет данных</strong>
                    </div>
                  );
                }

                const state = getState(value);

                return (
                  <div
                    key={`${row.label}-${column}`}
                    className="heatmap-cell"
                    style={{
                      background: state.surface,
                      borderColor: state.color,
                      color: state.textColor,
                    }}
                  >
                    <span>{state.icon}</span>
                    <strong>{state.label}</strong>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </ChartShell>
  );
}

export function DistributionBars({
  items = [],
  total,
  title,
  description,
  emptyLabel = "Нет данных распределения",
  showValues = true,
}) {
  const computedTotal = total ?? items.reduce((sum, item) => sum + Number(item.count ?? item.value ?? 0), 0);

  return (
    <ChartShell title={title} description={description} empty={!items.length} emptyLabel={emptyLabel}>
      <div className="distribution">
        {items.map((item) => {
          const count = Number(item.count ?? item.value ?? 0);
          const percentage = computedTotal ? Math.round((count / computedTotal) * 100) : 0;

          return (
            <div key={item.id} className="distribution-item">
              <div className="distribution-head">
                <span className="distribution-name">
                  <span className="distribution-swatch" style={{ background: item.color }} />
                  {item.label}
                </span>
                {showValues ? <strong>{percentage}%</strong> : null}
              </div>
              <div className="distribution-track">
                <div className="distribution-fill" style={{ width: `${percentage}%`, background: item.color }} />
              </div>
            </div>
          );
        })}
      </div>
    </ChartShell>
  );
}

export function EventImpactBarChart({
  data,
  values = [],
  labels = [],
  title,
  description = "Положительные значения показывают рост состояния, отрицательные — просадку.",
  height = 260,
  showGrid = true,
  showLabels = true,
  showValues = true,
  emptyLabel = "Нет данных по эффекту мероприятий",
  yDomain,
  positiveColor = "#7dae42",
  negativeColor = "#df765f",
  neutralColor = "#90a4ae",
}) {
  const items = normalizeData({ data, values, labels });
  const width = 760;
  const margin = { top: 24, right: 24, bottom: 34, left: 34 };
  const domain = normalizeDomain(yDomain ?? getAutoDomain(items.map((item) => item.value), [-2, 2], true));
  const zeroY = getY(0, domain, height, margin);
  const bandWidth = (width - margin.left - margin.right) / Math.max(items.length, 1);
  const barWidth = Math.max(18, Math.min(72, bandWidth - 18));

  return (
    <ChartShell title={title} description={description} empty={!items.length} emptyLabel={emptyLabel}>
      <div className="chart-svg-wrap">
        <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" role="img" preserveAspectRatio="xMidYMid meet">
          {renderGridLines({
            ticks: [domain[0], 0, domain[1]].map((value) => ({ value, label: String(value) })),
            domain,
            width,
            height,
            margin,
            showGrid,
          })}
          <line x1={margin.left} x2={width - margin.right} y1={zeroY} y2={zeroY} stroke="rgba(45,55,65,.42)" strokeWidth="2" />
          {items.map((item, index) => {
            const x = margin.left + index * bandWidth + bandWidth / 2 - barWidth / 2;
            const y = getY(item.value, domain, height, margin);
            const fill = item.color ?? (item.value > 0 ? positiveColor : item.value < 0 ? negativeColor : neutralColor);
            const rectY = Math.min(y, zeroY);
            const rectHeight = Math.max(3, Math.abs(zeroY - y));

            return (
              <g key={item.id}>
                <rect x={x} y={rectY} width={barWidth} height={rectHeight} rx="10" fill={fill} />
                {showValues ? (
                  <text x={x + barWidth / 2} y={item.value >= 0 ? rectY - 8 : rectY + rectHeight + 16} textAnchor="middle" fontSize="12" fill={fill}>
                    {item.value > 0 ? "+" : ""}
                    {item.value}
                  </text>
                ) : null}
                <title>
                  {item.label}: {item.value}
                </title>
              </g>
            );
          })}
        </svg>
      </div>
      {showLabels ? (
        <div className="chart-labels">
          {items.map((item) => (
            <div key={item.id} className="chart-label">
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      ) : null}
    </ChartShell>
  );
}

export function DeltaBars(props) {
  return (
    <EventImpactBarChart
      title="Резкие переходы"
      description="Изменение состояния относительно предыдущего события."
      {...props}
    />
  );
}

export function StackedDistributionChart({
  rows = [],
  title,
  description = "Доли состояний внутри группы или дня.",
  height,
  showLegend = true,
  emptyLabel = "Нет данных распределения",
}) {
  const width = 760;
  const rowHeight = 54;
  const chartHeight = height ?? Math.max(160, rows.length * rowHeight + 40);
  const margin = { top: 18, right: 24, bottom: 18, left: 170 };
  const segmentMap = new Map();

  rows.forEach((row) => {
    const rowSegments = row.segments ?? [];
    rowSegments.forEach((segment) => {
      if (!segmentMap.has(segment.id)) {
        segmentMap.set(segment.id, {
          id: segment.id,
          label: segment.label,
          color: segment.color,
        });
      }
    });
  });

  const legend = showLegend ? Array.from(segmentMap.values()) : [];

  return (
    <ChartShell title={title} description={description} empty={!rows.length} emptyLabel={emptyLabel} legend={legend}>
      <div className="chart-svg-wrap">
        <svg viewBox={`0 0 ${width} ${chartHeight}`} className="chart-svg" role="img" preserveAspectRatio="xMidYMid meet">
          {rows.map((row, rowIndex) => {
            const y = margin.top + rowIndex * rowHeight;
            const segments = row.segments ?? [];
            const total = row.total ?? segments.reduce((sum, segment) => sum + Number(segment.value ?? 0), 0);
            let offset = margin.left;
            const barWidth = width - margin.left - margin.right;

            return (
              <g key={row.id ?? row.label}>
                <text x={12} y={y + 28} fontSize="12" fill="rgba(49, 59, 66, 0.74)">
                  {row.label}
                </text>
                <rect x={margin.left} y={y + 8} width={barWidth} height="28" rx="14" fill="rgba(71,81,91,.08)" />
                {segments.map((segment, index) => {
                  const percentage = total ? Number(segment.value ?? 0) / total : 0;
                  const widthValue = barWidth * percentage;
                  const rect = (
                    <rect
                      key={segment.id}
                      x={offset}
                      y={y + 8}
                      width={widthValue}
                      height="28"
                      rx={index === 0 || index === segments.length - 1 ? 14 : 0}
                      fill={segment.color}
                    />
                  );
                  offset += widthValue;
                  return rect;
                })}
                <text x={width - margin.right} y={y + 28} textAnchor="end" fontSize="12" fill="rgba(49, 59, 66, 0.64)">
                  {total}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </ChartShell>
  );
}

export function RiskScatterChart({
  data = [],
  title,
  description = "Каждая точка — участник или группа. X: средняя активация, Y: амплитуда дня.",
  height = 300,
  xDomain,
  yDomain,
  xLabel = "Средняя активация",
  yLabel = "Амплитуда",
  showGrid = true,
  emptyLabel = "Нет данных риска",
  thresholds = [],
  palette = DEFAULT_PALETTE,
  selectedId,
  onPointClick,
  onClearSelection,
}) {
  const width = 760;
  const margin = { top: 24, right: 28, bottom: 44, left: 46 };
  const xValues = data.map((item) => Number(item.x ?? item.avgActivation ?? 0));
  const yValues = data.map((item) => Number(item.y ?? item.amplitude ?? 0));
  const resolvedXDomain = normalizeDomain(xDomain ?? getAutoDomain(xValues, DEFAULT_DOMAIN));
  const resolvedYDomain = normalizeDomain(yDomain ?? getAutoDomain(yValues, [0, 4], true));
  const ticks = [resolvedYDomain[0], (resolvedYDomain[0] + resolvedYDomain[1]) / 2, resolvedYDomain[1]].map((value) => ({
    value,
    label: value.toFixed(1),
  }));

  return (
    <ChartShell title={title} description={description} empty={!data.length} emptyLabel={emptyLabel}>
      <div className="chart-svg-wrap">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="chart-svg"
          role="img"
          preserveAspectRatio="xMidYMid meet"
          onClick={() => onClearSelection?.()}
        >
          {renderGridLines({ ticks, domain: resolvedYDomain, width, height, margin, showGrid })}
          {renderThresholds({ thresholds, domain: resolvedYDomain, width, height, margin })}
          <line x1={margin.left} x2={width - margin.right} y1={height - margin.bottom} y2={height - margin.bottom} stroke="rgba(45,55,65,.34)" />
          <line x1={margin.left} x2={margin.left} y1={margin.top} y2={height - margin.bottom} stroke="rgba(45,55,65,.34)" />
          <text x={width / 2} y={height - 8} textAnchor="middle" className="chart-axis-label">
            {xLabel}
          </text>
          <text x={14} y={height / 2} textAnchor="middle" transform={`rotate(-90 14 ${height / 2})`} className="chart-axis-label">
            {yLabel}
          </text>

          {data.map((item, index) => {
            const xValue = Number(item.x ?? item.avgActivation ?? 0);
            const yValue = Number(item.y ?? item.amplitude ?? 0);
            const size = Number(item.size ?? item.jumps ?? 1);
            const x = getXFromValue(xValue, resolvedXDomain, width, margin);
            const y = getY(yValue, resolvedYDomain, height, margin);
            const color = item.color ?? palette[index % palette.length];
            const radius = clamp(6 + Math.sqrt(Math.max(size, 0)) * 2.4, 6, 22);
            const isSelected = selectedId !== undefined && selectedId !== null && selectedId === (item.id ?? item.label);
            const calloutLabel = String(item.label ?? "");
            const visibleCalloutLabel = calloutLabel.length > 26 ? `${calloutLabel.slice(0, 25)}…` : calloutLabel;
            const calloutWidth = clamp(visibleCalloutLabel.length * 7 + 24, 104, 220);
            const calloutHeight = 30;
            const calloutX = clamp(x - calloutWidth / 2, 8, width - calloutWidth - 8);
            const calloutY = y - radius - 42 < 8 ? y + radius + 12 : y - radius - 42;

            return (
              <g
                key={item.id ?? item.label}
                className={`${onPointClick ? "chart-click-target" : ""} ${isSelected ? "is-selected" : ""}`.trim()}
                onClick={(event) => {
                  event.stopPropagation();
                  onPointClick?.(item);
                }}
              >
                <circle cx={x} cy={y} r={Math.max(radius + 10, 26)} fill="transparent" />
                <circle cx={x} cy={y} r={radius} fill={color} opacity="0.78" stroke="rgba(255,255,255,.9)" strokeWidth="2" />
                <text x={x} y={y + 4} textAnchor="middle" fontSize="10" fill="#22313a">
                  {item.shortLabel ?? index + 1}
                </text>
                {isSelected ? (
                  <g className="chart-point-callout" pointerEvents="none">
                    <rect x={calloutX} y={calloutY} width={calloutWidth} height={calloutHeight} rx="15" />
                    <text x={calloutX + calloutWidth / 2} y={calloutY + 20} textAnchor="middle">
                      {visibleCalloutLabel}
                    </text>
                  </g>
                ) : null}
                <title>
                  {item.label}: {xLabel} {xValue}, {yLabel} {yValue}
                </title>
              </g>
            );
          })}
        </svg>
      </div>
    </ChartShell>
  );
}

export const chartPalette = DEFAULT_PALETTE;
