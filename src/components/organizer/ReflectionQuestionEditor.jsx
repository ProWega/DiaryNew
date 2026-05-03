import Field from "../ui/Field";
import { createReflectionQuestionDraft, normalizeReflectionQuestions } from "./_helpers";

export function ReflectionQuestionEditor({
  value = [],
  disabled = false,
  title = "Вопросы рефлексии",
  emptyLabel = "Вопросы не настроены",
  onChange,
}) {
  const questions = normalizeReflectionQuestions(value);

  function updateQuestion(questionId, patch) {
    onChange?.(
      questions.map((question) =>
        question.id === questionId ? { ...question, ...patch } : question,
      ),
    );
  }

  function addQuestion() {
    onChange?.([...questions, createReflectionQuestionDraft()]);
  }

  function removeQuestion(questionId) {
    onChange?.(questions.filter((question) => question.id !== questionId));
  }

  return (
    <div className="reflection-question-editor">
      <div className="panel-head is-compact">
        <div>
          <p className="eyebrow">{title}</p>
          <p className="subtle">{questions.length ? `${questions.length} вопросов` : emptyLabel}</p>
        </div>
        <button type="button" className="ghost-button" disabled={disabled} onClick={addQuestion}>
          Добавить вопрос
        </button>
      </div>

      {questions.length ? (
        <div className="reflection-question-list">
          {questions.map((question, index) => (
            <div key={question.id} className="reflection-question-row">
              <Field label={`Вопрос ${index + 1}`} wide>
                <textarea
                  rows={2}
                  value={question.text}
                  disabled={disabled}
                  placeholder="Что важно осмыслить участнику?"
                  onChange={(event) => updateQuestion(question.id, { text: event.target.value })}
                />
              </Field>
              <label className="toggle-line">
                <input
                  type="checkbox"
                  checked={question.required}
                  disabled={disabled}
                  onChange={(event) =>
                    updateQuestion(question.id, { required: event.target.checked })
                  }
                />
                Обязательный
              </label>
              <button
                type="button"
                className="ghost-button is-danger"
                disabled={disabled}
                onClick={() => removeQuestion(question.id)}
              >
                Удалить
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
