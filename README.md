# NewDiary

NewDiary - веб-приложение для получения обратной связи о мероприятии и личной рефлексии участников. Участник оценивает свое состояние после каждого события программы, видит полезные выводы и динамику, а организаторы получают общую картину по группам, событиям и заезду целиком.

Проект сейчас находится в стадии рабочего прототипа: публикация программы, mobile-first дневник, очищенный кабинет участника и кураторский "Пульс дня" на реальных агрегатах уже собраны. Следующий фокус - сквозная приемка, действия куратора с заметками и рисками, деплой и развитие аналитики.

## Что уже работает

- Ролевые маршруты и доступ для `participant`, `curator`, `organizer`, `admin`.
- Регистрация участников на публичные заезды через `/register`.
- Auth-контур: cookie sessions, dev auth, magic links, setup первого администратора.
- Express API с PostgreSQL-схемой для пользователей, заездов, групп, программ, событий, дневников, рефлексий, опросов, аналитики и audit log.
- Кабинет организатора:
  - создание и редактирование заездов;
  - управление регистрацией;
  - программа заезда, дни, события и параллельные потоки;
  - единый табличный конструктор расписания;
  - создание, редактирование, удаление и активация событий;
  - обзор групп и участников.
- Кабинет участника:
  - спокойная участническая верхняя панель без технических бейджей, с навигацией и меню аккаунта;
  - основной раздел `Состояние` для быстрого дневного ввода;
  - mobile-first дневник с компактными раскрываемыми карточками событий без автоскролла между шагами и последовательным заполнением дня;
  - prop-driven компонент `StateScalePicker` для шкалы состояния: `arc` как спидометр со слайдером и разведенными подписями зон, а также варианты `zones` и `compact`;
  - отметка состояния после событий;
  - комментарии и отметка "сложно оценить";
  - отдельный ритуал открытия итоговой рефлексии без перегруза аналитикой;
  - раздел `Узнать себя` как подготовленная входная карточка под тест статуса идентичности;
  - экран `Динамика` для личной траектории;
  - состояния `unpublished` и `published-empty` для неопубликованной или пустой опубликованной программы.
- Кабинет куратора:
  - `Пульс дня` по событиям группы на реальных отметках дневника;
  - `Партитура группы` участники × события, где пропуски остаются пустыми и не подменяются нейтральным значением;
  - бриф к дневной рефлексии по событиям, комментариям, рефлексиям и открытым рискам;
  - сигналы для живого разговора с организаторами без отправки через платформу;
  - group-scoped данные из `diary_entries`, `daily_reflections`, `risk_signals`, `comment_clusters`, `ai_reports`.
- Кабинет администратора для пользователей, заездов, назначений и безопасности.
- Storybook для компонентов и страниц с controls, viewport presets и `@storybook/addon-a11y`.

## Стек

- React 19
- Vite
- React Router
- Express 5
- PostgreSQL через `pg`
- Storybook 10
- SVG-графики без отдельной chart-библиотеки

## Быстрый старт

```bash
npm install
```

Создайте `.env` из примера и настройте подключение к PostgreSQL:

```bash
cp .env.example .env
```

Применить схему БД:

```bash
npm run db:schema
```

При необходимости заполнить демо-данными:

```bash
npm run db:seed
```

Запустить frontend и backend вместе:

```bash
npm run dev
```

По умолчанию:

- Vite client: `http://localhost:5173`
- Express API: `http://localhost:4000`
- Vite проксирует `/api` на backend из `vite.config.mjs`.

## Полезные команды

```bash
npm run dev              # backend + frontend
npm run dev:client       # только Vite
npm run dev:server       # только Express через nodemon
npm run start:server     # Express без nodemon
npm run db:schema        # применить server/sql/schema.sql
npm run db:seed          # демо-данные
npm run db:reset         # сбросить и создать схему заново
npm run db:check         # проверить таблицы
npm run build            # production build frontend
npm run storybook        # Storybook dev server
npm run build-storybook  # статическая сборка Storybook
```

## Основные маршруты

- `/register` - регистрация участника на открытый заезд
- `/magic` - вход по magic link
- `/setup/admin` - создание первого администратора
- `/participant/session/:sessionId/today` - раздел участника `Состояние`
- `/participant/session/:sessionId/self` - раздел участника `Узнать себя`
- `/participant/session/:sessionId/dynamics` - динамика участника
- `/curator/session/:sessionId/group/:groupId` - кабинет куратора
- `/organizer/session/:sessionId` - кабинет организатора
- `/admin/security` - кабинет администратора

## Архитектура

### Frontend

- `src/main.jsx` - точка входа
- `src/AppRouter.jsx` - корневой роутер
- `src/components/AppLayout.jsx` - общий layout приложения
- `src/pages/` - routed pages
- `src/views/` - экранные представления
- `src/components/` - переиспользуемые UI-компоненты
- `src/api/jsonApi.js` - клиентский API-слой
- `src/api/hooks.js` - hooks загрузки и мутаций
- `src/auth/AuthContext.jsx` - auth state, bootstrap и регистрация
- `src/rbac/permissions.js` - клиентские правила доступа

### Backend

- `server/index.cjs` - Express app и API routes
- `server/config.cjs` - env/config/auth helpers
- `server/sql/schema.sql` - PostgreSQL schema
- `server/db/postgres.cjs` - подключение и применение схемы
- `server/db/repositories/` - доступ к данным по доменам
- `server/db/organizerWorkspaceStore.cjs` - workspace организатора с PostgreSQL и fallback memory mode
- `server/seed/` - демо-данные
- `server/scripts/` - schema/reset/check scripts

### Storybook

- `.storybook/main.mjs` - stories из `src/**/*.stories.@(js|jsx)`
- `.storybook/preview.js` - global styles, controls, a11y, viewports
- `Participant/StateScalePicker` - проверка шкалы состояния через Controls: вариант отображения, нейтральный предпросмотр, анимация, выбранное состояние, disabled и описания.
- `Curator/Pulse Dashboard` - проверка кураторского брифа: `Normal`, `Mobile`, `NoResponses`, `NoPublishedProgram`, `HighRisk`, `EmptyClustersAndAi`.
- Новые компоненты нужно делать настраиваемыми через props и покрывать stories с controls.

## Данные и режимы хранения

В production-like режиме проект использует PostgreSQL. Конфигурация задается через `DATABASE_URL` или `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`, `PGSSL`.

Если PostgreSQL недоступен для workspace организатора, код временно падает назад в memory mode. Это удобно для разработки, но не является production-хранилищем.

В production важно задать:

- `APP_MODE=production`
- сильный `AUTH_SESSION_SECRET`
- корректный `APP_BASE_URL`
- secure-настройки cookie: `AUTH_COOKIE_SECURE`, `AUTH_COOKIE_SAMESITE`
- PostgreSQL connection settings
- `ALLOW_DEMO_SEED=false`

## Текущий фокус

Сценарий публикации программы реализован в едином табличном режиме раздела "Программа": организатор собирает расписание в таблице, видит статус в верхней панели, может нажать "Опубликовать программу" или "Вернуть в черновик". Карточный режим из окна организатора удален, чтобы не раздваивать основной flow. Backend переводит текущую программу в `published`/`draft`, а участники видят только опубликованную программу. Экран участника переведен на mobile-first flow: раздел `Состояние` ведет через компактные раскрываемые карточки событий без автоскролла, подробная аналитика свернута, итоговая рефлексия открывается отдельным ритуалом, а `Узнать себя` подготовлен под тест статуса идентичности.

Кураторский routed-раздел пересобран вокруг метафоры `Пульс дня`: экран показывает ритм событий группы, партитуру ответов участников, факты для дневной рефлексии и сигналы, которые куратор может передать организаторам вживую. Раздел работает по реальным PostgreSQL/API-агрегатам и не подставляет придуманные темы, заметки или AI-сводки при отсутствии данных.

Следующие ближайшие задачи:

- проверить сквозной сценарий "создать заезд -> заполнить программу в таблице -> опубликовать -> участник заполняет дневник -> организатор видит прогресс";
- добавить рабочие действия куратора: заметки, статусы обработки сигналов риска и панель участника;
- проверить Docker/Ubuntu deployment на сервере и подключить reverse proxy/TLS;
- укрепить backend/API-контракты публикации и развить аналитику с будущим AI pipeline.

Подробная дорожная карта лежит в [TODO.md](TODO.md).

## AI и аналитика

Сейчас аналитический слой частично rule-based:

- прогресс заполнения считается по опубликованной программе, событиям, участникам и ответам;
- дневной портрет участника строится из отметок состояния;
- кураторский `Пульс дня` и бриф к рефлексии строятся rule-based и evidence-based по фактическим записям без смысловых fallback-сводок;
- организаторские и кураторские сводки уже имеют структуру для дальнейшего развития;
- полноценный внешний LLM pipeline, embeddings, кластеризация комментариев и версионирование AI-отчетов пока не подключены.

## Storybook и компоненты

Все новые UI-компоненты должны быть:

- гибкими и настраиваемыми через props;
- устойчивыми к empty/loading/error/saving/disabled states;
- покрытыми Storybook stories;
- снабженными controls для ключевых props;
- проверенными минимум на desktop и mobile viewport.

## Деплой

Docker-конфигурация для Ubuntu добавлена:

- `Dockerfile` собирает Vite frontend, устанавливает production-зависимости и запускает Express;
- Express в production отдает API и собранный SPA из `dist` на одном порту `4000`;
- `docker-compose.yml` поднимает `app` + PostgreSQL с persistent volume;
- `deploy/app.env.example` фиксирует production env-переменные и секреты.

Быстрый запуск на Ubuntu:

```bash
cp deploy/app.env.example .env.docker
nano .env.docker
docker compose --env-file .env.docker up -d --build
docker compose --env-file .env.docker ps
docker compose --env-file .env.docker logs -f app
```

При старте контейнер приложения выполняет `npm run prod:init`, применяет PostgreSQL-схему и затем запускает `node server/index.cjs`. После первого запуска можно открыть `/setup/admin` и создать администратора с `SETUP_TOKEN`.

Для публичного production-доступа приложение лучше ставить за reverse proxy с TLS. В этом случае укажите реальный `APP_BASE_URL`, `AUTH_COOKIE_SECURE=true` и проксируйте внешний HTTPS на внутренний порт `4000`.

## Статус

Проект уже подходит для демонстрации ролей, пользовательских сценариев, структуры данных, organizer workspace и mobile-first дневника участника. До production-ready состояния нужно пройти сквозную приемку organizer -> participant, проверить Docker-деплой на Ubuntu-сервере с reverse proxy/TLS и довести аналитику до реального пайплайна.
