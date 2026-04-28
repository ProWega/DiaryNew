# NewDiary Docs

NewDiary — платформа для сопровождения заезда по четырём ролям: `participant`, `curator`, `organizer`, `admin`. Эта документация — рабочий источник правды по запуску, деплою, QA-процессу и текущим ограничениям продукта.

## Что здесь лежит

- [Локальный запуск](/getting-started/local-setup) — как поднять проект у разработчика.
- [Первый администратор и auth](/getting-started/first-admin-and-auth) — setup token, magic links, базовые access-процедуры.
- [Роли и ключевые сценарии](/product/roles-and-flows) — что уже работает у участника, куратора, организатора и админа.
- [Ubuntu + Docker deploy](/deploy/ubuntu-docker) — канонический production-like путь через Docker Hub pull.
- [QA Playbook](/qa/playbook) — как организовать ручное тестирование, smoke и регрессию.
- [Обзор архитектуры](/architecture/overview) — где живут frontend, backend, данные и границы runtime.
- [Reference](/reference/environment) — env vars, npm scripts, маршруты и API верхнего уровня.

## Как устроен контур документации

- `README.md` — короткий вход в проект.
- `TODO.md` — текущий статус и roadmap.
- `docs/` — подробные рабочие инструкции и процессы.
- Storybook — отдельный UI reference, не замена продуктовой и эксплуатационной документации.

## Правило сопровождения

Документация считается частью Definition of Done:

1. Любое изменение env, release flow, ролей или пользовательского сценария обновляется в том же PR.
2. Generated reference-страницы не редактируются руками — они собираются через `npm run docs:generate`.
3. CI валидирует `npm run build`, `npm run build-storybook`, `npm run docs:check` и `npm run docs:build`.

## Быстрые ссылки

- [Release checklist](/deploy/release-checklist)
- [Smoke checklist](/qa/smoke-checklist)
- [Bug report template](/qa/bug-report-template)
- [Magic links и доступы](/ops/magic-links-and-access)
