# Внедрение ИИ-пайплайна чата: PatchTST-классификатор

## 1. Список изменений и файлов

### Созданы с нуля

| Файл | Назначение |
|------|------------|
| `backend/app/services/patchtst.py` | Клиент Hugging Face Inference API для модели `nikasq/PatchTST-Time-Series-Classifier`. Извлекает цены закрытия из свечей, отправляет их в HF, парсит ответ в формате label/score. Реализована отказоустойчивость: при отсутствии ключа, ошибке сети или невалидном ответе возвращается нейтральный fallback. |
| `backend/tests/test_chat.py` | 9 тестов: публичный predict, fallback, 401 без JWT, сохранение с символом, общий чат (None/"general"), аккумуляция истории, изоляция сессий разных пользователей. Используют `monkeypatch` для изоляции Redis, свечей и предсказания. |

### Изменены

| Файл | Что изменено |
|------|-------------|
| `backend/app/config.py` | Удалена переменная `groq_api_key`. Добавлен дефолт `hf_model_id = "nikasq/PatchTST-Time-Series-Classifier"`. Обновлён `log_startup_config()`. |
| `backend/app/routes/chat.py` | Полностью переписан (2 итерации). Итерация 1: два эндпоинта + генерация reply на бэкенде. Итерация 2 (исправление): `POST /message` — чистый сервис сохранения без вызова predict, `symbol` опционален для общего чата. |

### Удалены

| Файл | Причина |
|------|---------|
| `backend/app/services/groq_service.py` | Groq API вызывается на фронтенде, а не на бэкенде. Сервис удалён — бэкенд больше не генерирует текст ответа. |

### Без изменений

| Файл | Почему |
|------|--------|
| `backend/app/main.py` | Роутер `chat.router` уже был подключён через `app.include_router(chat.router)`. Никаких правок не потребовалось. |

---

## 2. Настройки (`config.py`)

В Pydantic-класс `Settings` добавлены две переменные для Hugging Face:

```python
class Settings(BaseSettings):
    # ... остальные поля ...

    # --- AI / ML API keys ------------------------------------------------------
    hf_api_key: str = ""
    hf_model_id: str = "nikasq/PatchTST-Time-Series-Classifier"
```

- **`hf_api_key`** — API-ключ Hugging Face. Если не задан, сервис `patchtst.py` не пытается выполнить HTTP-запрос, а сразу возвращает нейтральный fallback с `source = "missing_config"`.
- **`hf_model_id`** — идентификатор модели на Hugging Face Hub. Значение по умолчанию — `nikasq/PatchTST-Time-Series-Classifier`.

Логгирование конфигурации обновлено:

```python
logger.info(
    "[config] hf_api_key=%s hf_model_id=%s",
    "present" if settings.hf_api_key else "ABSENT",
    settings.hf_model_id or "not set",
)
```

Ключ никогда не выводится в открытом виде — только маркер `present`/`ABSENT`.

---

## 3. Сервис PatchTST (`app/services/patchtst.py`)

### 3.1. Извлечение цен закрытия

Функция `_extract_close_prices` принимает массив свечей и возвращает список `float` цен закрытия. Поддерживает два формата:

```python
def _extract_close_prices(candles: list[dict[str, Any]]) -> list[float]:
    prices: list[float] = []
    for i, c in enumerate(candles):
        try:
            if isinstance(c, dict):
                price = float(c.get("c", 0))          # {t, o, h, l, c, v}
            elif isinstance(c, (list, tuple)):
                price = float(c[4]) if len(c) > 4 else 0.0  # OKX raw: [t, o, h, l, c, v]
            else:
                continue
            prices.append(price)
        except (TypeError, ValueError, IndexError):
            continue
    return prices
```

Свечи поступают из `get_candles()` (сервис `services/candles.py`), который нормализует данные от OKX, Finnhub или мок-фоллбека.

### 3.2. Запрос к Hugging Face Inference API

Основная функция `get_prediction`:

```python
async def get_prediction(
    candles: list[dict[str, Any]],
    symbol: str = "unknown",
) -> dict[str, Any]:
    close_prices = _extract_close_prices(candles)

    if not close_prices:
        return _neutral_prediction(symbol, reason="no_candle_data")

    if not settings.hf_api_key:
        return _neutral_prediction(symbol, reason="missing_config")

    url = f"https://api-inference.huggingface.co/models/{settings.hf_model_id}"

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            url,
            json={"inputs": close_prices},
            headers={"Authorization": f"Bearer {settings.hf_api_key}"},
        )
        resp.raise_for_status()
        raw = resp.json()

    parsed = _parse_classifier_response(raw)
    # ...
```

Модель `nikasq/PatchTST-Time-Series-Classifier` ожидает на входе массив чисел (цены закрытия) и возвращает классификационный ответ в формате `[[{"label": "UP", "score": 0.85}, {"label": "DOWN", "score": 0.15}]]`.

### 3.3. Парсинг ответа

Функция `_parse_classifier_response` обрабатывает ответ HF:

```python
def _parse_classifier_response(raw: Any) -> dict[str, Any] | None:
    try:
        if isinstance(raw, list) and len(raw) > 0:
            inner = raw[0] if isinstance(raw[0], list) else raw
            if isinstance(inner, list) and len(inner) > 0:
                best = max(inner, key=lambda x: float(x.get("score", 0)))
                label = str(best.get("label", "SIDEWAYS")).upper()
                if label not in ("UP", "DOWN", "SIDEWAYS"):
                    label = "SIDEWAYS"
                score = max(0.0, min(1.0, float(best.get("score", 0.5))))
                return {"prediction": label, "probability": score}
    except (TypeError, ValueError, KeyError, IndexError):
        pass
    return None
```

- Выбирает класс с максимальным `score`.
- Валидирует, что `label` — одно из допустимых значений (`UP`, `DOWN`, `SIDEWAYS`).
- Клиппирует `probability` в диапазон `[0, 1]`.

### 3.4. Отказоустойчивость (Graceful Degradation)

При сбое любого вида возвращается нейтральное предсказание:

```python
def _neutral_prediction(symbol: str, reason: str = "fallback") -> dict[str, Any]:
    return {
        "symbol": symbol,
        "prediction": "SIDEWAYS",
        "probability": 0.5,
        "source": reason,
    }
```

Код возврата — всегда `200 OK`. Клиент (фронтенд) определяет источник по полю `source`:

| Условие | `source` |
|---------|----------|
| Успешный ответ HF | `"huggingface"` |
| Нет API-ключа (`hf_api_key == ""`) | `"missing_config"` |
| Нет свечей | `"no_candle_data"` |
| HTTP-ошибка (4xx/5xx/таймаут) | `"hf_api_error"` |
| Ошибка парсинга JSON | `"parse_error"` |
| Неожиданная структура ответа | `"unexpected_response"` |

Это гарантирует, что UI никогда не увидит 5xx при недоступности HF — классификатор «тихо» возвращает нейтральную позицию.

---

## 4. Роутер чата (`app/routes/chat.py`)

### 4.1. Эндпоинт `GET /api/chat/predict/{symbol}` (публичный)

```python
@router.get("/predict/{symbol}", response_model=PredictionOut)
async def predict_public(symbol: str) -> PredictionOut:
    symbol = symbol.upper().strip()

    if not symbol:
        raise HTTPException(status_code=400, detail="symbol is required")

    prediction = await _get_prediction_cached(symbol)
    return _to_prediction_out(prediction)
```

- **Без JWT** — любой клиент может получить предсказание.
- Приводит символ к верхнему регистру.
- Возвращает `PredictionOut`:

```python
class PredictionOut(BaseModel):
    direction: str       # "UP" | "DOWN" | "SIDEWAYS"
    probability: float   # [0.0, 1.0]
    source: str          # "huggingface" | "fallback"
```

### 4.2. Эндпоинт `POST /api/chat/message` (JWT) — чистый сервис сохранения

**Важное архитектурное решение:** Groq API вызывается на фронтенде, а не на бэкенде. Бэкенд **не генерирует** текст ответа и **не вызывает** `_get_prediction_cached`. Эндпоинт — исключительно сервис персистентности истории.

```python
@router.post("/message", response_model=SaveMessageResponse)
async def chat_message(
    body: ChatMessageSaveRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SaveMessageResponse:
    symbol = _resolve_symbol(body.symbol)

    try:
        session = await _get_or_create_session(db, current_user.id, symbol)
        session.messages = _merge_messages(
            session.messages, body.user_message, body.ai_message
        )
        await db.commit()
        await db.refresh(session)
        msg_count = len(session.messages) if session.messages else 0
    except Exception as exc:
        logger.error("[chat] DB persist error: %s", exc)
        raise HTTPException(status_code=500, detail="failed to save message") from exc

    return SaveMessageResponse(
        status="ok",
        symbol=symbol,
        message_count=msg_count,
    )
```

- **Требует JWT** (валидация через `get_current_user`).
- Принимает `ChatMessageSaveRequest`:

```python
class ChatMessageSaveRequest(BaseModel):
    symbol: Optional[str] = None       # None или "general" → общий чат
    user_message: str                  # текст вопроса пользователя
    ai_message: str                    # ответ от Groq, полученный на фронтенде
```

- Возвращает `SaveMessageResponse`:

```python
class SaveMessageResponse(BaseModel):
    status: str = "ok"                 # всегда "ok" при успехе
    symbol: str                        # сохранённый символ (возможно "general")
    message_count: int                 # количество сообщений в сессии после сохранения
```

- Ошибки БД приводят к `500 Internal Server Error` (в отличие от старой версии, где ошибка логгировалась, но ответ всё равно возвращался). Это корректное поведение для сервиса, чья единственная ответственность — сохранение.

### 4.3. Кэширование в Redis

Только эндпоинт `GET /predict/{symbol}` использует `_get_prediction_cached`:

```python
PREDICTION_CACHE_TTL = 60  # секунд

async def _get_prediction_cached(symbol: str) -> dict[str, Any]:
    cache_key = f"cache:predict:{symbol}"

    # 1. Попытка чтения из Redis
    try:
        cached = await get_cached(cache_key)
        if cached is not None:
            return cached
    except Exception as exc:
        logger.warning("[chat] cache read error for %s: %s", symbol, exc)

    # 2. Cache miss — загружаем свечи и вызываем классификатор
    candles_data = await get_candles(symbol=symbol, timeframe="1H", limit=100)
    prediction = await get_prediction(
        candles_data.get("candles") or [], symbol=symbol
    )

    # 3. Сохраняем в Redis только успешный ответ от HF
    if prediction.get("source") == "huggingface":
        try:
            await set_cached(cache_key, prediction, PREDICTION_CACHE_TTL)
        except Exception as exc:
            logger.warning("[chat] cache write error for %s: %s", symbol, exc)

    return prediction
```

- Ключ: `cache:predict:{symbol}` (например, `cache:predict:BTC`).
- TTL: 60 секунд.
- Кэшируется **только** успешный ответ от HF (`source == "huggingface"`). Fallback не кэшируется — при повторном запросе будет снова предпринята попытка обратиться к HF.
- Сбои Redis (сеть, недоступность) обрабатываются через `try/except` — сервис продолжает работу без кэша (slow path, но не ошибка).

### 4.4. Поле `symbol`: гибкость общего чата vs чата на графике

У пользователя есть два сценария: **общий чат** (без тикера) и **чат на графике** (с конкретным активом). Поле `symbol` в `ChatMessageSaveRequest` опционально:

```python
symbol: Optional[str] = None
```

Функция `_resolve_symbol` нормализует значение перед сохранением:

```python
def _resolve_symbol(symbol: str | None) -> str:
    if symbol is None or symbol.strip().lower() in ("", "general"):
        return "general"
    return symbol.strip().upper()
```

| Переданное значение | Сохранённое в БД | Сценарий |
|---|---|---|
| `None` | `"general"` | Общий чат — фронтенд не указал тикер |
| `"general"` | `"general"` | Общий чат — явно указан |
| `""` (пустая строка) | `"general"` | Общий чат — пустая строка трактуется как general |
| `"BTC"` / `"btc"` | `"BTC"` | Чат на графике — символ маппится в верхний регистр |
| `"ETH-USDT"` | `"ETH-USDT"` | Чат на графике — составной тикер |

Таким образом, в таблице `chat_sessions` у пользователя может быть несколько сессий:
- одна сессия с `symbol = "general"` — для общего чата
- по одной сессии на каждый актив (`"BTC"`, `"ETH"`, и т.д.) — для чатов на графике

### 4.5. Сохранение истории в PostgreSQL (ChatSession)

Поиск существующей сессии:

```python
async def _get_or_create_session(
    db: AsyncSession,
    user_id: Any,
    symbol: str,
) -> ChatSession:
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.user_id == user_id,
            ChatSession.symbol == symbol,
        )
    )
    session = result.scalar_one_or_none()
    if session is not None:
        return session
    session = ChatSession(user_id=user_id, symbol=symbol, messages=[])
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session
```

- Ключ: пара `(user_id, symbol)` — у одного пользователя может быть одна сессия на символ.
- `symbol` хранится как строка (в таблице `chat_sessions`).
- Поле `messages` — `JSONB`, список словарей вида `{"role": "...", "content": "..."}`.
- Если сессия не найдена — создаётся новая с пустым массивом `messages`.

Мердж новых сообщений:

```python
def _merge_messages(
    existing: list[dict[str, str]] | None,
    user_msg: str,
    assistant_msg: str,
) -> list[dict[str, str]]:
    history = list(existing) if existing else []
    history.append({"role": "user", "content": user_msg})
    history.append({"role": "assistant", "content": assistant_msg})
    return history
```

- Дописывает пару `user → assistant` в конец массива.
- Используется внутри `chat_message`:

```python
session = await _get_or_create_session(db, current_user.id, symbol)
session.messages = _merge_messages(
    session.messages, body.user_message, body.ai_message
)
await db.commit()
```

- В отличие от первой версии, ошибка БД теперь пробрасывается как `500 Internal Server Error` через `raise HTTPException(status_code=500)`, так как единственная ответственность эндпоинта — персистентность; если БД недоступна, ответ не может быть корректно сформирован.

---

## 5. Подключение роутера (`main.py`)

Изменений в `main.py` не потребовалось — роутер `chat.router` уже был подключён ранее:

```python
from app.routes import chat, crypto, dashboard, forex, news, profile, quotes, subscription

app.include_router(chat.router)  # carries its own /api/chat prefix

logger.info("[main] auth/users/subscription/dashboard/news/chat routes mounted")
```

Роутер объявлен с собственным префиксом `prefix="/api/chat"`, поэтому итоговые пути:

- `GET  /api/chat/predict/{symbol}`
- `POST /api/chat/message`

---

## 6. Тесты (`backend/tests/test_chat.py`)

Покрытие: 9 тестов, все проходят.

### Predict (GET) — 3 теста

| Тест | Что проверяет |
|------|---------------|
| `test_predict_public_ok` | GET predict возвращает `direction="UP"`, `probability=0.82`, `source="huggingface"` |
| `test_predict_public_empty_symbol_returns_400` | Пустой символ → 400 |
| `test_predict_public_fallback_on_missing_data` | Когда мок возвращает fallback, predict отдаёт `SIDEWAYS` |

### Save (POST) — 6 тестов

| Тест | Что проверяет |
|------|---------------|
| `test_save_unauthenticated` | POST без JWT → 401 |
| `test_save_with_symbol` | POST с `symbol="BTC"` сохраняет как `"BTC"`, `message_count=2` |
| `test_save_general_chat_none` | POST без поля `symbol` → сохраняется как `"general"`, `message_count=2` |
| `test_save_general_chat_explicit` | POST с `symbol="general"` → сохраняется как `"general"`, `message_count=2` |
| `test_save_persists_history_accumulates` | Два POST с одинаковым `(user, symbol)` → `message_count` суммируется (2→4) |
| `test_save_separate_users_have_separate_sessions` | Два разных пользователя с одним символом → каждый получает отдельную сессию |

Изоляция:
- `_no_cache` — monkeypatch `get_cached`/`set_cached` (Redis не нужен).
- `_mock_candles` — monkeypatch `get_candles` (реальные API не вызываются).
- `_mock_prediction` — monkeypatch `get_prediction` (HF Inference API не вызывается).
- `conftest.py` предоставляет in-memory SQLite (`sqlite+aiosqlite:///:memory:`) для тестов, требующих БД.
