function ParticipantCardSection({ brief }) {
  // Phase 4.2: skeleton — индивидуальная карточка для разговора.
  // В Phase 4.3 сюда подтянется полный профиль участника (этап пути, careful_mode,
  // последние заметки, недавняя динамика) — отдельный API/sub-endpoint.
  const points = brief?.conversationPoints || [];
  const candidates = points.slice(0, 3);

  return (
    <article className="panel-card curator-brief-section curator-brief-card">
      <header className="panel-head">
        <div>
          <p className="eyebrow">Карточка участника</p>
          <h3>Для личного разговора</h3>
        </div>
        <span className="confidence-tag is-outline">в работе</span>
      </header>

      <p className="subtle">
        Выберите участника, к которому хочется подойти. В этой версии видны только подсказки из
        записки — детали разговора подтянутся позже.
      </p>

      {candidates.length ? (
        <ul className="curator-brief-candidates">
          {candidates.map((point) => (
            <li key={`${point.participantId}-${point.reason}`} className="curator-brief-candidate">
              <strong>{point.displayName}</strong>
              <p>{point.note}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="subtle">
          Сегодня нет участников, к которым нужно подойти специально. Можно просто побыть рядом.
        </p>
      )}
    </article>
  );
}

export default ParticipantCardSection;
