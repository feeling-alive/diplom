[← Настройки и валюты](settings.md) · [Back to README](../README.md)

# Бэкенд API

FastAPI-сервис (`backend/`) — прокси/кэш котировок, хранение данных пользователей, персистентность дашборда, система комментариев с ответами и уведомлениями.

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
| `SMTP_HOST` | SMTP-сервер для писем сброса пароля (опционально) |
| `SMTP_PORT` | Порт SMTP (обычно 587) |
| `SMTP_USER` | Логин SMTP |
| `SMTP_PASSWORD` | Пароль SMTP |
| `MAIL_FROM` | Адрес отправителя писем |

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
| `POST` | `/auth/forgot-password` | Запрос сброса пароля (токен в Redis TTL 900с, письмо fastapi-mail) |
| `POST` | `/auth/reset-password` | Сброс пароля по токену (bcrypt-хэш, токен удаляется) |

> Сброс пароля: ответ нейтральный (не раскрывает, существует ли аккаунт). Без SMTP — ссылка пишется в DEBUG-лог.
> **Зависимость:** `starlette>=0.40,<0.49` обязательный пин (fastapi-mail несовместим со starlette 1.x).

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

### Новости и комментарии `/api/news`

| Метод | Путь | Описание |
|-------|------|----------|
| `GET` | `/api/news` | Список новостных статей |
| `GET` | `/api/news/{article_id}/comments` | Комментарии к статье (только top-level + вложенные ответы) |
| `POST` | `/api/news/{article_id}/comments` | Добавить комментарий или ответ (parent_id опционален) |
| `POST` | `/api/news/comments/{comment_id}/like` | Лайк комментария (increment; создаёт уведомление type=`reaction`) |

Ответы на комментарии имеют глубину 1: top-level комментарии возвращаются с полем `replies[]`.

### Уведомления `/api/notifications`

| Метод | Путь | Описание |
|-------|------|----------|
| `GET` | `/api/notifications` | Список уведомлений текущего пользователя (limit 50, order by created_at desc) |
| `POST` | `/api/notifications/read-all` | Пометить все уведомления прочитанными |
| `POST` | `/api/notifications/{notification_id}/read` | Пометить одно уведомление прочитанным |

**Типы уведомлений:**

| Тип | Когда создаётся |
|-----|----------------|
| `comment_reply` | Кто-то ответил на ваш комментарий |
| `reaction` | Кто-то лайкнул ваш комментарий |

Самоуведомления исключены: если `sender_id == recipient_id`, уведомление не создаётся.

**NotificationOut schema:** `id`, `type`, `message`, `link`, `is_read`, `created_at`, `sender_username`, `sender_avatar_url`.

## Модели БД

`backend/app/models.py` (SQLAlchemy 2.0 async, PostgreSQL 14):

| Модель | Описание |
|--------|----------|
| `User` | id, email, username, hashed_password, avatar_url, is_admin |
| `Subscription` | user_id (FK), plan, expires_at, ai_requests_used |
| `DashboardConfig` | user_id (FK), layout (JSON) — envelope дашбордов |
| `ChatSession` | user_id (FK), asset_symbol, messages (JSON) |
| `Comment` | user_id (FK), article_url, text, likes, parent_id (самоссылочный FK, nullable), created_at |
| `Favorite` | user_id (FK), asset_symbol |
| `Notification` | user_id (FK, CASCADE), sender_id (FK, SET NULL), type, message, link, is_read, created_at |

Миграции — Alembic (`backend/alembic/`). Ключевые миграции:

- `add_parent_id_to_comments` — добавляет `parent_id` и индекс на таблицу `comments`
- `add_notifications_table` — создаёт таблицу `notifications` с индексами по `user_id` и `is_read`

## Frontend-хук уведомлений

`frontend/src/hooks/useNotifications.ts` — TanStack Query с поллингом раз в 30 секунд:

```ts
const { data, unreadCount, markAllRead, markRead } = useNotifications()
```

Хук активен только при авторизованной сессии (`enabled: !!user`). Bell-иконка в `DashboardHeader` показывает бейдж с `unreadCount` и выпадающий список уведомлений.

## Vite Proxy

`frontend/vite.config.ts` проксирует на `http://localhost:8000`:

```
/auth              → /auth
/users             → /users
/subscription      → /subscription
/dashboard         → /dashboard
/uploads           → /uploads
/api/quotes        → /api/quotes
/api/news          → /api/news
/api/notifications → /api/notifications
```

## Тесты бэкенда

```bash
cd backend
pytest -v
```

Покрытие: `test_auth.py`, `test_profile.py`, `test_dashboard.py` (9 кейсов), `test_quotes.py`, `test_password_reset.py` (7 кейсов).

> Один pre-existing красный тест `test_google_not_configured` — зависит от окружения (Google OAuth без ключей).

## Ключевые файлы

| Файл | Назначение |
|------|------------|
| `backend/app/main.py` | FastAPI app, CORS, монтирование роутеров и статики |
| `backend/app/models.py` | SQLAlchemy-модели (7 таблиц) |
| `backend/app/database.py` | async engine, `get_db`, `Base` |
| `backend/app/auth/` | JWT, bcrypt, Google OAuth, dependencies |
| `backend/app/routes/dashboard.py` | GET/PUT + `_normalize_to_envelope` + лимиты |
| `backend/app/routes/quotes.py` | Прокси котировок + Redis-кэш |
| `backend/app/routes/news.py` | Новости, комментарии (threaded), лайки, `_create_notification` |
| `backend/app/routes/notifications.py` | GET/POST уведомлений |
| `backend/app/services/email.py` | fastapi-mail, HTML-шаблон письма сброса пароля |
| `docker-compose.yml` | postgres + redis + backend (dev-сборка) |
| `backend/alembic/` | Миграции БД |

## См. также

- [Несколько дашбордов](multi-dashboard.md) — как фронт использует `/dashboard/config`
- [Настройки и валюты](settings.md) — настройки пока в localStorage, не в БД
- [Система виджетов](widgets.md) — структура виджетов внутри layout JSON
