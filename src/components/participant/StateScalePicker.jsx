import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  STATE_SCALE_NEUTRAL_PREVIEW,
  STATE_SCALE_ZONES,
  findMethodologyGroupForStateId,
  methodologyStateGroups,
  normalizeStateScale,
} from "../../data/stateScaleModel";

const ARC_START = 225;
const ARC_END = 495;
const ARC_CENTER = { x: 180, y: 178 };
const ARC_RADIUS = 126;
const ARC_NEEDLE_RADIUS = 68;
const VALID_VARIANTS = new Set(["arc", "zones", "compact", "arc-5", "emoji-5", "slider-5"]);
const VALID_SIZES = new Set(["default", "compact"]);
const METHODOLOGY_VARIANTS = new Set(["arc-5", "emoji-5", "slider-5"]);

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

  return ["M", start.x, start.y, "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y].join(" ");
}

function getArcAngle(index, total) {
  if (total <= 1) {
    return (ARC_START + ARC_END) / 2;
  }

  return ARC_START + ((ARC_END - ARC_START) / (total - 1)) * index;
}

function getOptionAriaLabel(state) {
  return [
    state.shortLabel || state.label,
    state.zoneLabel,
    state.participantHint || state.description,
  ]
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
  size = "default",
  animated = true,
  disabled = false,
  showDescriptions = true,
  showSlideBar = true,
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
  const safeSize = VALID_SIZES.has(size) ? size : "default";
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
  const arcPreviewState =
    normalizedStates[previewIndex] || normalizedStates[neutralPreviewIndex] || null;
  const isNeutralArcPreview = safeVariant === "arc" && !hasCommittedValue && !hasInteractedWithArc;
  const sliderGradient = useMemo(() => getSliderGradient(normalizedStates), [normalizedStates]);
  const isMethodologyVariant = METHODOLOGY_VARIANTS.has(safeVariant);
  const groups = useMemo(
    () => (isMethodologyVariant ? methodologyStateGroups(normalizedStates) : []),
    [isMethodologyVariant, normalizedStates],
  );
  const selectedGroup = useMemo(
    () => (isMethodologyVariant ? findMethodologyGroupForStateId(groups, value) : null),
    [isMethodologyVariant, groups, value],
  );
  const selectedGroupIndex = selectedGroup
    ? groups.findIndex((group) => group.id === selectedGroup.id)
    : -1;

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

  function renderArcZoneLabels(extraClassName = "") {
    const className = ["state-scale-slider-zone-labels", extraClassName].filter(Boolean).join(" ");

    return (
      <div className={className} aria-hidden="true">
        {STATE_SCALE_ZONES.map((zone) => (
          <span key={zone.id}>{zone.shortLabel.toLowerCase()}</span>
        ))}
      </div>
    );
  }

  function renderArc() {
    const isCompactArc = safeSize === "compact";
    const step = (ARC_END - ARC_START) / normalizedStates.length;
    const selectedAngle = arcPreviewState
      ? getArcAngle(previewIndex, normalizedStates.length)
      : null;
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
    const selectedSegment = normalizedStates[previewIndex] || null;

    function renderArcSegment(state, index, extraClassName = "") {
      const start = ARC_START + index * step;
      const end = start + step;
      const className = [
        "state-scale-segment",
        index === previewIndex ? "is-selected" : "",
        extraClassName,
      ]
        .filter(Boolean)
        .join(" ");

      return (
        <path
          key={`${state.id}-${extraClassName || "base"}`}
          className={className}
          d={describeArc(ARC_CENTER.x, ARC_CENTER.y, ARC_RADIUS, start + 2.2, end - 2.2)}
          style={{ "--state-color": state.color }}
          onClick={() => handleSelect(state.id)}
        />
      );
    }

    return (
      <div className="state-scale-arc-flow">
        <div
          className={
            isNeutralArcPreview
              ? "state-scale-arc-stage is-neutral-preview"
              : "state-scale-arc-stage"
          }
          style={{
            "--state-color": arcPreviewState?.color || STATE_SCALE_NEUTRAL_PREVIEW.color,
            "--state-surface": arcPreviewState?.surface || STATE_SCALE_NEUTRAL_PREVIEW.surface,
          }}
        >
          <svg className="state-scale-arc-svg" viewBox="0 0 360 340" aria-hidden="true">
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

            {normalizedStates.map((state, index) =>
              index === previewIndex ? null : renderArcSegment(state, index),
            )}
            {selectedSegment ? renderArcSegment(selectedSegment, previewIndex, "is-overlay") : null}

            {selectedPoint ? (
              <g className="state-scale-needle">
                <line
                  x1={ARC_CENTER.x}
                  y1={ARC_CENTER.y}
                  x2={selectedPoint.x}
                  y2={selectedPoint.y}
                />
                <circle cx={ARC_CENTER.x} cy={ARC_CENTER.y} r="15" />
                <circle
                  className="state-scale-needle-tip"
                  cx={selectedPoint.x}
                  cy={selectedPoint.y}
                  r="7"
                />
              </g>
            ) : null}

            {!isCompactArc ? (
              <>
                <text x="56" y="318" className="state-scale-zone-label">
                  {STATE_SCALE_ZONES[0]?.shortLabel.toLowerCase()}
                </text>
                <text x="180" y="18" className="state-scale-zone-label is-center">
                  {STATE_SCALE_ZONES[1]?.shortLabel.toLowerCase()}
                </text>
                <text x="304" y="318" className="state-scale-zone-label is-end">
                  {STATE_SCALE_ZONES[2]?.shortLabel.toLowerCase()}
                </text>
              </>
            ) : null}
          </svg>

          <div className="state-scale-arc-center" aria-hidden="true">
            <span>{arcPreviewState?.shortLabel || arcPreviewState?.label}</span>
            <small>{isNeutralArcPreview ? "предпросмотр" : arcPreviewState?.zoneLabel}</small>
          </div>
        </div>

        {showDescriptions && descriptionState ? (
          <div
            className={
              isNeutralArcPreview
                ? "state-scale-arc-description is-neutral"
                : "state-scale-arc-description"
            }
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

        {isCompactArc && !showSlideBar ? renderArcZoneLabels("is-standalone") : null}

        {showSlideBar ? (
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
              style={{
                "--state-color": arcPreviewState?.color || STATE_SCALE_NEUTRAL_PREVIEW.color,
              }}
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
            {renderArcZoneLabels()}
          </div>
        ) : null}
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

  function handleGroupSelect(group) {
    if (disabled || !group) return;
    if (group.canonicalId === value) return;
    onChange?.(group.canonicalId);
  }

  function renderArc5() {
    const total = groups.length;
    const step = (ARC_END - ARC_START) / total;
    const selectedAngle = selectedGroupIndex >= 0 ? getArcAngle(selectedGroupIndex, total) : null;
    const selectedPoint =
      selectedAngle === null
        ? null
        : polarToCartesian(ARC_CENTER.x, ARC_CENTER.y, ARC_NEEDLE_RADIUS, selectedAngle);
    const previewGroup = selectedGroup || groups[Math.floor(total / 2)] || null;

    return (
      <div className="state-scale-arc-flow">
        <div
          className="state-scale-arc-stage"
          style={{
            "--state-color": previewGroup?.color || STATE_SCALE_NEUTRAL_PREVIEW.color,
            "--state-surface": previewGroup?.surface || STATE_SCALE_NEUTRAL_PREVIEW.surface,
          }}
        >
          <svg className="state-scale-arc-svg" viewBox="0 0 360 340" aria-hidden="true">
            {groups.map((group, index) => {
              const start = ARC_START + index * step;
              const end = start + step;
              const className = `state-scale-segment ${index === selectedGroupIndex ? "is-selected" : ""}`;

              return (
                <path
                  key={group.id}
                  className={className}
                  d={describeArc(ARC_CENTER.x, ARC_CENTER.y, ARC_RADIUS, start + 2.2, end - 2.2)}
                  style={{ "--state-color": group.color }}
                  onClick={() => handleGroupSelect(group)}
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
                <circle
                  className="state-scale-needle-tip"
                  cx={selectedPoint.x}
                  cy={selectedPoint.y}
                  r="7"
                />
              </g>
            ) : null}
          </svg>

          <div className="state-scale-arc-center" aria-hidden="true">
            <span>{previewGroup?.shortLabel}</span>
            <small>{selectedGroup ? "выбрано" : "выберите"}</small>
          </div>
        </div>

        {showDescriptions && previewGroup ? (
          <div
            className="state-scale-arc-description"
            style={{
              "--state-color": previewGroup.color,
              "--state-surface": previewGroup.surface,
              "--state-text": previewGroup.textColor,
            }}
          >
            <span className="state-scale-note-dot" aria-hidden="true" />
            <div>
              <strong>{previewGroup.label}</strong>
              <p>{previewGroup.participantHint || previewGroup.description}</p>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  function renderEmoji5() {
    return (
      <div className="state-scale-emoji-row">
        {groups.map((group) => {
          const isSelected = selectedGroup?.id === group.id;
          return (
            <button
              key={group.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={`${group.label}. ${group.description}`}
              disabled={disabled}
              className={`state-scale-emoji-button ${isSelected ? "is-selected" : ""}`}
              style={{
                "--state-color": group.color,
                "--state-surface": group.surface,
                "--state-text": group.textColor,
              }}
              onClick={() => handleGroupSelect(group)}
            >
              <span className="state-scale-emoji-icon" aria-hidden="true">
                {group.icon}
              </span>
              <span className="visually-hidden">{group.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  function renderSlider5() {
    const total = groups.length;
    const sliderIndex = selectedGroupIndex >= 0 ? selectedGroupIndex : Math.floor(total / 2);
    const previewGroup = groups[sliderIndex] || null;

    return (
      <div className="state-scale-slider5">
        <div className="state-scale-slider5-track-row">
          <input
            type="range"
            min="0"
            max={Math.max(total - 1, 0)}
            step="1"
            value={sliderIndex}
            disabled={disabled}
            className="state-scale-slider5-input"
            aria-labelledby={titleId}
            aria-valuetext={previewGroup?.label || ""}
            style={{
              "--state-color": previewGroup?.color,
              "--state-surface": previewGroup?.surface,
            }}
            onChange={(event) => {
              const nextIndex = clampIndex(event.target.value, total);
              const nextGroup = groups[nextIndex];
              if (nextGroup) handleGroupSelect(nextGroup);
            }}
          />
          <div className="state-scale-slider5-ticks" aria-hidden="true">
            {groups.map((group, index) => (
              <span
                key={group.id}
                className={index === sliderIndex ? "is-active" : ""}
                style={{
                  "--state-color": group.color,
                  left: `${total > 1 ? (index / (total - 1)) * 100 : 0}%`,
                }}
              />
            ))}
          </div>
        </div>
        {previewGroup ? (
          <div
            className="state-scale-slider5-label"
            style={{ "--state-color": previewGroup.color }}
          >
            <strong>{previewGroup.label}</strong>
            {showDescriptions ? (
              <small>{previewGroup.participantHint || previewGroup.description}</small>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={`state-scale-picker is-${safeVariant} is-size-${safeSize} ${
        animated ? "is-animated" : "is-static"
      } ${disabled ? "is-disabled" : ""} ${hasPendingArcCommit ? "has-pending-preview" : ""}`}
      role={
        safeVariant === "arc" || safeVariant === "arc-5" || safeVariant === "slider-5"
          ? undefined
          : "radiogroup"
      }
      aria-labelledby={titleId}
      aria-disabled={disabled || undefined}
      onKeyDown={
        safeVariant === "arc" || safeVariant === "arc-5" || safeVariant === "slider-5"
          ? undefined
          : handleKeyDown
      }
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
      {safeVariant === "arc-5" ? renderArc5() : null}
      {safeVariant === "emoji-5" ? renderEmoji5() : null}
      {safeVariant === "slider-5" ? renderSlider5() : null}

      {safeVariant !== "arc" && !isMethodologyVariant && showDescriptions && selectedState ? (
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
