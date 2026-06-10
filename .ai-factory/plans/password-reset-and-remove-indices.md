# План: Восстановление пароля + удаление биржевых индексов

**Дата:** 2026-06-11  
**Ветка:** master (create_branches: false)  
**Задачи:** 11

## Настройки реализации

- **Тесты:** да (pytest на бэкенде, обновление Vitest-тестов на фронте)
- **Логирование:** verbose — `console.debug('[ComponentName] ...')` на фронте, Python `logger.debug(...)` на бэкенде
- **Документация:** обязательный чекпоинт после завершения (Задача 11)

---

## Задача 1 — Восстановление пароля через email

### Контекст

Существующий auth-модуль (`backend/app/auth/`) покрывает register/login/logout/me/google. Redis уже настроен и используется для кэша котировок. Токен сброса будет храниться в Redis с TTL 900с — новые поля в БД не нужны.

### Фаза 1: Backend

**Задача 1** — `backend/requirements.txt`, `backend/app/config.py`, `backend/.env.example`
- Добавить `fastapi-mail>=0.9`
- Расширить Settings полями: `smtp_host`, `smtp_port` (int, default 587), `smtp_user`, `smtp_password`, `smtp_from`
- Создать `.env.example` с комментариями для всех переменных
- Файлы: `backend/requirements.txt`, `backend/app/config.py`, `backend/.env.example`
- Лог: `DEBUG [email_service] smtp host={host}, port={port}` при инициализации

**Задача 2** — `backend/app/services/email.py`
- `ConnectionConfig` из config-полей
- `send_reset_email(to, reset_link)` — HTML-письмо, инлайн-шаблон, акцент #E11D48
- Graceful fallback: если `smtp_host` пустой — `DEBUG [email_service] SMTP not configured, link: {link}`
- Файл: `backend/app/services/email.py`

**Задача 3** — `backend/app/auth/schemas.py`, `backend/app/auth/router.py`
- Схемы: `ForgotPasswordRequest`, `ResetPasswordRequest`
- `POST /auth/forgot-password`: lookup → Redis SET `password_reset:{token}` TTL 900 → send_reset_email → 200
- `POST /auth/reset-password`: Redis GET → 400 если нет → update hash → Redis DEL → 200
- Нейтральный ответ на forgot (не раскрывать email-existence)
- Файлы: `backend/app/auth/schemas.py`, `backend/app/auth/router.py`

> **Коммит 1** после Задачи 3:  
> `feat(auth): password reset via email — forgot + reset endpoints, fastapi-mail`

---

### Фаза 2: Frontend

**Задача 4** — `frontend/src/lib/authApi.ts`
- `apiForgotPassword(email)` → POST /auth/forgot-password
- `apiResetPassword(token, newPassword)` → POST /auth/reset-password
- Оба с `credentials: 'include'`, обработка HTTP-ошибок
- Лог: `console.debug('[authApi] forgotPassword', email)`

**Задача 5** — `frontend/src/pages/ForgotPasswordPage.tsx`, `frontend/src/pages/ResetPasswordPage.tsx`
- ForgotPasswordPage: форма email, состояния idle/loading/success/error, нейтральный success, ссылка «← Войти»
- ResetPasswordPage: читать `?token=` из URL, валидировать; при отсутствии → ошибка; success → редирект /login через 3с
- Стиль: аналог LoginPage (card, тени, #E11D48, без MUI)
- Лог: `console.debug('[ForgotPasswordPage] submit', email)` / `console.debug('[ResetPasswordPage] submit token=', !!token)`

**Задача 6** — App.tsx / router, `frontend/src/pages/LoginPage.tsx`
- Зарегистрировать `/forgot-password` и `/reset-password` как публичные маршруты
- Добавить ссылку «Забыли пароль?» под полем пароля в LoginPage

> **Коммит 2** после Задачи 6:  
> `feat(frontend): forgot-password и reset-password pages + router + login link`

---

## Задача 2 — Удаление биржевых индексов

### Контекст

Индексы (SPX, IXIC, DJI, DAX, NKY, USOIL, UKOIL) были реализованы на статичных данных без API. Тип `'index'` фигурирует в 9 файлах: типы, данные, хуки, компоненты, тесты.

### Фаза 3: Удаление

**Задача 7** — Типы, данные, хуки
- `frontend/src/types/market.types.ts`: убрать `'index'` из union-типа
- `frontend/src/data/prices.json`: удалить 7 записей с `"type": "index"`
- `frontend/src/hooks/usePrices.ts`: убрать `indices: Asset[]`, фильтрацию, комментарий про static snapshot
- `frontend/src/hooks/useAssetPrice.ts`: убрать ветку `if (type === 'index')`

**Задача 8** — UI-компоненты
- `frontend/src/pages/MarketOverview.tsx`: убрать `'index'` из FilterType, убрать вкладку «Индексы»
- `frontend/src/components/market-overview/AssetTable.tsx`: убрать `'index'`, `indices`
- `frontend/src/components/market-overview/TopMovers.tsx`: аналогично
- `frontend/src/components/asset/SimpleChart.tsx`: убрать ветки `if (type === 'index')`

> **Коммит 3** после Задачи 8:  
> `feat(market): remove index asset type — no API source available`

---

## Фаза 4: Тесты

**Задача 9** — `backend/tests/test_password_reset.py` (5 кейсов)
- forgot_password_user_not_found → 200 нейтральный
- forgot_password_user_exists → 200, Redis.set вызван, send_reset_email вызван
- reset_password_invalid_token → 400
- reset_password_success → 200, hash обновлён, Redis.delete вызван
- reset_password_too_short → 422

**Задача 10** — Обновление frontend-тестов
- `AssetTable.test.tsx`, `MarketSummaryBar.test.tsx`, `MarketOverview.test.tsx`
- Убрать `'index'` из типов, удалить тест-кейсы для вкладки «Индексы», исправить моки `usePrices`
- Проверить: `npm run test` зелёный

> **Коммит 4** после Задачи 10:  
> `test: password reset backend tests + fix frontend index type tests`

---

## Фаза 5: Документация

**Задача 11** — `PROJECT_OVERVIEW.md`
- Добавить описание flow восстановления пароля в раздел «Аутентификация»
- Убрать упоминание индексов из раздела «Обзор рынка»
- Добавить строку «Восстановление пароля | Готово» в таблицу состояния

> **Коммит 5** после Задачи 11:  
> `docs: update PROJECT_OVERVIEW — password reset, remove indices`

---

## Граф зависимостей

```
1 → 2 → 3 → 9
            ↓
4 → 5 → 6
            ↓
7 → 8 → 10
            ↓
         6 + 10 → 11
```

---

## Итого

| # | Задача | Фаза | Зависит от | Статус |
|---|--------|------|------------|--------|
| 1 | fastapi-mail, конфиг, .env.example | Backend | — | ✅ |
| 2 | Email-сервис + HTML-шаблон | Backend | 1 | ✅ |
| 3 | Эндпоинты forgot/reset | Backend | 2 | ✅ |
| 4 | API-функции фронтенда | Frontend | — | ✅ |
| 5 | ForgotPasswordPage + ResetPasswordPage | Frontend | 4 | ✅ |
| 6 | Маршруты + ссылка в LoginPage | Frontend | 5 | ✅ |
| 7 | Убрать тип index (типы/данные/хуки) | Cleanup | — | ✅ |
| 8 | Убрать index из UI-компонентов | Cleanup | 7 | ✅ |
| 9 | Backend-тесты password reset | Tests | 3 | ✅ |
| 10 | Обновить frontend-тесты | Tests | 8 | ✅ |
| 11 | Обновить PROJECT_OVERVIEW.md | Docs | 6, 10 | ⏳ |
