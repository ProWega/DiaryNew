import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  STATE_SCALE_NEUTRAL_PREVIEW,
  STATE_SCALE_ZONES,
  normalizeStateScale,
} from "../../data/stateScaleModel";

const ARC_START = 225;
const ARC_END = 495;
const ARC_CENTER = { x: 180, y: 178 };
const ARC_RADIUS = 126;
const ARC_NEEDLE_RADIUS = 68;
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

function getNeutralPreviewIndex(states) {
  const balanceIndex = states.findIndex((state) => state.id === "balance");

  if (balanceIndex >= 0) {
    return balanceIndex;
  }

  return Math.max(0, Math.floor((states.length - 1) / 2));
}

function getStateIndex(states, stateId) {
  return states.findIndex((state) => state.id === stateId);
}

function clampIndex(value, total) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return 0;
  }

  return Math.max(0, Math.min(Math.round(numberValue), total - 1));
}

function getSliderGradient(states) {
  if (!states.length) {
    return "linear-gradient(90deg, #eef1e8, #eef1e8)";
  }

  return `linear-gradient(90deg, ${states
    .map((state, index) => {
      const start = (index / states.length) * 100;
      const end = ((index + 1) / states.length) * 100;

      return `${state.color} ${start}% ${end}%`;
    })
    .join(", ")})`;
}

function getSliderValueText(state, isNeutralPreview) {
  if (isNeutralPreview) {
    return STATE_SCALE_NEUTRAL_PREVIEW.ariaValueText;
  }

  return [state?.shortLabel || state?.label, state?.zoneLabel].filter(Boolean).join(", ");
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
  const safeVariant = VALID_VARIANTS.has(variant) ? variant : "arc";
  const selectedState = normalizedStates.find((state) => state.id === value) || null;
  const committedIndex = getStateIndex(normalizedStates, value);
  const neutralPreviewIndex = getNeutralPreviewIndex(normalizedStates);
  const hasCommittedValue = committedIndex >= 0;
  const [previewIndex, setPreviewIndex] = useState(() =>
    hasCommittedValue ? committedIndex : neutralPreviewIndex,
  );
  const [hasInteractedWithArc, setHasInteractedWithArc] = useState(false);
  const [hasPendingArcCommit, setHasPendingArcCommit] = useState(false);
  const previewIndexRef = useRef(previewIndex);
  const hasPendingArcCommitRef = useRef(false);
  const zones = useMemo(
    () =>
      STATE_SCALE_ZONES.map((zone) => ({
        ...zone,
        states: normalizedStates.filter((state) => state.zone === zone.id),
      })).filter((zone) => zone.states.length),
    [normalizedStates],
  );
  const arcPreviewState = normalizedStates[previewIndex] || normalizedStates[neutralPreviewIndex] || null;
  const isNeutralArcPreview = safeVariant === "arc" && !hasCommittedValue && !hasInteractedWithArc;
  const sliderGradient = useMemo(() => getSliderGradient(normalizedStates), [normalizedStates]);

  useEffect(() => {
    const nextPreviewIndex = hasCommittedValue ? committedIndex : neutralPreviewIndex;

    setPreviewIndex(nextPreviewIndex);
    setHasInteractedWithArc(false);
    setHasPendingArcCommit(false);
    previewIndexRef.current = nextPreviewIndex;
    hasPendingArcCommitRef.current = false;
  }, [committedIndex, hasCommittedValue, neutralPreviewIndex, normalizedStates.length]);

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

  function handleArcPreviewChange(nextValue) {
    if (disabled || !normalizedStates.length) {
      return;
    }

    const nextIndex = clampIndex(nextValue, normalizedStates.length);

    setPreviewIndex(nextIndex);
    setHasInteractedWithArc(true);
    setHasPendingArcCommit(true);
    previewIndexRef.current = nextIndex;
    hasPendingArcCommitRef.current = true;
  }

  function commitArcPreview() {
    if (disabled || !hasPendingArcCommitRef.current || !normalizedStates.length) {
      return;
    }

    hasPendingArcCommitRef.current = false;
    setHasPendingArcCommit(false);
    setHasInteractedWithArc(true);

    const state = normalizedStates[previewIndexRef.current];

    if (state && state.id !== value) {
      onChange?.(state.id);
    }
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
    const selectedAngle = arcPreviewState ? getArcAngle(previewIndex, normalizedStates.length) : null;
    const selectedPoint =
      selectedAngle === null
        ? null
        : polarToCartesian(ARC_CENTER.x, ARC_CENTER.y, ARC_NEEDLE_RADIUS, selectedAngle);
    const descriptionState = isNeutralArcPreview ? STATE_SCALE_NEUTRAL_PREVIEW : arcPreviewState;
    const descriptionTitle = isNeutralArcPreview
      ? descriptionState.title
      : arcPreviewState?.shortLabel || arcPreviewState?.label;
    const descriptionText = isNeutralArcPreview
      ? descriptionState.description
      : arcPreviewState?.participantHint || arcPreviewState?.description;

    return (
      <div className="state-scale-arc-flow">
        <div
          className={isNeutralArcPreview ? "state-scale-arc-stage is-neutral-preview" : "state-scale-arc-stage"}
          style={{
            "--state-color": arcPreviewState?.color || STATE_SCALE_NEUTRAL_PREVIEW.color,
            "--state-surface": arcPreviewState?.surface || STATE_SCALE_NEUTRAL_PREVIEW.surface,
          }}
        >
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
                  className={index === previewIndex ? "state-scale-segment is-selected" : "state-scale-segment"}
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
              {STATE_SCALE_ZONES[0]?.shortLabel.toLowerCase()}
            </text>
            <text x="180" y="32" className="state-scale-zone-label is-center">
              {STATE_SCALE_ZONES[1]?.shortLabel.toLowerCase()}
            </text>
            <text x="304" y="286" className="state-scale-zone-label is-end">
              {STATE_SCALE_ZONES[2]?.shortLabel.toLowerCase()}
            </text>
          </svg>

          <div className="state-scale-arc-center" aria-hidden="true">
            <span>{arcPreviewState?.shortLabel || arcPreviewState?.label}</span>
            <small>{isNeutralArcPreview ? "предпросмотр" : arcPreviewState?.zoneLabel}</small>
          </div>
        </div>

        {showDescriptions && descriptionState ? (
          <div
            className={isNeutralArcPreview ? "state-scale-arc-description is-neutral" : "state-scale-arc-description"}
            style={{
              "--state-color": arcPreviewState?.color || descriptionState.color,
              "--state-surface": arcPreviewState?.surface || descriptionState.surface,
              "--state-text": arcPreviewState?.textColor || descriptionState.textColor,
            }}
          >
            <span className="state-scale-note-dot" aria-hidden="true" />
            <div>
              <span className="state-scale-description-zone">
                {isNeutralArcPreview ? descriptionState.zoneLabel : arcPreviewState?.zoneLabel}
              </span>
              <strong>{descriptionTitle}</strong>
              <p>{descriptionText}</p>
              {isNeutralArcPreview ? <small>{descriptionState.participantHint}</small> : null}
            </div>
          </div>
        ) : null}

        <div className="state-scale-slider" style={{ "--state-slider-track": sliderGradient }}>
          <input
            type="range"
            min="0"
            max={Math.max(normalizedStates.length - 1, 0)}
            step="1"
            value={previewIndex}
            disabled={disabled || !normalizedStates.length}
            className="state-scale-slider-input"
            aria-labelledby={titleId}
            aria-valuetext={getSliderValueText(arcPreviewState, isNeutralArcPreview)}
            style={{ "--state-color": arcPreviewState?.color || STATE_SCALE_NEUTRAL_PREVIEW.color }}
            onChange={(event) => handleArcPreviewChange(event.target.value)}
            onPointerUp={commitArcPreview}
            onMouseUp={commitArcPreview}
            onTouchEnd={commitArcPreview}
            onKeyUp={commitArcPreview}
            onBlur={commitArcPreview}
          />
          <div className="state-scale-slider-ticks" aria-hidden="true">
            {normalizedStates.map((state, index) => (
              <span
                key={state.id}
                className={index === previewIndex ? "is-active" : ""}
                style={{
                  "--state-color": state.color,
                  left: `${normalizedStates.length > 1 ? (index / (normalizedStates.length - 1)) * 100 : 0}%`,
                }}
              />
            ))}
          </div>
          <div className="state-scale-slider-zone-labels" aria-hidden="true">
            {STATE_SCALE_ZONES.map((zone) => (
              <span key={zone.id}>{zone.shortLabel.toLowerCase()}</span>
            ))}
          </div>
        </div>
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
      } ${hasPendingArcCommit ? "has-pending-preview" : ""}`}
      role={safeVariant === "arc" ? undefined : "radiogroup"}
      aria-labelledby={titleId}
      aria-disabled={disabled || undefined}
      onKeyDown={safeVariant === "arc" ? undefined : handleKeyDown}
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

      {safeVariant !== "arc" && showDescriptions && selectedState ? (
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
