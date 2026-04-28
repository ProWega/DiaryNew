# Release checklist

## Перед релизом

- [ ] `npm run build`
- [ ] `npm run build-storybook`
- [ ] `npm run docs:check`
- [ ] `npm run docs:build`
- [ ] README / TODO / docs обновлены вместе с изменением поведения
- [ ] подготовлен release tag Docker-образа
- [ ] зафиксирован план smoke после выката

## Сборка и публикация образа

- [ ] `docker build -t prowega/newdiary:<tag> -t prowega/newdiary:latest .`
- [ ] `docker push prowega/newdiary:<tag>`
- [ ] `docker push prowega/newdiary:latest`
- [ ] tag образа сохранён в release note / задаче

## Выкат на сервер

- [ ] в `.env.docker` обновлён `APP_IMAGE` на точный tag
- [ ] `sudo docker compose --env-file .env.docker pull`
- [ ] `sudo docker compose --env-file .env.docker up -d`
- [ ] просмотрены `app` logs
- [ ] `curl http://127.0.0.1:4000/api/health`

## Smoke после выката

- [ ] admin может войти
- [ ] organizer видит заезд, программу и может сохранить вопросы рефлексии
- [ ] participant открывает дневник и видит настроенные вопросы в опубликованной программе
- [ ] curator открывает dashboard
- [ ] нет неожиданных 500/403 в основных сценариях

## Если нужен rollback

- [ ] выбран предыдущий стабильный image tag
- [ ] `APP_IMAGE` возвращён на этот tag
- [ ] выполнены `pull` + `up -d`
- [ ] повторён smoke-check
