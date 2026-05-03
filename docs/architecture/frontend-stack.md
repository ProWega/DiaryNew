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

## CSS: токены и тёмная тема

CSS разбит на 10 модулей в `src/styles/`:

| Файл               | Что внутри                                                                   |
| ------------------ | ---------------------------------------------------------------------------- |
| `tokens.css`       | `:root` + `[data-theme="dark"]` — все цвета, отступы, радиусы, типографика   |
| `base.css`         | resets, `.visually-hidden`, `.theme-toggle`                                  |
| `layout.css`       | `.app-shell`, `.topbar`, `.ambient`, `.scope-strip`, `.subnav`, `.page-grid` |
| `registration.css` | публичный регистрационный flow                                               |
| `navigation.css`   | `.participant-topbar`, `.participant-nav`, `.participant-account-*`          |
| `components.css`   | UI-kit: pills, buttons, modal, toast, charts, forms                          |
| `participant.css`  | дневник, события, рефлексия                                                  |
| `organizer.css`    | программа, события, опросы                                                   |
| `curator.css`      | dashboard и pulse                                                            |
| `admin.css`        | админ-сайдбар                                                                |

Все импортируются через `src/styles/index.css`.

**Dark theme**: `useTheme` hook (`src/hooks/useTheme.js`) — читает `localStorage.theme` или `prefers-color-scheme`, ставит `data-theme` на `<html>`. Toggle button в `AppLayout.jsx` (для обеих топ-баров — `ParticipantTopbar` и staff topbar).

**FOUC-prevention**: inline-script в `index.html` ставит `data-theme` ДО React-рендера, чтобы избежать вспышки светлой темы при загрузке.

## Декомпозиция view

Большие view разбиты на feature-папки с co-location:

- `src/views/OrganizerCabinet/` — 7 файлов (главный компонент + панели вкладок + helpers)
- `src/views/CuratorDashboard/` — 8 файлов (главный + Pulse, GroupScore, ReflectionBrief, AI summary section)
- `src/components/organizer/` — 17 файлов программных редакторов + barrel `index.js` (был `OrganizerComponents.jsx` 4018 строк)

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
