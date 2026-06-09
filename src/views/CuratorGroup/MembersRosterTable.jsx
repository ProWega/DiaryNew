const JOURNEY_LABELS = {
  search: "Поиск",
  verification: "Проверка",
  support: "Опора",
  transmission: "Передача",
};

function formatRelativeTime(value) {
  if (!value) return "—";
  try {
    const ts = new Date(value);
    if (Number.isNaN(ts.getTime())) return "—";
    const now = new Date();
    const sameDay =
      ts.getUTCFullYear() === now.getUTCFullYear() &&
      ts.getUTCMonth() === now.getUTCMonth() &&
      ts.getUTCDate() === now.getUTCDate();
    if (sameDay) {
      return ts.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    }
    return ts.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  } catch {
    return "—";
  }
}

/**
 * Таблица-ростер участников группы. Колонки: ФИО / Этап пути / Состояние
 * сегодня / Состояние вчера / Рефлексия / Последний комментарий.
 */
function MembersRosterTable({ members }) {
  return (
    <article className="panel-card curator-group-roster">
      <header className="panel-head">
        <div>
          <p className="eyebrow">Ростер участников</p>
          <h3>Кто как откликается</h3>
        </div>
        <span className="confidence-tag">{members.length} участников</span>
      </header>

      {members.length === 0 ? (
        <p className="subtle">
          В группе пока нет активных участников. Выпустите приглашения ниже — после consume
          участники появятся здесь автоматически.
        </p>
      ) : (
        <div className="table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>ФИО</th>
                <th>Этап пути</th>
                <th>Состояние сегодня</th>
                <th>Состояние вчера</th>
                <th>Рефлексия</th>
                <th>Последний коммент</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.userId}>
                  <td className="cell-wrap">
                    <strong>{m.fullName || "(без имени)"}</strong>
                  </td>
                  <td>{m.journeyStage ? JOURNEY_LABELS[m.journeyStage] || m.journeyStage : "—"}</td>
                  <td>{m.todayState?.label || <span className="subtle">—</span>}</td>
                  <td>{m.yesterdayState?.label || <span className="subtle">—</span>}</td>
                  <td>
                    {m.reflectionDone ? (
                      <span className="status-pill tone-ok">✓</span>
                    ) : (
                      <span className="subtle">—</span>
                    )}
                  </td>
                  <td>{formatRelativeTime(m.lastCommentAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}

export default MembersRosterTable;
