# AI-Чат пайплайн анализа активов (PatchTST + Groq)

**Дата:** 2026-06-05  
**Ветка:** нет (fast-mode, `git.create_branches: false`)  
**Автор:** AI-агент  

---

## Settings

| Параметр | Значение |
|----------|----------|
| Testing | Нет |
| Logging | Verbose (DEBUG) |
| Docs | Нет |
| Roadmap | none (skipped) |

---

## Описание

Реализация эндпоинта `POST /api/chat/message`, который:
1. Принимает `symbol` и `message` от авторизованного пользователя
2. Скачивает свечи (OHLCV) через существующий `candles.get_candles()`
3. Кэширует прогноз в Redis (ключ `cache:predict:{symbol}`, TTL 60s)
4. Отправляет цены закрытия в Hugging Face Inference API (PatchTST)
5. Передаёт результат + вопрос в Groq API (Llama 3.3 70B) для генерации ответа на русском
6. Сохраняет историю диалога в `ChatSession` (с мерджем существующих сообщений)
7. Graceful degradation на каждом этапе

---

## Задачи

### Задача 1: Конфигурация — добавить API-ключи в Settings ✅

**Файл:** `backend/app/config.py`

Добавить в класс `Settings` поля:
- `hf_api_key: str = ""` — Hugging Face API токен (из `HF_API_KEY`)
- `hf_model_id: str = ""` — ID модели на Hugging Face (из `HF_MODEL_ID`)
- `groq_api_key: str = ""` — Groq API ключ (из `GROQ_API_KEY`)

Разместить в секции `# --- External API keys (Phase 2)` после `etherscan_api_key`. Дополнить `log_startup_config()` логированием наличия/отсутствия новых ключей.

---

### Задача 2: Сервис Hugging Face (PatchTST) ✅

**Новый файл:** `backend/app/services/patchtst.py`

Асинхронный сервис для запросов к Hugging Face Inference API. Реализовать:

- `get_prediction(candles: list[dict], symbol: str) -> dict` — основной метод
  - Извлекает цены закрытия (`close`) из массива свечей (candles)
  - Формирует тело запроса `{"inputs": {"close": [...], "symbol": symbol}}`
  - Отправляет POST на `https://api-inference.huggingface.co/models/{settings.hf_model_id}`
  - Парсит ответ: извлекает `direction` (UP/DOWN/SIDEWAYS) и `probability` (float)
  - Возвращает `{"direction": ..., "probability": ..., "source": "huggingface"}`
- Защита: если свечи пусты или API недоступен — вернуть нейтральный прогноз `{"direction": "SIDEWAYS", "probability": 0.5, "source": "fallback"}`
- Логирование: все ключевые шаги (fetch, parse, fallback) с level INFO/DEBUG
- Таймаут httpx: 15 секунд
- Graceful degradation: `try/except httpx.HTTPError` + `try/except (KeyError, ValueError, json.JSONDecodeError)`

---

### Задача 3: Сервис Groq API ✅

**Новый файл:** `backend/app/services/groq_service.py`

Асинхронный сервис для генерации текстового ответа через Groq.

Реализовать:
- `generate_response(user_message: str, symbol: str, current_price: float, prediction: dict) -> str`
  - Формирует системный промпт финансового аналитика на русском
  - В промпт включить: текущую цену, прогноз PatchTST (direction + probability), вопрос пользователя
  - Обязательный дисклеймер: «Данная информация не является инвестиционной рекомендацией»
  - POST на `https://api.groq.com/openai/v1/chat/completions`
  - Модель: `llama-3.3-70b-versatile`
  - Таймаут: 15 секунд
  - Вернуть текст ответа из `choices[0].message.content`

- Graceful degradation: если Groq недоступен — вернуть сообщение-заглушку:
  ```
  "⚠️ Сервис ИИ-анализа временно недоступен. Пожалуйста, попробуйте позже."
  ```

---

### Задача 4: Роутер чата ✅

**Новый файл:** `backend/app/routes/chat.py`

Реализовать:

**Pydantic схемы:**
- `ChatRequest`: `symbol: str` (1-32), `message: str` (1-2000)
- `ChatResponse`: `reply: str`, `prediction: dict` (direction + probability + source)

**Эндпоинт `POST /api/chat/message`:**
- Защита: `Depends(get_current_user)`
- Dependency: `Depends(get_db)` для сессии БД

**Логика (шаги):**

1. **Проверка кэша Redis:**
   - `get_cached(f"cache:predict:{symbol}")`
   - Если HIT — использовать кэшированный прогноз, пропустить HF

2. **Получение свечей:**
   - `candles.get_candles(symbol=symbol, tf="1H", limit=100)`
   - Извлечь текущую цену из последней свечи (`candles[-1]["c"]`)

3. **Прогноз PatchTST (если нет кэша):**
   - `patchtst.get_prediction(candles, symbol)`
   - Если успешно — `set_cached(f"cache:predict:{symbol}", result, ttl=60)`

4. **Генерация ответа Groq:**
   - `groq_service.generate_response(user_message, symbol, current_price, prediction)`

5. **Сохранение в БД (ChatSession):**
   - Поиск существующей сессии: `SELECT WHERE user_id=$uid AND symbol=$symbol`
   - Если найдена — мердж новых сообщений в JSON-массив `messages`
   - Если не найдена — создать новую `ChatSession` с `messages = [{"role": "user", "content": message}, {"role": "assistant", "content": reply}]`
   - Commit + refresh

6. **Ответ:** `ChatResponse(reply=groq_text, prediction=prediction)`

**Обработка ошибок:**
- Если candles пуст — заглушка "Не удалось получить данные для {symbol}"
- Если HF упал — нейтральный прогноз, Groq работает дальше
- Если Groq упал — заглушка, прогноз всё равно возвращаем
- Если БД упала при сохранении — логируем WARNING, ответ всё равно отдаём

---

### Задача 5: Подключение роутера в main.py ✅

**Файл:** `backend/app/main.py`

1. Добавить импорт: `from app.routes import chat` (дописать в строку 22)
2. Добавить `app.include_router(chat.router)` после `app.include_router(news.router)` (строка 101)

---

## Порядок выполнения

```
Задача 1 (config) → Задача 2 (patchtst) → Задача 3 (groq_service) → Задача 4 (chat route) → Задача 5 (main.py)
```

Задачи 2 и 3 независимы — могут выполняться параллельно. Задача 4 зависит от 2 и 3. Задача 5 зависит от 4.

## Commit

Один коммит в конце: `feat: add AI chat endpoint with PatchTST prediction and Groq analysis`
