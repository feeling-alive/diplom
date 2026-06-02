# FinTrack Backend — FastAPI + Redis + PostgreSQL

Прокси-сервис, который ходит во внешние API котировок (Finnhub, OKX, Frankfurter)
и кэширует ответы в Redis, чтобы фронт не обращался к внешним API напрямую и не
светил ключи в браузере. С Блока A добавлен слой персистентности на PostgreSQL
(SQLAlchemy 2.0 async + Alembic) — задел под auth, подписки, дашборд-конфиги,
чат, комментарии и избранное.

## Стек

- FastAPI + Uvicorn (ASGI)
- Redis (кэш с TTL: акции 60с, крипта 30с, форекс 300с)
- PostgreSQL 14 + SQLAlchemy 2.0 async (`asyncpg`) + Alembic (миграции)
- httpx (async HTTP-клиент к внешним API)
- pydantic-settings + python-dotenv (конфиг из `.env`)
- Docker Compose (postgres + redis + backend)

## Быстрый старт

```bash
# 1. Redis (Docker — рекомендуется)
docker run -d --name fintrack-redis -p 6379:6379 redis:alpine

# 2. Зависимости (виртуальное окружение)
cd backend
python -m venv .venv
# Windows PowerShell:  .venv\Scripts\Activate.ps1
# Windows CMD/bash:    .venv\Scripts\activate
pip install -r requirements.txt

# 3. Конфиг
cp .env.example .env        # затем впишите свой FINNHUB_API_KEY

# 4. Запуск
uvicorn app.main:app --reload --port 8000
```

Проверка: <http://localhost:8000/health> → `{"status":"ok"}`.

## База данных, миграции и Docker (Блок A)

### Поднять стенд через Docker Compose

Из **корня проекта** (не из `backend/`):

```bash
# Только хранилища (для host-run uvicorn/alembic):
docker compose up -d postgres redis

# Либо весь стек (postgres + redis + backend в контейнере):
docker compose up --build
```

> **Порт PostgreSQL.** Внутри compose-сети сервисы общаются по `postgres:5432`.
> На хост Postgres опубликован как **`localhost:5433`** — порт 5432 часто занят
> локально установленным («нативным») PostgreSQL, из-за чего `localhost:5432`
> становится неоднозначным. Для запуска uvicorn/alembic **с хоста** используйте
> DSN с портом 5433 (см. ниже). Хотите вернуть 5432 — остановите нативный
> PostgreSQL и поменяйте маппинг `5433:5432` обратно на `5432:5432` в
> `docker-compose.yml`.

### Применить миграции (Alembic)

```bash
cd backend
# host-run: укажите host-порт 5433
# PowerShell:  $env:DATABASE_URL="postgresql+asyncpg://fintrack:fintrack_pass@localhost:5433/fintrack"
# bash:        export DATABASE_URL=postgresql+asyncpg://fintrack:fintrack_pass@localhost:5433/fintrack
alembic upgrade head          # применить миграции
alembic revision --autogenerate -m "описание"   # сгенерировать новую миграцию
```

Внутри контейнера `backend` переменная `DATABASE_URL` уже указывает на
`postgres:5432` (см. `docker-compose.yml`), порт переопределять не нужно.

### Схема и слой данных

- `app/database.py` — async engine, `AsyncSessionLocal`, `Base`, dependency `get_db`.
- `app/models.py` — 6 моделей: `User`, `Subscription`, `DashboardConfig`,
  `ChatSession`, `Comment`, `Favorite` (SQLAlchemy 2.0, UUID-ключи, PG-enum'ы).
- `alembic/` — async `env.py`, URL берётся из `settings.database_url`.
- В dev-режиме `lifespan` на старте делает `Base.metadata.create_all` (обёрнут в
  try/except — недоступная БД не валит сервис). В проде схему ведёт Alembic.

### Тесты

```bash
cd backend
pip install -r requirements-dev.txt
pytest                # детерминированы, живой Postgres НЕ требуется
```

## Переменные окружения

| Переменная | По умолчанию | Назначение |
|---|---|---|
| `FINNHUB_API_KEY` | `""` | Ключ Finnhub (котировки акций). Только в `backend/.env`. |
| `REDIS_URL` | `redis://localhost:6379` | Подключение к Redis. |
| `DATABASE_URL` | `postgresql+asyncpg://fintrack:fintrack_pass@localhost:5432/fintrack` | DSN PostgreSQL (asyncpg). На хосте используйте порт `5433`; в Docker — host `postgres:5432`. |
| `SECRET_KEY` | `your-secret-key-change-in-production` | Секрет для JWT. **Сменить в проде.** |
| `ALGORITHM` | `HS256` | Алгоритм подписи JWT. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `10080` | Время жизни access-токена, мин (7 дней). |
| `UPLOADS_DIR` | `uploads` | Каталог загружаемых файлов (аватары). |
| `GOOGLE_CLIENT_ID` | `""` | OAuth client id. Пусто → `/auth/google` отдаёт 501. |
| `GOOGLE_CLIENT_SECRET` | `""` | OAuth client secret. |
| `BACKEND_URL` | `http://localhost:8000` | Публичный URL бэкенда (для `redirect_uri`). |
| `FRONTEND_URL` | `http://localhost:5173` | URL фронта (редирект после OAuth-логина). |
| `CORS_ORIGINS` | `http://localhost:5173` | Разрешённые origin (Vite dev). |
| `STOCK_TTL` / `CRYPTO_TTL` / `FOREX_TTL` | `60` / `30` / `300` | TTL кэша, сек. |

## Эндпоинты

| Метод | Путь | Источник | TTL |
|---|---|---|---|
| GET | `/health` | — | — |
| GET | `/api/quotes/stock/{symbol}` | Finnhub | 60с |
| GET | `/api/quotes/stocks?symbols=AAPL,MSFT` | Finnhub (батч) | 60с |
| GET | `/api/quotes/crypto/{symbol}` | OKX REST | 30с |
| GET | `/api/quotes/forex/{from}/{to}` | Frankfurter | 300с |

Формат котировки: `{symbol, price, change, changePercent, volume}` (у форекса
дополнительно `from`, `to`, `rate`). Volume у акций всегда `0` — Finnhub `/quote`
его не отдаёт.

## Аутентификация (Блок B)

JWT доставляется в **HttpOnly-cookie** `access_token` (`samesite=lax`, срок 7 дней),
поэтому браузер шлёт его автоматически, а JS не имеет к нему доступа. Фронт ходит
на `/auth/*` через vite-proxy (`/auth → :8000`) — для браузера это same-origin, так
что cross-site проблем с cookie нет.

| Метод | Путь | Назначение |
|---|---|---|
| POST | `/auth/register` | Регистрация (email/username/password). Создаёт User + Subscription(free), ставит cookie. 409 если email/username заняты. |
| POST | `/auth/login` | Вход по email+password. 401 при неверных данных, 403 если `is_active=False`. |
| POST | `/auth/logout` | Удаляет cookie. |
| GET | `/auth/me` | Текущий пользователь (по cookie). 401 без/с невалидной cookie. |
| GET | `/auth/google` | Редирект на Google OAuth. **501**, если `GOOGLE_CLIENT_ID` пуст. |
| GET | `/auth/google/callback` | Обмен `code`, линковка/создание User, cookie, редирект на `FRONTEND_URL`. |

- Пароли — `bcrypt` напрямую (passlib 1.7.4 несовместим с bcrypt ≥ 4.1/5.x).
- Зависимости валидации email: `email-validator` (для `EmailStr`).
- Тесты: `pytest` (`tests/test_auth.py`) — register/login/401/me/501 на sqlite, без живого Postgres.

### Настройка Google OAuth (опционально)

1. В Google Cloud Console создать OAuth client (тип Web).
2. Authorized redirect URI: `{BACKEND_URL}/auth/google/callback` (по умолчанию `http://localhost:8000/auth/google/callback`).
3. Прописать `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` в `backend/.env`.
4. Без ключей кнопка «Войти через Google» приводит к 501 — это ожидаемо.

## Миграция фронта (на потом — в этой итерации хуки НЕ меняем)

Сейчас фронт ходит во внешние API напрямую/через старый vite-proxy. Бэкенд
поднят параллельно (vite-proxy `/api/quotes → :8000`), хуки пока не тронуты.

Текущие точки обращения (что переключать позже):

| Хук | Сейчас | После миграции |
|---|---|---|
| `useStockPrice.ts` | `/api/finnhub/quote?symbol=X&token=KEY` | `/api/quotes/stock/X` |
| `usePrices.ts` (акции) | `${ENV.FINNHUB_BASE_URL}/quote?...&token=KEY` | `/api/quotes/stocks?symbols=...` |
| `useAssetPrice.ts` (stock) | `/api/finnhub/quote?...&token=KEY` | `/api/quotes/stock/X` |
| `useAssetPrice.ts` (forex) | `${ENV.FRANKFURTER_BASE_URL}/latest` | `/api/quotes/forex/{from}/{to}` |
| `useForexRate.ts` | `${ENV.FRANKFURTER_BASE_URL}/latest` | `/api/quotes/forex/{from}/{to}` |
| `usePrices.ts` (крипта) | прямой `https://www.okx.com/...` | `/api/quotes/crypto/{symbol}` |

Шаги миграции (отдельная задача):
1. В `src/lib/env.ts` сменить дефолт `FINNHUB_BASE_URL` на `/api/quotes` (или ввести `QUOTES_BASE_URL`).
2. В хуках заменить пути и **убрать `token` из URL** — ключ теперь только на бэкенде.
3. OKX **WebSocket** в `useAssetPrice.ts` НЕ трогать — realtime остаётся на фронте.

## Безопасность

Старый Finnhub-ключ утёк в публичную git-историю и в `proxy.md` — **перевыпустите
его** и держите новый только в `backend/.env` (он в `.gitignore`).
