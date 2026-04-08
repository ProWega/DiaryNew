import { stateScale } from "../data/mockData";

const stateByLevel = Object.fromEntries(
  stateScale.map((item) => [item.level, item]),
);

function clampValue(level) {
  if (!Number.isFinite(level)) {
    return 0;
  }

  return Math.max(0, Math.min(level, stateScale.length - 1));
}

function getChartPoints(values, width, height, paddingX, paddingY) {
  const effectiveWidth = width - paddingX * 2;
  const effectiveHeight = height - paddingY * 2;
  const stepX = values.length > 1 ? effectiveWidth / (values.length - 1) : 0;

  return values.map((value, index) => ({
    x: paddingX + index * stepX,
    y:
      paddingY +
      ((stateScale.length - 1 - clampValue(value)) / (stateScale.length - 1)) *
        effectiveHeight,
    raw: value,
    state: stateByLevel[Math.round(clampValue(value))],
  }));
}

function buildPath(points) {
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
    const midpointX = (previous.x + current.x) / 2;

    path += ` Q ${midpointX} ${previous.y}, ${current.x} ${current.y}`;
  }

  return path;
}

export function EmotionLineChart({
  values,
  labels,
  title,
  compact = false,
  bands = true,
}) {
  const width = 760;
  const height = compact ? 150 : 260;
  const paddingX = compact ? 18 : 24;
  const paddingY = compact ? 18 : 24;
  const points = getChartPoints(values, width, height, paddingX, paddingY);
  const path = buildPath(points);

  return (
    <div className={`chart-frame ${compact ? "is-compact" : ""}`}>
      {title ? (
        <div className="chart-header">
          <div>
            <h3>{title}</h3>
            {!compact ? (
              <p>Ось Y отражает уровень активации по шкале состояний.</p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="chart-svg-wrap">
        <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" role="img">
          <defs>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#8dd8e8" />
              <stop offset="45%" stopColor="#b8e26f" />
              <stop offset="100%" stopColor="#ffb46b" />
            </linearGradient>
          </defs>

          {bands
            ? stateScale.map((state) => {
                const bandHeight =
                  (height - paddingY * 2) / (stateScale.length - 1);
                const y =
                  paddingY +
                  ((stateScale.length - 1 - state.level) /
                    (stateScale.length - 1)) *
                    (height - paddingY * 2) -
                  bandHeight / 2;

                return (
                  <rect
                    key={state.id}
                    x={paddingX}
                    y={Math.max(0, y)}
                    width={width - paddingX * 2}
                    height={bandHeight}
                    fill={state.surface}
                    opacity={0.55}
                    rx="16"
                  />
                );
              })
            : null}

          {stateScale.map((state) => {
            const y =
              paddingY +
              ((stateScale.length - 1 - state.level) / (stateScale.length - 1)) *
                (height - paddingY * 2);

            return (
              <g key={`grid-${state.id}`}>
                <line
                  x1={paddingX}
                  x2={width - paddingX}
                  y1={y}
                  y2={y}
                  stroke="rgba(64, 72, 80, 0.12)"
                  strokeDasharray="5 8"
                />
                {!compact ? (
                  <text
                    x={12}
                    y={y + 4}
                    fontSize="11"
                    fill="rgba(49, 59, 66, 0.64)"
                  >
                    {state.shortLabel}
                  </text>
                ) : null}
              </g>
            );
          })}

          <path
            d={path}
            fill="none"
            stroke="url(#lineGradient)"
            strokeWidth={compact ? 4 : 5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {points.map((point, index) => (
            <g key={`point-${labels[index]}-${index}`}>
              <circle
                cx={point.x}
                cy={point.y}
                r={compact ? 6.5 : 11}
                fill={point.state.surface}
                stroke={point.state.color}
                strokeWidth={compact ? 2 : 3}
              />
              {!compact ? (
                <text
                  x={point.x}
                  y={point.y + 4}
                  textAnchor="middle"
                  fontSize="12"
                >
                  {point.state.icon}
                </text>
              ) : null}
            </g>
          ))}
        </svg>
      </div>

      <div className={`chart-labels ${compact ? "is-compact" : ""}`}>
        {labels.map((label, index) => (
          <div key={`${label}-${index}`} className="chart-label">
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Sparkline({ values }) {
  const width = 180;
  const height = 56;
  const points = getChartPoints(values, width, height, 8, 8);
  const path = buildPath(points);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="sparkline" aria-hidden="true">
      <path
        d={path}
        fill="none"
        stroke="url(#sparklineGradient)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient id="sparklineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#8dd8e8" />
          <stop offset="50%" stopColor="#b8e26f" />
          <stop offset="100%" stopColor="#ff8a7b" />
        </linearGradient>
      </defs>
      {points.map((point, index) => (
        <circle
          key={`spark-${index}`}
          cx={point.x}
          cy={point.y}
          r="3.5"
          fill={point.state.color}
        />
      ))}
    </svg>
  );
}

export function HeatmapGrid({ columns, rows }) {
  return (
    <div className="heatmap">
      <div
        className="heatmap-grid"
        style={{
          gridTemplateColumns: `180px repeat(${columns.length}, minmax(64px, 1fr))`,
        }}
      >
        <div className="heatmap-corner">Событие / участник</div>
        {columns.map((column) => (
          <div key={column} className="heatmap-column">
            {column}
          </div>
        ))}

        {rows.map((row) => (
          <div key={row.label} className="heatmap-row">
            <div className="heatmap-row-label">{row.label}</div>
            {row.values.map((value, index) => {
              const state = stateByLevel[Math.round(clampValue(value))];

              return (
                <div
                  key={`${row.label}-${index}`}
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
  );
}

export function DistributionBars({ items, total }) {
  return (
    <div className="distribution">
      {items.map((item) => {
        const percentage = total ? Math.round((item.count / total) * 100) : 0;

        return (
          <div key={item.id} className="distribution-item">
            <div className="distribution-head">
              <span className="distribution-name">
                <span
                  className="distribution-swatch"
                  style={{ background: item.color }}
                />
                {item.label}
              </span>
              <strong>{percentage}%</strong>
            </div>
            <div className="distribution-track">
              <div
                className="distribution-fill"
                style={{ width: `${percentage}%`, background: item.color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
