function ProgramScoreSection({ brief }) {
  // Phase 4.2: skeleton — «партитура смены» (нарратив всей смены).
  // В Phase 4.3 сюда подтянется свёртка по дням: дуга смены, повторяющиеся темы,
  // куда смещался резонанс этапов. Сейчас показываем сегодняшний резонанс как
  // первую точку партитуры.
  const stages = brief?.stageResonance;

  return (
    <article className="panel-card curator-brief-section curator-brief-score">
      <header className="panel-head">
        <div>
          <p className="eyebrow">Партитура смены</p>
          <h3>Дуга всей программы</h3>
        </div>
        <span className="confidence-tag is-outline">в работе</span>
      </header>

      <p className="subtle">
        В этой версии видна только текущая точка. Когда наберётся 2+ дня записей — здесь появится
        свёртка по дням и темы, которые звучали повторяющимся мотивом.
      </p>

      {stages ? (
        <div className="curator-brief-score-snapshot">
          <h4>Сегодня</h4>
          <p>
            Поиск — {stages.search ?? 0}; Проверка — {stages.verification ?? 0}; Опора —{" "}
            {stages.support ?? 0}; Передача — {stages.transmission ?? 0}; Бережно —{" "}
            {stages.careful ?? 0}.
          </p>
        </div>
      ) : null}
    </article>
  );
}

export default ProgramScoreSection;
