import { asArray, getStateByLevel, formatAverageState, PULSE_DOMAIN } from "./_helpers";
import { formatPercent } from "../../lib/format";

function buildPulseSegments(points) {
  const segments = [];
  let current = [];

  for (const point of points) {
    if (point.value === null) {
      if (current.length) {
        segments.push(current);
        current = [];
      }
      continue;
    }

    current.push(point);
  }

  if (current.length) {
    segments.push(current);
  }

  return segments;
}

function buildPulsePath(points) {
  if (!points.length) {
    return "";
  }

  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`;
  }

  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

export function PulseOfDayChart({ events = [] }) {
  const width = 980;
  const height = 360;
  const margin = { top: 38, right: 34, bottom: 108, left: 56 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const safeEvents = asArray(events);
  const maxIndex = Math.max(safeEvents.length - 1, 1);
  const points = safeEvents.map((event, index) => {
    const value = Number.isFinite(Number(event.averageStateLevel))
      ? Number(event.averageStateLevel)
      : null;
    const x = margin.left + (plotWidth / maxIndex) * index;
    const y =
      value === null
        ? margin.top + plotHeight
        : margin.top +
          ((PULSE_DOMAIN[1] - value) / (PULSE_DOMAIN[1] - PULSE_DOMAIN[0])) * plotHeight;

    return { ...event, value, x, y };
  });
  const segments = buildPulseSegments(points);
  const empty = !points.some((point) => point.value !== null);

  if (!safeEvents.length) {
    return <div className="curator-chart-empty">Нет событий для построения пульса дня.</div>;
  }

  return (
    <div className="curator-pulse-shell">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="curator-pulse-chart"
        role="img"
        aria-label="Пульс дня по событиям группы"
      >
        <rect
          x={margin.left}
          y={margin.top}
          width={plotWidth}
          height={(plotHeight * 2) / 7}
          className="pulse-zone zone-distress"
        />
        <rect
          x={margin.left}
          y={margin.top + (plotHeight * 2) / 7}
          width={plotWidth}
          height={(plotHeight * 3) / 7}
          className="pulse-zone zone-integration"
        />
        <rect
          x={margin.left}
          y={margin.top + (plotHeight * 5) / 7}
          width={plotWidth}
          height={(plotHeight * 2) / 7}
          className="pulse-zone zone-burnout"
        />

        {[0, 1, 2, 3, 4, 5, 6].map((level) => {
          const y =
            margin.top +
            ((PULSE_DOMAIN[1] - level) / (PULSE_DOMAIN[1] - PULSE_DOMAIN[0])) * plotHeight;
          const state = getStateByLevel(level);

          return (
            <g key={level}>
              <line
                x1={margin.left}
                x2={width - margin.right}
                y1={y}
                y2={y}
                className="pulse-grid-line"
              />
              <text x={18} y={y + 4} className="pulse-axis-label">
                {state?.shortLabel || level}
              </text>
            </g>
          );
        })}

        {points.map((point) => (
          <line
            key={`rail-${point.id}`}
            x1={point.x}
            x2={point.x}
            y1={margin.top}
            y2={margin.top + plotHeight}
            className={point.value === null ? "pulse-event-rail is-empty" : "pulse-event-rail"}
          />
        ))}

        {segments.map((segment, index) => (
          <path key={`segment-${index}`} d={buildPulsePath(segment)} className="pulse-line" />
        ))}

        {points.map((point) => {
          const state = getStateByLevel(point.value);
          const radius = 9 + (Number(point.completion || 0) / 100) * 13;
          const hasRisk = Number(point.riskAnswersCount || 0) > 0;
          const hasSharpDelta =
            Number.isFinite(Number(point.deltaFromPrevious)) &&
            Math.abs(Number(point.deltaFromPrevious)) >= 1.5;

          return (
            <g key={point.id} className="pulse-point-group">
              {point.value === null ? (
                <circle cx={point.x} cy={point.y} r="10" className="pulse-point is-empty" />
              ) : (
                <>
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={radius}
                    fill={state?.surface || "#f7f8f3"}
                    stroke={state?.color || "#8eab55"}
                    className={hasRisk ? "pulse-point has-risk" : "pulse-point"}
                  />
                  {hasSharpDelta ? (
                    <path
                      d={`M ${point.x - 8} ${point.y - radius - 12} L ${point.x + 8} ${point.y - radius - 12} L ${point.x} ${point.y - radius - 24} Z`}
                      className={
                        Number(point.deltaFromPrevious) > 0
                          ? "pulse-delta is-up"
                          : "pulse-delta is-down"
                      }
                    />
                  ) : null}
                </>
              )}
              <title>
                {point.title}:{" "}
                {point.value === null
                  ? "нет ответов"
                  : `среднее ${formatAverageState(point.value)}, заполнение ${formatPercent(point.completion)}`}
              </title>
            </g>
          );
        })}

        {points.map((point, index) => (
          <g key={`label-${point.id}`} transform={`translate(${point.x}, ${height - 82})`}>
            <text className="pulse-event-index" textAnchor="middle">
              {index + 1}
            </text>
            <text className="pulse-event-label" textAnchor="middle" y="20">
              {point.title.length > 18 ? `${point.title.slice(0, 18)}…` : point.title}
            </text>
            <text className="pulse-event-meta" textAnchor="middle" y="38">
              {point.completion ? formatPercent(point.completion) : "нет ответов"}
            </text>
          </g>
        ))}
      </svg>

      {empty ? (
        <div className="curator-chart-empty">
          Пульс построен по опубликованной программе, но участники пока не оставили отметок
          состояния.
        </div>
      ) : null}
    </div>
  );
}
