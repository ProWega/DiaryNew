function ParticipantSelfKnowledgeView({ currentUser, sessionInfo }) {
  const firstName = currentUser?.fullName?.trim().split(/\s+/)[0] || "Вы";
  const sessionMeta = [sessionInfo?.dateLabel, sessionInfo?.location].filter(Boolean);

  return (
    <section className="role-view participant-view participant-self-view">
      <article className="participant-self-card">
        <div className="participant-self-content">
          <div className="participant-self-kicker">
            <span className="soft-pill">Тест готовится</span>
            {sessionMeta.length ? (
              <span className="soft-pill is-outline">{sessionMeta.join(" · ")}</span>
            ) : null}
          </div>

          <div>
            <p className="eyebrow">Узнать себя</p>
            <h2>Статус идентичности</h2>
            <p className="lead-text">
              {firstName}, здесь появится короткий психологический тест, который поможет
              бережно посмотреть на выбор, поиск, уверенность и сомнения.
            </p>
          </div>

          <div className="participant-self-points" aria-label="Что даст тест">
            <div>
              <strong>Выбор</strong>
              <span>Как сейчас принимаются важные решения.</span>
            </div>
            <div>
              <strong>Поиск</strong>
              <span>Где хочется пробовать, уточнять и сравнивать.</span>
            </div>
            <div>
              <strong>Опора</strong>
              <span>На что можно бережно опереться в период заезда.</span>
            </div>
          </div>

          <div className="participant-self-actions">
            <button type="button" className="primary-button" disabled>
              Скоро будет доступно
            </button>
            <span>Ответы не собираются в этой версии кабинета.</span>
          </div>
        </div>

        <aside className="participant-self-panel" aria-label="Статус раздела">
          <div>
            <p className="eyebrow">Личный ориентир</p>
            <h3>Тест готовится</h3>
            <p>
              Раздел останется отдельным от дневника состояния, чтобы не смешивать
              ежедневные отметки и более глубокое самонаблюдение.
            </p>
          </div>
          <div className="participant-self-status-grid">
            <span>Без спешки</span>
            <span>Без оценки</span>
            <span>Для себя</span>
          </div>
        </aside>
      </article>
    </section>
  );
}

export default ParticipantSelfKnowledgeView;
