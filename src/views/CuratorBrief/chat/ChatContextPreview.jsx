/**
 * Live preview собранного preamble (тот же текст, что увидит ИИ).
 * Принимает результат previewChatContext: { systemText, membersBlock,
 * feedbackBlock, conceptsBlock, estimatedChars, estimatedTokens, contextTruncated }.
 */
function ChatContextPreview({ preview, loading }) {
  if (loading) {
    return <div className="chat-context-preview is-loading subtle">Собираем preview…</div>;
  }
  if (!preview) {
    return (
      <div className="chat-context-preview is-empty subtle">
        Изменения в выборе автоматически обновят preview.
      </div>
    );
  }

  const { systemText, membersBlock, conceptsBlock } = preview;
  // Fallback: на старом backend поле называлось briefsBlock.
  const feedbackBlock = preview.feedbackBlock || preview.briefsBlock || "";
  const chars = preview.estimatedChars ?? 0;
  const tokens = preview.estimatedTokens ?? Math.ceil(chars / 3.5);
  const truncated = Boolean(preview.contextTruncated);

  // Цветовой alert по % от 200k cap.
  const ratio = chars / 200_000;
  const tier = ratio > 0.8 ? "danger" : ratio > 0.5 ? "warn" : "ok";

  return (
    <div className="chat-context-preview">
      <div className={`chat-context-preview-meter is-${tier}`}>
        <strong>
          {chars.toLocaleString("ru-RU")} символов · ~{tokens.toLocaleString("ru-RU")} токенов
        </strong>
        {truncated ? <span className="chat-context-truncated-badge">контекст обрезан</span> : null}
      </div>

      <PreviewBlock title="Системный промпт" text={systemText} initiallyOpen={false} />
      {membersBlock ? <PreviewBlock title="Состав группы" text={membersBlock} /> : null}
      {feedbackBlock ? (
        <PreviewBlock title="Обратная связь участников" text={feedbackBlock} />
      ) : null}
      {conceptsBlock ? <PreviewBlock title="Концепции мероприятий" text={conceptsBlock} /> : null}
      {!membersBlock && !feedbackBlock && !conceptsBlock ? (
        <p className="subtle">
          В выбранном контексте нет ни одного блока. ИИ увидит только системный промпт и ваш вопрос.
          Возможно, стоит включить хотя бы одну секцию.
        </p>
      ) : null}
    </div>
  );
}

function PreviewBlock({ title, text, initiallyOpen = true }) {
  if (!text) return null;
  return (
    <details className="chat-context-preview-block" open={initiallyOpen}>
      <summary>
        <strong>{title}</strong>
        <span className="subtle"> · {text.length.toLocaleString("ru-RU")} симв.</span>
      </summary>
      <pre className="chat-context-preview-text">{text}</pre>
    </details>
  );
}

export default ChatContextPreview;
