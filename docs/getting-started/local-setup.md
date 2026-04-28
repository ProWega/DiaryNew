# Локальный запуск

## Что нужно заранее

- Node.js 22.x
- npm 10+
- PostgreSQL 16+ локально или в доступном окружении
- Git

## Установка

```bash
npm install
cp .env.example .env
```

После копирования `.env.example` проверьте как минимум:

- `APP_MODE=development`
- `APP_BASE_URL=http://localhost:5173`
- `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`

Список переменных и назначений — в [reference/env](/reference/environment).

## Подготовка базы

Применить схему:

```bash
npm run db:schema
```

Опционально заполнить демо-данными:

```bash
npm run db:seed
```

Если нужно полностью пересоздать локальную базу:

```bash
npm run db:reset
```

Проверить подключение и таблицы:

```bash
npm run db:check
```

## Запуск приложения

Frontend + backend вместе:

```bash
npm run dev
```

По отдельности:

```bash
npm run dev:client
npm run dev:server
```

Локальные адреса по умолчанию:

- frontend: `http://localhost:5173`
- backend/API: `http://localhost:4000`

## Storybook и docs-site

Storybook:

```bash
npm run storybook
```

Документация:

```bash
npm run docs:dev
```

## Проверка перед PR

Минимальный локальный verify:

```bash
npm run build
npm run build-storybook
npm run docs:check
npm run docs:build
```

## Если что-то не стартует

- Если backend не видит PostgreSQL — проверьте `.env` и `npm run db:check`.
- Если magic links ведут не туда — проверьте `APP_BASE_URL`.
- Если production-поведение случайно попало локально — проверьте `APP_MODE`.
