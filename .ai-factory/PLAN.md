# Ретуширование AI-чат пайплайна: два эндпоинта, Groq на фронте

**Дата:** 2026-06-05  
**Режим:** fast  

---

## Settings

| Параметр | Значение |
|----------|----------|
| Testing | Да |
| Logging | Verbose (DEBUG) |
| Docs | Нет |
| Roadmap | none (skipped) |

---

## Описание

Переработка AI-чат пайплайна под новую архитектуру:
- Groq API вызывается **с фронтенда**, а не с бэкенда
- Бэкенд отвечает только за: сбор свечей → инференс PatchTST (HF) → Redis-кэш → сохранение истории в PostgreSQL
- Два эндпоинта вместо одного:
  - `GET /api/chat/predict/{symbol}` — standalone прогноз PatchTST
  - `POST /api/chat/message` — сохранение диалога (фронт присылает готовый AI-ответ)

---

## Задачи

### Задача 1: config.py — убрать GROQ_API_KEY, зафиксировать HF_MODEL_ID

**Файл:** `backend/app/config.py`

- Удалить `groq_api_key: str = ""` из класса Settings
- Установить дефолт `hf_model_id: str = "nikasq/PatchTST-Time-Series-Classifier"`
- Обновить `log_startup_config()` — убрать `groq_api_key` из лога

---

### Задача 2: services/patchtst.py — переписать парсинг под классификатор

**Файл:** `backend/app/services/patchtst.py`

HF-модель `nikasq/PatchTST-Time-Series-Classifier` — это **классификатор**. Он возвращает массив `{label, score}`. Нужно найти лейбл с максимальным `score`.

- Изменить `get_prediction()`:
  - Отправлять только массив цен закрытия (close) как `inputs`
  - На выходе парсить ответ как `list[{"label": "UP"|"DOWN"|"SIDEWAYS", "score": float}]`
  - Найти лейбл с максимальным `score`
  - Вернуть `{"prediction": "UP", "probability": 0.85, "source": "huggingface"}`
- Ключи ответа: `prediction` и `probability` (вместо `direction`/`probability`)

---

### Задача 3: services/groq_service.py — удалить

**Файл:** `backend/app/services/groq_service.py`

Полностью удалить файл — Groq перенесён на фронтенд.

---

### Задача 4: routes/chat.py — два эндпоинта

**Файл:** `backend/app/routes/chat.py`

**Эндпоинт 1 — `GET /api/chat/predict/{symbol}`:**
- Auth: `Depends(get_current_user)`
- Проверить Redis кэш: `get_cached(f"cache:predict:{symbol}")`
- Если HIT — вернуть как есть
- Если MISS:
  - `candles.get_candles(symbol=symbol, tf="1H", limit=100)`
  - `patchtst.get_prediction(candles, symbol)`
  - `set_cached(key, result, ttl=60)`
- Graceful degradation на каждом шаге → fallback `{"prediction": "SIDEWAYS", "probability": 0.5}`
- **Ответ:** `PredictResponse(prediction=..., probability=..., source=...)`

**Эндпоинт 2 — `POST /api/chat/message`:**
- Auth: `Depends(get_current_user)`
- Pydantic `SaveMessageRequest {symbol, user_message, ai_message, metadata?: dict}`
- Ищет `ChatSession` по `(user_id, symbol)`
- Если есть — merge `messages` (append: `{role:"user", content:user_message}` + `{role:"assistant", content:ai_message, meta:metadata}`)
- Если нет — создать новую
- Graceful degradation: если БД упала — вернуть 200 с `saved: false`
- **Ответ:** `MessageSavedResponse(saved=True, session_id=...)`

---

### Задача 5: main.py — убрать импорт groq_service

**Файл:** `backend/app/main.py`

Убрать `from app.services.groq_service import ...` (такого импорта нет в main.py, только в chat.py, который переписывается). Просто проверить что не осталось ссылок на groq_service.

---

### Задача 6: Тесты

**Новый файл:** `backend/tests/test_chat.py`

Написать тесты для двух эндпоинтов:
1. `GET /predict/{symbol}` — проверка кэша, вызова HF, fallback при ошибке
2. `POST /message` — проверка создания сессии, мерджа сообщений, graceful degradation

---

## Порядок выполнения

```
Задача 1 → Задача 2 → Задача 3 → Задача 4 → Задача 5 → Задача 6
```

Задача 5 может выполняться параллельно с 3.
Задача 6 — после 4.

## Commit

Один коммит: `refactor(chat): split predict and message endpoints, move Groq to frontend`
