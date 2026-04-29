# Ollama Comment Analysis Prototype

Ветка `llm-test` содержит локальный прототип анализа комментариев участников через Ollama и Qwen2.5-3B.

## Что делает прототип

- берёт существующий curator dashboard без нового SQL;
- выбирает текущий `scopeId` / `dayId`;
- обезличивает участников до `P001`, `P002` и т.д.;
- группирует event-level комментарии по событиям;
- добавляет характеристики заполненности, итоговую рефлексию дня и открытые риски;
- отправляет JSON-oriented prompt в локальный Ollama `/api/chat`;
- возвращает JSON-сводки по событиям, итоговой рефлексии и дню в целом.

## Локальный запуск

1. Установить Ollama.
2. Скачать модель:

```bash
npm run llm:pull:qwen25
```

3. Проверить `.env`:

```bash
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:3b-instruct-q4_K_M
OLLAMA_TIMEOUT_MS=420000
OLLAMA_NUM_CTX=1024
OLLAMA_NUM_PREDICT=192
```

Если локальный тег модели отличается, поменяйте `OLLAMA_MODEL`.

4. Запустить приложение:

```bash
npm run dev
```

5. Открыть routed-кабинет куратора и в блоке комментариев нажать `Запустить` в зоне `Qwen2.5-3B анализ комментариев`.

## API

```http
POST /api/prototype/llm/sessions/:sessionId/groups/:groupId/comment-analysis
```

Body:

```json
{
  "scopeId": "day-id-or-all",
  "dayId": "optional-day-id",
  "model": "qwen2.5:3b-instruct-q4_K_M",
  "previewOnly": false
}
```

Для проверки prompt без вызова модели:

```json
{
  "scopeId": "day-id-or-all",
  "previewOnly": true
}
```

## Privacy boundaries

- В prompt не отправляются имена участников, email, user id или контакты.
- Комментарии ограничены по длине и количеству на событие.
- Ответ модели не сохраняется в базу: это runtime-прототип для проверки качества сводок.
- Модель должна возвращать гипотезы и вопросы к куратору, а не автоматические решения за человека.
