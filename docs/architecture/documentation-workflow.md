# Контур документации

## Источники правды

- `README.md` — короткий вход в проект;
- `TODO.md` — статус и roadmap;
- `docs/` — подробные рабочие инструкции;
- generated reference-страницы — результат `npm run docs:generate`.

## Что собирается автоматически

Сейчас автоматически собираются:

- `docs/reference/environment.md` из `.env.example` и `deploy/app.env.example`;
- `docs/reference/scripts.md` из `package.json`.

Команды:

```bash
npm run docs:generate
npm run docs:check
npm run docs:build
```

## Как команда должна работать с документацией

Если PR меняет хотя бы одно из ниже:

- env vars;
- npm scripts;
- deploy flow;
- роли, маршруты или пользовательские сценарии;
- QA smoke / release procedure;

то в том же PR обновляются:

- релевантные страницы в `docs/`;
- при необходимости `README.md`;
- при необходимости `TODO.md`.

## CI-проверки

Workflow `.github/workflows/docs-and-build.yml` делает:

1. `npm ci`
2. `npm run build`
3. `npm run build-storybook`
4. `npm run docs:check`
5. `npm run docs:build`
6. upload docs-site и Storybook как artifacts

Это значит:

- generated docs нельзя “забыть” пересобрать;
- docs-site всегда можно посмотреть как build artifact;
- Storybook остаётся параллельным обзорным артефактом UI.
