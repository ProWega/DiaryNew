# Frontend stack

React 19 + Vite 8 + react-router-dom v7. Инкрементальный TypeScript, React Query для данных, MSW для dev-моков.

## TypeScript: incremental adoption

Конфигурация — `tsconfig.json`: `allowJs: true`, `checkJs: false`, `strict: true`, `noEmit: true`. Vite собирает `.ts/.tsx` через esbuild без отдельной build-стадии TypeScript.

Мигрировано (5 модулей):

| Файл                      | Что внутри                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------ |
| `src/types/domain.ts`     | `Role`, `Permission`, `Assignment`, `Subject`, `CurrentUser`, `NavigationItem`                         |
| `src/lib/format.ts`       | `formatNumber`, `formatDate`, `formatRelative`                                                         |
| `src/lib/programDays.ts`  | `selectClosestProgramDay<T>`, генерик с `HasDateValue`                                                 |
| `src/lib/csrfToken.ts`    | `getCsrfToken()` — читает CSRF cookie                                                                  |
| `src/rbac/permissions.ts` | `can`, `getDefaultRoute`, `getNavigationItems`, `getScopeBadges` (discriminated union по `Permission`) |
| `src/api/jsonApi.ts`      | `ApiError`, `requestJson`, типизированный API-клиент                                                   |

Команда: `npm run typecheck` (запускается в pre-commit и CI).

Стратегия дальше: переводить `.jsx` → `.tsx` по мере содержательных правок, не делать big-bang миграцию. Источник истины для типов — `server/sql/schema.sql`.

## React Query

Все запросы и мутации идут через `@tanstack/react-query` v5. Старый `useAsyncResource` удалён.

Структура `src/api/hooks.js`:

- **`qk`** — query-key factory: `qk.participantDiary(viewerId, sessionId)`, `qk.organizerWorkspace(...)`, и т.д. Использовать ВСЕГДА вместо ручных массивов — это единственный путь к корректной инвалидации.
- **`useCommandMutation(messages)`** — обёртка над `useMutation` с executor-pattern + toast'ами.
- **`queryShape(query, queryKey, queryClient)`** — legacy-адаптер: возвращает `{data, loading, error, refresh, setData, setError}`. Нужен потому что views ещё не переведены на сырой `useQuery`.
- **Optimistic updates** — в `useParticipantDiary` через `queryClient.setQueryData(key, ...)` с rollback при ошибке.

Polling больше не через `setInterval`: `refetchInterval: mutation.saving ? false : 30000`.

`QueryClientProvider` инициализирован в `src/main.jsx` с `staleTime: 60_000, retry: 1`.

## MSW: моковый слой для dev

Активация: `VITE_USE_MOCK=true npm run dev:client`.

`src/main.jsx` ленится на динамический импорт worker'а:

```js
async function enableMocking() {
  if (import.meta.env.VITE_USE_MOCK !== "true") return;
  const { worker } = await import("./mocks/browser");
  return worker.start({ onUnhandledRequest: "warn" });
}
```

Структура `src/mocks/`:

- `browser.js` — `setupWorker(...handlers)`
- `handlers.js` — http-handlers, сгруппированные по доменам (auth, user, bootstrap, participant, curator, organizer, admin)
- `db.js` — in-memory DB на `localStorage` (key `newdiary-mock-api-v4`)
- `fixtures.js` — re-exports из `src/data/mockData.js` + статические каталоги (sessions, groups, users, state scale)

Mock-режим **не** валидирует CSRF — это проще держать для UI-разработки без реального бэкенда.

Service worker лежит в `public/mockServiceWorker.js` (сгенерирован `npx msw init`).

## CSS: токены и бренд «Истоки»

CSS разбит на модули в `src/styles/`:

| Файл               | Что внутри                                                                                            |
| ------------------ | ----------------------------------------------------------------------------------------------------- |
| `fonts.css`        | `@font-face` для Archimandrite (.otf) и TT Norms (Condensed Trial). Импортируется первым.             |
| `tokens.css`       | `:root` — все цвета (palette v2 «Истоки»: burgundy/gold/graphite/sand), отступы, радиусы, типографика |
| `base.css`         | resets, `.visually-hidden`                                                                            |
| `layout.css`       | `.app-shell`, `.topbar`, `.ambient`, `.scope-strip`, `.subnav`, `.page-grid`                          |
| `registration.css` | публичный регистрационный flow                                                                        |
| `navigation.css`   | `.participant-topbar`, `.participant-nav`, `.participant-account-*`                                   |
| `components.css`   | UI-kit: pills, buttons, modal, toast, charts, forms                                                   |
| `participant.css`  | дневник, события, рефлексия                                                                           |
| `organizer.css`    | программа, события, опросы, концепции мероприятий                                                     |
| `curator.css`      | dashboard, day-picker, chat, UsageBadge                                                               |
| `admin.css`        | админ-сайдбар                                                                                         |
| `istoki.css`       | public-лендинг «Истоки» (карта России и т.п.)                                                         |
| `methodology.css`  | state-scale и methodology v4 элементы (journey-stage chip, reflection editor)                         |

Все импортируются через `src/styles/index.css`. Тёмная тема удалена в текущей итерации — всегда светлая. Палитра «Истоки» применяется через bridge `--color-accent: var(--istoki-burgundy)` и т.д. — 95% компонентов автоматически на бренд-цветах без правок их CSS.

## Декомпозиция view

Большие view разбиты на feature-папки с co-location:

- `src/views/OrganizerCabinet/` — главный компонент + панели вкладок (SessionsTabPanel, ProgramTabPanel, GroupsTabPanel, SurveysTabPanel)
- `src/views/CuratorDashboard/` — legacy-дашборд (Pulse, GroupScore, ReflectionBrief, AI summary section)
- `src/views/CuratorBrief/` — methodology v4: ChatPanel + sections/{ReflectionNoteSection, DayPickerStrip, ParticipantCardSection, ProgramScoreSection}
- `src/components/organizer/` — программные редакторы + EventConceptsPanel + SessionLlmSettingsCard + barrel `index.js`
- `src/components/curator/` — UsageBadge и др. curator-only UI

Шаблон: `index.jsx` re-export → `<Feature>View.jsx` (главный) → секционные компоненты + `_helpers.js`.

## UI kit

`src/components/ui/`:

| Компонент        | Назначение                                                         |
| ---------------- | ------------------------------------------------------------------ |
| `Button.jsx`     | Variants: primary / ghost / danger; sizes: sm / md; loading state. |
| `EmptyState.jsx` | Centered placeholder: title + description + action slot.           |
| `Modal.jsx`      | Portal-based, Escape + backdrop close, focus restoration.          |
| `Toast.jsx`      | Provider + `useToast` hook (используется в `useCommandMutation`).  |
| `Tabs.jsx`       | Accessible tab list.                                               |
| `Field.jsx`      | Form field wrapper.                                                |
| `Pills.jsx`      | `SoftPill`, `StatusPill`, `AlertCard`.                             |

Каждый компонент использует CSS-классы из `src/styles/components.css`.
