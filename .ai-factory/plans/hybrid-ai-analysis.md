# Гибридный ИИ-анализ: PatchTST + Groq + новости на бэкенде

**Ветка:** `master` (без создания ветки)
**Дата:** 2026-06-05
**Тип:** feature

## Настройки

| Параметр | Значение |
|----------|----------|
| Тестирование | Да |
| Логирование | Verbose (DEBUG) |
| Документация | Да (mandatory checkpoint) |

## Описание

Убрать заглушку ИИ-ассистента на фронтенде и реализовать гибридный ИИ-анализ на бэкенде:
- Фронтенд больше не ходит напрямую в `api.groq.com` (небезопасно)
- Бэкенд генерирует ответ LLM через Groq API, комбинируя технический прогноз PatchTST и фундаментальные новости
- API-ключ Groq защищён на бэкенде (не доступен в браузере)

---

## Задачи

### Фаза 1: Подготовка бэкенда

#### Задача 1.1: Добавить `groq_api_key` в конфиг

**Файл:** `backend/app/config.py`

- Добавить поле `groq_api_key: str = ""` в класс `Settings`
- Обновить `log_startup_config()` — выводить `present`/`ABSENT`, без раскрытия ключа
- Напомнить пользователю про `GROQ_API_KEY` в `backend/.env`

**Логирование:**
- `[config] groq_api_key=%s` с `"present" if settings.groq_api_key else "ABSENT"`

---

#### Задача 1.2: Создать сервис `groq_service.py`

**Файл:** `backend/app/services/groq_service.py`

Создать асинхронный сервис для вызова Groq API:

```python
async def get_groq_response(
    system_prompt: str,
    user_message: str,
    history: list[dict[str, str]] | None = None,
) -> str
```

- HTTP-запрос через `httpx` к `https://api.groq.com/v1/chat/completions`
- Модель: `llama3-8b-8192` (или `llama-3.3-70b-versatile`)
- Параметры: `temperature=0.7, max_tokens=512`
- Аутентификация: `Authorization: Bearer {settings.groq_api_key}`
- Graceful degradation: при ошибке сети/API/ключа — возвращать осмысленное сообщение-заглушку на русском (не падать с 500)

**Логирование:**
- `[groq_service] sending request model=%s prompt_len=%d`
- `[groq_service] response received status=%d reply_len=%d`
- `[groq_service] error: %s` при ошибках

**Обработка ошибок:**
- HTTPError, timeout, JSONDecodeError → возвращать `"Не удалось получить ответ от ИИ-модели. Попробуйте позже."`
- Отсутствие `groq_api_key` → возвращать `"ИИ-ассистент не настроен. Добавьте GROQ_API_KEY в .env."`

---

#### Задача 1.3: Реализовать получение новостей по символу

**Файл:** `backend/app/routes/chat.py` (новая вспомогательная функция)

Добавить функцию для получения последних 3-5 новостей по символу из БД:

```python
async def _get_news_context(db: AsyncSession, symbol: str) -> str
```

- Запрос к `NewsArticle`, фильтр по `symbols` (JSONB массив, содержит symbol)
- Сортировка по `published_at DESC`, лимит 5
- Сбор заголовков и description в текстовый блок
- Если новостей нет — возвращать `"Нет свежих новостей по данному активу."`

**Логирование:**
- `[chat] news context for %s: %d articles`

**Зависимости:** Задача 1.1 (конфиг уже готов)

---

### Фаза 2: Переработка эндпоинта чата

#### Задача 2.1: Расширить Pydantic-схемы

**Файл:** `backend/app/routes/chat.py`

Заменить/добавить новые схемы запроса и ответа:

```python
class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    symbol: str = Field(..., min_length=1, max_length=32)

class PredictionOut(BaseModel):
    direction: str
    probability: float
    source: str

class ChatResponse(BaseModel):
    reply: str
    prediction: PredictionOut | None = None
```

**Зависимости:** Задача 1.1

---

#### Задача 2.2: Переписать `POST /api/chat/message`

**Файл:** `backend/app/routes/chat.py`

Переписать функцию `chat_message`:

1. Получить `symbol` и `message` из тела запроса
2. **Технический прогноз:** вызвать `_get_prediction_cached(symbol)` — получает `{direction, probability, source}`
3. **Новостной контекст:** вызвать `_get_news_context(db, symbol)` (из Задачи 1.3)
4. **Системный промпт:** сформировать на русском:

```
Ты — профессиональный финансовый аналитик. Проанализируй актив {symbol}.

Текущий тренд (технический анализ PatchTST): {direction} (уверенность: {probability}%)
{news_context}

Вопрос пользователя: {user_message}

Дай краткий (3-5 предложений) взвешенный ответ на русском, объединяя технический анализ и фундаментальные новости. Не давай конкретных инвестиционных рекомендаций.
```

5. **История:** загрузить предыдущие сообщения из `ChatSession` для контекста (последние 6 сообщений)
6. **Запрос к Groq:** вызвать `get_groq_response(system_prompt, user_message, history)`
7. **Сохранение:** сохранить пару `user_message` + `reply` в `ChatSession` (существующая логика `_get_or_create_session` + `_merge_messages`)
8. **Ответ:** вернуть `ChatResponse(reply=groq_reply, prediction=prediction_out)`

**Логирование:**
- `[chat] POST /message user=%s symbol=%s msg_len=%d`
- `[chat] prediction: %s %.2f from=%s`
- `[chat] groq reply received len=%d`
- `[chat] session saved msg_count=%d`

**Зависимости:** Задачи 1.2, 1.3, 2.1

---

#### Задача 2.3: Обновить эндпоинт `GET /api/chat/predict/{symbol}`

**Файл:** `backend/app/routes/chat.py`

- Эндпоинт уже существует и работает корректно
- Убедиться, что импорты не сломались после переработки `POST /message`
- Проверить, что `SaveMessageResponse` / `ChatMessageSaveRequest` можно удалить или оставить для обратной совместимости

**Зависимости:** Задача 2.2

---

### Фаза 3: Оживление фронтенда

#### Задача 3.1: Убрать прямые вызовы Groq из `useGroqChat.ts`

**Файл:** `frontend/src/hooks/useGroqChat.ts`

Переписать хук так, чтобы он больше не отправлял запросы на `api.groq.com` напрямую.

Новая логика:
- Принимать `symbol?: string` в параметрах
- Вместо прямого `fetch` к `api.groq.com` — делать `POST /api/chat/message`
- Тело запроса: `{ message: userMessage, symbol: currentSymbol }`
- Ответ содержит `reply` (текст ИИ) и `prediction` (опционально)
- Сохранять только сообщения пользователя и ассистента (без системных)

```typescript
interface UseGroqChatOptions {
  systemPrompt: string
  symbol?: string
}

interface ChatResponse {
  reply: string
  prediction?: { direction: string; probability: number; source: string }
}
```

**Логирование:**
- `[useGroqChat] POST /api/chat/message symbol=%s msg=%s`
- `[useGroqChat] reply received len=%d`
- `[useGroqChat] error: %s`

**Зависимости:** Задача 2.2

---

#### Задача 3.2: Оживить `TradingViewModal` — убрать заглушку

**Файл:** `frontend/src/components/asset/TradingViewModal.tsx`

1. Убрать надпись `"Подключение к аналитической модели — следующий этап"`
2. Разблокировать кнопки-подсказки (`SUGGESTIONS`)
3. При нажатии на подсказку — отправлять запрос на бэкенд через обновлённый `useGroqChat` (с `symbol={asset.symbol}`)
4. Добавить инпут для ввода своего вопроса, привязанный к `useGroqChat`
5. Выводить ответ ИИ в окно чата справа от графика
6. Если в ответе есть `prediction` — показывать плашку тренда в шапке панели (UP/DOWN/SIDEWAYS с цветом и вероятностью)

**Логирование:**
- `[TradingViewModal] send prompt=%s`
- `[TradingViewModal] reply=%s`

**Зависимости:** Задача 3.1

---

#### Задача 3.3: Оживить `AIPanel` на странице актива

**Файл:** `frontend/src/components/asset/AIPanel.tsx`

Аналогично TradingViewModal:
1. Убрать `opacity: 0.6` и блокировку
2. Разблокировать кнопки-подсказки и инпут
3. Подключить `useGroqChat` с `symbol={symbol}` (приходит через props)
4. При отправке сообщения — делать запрос к `/api/chat/message`
5. Добавить отображение сообщений (история чата) + индикатор загрузки
6. Показывать плашку тренда из `prediction` если есть

**Логирование:**
- `[AIPanel] send prompt=%s`
- `[AIPanel] reply=%s`

**Зависимости:** Задача 3.1

---

#### Задача 3.4: Обновить `AssetPage` — передавать `symbol` в хуки

**Файл:** `frontend/src/pages/AssetPage.tsx`

- Убедиться, что `symbol` корректно передаётся в компоненты
- Проверить, что `AIPanel` получает актуальный `symbol` для ИИ-запросов
- При необходимости добавить логирование

**Зависимости:** Задача 3.3

---

### Фаза 4: Тестирование

#### Задача 4.1: Написать тесты для Groq-сервиса

**Файл:** `backend/tests/test_groq.py`

- `test_groq_response_returns_text` — мок httpx, ответ от Groq возвращает текст
- `test_groq_response_api_error_returns_fallback` — ошибка 500 → возвращается заглушка
- `test_groq_response_missing_key` — пустой `groq_api_key` → заглушка
- `test_groq_response_timeout` — таймаут → заглушка

**Зависимости:** Задача 1.2

---

#### Задача 4.2: Обновить тесты для `POST /api/chat/message`

**Файл:** `backend/tests/test_chat.py`

Существующие тесты проверяют старую логику (чистое сохранение). Нужно:
- Обновить моки: замокать `get_groq_response` и `get_prediction`
- `test_chat_message_with_symbol` — POST с `{message, symbol}` → возвращает `ChatResponse` с `reply` и `prediction`
- `test_chat_message_persists_history` — после POST сессия содержит сообщения
- `test_chat_message_unauthorized` — без JWT → 401
- `test_chat_news_context` — проверить, что новостной контекст включается

**Зависимости:** Задача 2.2

---

#### Задача 4.3: Написать тесты для news-context

**Файл:** `backend/tests/test_chat.py`

- `test_get_news_context_returns_text` — мок запроса к БД, возвращает форматированный текст
- `test_get_news_context_empty` — нет новостей → возвращает заглушку
- `test_get_news_context_symbol_filter` — фильтр по `symbols` работает

**Зависимости:** Задача 1.3

---

### Фаза 5: Документация

#### Задача 5.1: Обновить документацию AI-чата

Вызвать `/aif-docs` для обновления документации AI-чата после изменений.

**Зависимости:** Все задачи Фазы 1-4

---

## Порядок коммитов

| № | Коммит | Задачи |
|---|--------|--------|
| 1 | `feat(backend): add groq_api_key to config and create groq_service` | 1.1, 1.2 |
| 2 | `feat(backend): add news context helper and extend chat schemas` | 1.3, 2.1 |
| 3 | `feat(backend): rewrite POST /api/chat/message with hybrid AI analysis` | 2.2, 2.3 |
| 4 | `feat(frontend): redirect useGroqChat and rewire asset components` | 3.1, 3.2, 3.3, 3.4 |
| 5 | `test(backend): add tests for groq service and updated chat endpoint` | 4.1, 4.2, 4.3 |
| 6 | `docs: update AI chat documentation` | 5.1 |

---

## Примечания

- **Ключ Groq:** У тебя уже есть `VITE_GROQ_API_KEY` в `frontend/.env` — скопируй его значение в `backend/.env` как `GROQ_API_KEY=<тот-же-ключ>`. После реализации фронт перестанет ходить напрямую в `api.groq.com`, и `VITE_GROQ_API_KEY` на фронте станет не нужен (можно удалить).
- После реализации — проверить `npm run lint` и `npm run typecheck` на фронтенде
- Vite-proxy уже настроен для `/api/chat` → `:8000` (см. `vite.config.ts`)
- Существующие эндпоинты новостей (`/api/news`) не меняются — только чтение из БД
