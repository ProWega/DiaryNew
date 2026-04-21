import FeedbackState from "../FeedbackState";
import MetricBadge from "../MetricBadge";
import Field from "./Field";
import Tabs from "./Tabs";
import { AlertCard, SoftPill, StatusPill } from "./Pills";

export default {
  title: "UI/Basic",
};

export function MetricBadges() {
  return (
    <div className="hero-stats" style={{ padding: 24 }}>
      <MetricBadge label="Участников" value="56" />
      <MetricBadge label="Профиль" value="социально-групповой ресурсный" />
      <MetricBadge label="Компактно" value="89%" compact />
      <MetricBadge label="Пустое значение" value="-" />
    </div>
  );
}

export function FeedbackStates() {
  return (
    <div style={{ display: "grid", gap: 20, padding: 24 }}>
      <FeedbackState title="Нет данных" description="Выберите программу или измените фильтр." />
      <FeedbackState
        title="Ошибка загрузки"
        description="Backend временно недоступен."
        actionLabel="Повторить"
        onAction={() => console.log("retry")}
      />
    </div>
  );
}

export function TabsStates() {
  return (
    <div style={{ padding: 24 }}>
      <Tabs
        items={[
          { id: "program", label: "Программа" },
          { id: "groups", label: "Группы" },
          { id: "participants", label: "Участники" },
          { id: "disabled", label: "Недоступно", disabled: true },
        ]}
        activeId="groups"
        onChange={(id) => console.log("tab", id)}
      />
    </div>
  );
}

export function FieldsAndPills() {
  return (
    <div className="panel-card" style={{ margin: 24 }}>
      <div className="field-grid">
        <Field label="Название" hint="Короткое публичное название">
          <input defaultValue="Лекция: дизайн сообщества" />
        </Field>
        <Field label="Тип">
          <select defaultValue="lecture">
            <option value="lecture">Лекция</option>
            <option value="workshop">Мастер-класс</option>
          </select>
        </Field>
        <Field label="Описание" wide error="Описание слишком короткое">
          <textarea rows={3} defaultValue="Краткое описание мероприятия." />
        </Field>
      </div>
      <div className="pill-grid">
        <SoftPill>Storage: postgres</SoftPill>
        <SoftPill outline>Обновлено сегодня</SoftPill>
        <StatusPill tone="tone-ok">Актуально сейчас</StatusPill>
        <StatusPill tone="tone-watch">Завершено</StatusPill>
      </div>
      <div className="alert-list" style={{ marginTop: 16 }}>
        <AlertCard title="Высокий риск" detail="Группа показывает два резких скачка." tone="severity-high" />
        <AlertCard title="Средний риск" detail="Нужна пауза после практикума." tone="severity-medium" />
      </div>
    </div>
  );
}
