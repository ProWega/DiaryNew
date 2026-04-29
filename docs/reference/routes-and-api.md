# Маршруты и API верхнего уровня

Эта страница — curated inventory. Она не заменяет OpenAPI и не претендует на посимвольную спецификацию payload-ов.

## Web routes

| Маршрут | Назначение |
| --- | --- |
| `/register` | публичная регистрация участника |
| `/magic` | вход по magic link |
| `/setup/admin` | создание первого администратора |
| `/participant/session/:sessionId/today` | дневник состояния участника |
| `/participant/session/:sessionId/self` | раздел самопознания |
| `/participant/session/:sessionId/dynamics` | динамика участника |
| `/curator/session/:sessionId/group/:groupId` | кабинет куратора |
| `/organizer/session/:sessionId` | кабинет организатора |
| `/admin/security` | админский кабинет |

## API: public / auth

- `GET /api/health`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `POST /api/auth/magic-links`
- `POST /api/auth/magic-links/consume`
- `POST /api/setup/admin`
- `GET /api/public/events`
- `POST /api/participants/register`
- `GET /api/bootstrap`

## API: participant

- `GET /api/participant/sessions/:sessionId/diary`
- `PATCH /api/participant/sessions/:sessionId/diary/:entryId`
- `PATCH /api/participant/sessions/:sessionId/reflections/:dayId`

Participant diary payload включает опубликованные дни и мероприятия программы. Для настроенной рефлексии:

- `day.reflectionQuestions: [{ id, text, required }]` — вопросы итогов дня;
- `event.reflectionQuestions: [{ id, text, required }]` — вопросы конкретного мероприятия;
- `event.reflectionAnswers` — ответы участника на вопросы мероприятия;
- `day.reflection.answers` — ответы участника на вопросы дня.

`PATCH /diary/:entryId` принимает обычные поля отметки (`stateId`, `comment`, `confidence`) и `reflectionAnswers`. Обязательные event-вопросы валидируются при финальном сохранении карточки. Быстрый автосейв выбора состояния может передавать служебный `allowIncompleteReflection: true`, чтобы сохранить шкалу до заполнения текстовых ответов.

`PATCH /reflections/:dayId` принимает legacy `q1`/`q2`/`q3` или `answers` для day-level вопросов. Если обязательный day-вопрос пустой, черновик сохраняется, но `responded_at` не выставляется и рефлексия не засчитывается в прогресс.

## API: curator

- `GET /api/curator/sessions/:sessionId/groups/:groupId/dashboard`

## API: LLM prototype

- `POST /api/prototype/llm/sessions/:sessionId/groups/:groupId/comment-analysis`
  - запускает локальный Ollama-анализ комментариев выбранного curator scope;
  - body: `{ scopeId?, dayId?, model?, previewOnly? }`;
  - `previewOnly: true` возвращает обезличенный input и prompt без вызова Ollama.

## API: admin

- `GET /api/admin/dashboard`
- `GET /api/admin/workspace`
- `POST /api/admin/users`
- `PATCH /api/admin/users/:userId`
- `PATCH /api/admin/users/:userId/status`
- `POST /api/admin/users/:userId/assignments`
- `PATCH /api/admin/users/:userId/assignments/:sessionId`
- `POST /api/admin/sessions`
- `PATCH /api/admin/sessions/:sessionId`
- `PATCH /api/admin/sessions/:sessionId/registration`

## API: organizer

### Workspace и аналитика

- `GET /api/organizer/workspace`
- `POST /api/organizer/sessions`
- `PATCH /api/organizer/sessions/:sessionId`
- `PATCH /api/organizer/sessions/:sessionId/registration`
- `PATCH /api/organizer/sessions/:sessionId/settings`
- `GET /api/organizer/sessions/:sessionId/workspace`
- `GET /api/organizer/sessions/:sessionId/analytics`

### Groups

- `POST /api/organizer/sessions/:sessionId/groups`
- `PATCH /api/organizer/sessions/:sessionId/groups/:groupId`
- `DELETE /api/organizer/sessions/:sessionId/groups/:groupId`
- `PATCH /api/organizer/sessions/:sessionId/groups/:groupId/curator`
- `POST /api/organizer/sessions/:sessionId/groups/:groupId/participants`

### Programs, days, events

- `POST /api/organizer/sessions/:sessionId/programs`
- `PATCH /api/organizer/sessions/:sessionId/programs/:programId`
- `POST /api/organizer/sessions/:sessionId/programs/:programId/publish`
- `POST /api/organizer/sessions/:sessionId/programs/:programId/draft`
- `POST /api/organizer/sessions/:sessionId/programs/:programId/select`
- `POST /api/organizer/sessions/:sessionId/programs/:programId/days`
- `PATCH /api/organizer/sessions/:sessionId/programs/:programId/days/:dayId`
- `DELETE /api/organizer/sessions/:sessionId/programs/:programId/days/:dayId`
- `PATCH /api/organizer/sessions/:sessionId/programs/:programId/days/:dayId/flows`
- `PATCH /api/organizer/sessions/:sessionId/programs/:programId/days/:dayId/flow-order`
- `PATCH /api/organizer/sessions/:sessionId/programs/:programId/days/:dayId/events/:eventId`
- `POST /api/organizer/sessions/:sessionId/programs/:programId/days/:dayId/events/parallel`
- `DELETE /api/organizer/sessions/:sessionId/programs/:programId/days/:dayId/events/:eventId`
- `POST /api/organizer/sessions/:sessionId/programs/:programId/days/:dayId/events/:eventId/activate`

Program day и event payload поддерживают `reflectionQuestions: [{ id, text, required }]`.

- Для дней вопросы сохраняются в `program_days.reflection_prompts` и отображаются в participant-блоке «Итог дня».
- Для мероприятий вопросы сохраняются в `program_events.meta.reflectionQuestions` и отображаются внутри карточки события.
- Если список вопросов мероприятия пустой, participant view показывает старое поле комментария.

### Surveys

- `POST /api/organizer/sessions/:sessionId/surveys`
- `PATCH /api/organizer/sessions/:sessionId/surveys/:surveyId`
- `POST /api/organizer/sessions/:sessionId/surveys/:surveyId/questions`
- `PATCH /api/organizer/sessions/:sessionId/surveys/:surveyId/questions/:questionId`
- `POST /api/organizer/sessions/:sessionId/surveys/:surveyId/publish`

## Что не делаем в первом шаге

- не генерируем OpenAPI автоматически из `server/index.cjs`;
- не документируем каждый request/response schema как контракт-генерацию;
- не обещаем стабильный public API вне текущего внутреннего продукта.
