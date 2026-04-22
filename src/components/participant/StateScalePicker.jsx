import { useId, useMemo } from "react";
import { STATE_SCALE_ZONES, normalizeStateScale } from "../../data/stateScaleModel";

const ARC_START = 225;
const ARC_END = 495;
const ARC_CENTER = { x: 180, y: 178 };
const ARC_RADIUS = 126;
const ARC_BUTTON_RADIUS = 94;
const VALID_VARIANTS = new Set(["arc", "zones", "compact"]);

function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;

  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

function describeArc(centerX, centerY, radius, startAngle, endAngle) {
  const start = polarToCartesian(centerX, centerY, radius, endAngle);
  const end = polarToCartesian(centerX, centerY, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  return [
    "M",
    start.x,
    start.y,
    "A",
    radius,
    radius,
    0,
    largeArcFlag,
    0,
    end.x,
    end.y,
  ].join(" ");
}

function getArcAngle(index, total) {
  if (total <= 1) {
    return (ARC_START + ARC_END) / 2;
  }

  return ARC_START + ((ARC_END - ARC_START) / (total - 1)) * index;
}

function getOptionAriaLabel(state) {
  return [state.shortLabel || state.label, state.zoneLabel, state.participantHint || state.description]
    .filter(Boolean)
    .join(". ");
}

function findLastZoneStateIndex(states, zoneId) {
  for (let index = states.length - 1; index >= 0; index -= 1) {
    if (states[index].zone === zoneId) {
      return index;
    }
  }

  return -1;
}

function StateScalePicker({
  value,
  onChange,
  states = [],
  variant = "arc",
  animated = true,
  disabled = false,
  showDescriptions = true,
  label = "Шкала состояния",
}) {
  const generatedId = useId();
  const titleId = `${generatedId}-label`;
  const normalizedStates = useMemo(() => normalizeStateScale(states), [states]);
  const zoneFlowLabel = useMemo(
    () => STATE_SCALE_ZONES.map((zone) => zone.shortLabel.toLowerCase()).join(" → "),
    [],
  );
  const selectedState = normalizedStates.find((state) => state.id === value) || null;
  const safeVariant = VALID_VARIANTS.has(variant) ? variant : "arc";
  const zones = useMemo(
    () =>
      STATE_SCALE_ZONES.map((zone) => ({
        ...zone,
        states: normalizedStates.filter((state) => state.zone === zone.id),
      })).filter((zone) => zone.states.length),
    [normalizedStates],
  );

  function handleSelect(stateId) {
    if (disabled || stateId === value) {
      return;
    }

    onChange?.(stateId);
  }

  function handleKeyDown(event) {
    if (disabled || !normalizedStates.length) {
      return;
    }

    const currentIndex = Math.max(
      normalizedStates.findIndex((state) => state.id === value),
      0,
    );
    let nextIndex = null;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = Math.min(currentIndex + 1, normalizedStates.length - 1);
    }

    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = Math.max(currentIndex - 1, 0);
    }

    if (event.key === "Home") {
      nextIndex = 0;
    }

    if (event.key === "End") {
      nextIndex = normalizedStates.length - 1;
    }

    if (nextIndex === null) {
      return;
    }

    event.preventDefault();
    handleSelect(normalizedStates[nextIndex].id);
  }

  function renderOption(state, extraClassName = "", showZone = false) {
    const isSelected = state.id === value;

    return (
      <button
        key={state.id}
        type="button"
        role="radio"
        aria-checked={isSelected}
        aria-label={getOptionAriaLabel(state)}
        disabled={disabled}
        className={`state-scale-option ${extraClassName} ${isSelected ? "is-selected" : ""}`}
        style={{
          "--state-color": state.color,
          "--state-surface": state.surface,
          "--state-text": state.textColor,
          "--state-tone": state.toneColor,
        }}
        onClick={() => handleSelect(state.id)}
      >
        <span className="state-scale-option-mark" aria-hidden="true" />
        <span className="state-scale-option-text">
          <strong>{state.shortLabel || state.label}</strong>
          {showZone ? <small>{state.zoneLabel}</small> : null}
          {showDescriptions && safeVariant !== "compact" ? (
            <small>{state.participantHint || state.description}</small>
          ) : null}
        </span>
      </button>
    );
  }

  function renderArc() {
    const step = (ARC_END - ARC_START) / normalizedStates.length;
    const selectedIndex = normalizedStates.findIndex((state) => state.id === value);
    const selectedAngle = selectedIndex >= 0 ? getArcAngle(selectedIndex, normalizedStates.length) : null;
    const selectedPoint =
      selectedAngle === null
        ? null
        : polarToCartesian(ARC_CENTER.x, ARC_CENTER.y, ARC_BUTTON_RADIUS - 26, selectedAngle);

    return (
      <div className="state-scale-arc-stage">
        <svg className="state-scale-arc-svg" viewBox="0 0 360 310" aria-hidden="true">
          {zones.map((zone) => {
            const firstStateIndex = normalizedStates.findIndex((state) => state.zone === zone.id);
            const lastStateIndex = findLastZoneStateIndex(normalizedStates, zone.id);
            const start = ARC_START + firstStateIndex * step;
            const end = ARC_START + (lastStateIndex + 1) * step;

            return (
              <path
                key={zone.id}
                className={`state-scale-zone-arc is-${zone.id}`}
                d={describeArc(ARC_CENTER.x, ARC_CENTER.y, ARC_RADIUS + 22, start + 2, end - 2)}
              />
            );
          })}

          {normalizedStates.map((state, index) => {
            const start = ARC_START + index * step;
            const end = start + step;

            return (
              <path
                key={state.id}
                className={state.id === value ? "state-scale-segment is-selected" : "state-scale-segment"}
                d={describeArc(ARC_CENTER.x, ARC_CENTER.y, ARC_RADIUS, start + 2.2, end - 2.2)}
                style={{ "--state-color": state.color }}
              />
            );
          })}

          {selectedPoint ? (
            <g className="state-scale-needle">
              <line
                x1={ARC_CENTER.x}
                y1={ARC_CENTER.y}
                x2={selectedPoint.x}
                y2={selectedPoint.y}
              />
              <circle cx={ARC_CENTER.x} cy={ARC_CENTER.y} r="15" />
              <circle className="state-scale-needle-tip" cx={selectedPoint.x} cy={selectedPoint.y} r="7" />
            </g>
          ) : null}

          <text x="56" y="286" className="state-scale-zone-label">
            выгорание
          </text>
          <text x="180" y="32" className="state-scale-zone-label is-center">
            интеграция
          </text>
          <text x="304" y="286" className="state-scale-zone-label is-end">
            дистресс
          </text>
        </svg>

        {normalizedStates.map((state, index) => {
          const angle = getArcAngle(index, normalizedStates.length);
          const point = polarToCartesian(ARC_CENTER.x, ARC_CENTER.y, ARC_BUTTON_RADIUS, angle);

          return (
            <div
              key={state.id}
              className="state-scale-arc-slot"
              style={{
                left: `${(point.x / 360) * 100}%`,
                top: `${(point.y / 310) * 100}%`,
              }}
            >
              {renderOption(state, "state-scale-arc-option")}
            </div>
          );
        })}
      </div>
    );
  }

  function renderZones() {
    return (
      <div className="state-scale-zone-list">
        {zones.map((zone) => (
          <section key={zone.id} className={`state-scale-zone-card is-${zone.id}`}>
            <div className="state-scale-zone-head">
              <strong>{zone.label}</strong>
              <span>{zone.rangeLabel}</span>
            </div>
            <div className="state-scale-zone-options">
              {zone.states.map((state) => renderOption(state, "state-scale-zone-option"))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  function renderCompact() {
    return (
      <div className="state-scale-compact-list">
        {normalizedStates.map((state) => renderOption(state, "state-scale-compact-option", true))}
      </div>
    );
  }

  return (
    <div
      className={`state-scale-picker is-${safeVariant} ${animated ? "is-animated" : "is-static"} ${
        disabled ? "is-disabled" : ""
      }`}
      role="radiogroup"
      aria-labelledby={titleId}
      aria-disabled={disabled || undefined}
      onKeyDown={handleKeyDown}
    >
      {label ? (
        <div className="state-scale-heading" id={titleId}>
          <span>{label}</span>
          <small>{zoneFlowLabel}</small>
        </div>
      ) : (
        <span className="visually-hidden" id={titleId}>
          Шкала состояния
        </span>
      )}

      {safeVariant === "arc" ? renderArc() : null}
      {safeVariant === "zones" ? renderZones() : null}
      {safeVariant === "compact" ? renderCompact() : null}

      {showDescriptions && selectedState ? (
        <div
          className="state-scale-selected-note"
          style={{
            "--state-color": selectedState.color,
            "--state-surface": selectedState.surface,
            "--state-text": selectedState.textColor,
          }}
        >
          <span className="state-scale-note-dot" aria-hidden="true" />
          <div>
            <strong>{selectedState.shortLabel || selectedState.label}</strong>
            <p>{selectedState.participantHint || selectedState.description}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default StateScalePicker;
