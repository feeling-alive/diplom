# Отчёт: Реализация гибридного ИИ-анализа

## Что сделано

Убрана заглушка ИИ-ассистента на фронтенде и реализован полноценный гибридный анализ на бэкенде.

### Проблема

Раньше фронтенд (браузер пользователя) отправлял запросы напрямую в `api.groq.com` — это значило, что API-ключ Groq был доступен в исходном коде страницы, что небезопасно. Бэкенд же в эндпоинте `POST /api/chat/message` просто сохранял сообщения, не генерируя ответа.

### Решение

Теперь цепочка выглядит так:

```
Пользователь → Фронтенд → POST /api/chat/message → Бэкенд
                                                      │
                                                      ├── PatchTST (технический прогноз)
                                                      ├── Новости из БД (последние 5)
                                                      └── Groq API (финальный ответ)
                                                      ↓
                                              Ответ → Фронтенд → Чат
```

Бэкенд делает три вещи:
1. Получает технический прогноз PatchTST (UP/DOWN/SIDEWAYS)
2. Запрашивает свежие новости по активу из БД
3. Отправляет всё это в Groq LLM с промптом финансового аналитика
4. Сохраняет диалог в PostgreSQL

### Зачем GROQ_API_KEY в backend/.env

Ключ Groq перенесён с фронта на бэкенд, чтобы он не был доступен в браузере. В `backend/.env` нужно добавить:

```
GROQ_API_KEY=<тот-же-ключ-что-в-frontend/.env>
```

После этого `VITE_GROQ_API_KEY` во `frontend/.env` можно удалить — фронт больше не ходит напрямую в Groq.

### Изменённые файлы

**Бэкенд (Python/FastAPI):**
- `backend/app/config.py` — новый параметр `groq_api_key`
- `backend/app/services/groq_service.py` — HTTP-клиент для Groq API
- `backend/app/routes/chat.py` — `POST /api/chat/message` теперь генерирует ответ (PatchTST + новости + Groq)

**Фронтенд (React/TypeScript):**
- `frontend/src/hooks/useGroqChat.ts` — больше не вызывает `api.groq.com`, ходит на бэкенд
- `frontend/src/components/asset/TradingViewModal.tsx` — убрана заглушка, живой чат с трендом
- `frontend/src/components/asset/AIPanel.tsx` — убрана заглушка, живой чат с трендом

**Тесты:**
- `backend/tests/test_chat.py` — 8 тестов (обновлены)
- `backend/tests/test_groq.py` — 5 тестов (новые)
