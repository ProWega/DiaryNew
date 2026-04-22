import { DistributionBars, EmotionLineChart } from "../components/Charts";
import MetricBadge from "../components/MetricBadge";
import { getStateInfo, getStateLevel } from "../lib/metrics";

function ParticipantRoutedView({
  mode,
  navigateToMode,
  sessionInfo,
  stateScale,
  reflectionPrompts,
  todayEvents,
  todayMetrics,
  todayPortrait,
  reflection,
  setReflection,
  updateEventState,
  updateEventComment,
  updateEventConfidence,
  liveHistory,
  selectedDay,
  setSelectedHistoryDay,
  overallTrajectory,
  overallAverages,
  formatAverage,
}) {
  const todayChartEvents = todayEvents.filter((event) => event.answered !== false && event.stateId);
  const selectedChartEvents = (selectedDay?.events || []).filter((event) => event.answered !== false && event.stateId);

  return (
    <section className="role-view">
      <div className="hero-card">
        <div>
          <p className="eyebrow">Роль: участник</p>
          <h2>Дневник состояний по событиям дня</h2>
          <p className="subtle">
            Заполнение занимает 1–2 минуты: выберите состояние, при желании добавьте причину и закройте день рефлексией.
          </p>
        </div>

        <div className="hero-stats">
          <MetricBadge label="Заполнено" value={`${todayMetrics.completion}%`} />
          <MetricBadge
            label="Средний уровень"
            value={formatAverage(todayMetrics.average)}
          />
          <MetricBadge label="Амплитуда" value={`${todayMetrics.amplitude}`} />
          <MetricBadge
            label="Резкие переходы"
            value={`${todayMetrics.sharpTransitions}`}
          />
        </div>
      </div>

      <div className="subnav">
        <button
          type="button"
          className={mode === "today" ? "subnav-pill is-active" : "subnav-pill"}
          onClick={() => navigateToMode("today")}
        >
          Сегодня
        </button>
        <button
          type="button"
          className={mode === "dynamics" ? "subnav-pill is-active" : "subnav-pill"}
          onClick={() => navigateToMode("dynamics")}
        >
          Моя динамика
        </button>
        <span className="soft-pill is-outline">{sessionInfo.editWindow}</span>
      </div>

      {mode === "today" ? (
        <div className="participant-layout">
          <div className="event-column">
            {todayEvents.map((event) => (
              <article key={event.id} className="event-card">
                <div className="event-head">
                  <div>
                    <span className="event-time">{event.time}</span>
                    <h3>{event.title}</h3>
                    <p>{event.type}</p>
                  </div>
                  <div className="tag-row">
                    {event.tags.map((tag) => (
                      <span key={tag} className="tag-chip">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="state-row">
                  {stateScale.map((state) => (
                    <button
                      key={state.id}
                      type="button"
                      className={
                        event.stateId === state.id ? "state-pill is-selected" : "state-pill"
                      }
                      style={{
                        "--state-surface": state.surface,
                        "--state-border": state.color,
                        "--state-text": state.textColor,
                      }}
                      onClick={() => updateEventState(event.id, state.id)}
                    >
                      <span>{state.icon}</span>
                      <span>{state.label}</span>
                    </button>
                  ))}
                </div>

                <div className="input-row">
                  <textarea
                    rows="2"
                    value={event.comment}
                    placeholder="Что повлияло на состояние?"
                    onChange={(eventInput) =>
                      updateEventComment(event.id, eventInput.target.value)
                    }
                  />
                </div>

                <div className="event-foot">
                  <button
                    type="button"
                    className={event.confidence === "low" ? "ghost-button is-active" : "ghost-button"}
                    onClick={() => updateEventConfidence(event.id)}
                  >
                    Сложно оценить
                  </button>
                  <span className="confidence-note">
                    Уверенность: {event.confidence === "low" ? "low" : "high"}
                  </span>
                </div>
              </article>
            ))}
          </div>

          <div className="insight-column">
            <article className="panel-card">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">Итог дня</p>
                  <h3>Рефлексия и заметки</h3>
                </div>
                <button type="button" className="primary-button">
                  Сохранить черновик
                </button>
              </div>

              <div className="reflection-list">
                {reflectionPrompts.map((prompt, index) => {
                  const keys = ["q1", "q2", "q3"];
                  const field = keys[index];

                  return (
                    <label key={prompt} className="reflection-item">
                      <span>{prompt}</span>
                      <textarea
                        rows="2"
                        value={reflection[field]}
                        placeholder="Напишите 1–2 предложения"
                        onChange={(event) =>
                          setReflection((previous) => ({
                            ...previous,
                            [field]: event.target.value,
                          }))
                        }
                      />
                    </label>
                  );
                })}

                <label className="reflection-item">
                  <span>Свободный текст</span>
                  <textarea
                    rows="4"
                    value={reflection.freeText}
                    placeholder="Что ещё важно зафиксировать?"
                    onChange={(event) =>
                      setReflection((previous) => ({
                        ...previous,
                        freeText: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
            </article>

            <article className="panel-card">
              <EmotionLineChart
                title="Карта эмоций дня"
                values={todayChartEvents.map((event) => getStateLevel(event.stateId))}
                labels={todayChartEvents.map((event) => event.title)}
              />
            </article>

            <article className="panel-card tone-card">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">Психологический портрет дня</p>
                  <h3>Автосводка по текущим отметкам</h3>
                </div>
                <span className="confidence-tag">confidence: medium</span>
              </div>

              <ul className="bullet-list">
                {todayPortrait.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>

            <article className="panel-card">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">Распределение состояний</p>
                  <h3>Дневной профиль по шкале</h3>
                </div>
              </div>

              <DistributionBars
                items={todayMetrics.distribution}
                total={todayChartEvents.length}
              />
            </article>
          </div>
        </div>
      ) : null}

      {mode === "dynamics" ? (
        <div className="dynamics-layout">
          <div className="panel-card">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Траектория по заезду</p>
                <h3>Моя динамика за 3 дня форума</h3>
              </div>
              <div className="tab-row">
                {liveHistory.map((day) => (
                  <button
                    key={day.id}
                    type="button"
                    className={selectedDay.id === day.id ? "mini-tab is-active" : "mini-tab"}
                    onClick={() => setSelectedHistoryDay(day.id)}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>

            <EmotionLineChart
              title={selectedDay.dateLabel}
              values={selectedChartEvents.map((event) => getStateLevel(event.stateId))}
              labels={selectedChartEvents.map((event) => event.title)}
            />
          </div>

          <div className="dynamics-side">
            <article className="panel-card">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">Три дня одним взглядом</p>
                  <h3>Средние значения по дням</h3>
                </div>
              </div>

              <EmotionLineChart
                compact
                bands={false}
                values={overallAverages.map((item) => item.value)}
                labels={overallAverages.map((item) => item.day)}
              />
            </article>

            <article className="panel-card">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">Краткий вывод</p>
                  <h3>{selectedDay.label}</h3>
                </div>
              </div>
              <p className="lead-text">{selectedDay.insight}</p>
              <ul className="bullet-list">
                {selectedDay.aiHighlights.map((highlight) => (
                  <li key={highlight}>{highlight}</li>
                ))}
              </ul>
            </article>
          </div>

          <div className="panel-card stretch-card">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Детализация</p>
                <h3>Точки роста и просадки</h3>
              </div>
              <span className="confidence-tag">ИИ-подсказка для участника</span>
            </div>

            <div className="trajectory-grid">
              {overallTrajectory.map((step) => {
                const state = getStateInfo(step.stateId);

                return (
                  <div key={step.label} className="trajectory-step">
                    <span
                      className="trajectory-icon"
                      style={{
                        background: state.surface,
                        borderColor: state.color,
                      }}
                    >
                      {state.icon}
                    </span>
                    <div>
                      <strong>{step.label}</strong>
                      <p>{state.label}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default ParticipantRoutedView;
