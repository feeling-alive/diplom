[← Настройки и валюты](settings.md) · [Back to README](../README.md)

# Бэкенд API

FastAPI-сервис (`backend/`) — прокси/кэш котировок, хранение данных пользователей, персистентность дашборда.

## Запуск

**Через docker-compose (рекомендуется):**

```bash
docker-compose up --build   # postgres + redis + backend
```

**Вручную (разработка):**

```bash
cd backend
python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env        # заполнить DATABASE_URL, SECRET_KEY, FINNHUB_API_KEY
uvicorn app.main:app --reload --port 8000
```

> На Windows 10 хост-порт Postgres = **5433** (5432 занят нативным PostgreSQL). Внутри compose-сети — `postgres:5432`.

## Переменные окружения

| Переменная | Описание |
|------------|----------|
| `DATABASE_URL` | `postgresql+asyncpg://user:pass@host:port/db` |
| `SECRET_KEY` | JWT secret (любая длинная строка) |
| `ALGORITHM` | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | 60 |
| `FINNHUB_API_KEY` | Ключ Finnhub (ротировать — утёк в публичный git) |
| `REDIS_URL` | `redis://localhost:6379` |
| `FRONTEND_URL` | `http://localhost:5173` (CORS allow-origin) |
| `BACKEND_URL` | `http://localhost:8000` (Google OAuth callback) |

## Роуты

### Аутентификация `/auth`

| Метод | Путь | Описание |
|-------|------|----------|
| `POST` | `/auth/register` | Регистрация (bcrypt, JWT в HttpOnly cookie) |
| `POST` | `/auth/login` | Логин |
| `POST` | `/auth/logout` | Очистка cookie |
| `GET` | `/auth/me` | Текущий пользователь |
| `GET` | `/auth/google` | Редирект на Google OAuth (501 без `google_client_id`) |
| `GET` | `/auth/google/callback` | OAuth callback |

### Профиль `/users`

| Метод | Путь | Описание |
|-------|------|----------|
| `GET` | `/users/me` | Данные профиля |
| `PATCH` | `/users/me` | Обновить профиль |
| `GET` | `/users/check-username` | Проверить уникальность username |
| `POST` | `/users/me/avatar` | Загрузить аватар (Pillow center-crop 200×200) |

Аватары хранятся в `backend/uploads/avatars/{user_id}.jpg`. Доступны через `/uploads` (StaticFiles).

### Подписка `/subscription`

| Метод | Путь | Описание |
|-------|------|----------|
| `GET` | `/subscription/status` | Текущий план (free/premium) + лимиты |
| `POST` | `/subscription/upgrade` | Демо-активация premium на 30 дней |
| `POST` | `/subscription/cancel` | Отмена подписки |

Лимиты по плану: free — 5 виджетов, premium — без ограничений (вычисляются в коде, не в БД).

### Дашборд `/dashboard`

| Метод | Путь | Описание |
|-------|------|----------|
| `GET` | `/dashboard/config` | Получить envelope дашбордов (сеет дефолт при первом запросе) |
| `PUT` | `/dashboard/config` | Сохранить envelope; валидация лимитов |

**Envelope-схема:**

```json
{
  "dashboards": [
    { "id": "uuid", "name": "Основной", "layout": [...виджеты...] }
  ],
  "activeId": "uuid"
}
```

Лимиты: не более 5 дашбордов, не более 100 виджетов на дашборд.

### Котировки `/api/quotes`

| Метод | Путь | TTL кэша | Источник |
|-------|------|----------|----------|
| `GET` | `/api/quotes/stock/{symbol}` | 60 с | Finnhub |
| `GET` | `/api/quotes/crypto/{symbol}` | 30 с | OKX REST |
| `GET` | `/api/quotes/forex/{pair}` | 300 с | Frankfurter |

Кэш — Redis. При недоступности Redis — graceful degradation (запрос напрямую к источнику).

## Модели БД

`backend/app/models.py` (SQLAlchemy 2.0 async, PostgreSQL 14):

| Модель | Описание |
|--------|----------|
| `User` | id, email, username, hashed_password, avatar_url, is_admin |
| `Subscription` | user_id (FK), plan, expires_at, ai_requests_used |
| `DashboardConfig` | user_id (FK), layout (JSON) — envelope дашбордов |
| `ChatSession` | user_id (FK), asset_symbol, messages (JSON) |
| `Comment` | user_id (FK), asset_symbol, body, created_at |
| `Favorite` | user_id (FK), asset_symbol |

Миграции — Alembic (`backend/alembic/`).

## Vite Proxy

`frontend/vite.config.ts` проксирует на `http://localhost:8000`:

```
/auth         → /auth
/users        → /users
/subscription → /subscription
/dashboard    → /dashboard
/uploads      → /uploads
/api          → /api
```

## Тесты бэкенда

```bash
cd backend
pytest -v   # 33 passed (+ 1 pre-existing красный test_google_not_configured — зависит от окружения)
```

Покрытие: `test_auth.py`, `test_profile.py`, `test_dashboard.py` (9 кейсов), `test_quotes.py`.

## Ключевые файлы

| Файл | Назначение |
|------|------------|
| `backend/app/main.py` | FastAPI app, CORS, монтирование роутеров и статики |
| `backend/app/models.py` | SQLAlchemy-модели (6 таблиц) |
| `backend/app/database.py` | async engine, `get_db`, `Base` |
| `backend/app/auth/` | JWT, bcrypt, Google OAuth, dependencies |
| `backend/app/routes/dashboard.py` | GET/PUT + `_normalize_to_envelope` + лимиты |
| `backend/app/routes/quotes.py` | Прокси котировок + Redis-кэш |
| `docker-compose.yml` | postgres + redis + backend (dev-сборка) |
| `backend/alembic/` | Миграции БД |

## См. также

- [Несколько дашбордов](multi-dashboard.md) — как фронт использует `/dashboard/config`
- [Настройки и валюты](settings.md) — настройки пока в localStorage, не в БД
- [Система виджетов](widgets.md) — структура виджетов внутри layout JSON
