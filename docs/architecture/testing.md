# Тестирование

Три слоя тестов, каждый со своей зоной ответственности и скоростью.

## Слой 1 — Vitest (unit + integration)

Запуск: `npm test` (или `npm run test:watch` локально, `npm run test:ui` для браузерного раннера).

Конфиг: [vitest.config.ts](../../vitest.config.ts) — `happy-dom`, `globals: true`, ищет `src/**/*.test.{js,jsx,ts,tsx}` и `server/**/*.test.cjs`.

Setup-файл [vitest.setup.ts](../../vitest.setup.ts) подключает `@testing-library/jest-dom/vitest` (matchers `toBeInTheDocument` и т.п.).

### Что покрыто

| Файл                                                                                 | Что тестирует                                                                                                                                             |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [src/lib/format.test.ts](../../src/lib/format.test.ts)                               | `formatNumber`, `formatPercent`, `formatDelta`, `formatDate`, `formatRelative` — числа, локаль ru-RU, em-dash для NaN/falsy                               |
| [src/lib/programDays.test.ts](../../src/lib/programDays.test.ts)                     | `getIsoDateDayStamp`, `addDaysToIsoDate`, `formatProgramDayDateLabel`, `selectClosestProgramDay` — границы месяца/года, prefer-past tie-break             |
| [src/lib/csrfToken.test.ts](../../src/lib/csrfToken.test.ts)                         | `getCsrfToken` читает cookie с URL-encoded значениями, не путает с подстроками                                                                            |
| [src/rbac/permissions.test.ts](../../src/rbac/permissions.test.ts)                   | Таблица истинности `can()` для admin / participant / curator / organizer + `getDefaultRoute` + `getNavigationItems` + `getScopeBadges`                    |
| [src/components/ErrorBoundary.test.jsx](../../src/components/ErrorBoundary.test.jsx) | Рендер children без ошибок, fallback UI с `role="alert"`, передача в `console.error`                                                                      |
| [server/index.test.cjs](../../server/index.test.cjs)                                 | supertest против `app`: CSRF guard (403 без cookie/header), exempt-paths, RBAC (401/403 без auth), zod validation (400 на невалидном теле), `/api/health` |

### Принципы

- **NODE_ENV=test** глушит pino и пропускает OTel-инициализацию — тесты не зависят от внешних коллекторов.
- Backend-тесты используют `app` экспорт из [server/index.cjs](../../server/index.cjs) и не поднимают TCP — supertest подключается напрямую.
- Vitest globals (`describe`, `it`, `expect`, `vi`) разрешены только в test-файлах — конфиг ESLint в [eslint.config.mjs](../../eslint.config.mjs) добавляет их для матчинга `**/*.test.*`.

## Слой 2 — Storybook play-тесты

Запуск: `npm run test:storybook:ci` (CI-вариант: статическая сборка + http-server + test-storybook).

Локально для отладки: `npm run storybook` в одном терминале → `npm run test:storybook` в другом.

### Что покрыто

Play-функции в существующих stories — взаимодействие с компонентами в headless Chromium через `storybook/test`:

- [src/components/participant/StateScalePicker.stories.jsx](../../src/components/participant/StateScalePicker.stories.jsx) — `ZoneCards` (клик по radio, проверка aria-checked) + `ZoneCardsKeyboardNavigation` (структурный smoke на radiogroup).
- [src/components/ui/Ui.stories.jsx](../../src/components/ui/Ui.stories.jsx) — `TabsClickInteraction` (клик переключает aria-selected, disabled tab не активируется).

Smoke-тесты Storybook автоматически рендерят все остальные stories (185 passed, 1 skipped — `AdminCabinetView` помечен `tags: ["!test"]` потому что нужен mocked AuthProvider).

### a11y

Параметр `a11y: { test: "todo" }` в [.storybook/preview.js](../../.storybook/preview.js) — axe-core прогоняется и показывает нарушения в Storybook UI, но **не валит CI**. Известные нарушения (chart SVG `<title>`) — отдельная задача.

## Слой 3 — Playwright E2E

Запуск: `npm run test:e2e` (или `test:e2e:ui` для interactive UI, `test:e2e:debug` для step-through).

Конфиг: [playwright.config.ts](../../playwright.config.ts) — авто-стартует Vite (`npm run dev:client`) с `VITE_USE_MOCK=true`, целит `http://127.0.0.1:5173`, chromium-only, traces / screenshots / video on failure.

### Стратегия: MSW вместо реального backend

E2E работают **против MSW мок-режима**, без Postgres и Express-сервера. Это даёт:

- детерминированный seed (`src/mocks/db.js` пишет в `localStorage`, ключ `newdiary-mock-api-v4`);
- скорость (один Vite dev-server, без БД);
- изоляция от инфраструктуры (CI не нужен Postgres);
- покрытие реальной auth-цепочки (MSW использует header `x-viewer-id` + `localStorage[newdiary-auth-user]` — всё работает в браузере).

Альтернатива «E2E против реального сервера + dockerized Postgres» — отдельная задача production-hardening.

### Сценарии

| Файл                                                       | Что проверяет                                                                                                                                                           |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [e2e/smoke.spec.ts](../../e2e/smoke.spec.ts)               | `/` → редирект на `/register`; форма видна; submit disabled до заполнения name + sessionId                                                                              |
| [e2e/registration.spec.ts](../../e2e/registration.spec.ts) | Заполнение → submit → landing на `/participant/session/.../today`; `localStorage["newdiary-auth-user"]` стоит; reload не теряет auth                                    |
| [e2e/theme.spec.ts](../../e2e/theme.spec.ts)               | Default light → клик "Тёмная" → `data-theme="dark"` + `localStorage["theme"]="dark"`; reload сохраняет (FOUC-prevention в `index.html` сработал); обратное переключение |
| [e2e/navigation.spec.ts](../../e2e/navigation.spec.ts)     | Несуществующий путь без auth → `/register`; nav-pills (Состояние / Узнать себя / Динамика) переключают URL                                                              |

### Custom fixture

[e2e/fixtures.ts](../../e2e/fixtures.ts) расширяет дефолтный `test`:

- На каждом тесте сначала очищает `localStorage` (включая мок-БД, auth-user, theme) — гарантирует свежий seed;
- Дожидается активации MSW service worker через `navigator.serviceWorker.ready` перед началом теста.

## CI

Слои собраны последовательно в [.github/workflows/docs-and-build.yml](../../.github/workflows/docs-and-build.yml):

```
Lint → Typecheck → Vitest → Build → Build Storybook → Install Playwright →
Storybook play-тесты → Playwright E2E → docs:check → docs:build
```

При падении Playwright — артефакт `playwright-report` загружается на 7 дней.

## Что НЕ покрыто (осознанно)

- **Visual regression** (Percy/Chromatic/Playwright snapshots) — снапшоты CSS-классов хрупкие при активном UI development.
- **Cross-browser E2E** — chromium-only достаточен для смока. Firefox/WebKit — отдельный спайк.
- **E2E против реального backend** — большая инфра (Postgres service container, fixtures, cleanup).
- **Performance / Lighthouse** — отдельный инструмент.
- **Live keyboard navigation в Storybook play-тестах** — гонки фокуса+React state в headless. Покрыто ручным QA.
