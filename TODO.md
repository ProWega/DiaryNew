# TODO NewDiary

Статус на 28.04.2026: проект находится в состоянии рабочего production-like прототипа. Основные ролевые сценарии уже собраны, Docker-контур для Ubuntu есть, а документация и QA-процессы вынесены в отдельный docs-site.

## Что уже сделано

### Платформа и доступы

- React + Vite frontend, Express + PostgreSQL backend.
- Role-based доступы для `participant`, `curator`, `organizer`, `admin`.
- Cookie sessions, magic links, setup первого администратора.
- PostgreSQL-схема для пользователей, заездов, групп, программ, дневников, рефлексий, аналитики и audit log.

### Organizer

- создание и настройка заездов;
- регистрация и session settings;
- workspace программы, дни, события и параллельные потоки;
- publish / draft flow программы;
- группы, участники и session-scoped organizer routes;
- базовые аналитические и обзорные блоки по заезду.

### Participant

- mobile-first routed-flow `Состояние`, `Самопознание`, `Динамика`;
- выбор дня программы и работа по active day;
- оценка состояния по событиям, комментарий и дневная рефлексия;
- стабильный `StateScalePicker` и последовательное прохождение дня;
- корректные empty states для unpublished / published-empty сценариев.

### Curator

- routed-dashboard `Пульс дня` на реальных агрегатах;
- `Партитура группы`, бриф к рефлексии и сигналы организаторам;
- group-scoped данные из `diary_entries`, `daily_reflections`, `risk_signals`, `comment_clusters`, `ai_reports`;
- Storybook-сценарии для основных curator states, включая mobile.

### Документация и QA-операции

- `README.md` пересобран как короткий входной портал;
- `docs/` добавлен как VitePress-site для запуска, деплоя, QA, ops и архитектуры;
- generated reference-страницы для env vars и npm scripts;
- CI workflow с `build`, `build-storybook`, `docs:check`, `docs:build` и artifacts;
- отдельные QA-артефакты: smoke checklist, bug report template, UAT sign-off, release checklist.

## Ближайший фокус

1. Довести рабочие действия куратора:
   заметки, статусы обработки рисков, карточка участника, сохранение и audit trail.
2. Закрыть сквозную приёмку на серверном окружении:
   organizer -> participant -> curator -> admin по реальным smoke и regression checklist.
3. Усилить organizer/curator operational analytics на реальных данных без смысловых fallback-подстановок.
4. Дожать release discipline:
   backup/restore PostgreSQL, rollback drill, фиксированный release-note по Docker tags.

## Дальнейшие TODO

- закрепить командную привычку обновлять docs/README/TODO в том же PR, где меняется поведение;
- расширить curated reference по API и runtime flows без попытки хрупкой автогенерации OpenAPI из Express;
- развить production monitoring и журналирование вокруг server deploy;
- подготовить более формальный acceptance для тестовых заездов и UAT-сессий;
- развить следующий слой аналитики и AI pipeline только после стабилизации базовых ролевых сценариев.

## Рабочие артефакты

- [Документация проекта](docs/index.md)
- [Ubuntu + Docker deploy](docs/deploy/ubuntu-docker.md)
- [Release checklist](docs/deploy/release-checklist.md)
- [QA Playbook](docs/qa/playbook.md)
- [Smoke checklist](docs/qa/smoke-checklist.md)
- [Bug report template](docs/qa/bug-report-template.md)
- [Контур документации](docs/architecture/documentation-workflow.md)
