# Первый администратор и auth

## Базовая модель доступа

В проекте есть четыре роли:

- `participant`
- `curator`
- `organizer`
- `admin`

Auth-контур основан на cookie sessions и magic links. Для production важны:

- `AUTH_SESSION_SECRET`
- `AUTH_COOKIE_SECURE`
- `AUTH_COOKIE_SAMESITE`
- `APP_BASE_URL`

## Создание первого администратора

1. Задайте `SETUP_TOKEN` в `.env` или `.env.docker`.
2. Откройте страницу `/setup/admin`.
3. Введите setup token и данные пользователя.

После создания первого админа этот маршрут больше не используется как основной входной поток.

## Как работает вход дальше

- Админ может создавать login magic links.
- Organizer и admin могут создавать invite magic links в рамках доступного заезда.
- Invite link создаёт пользователя при первом входе и привязывает его к `sessionId` / `groupId`.

## Где смотреть служебные команды

- [Magic links и доступы](/ops/magic-links-and-access)
- [Сервисные команды](/ops/service-commands)

## Практическое правило

Для ручных операций на сервере используйте heredoc-команды через `docker compose exec -T app node - <<'NODE'`, а не one-liner с `!`, чтобы не ловить bash history expansion.
