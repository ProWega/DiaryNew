import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
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

function TabsInteractive() {
  const [activeId, setActiveId] = useState("program");
  return (
    <div style={{ padding: 24 }}>
      <Tabs
        items={[
          { id: "program", label: "Программа" },
          { id: "groups", label: "Группы" },
          { id: "participants", label: "Участники" },
          { id: "disabled", label: "Недоступно", disabled: true },
        ]}
        activeId={activeId}
        onChange={setActiveId}
      />
    </div>
  );
}

export const TabsClickInteraction = {
  render: () => <TabsInteractive />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Initial: "Программа" is selected
    const programTab = canvas.getByRole("tab", { name: "Программа" });
    await expect(programTab).toHaveAttribute("aria-selected", "true");

    // Click "Участники" — selection moves
    const participantsTab = canvas.getByRole("tab", { name: "Участники" });
    await userEvent.click(participantsTab);
    await expect(participantsTab).toHaveAttribute("aria-selected", "true");
    await expect(programTab).toHaveAttribute("aria-selected", "false");

    // Disabled tab cannot be clicked into
    const disabledTab = canvas.getByRole("tab", { name: "Недоступно" });
    await expect(disabledTab).toBeDisabled();
  },
};

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
        <AlertCard
          title="Высокий риск"
          detail="Группа показывает два резких скачка."
          tone="severity-high"
        />
        <AlertCard
          title="Средний риск"
          detail="Нужна пауза после практикума."
          tone="severity-medium"
        />
      </div>
    </div>
  );
}

export function BrandSystemReview() {
  return (
    <div className="app-shell" style={{ minHeight: "auto" }}>
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark" aria-label="Истоки">
            И
          </div>
          <div>
            <p className="eyebrow">Истоки · UI review</p>
            <h1>Система интерфейса</h1>
            <p className="subtle">Проверка палитры, типографики, контролов и состояний.</p>
          </div>
        </div>
        <div className="pill-grid">
          <span className="soft-pill">Бордовый</span>
          <span className="soft-pill is-outline">Песчаный фон</span>
        </div>
      </header>

      <main className="page-grid">
        <section className="hero-card">
          <div>
            <p className="eyebrow">Рабочий экран</p>
            <h2>Сдержанный продуктовый слой Истоков</h2>
            <p className="subtle">Бренд присутствует через цвет, ритм и состояние компонентов.</p>
          </div>
          <div className="hero-stats">
            <MetricBadge label="Контраст" value="AA" />
            <MetricBadge label="Радиус" value="8px" />
            <MetricBadge label="Палитра" value="Истоки" />
          </div>
        </section>

        <section className="panel-card">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Состояния</p>
              <h3>Кнопки, поля, статусы</h3>
            </div>
            <span className="confidence-tag">review</span>
          </div>
          <div className="pill-grid" style={{ marginTop: 16 }}>
            <button type="button" className="primary-button">
              Основное действие
            </button>
            <button type="button" className="ghost-button">
              Вторичное
            </button>
            <button type="button" className="primary-button" disabled>
              Недоступно
            </button>
            <StatusPill tone="tone-ok">Стабильно</StatusPill>
            <StatusPill tone="tone-watch">Наблюдать</StatusPill>
            <StatusPill tone="tone-risk">Риск</StatusPill>
          </div>
          <div className="field-grid" style={{ marginTop: 16 }}>
            <Field label="Название">
              <input defaultValue="Истоки. Школа" />
            </Field>
            <Field label="Комментарий" error="Проверьте формулировку">
              <textarea rows={3} defaultValue="Короткий рабочий текст внутри интерфейса." />
            </Field>
          </div>
        </section>
      </main>
    </div>
  );
}
