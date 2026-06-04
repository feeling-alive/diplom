# Деплой FinTrack на Railway

## Архитектура

Проект деплоится как **3 сервиса** в одном Railway-проекте:

| Сервис | Что делает | Порт |
|--------|------------|------|
| `backend` | FastAPI + PostgreSQL + Redis | 8000 |
| `frontend` | nginx → статика SPA + прокси на backend | 3000 |
| `postgres` | База данных (Railway plugin) | — |
| `redis` | Кэш (Railway plugin, опционально) | — |

## Шаг 1: База данных

1. Зарегистрируйся на https://railway.app (через GitHub)
2. Создай новый **Project**
3. Нажми **New → Database → Add PostgreSQL**
4. Railway создаст БД и покажет **Connection URL**. Скопируй его.
5. Опционально: **New → Database → Add Redis**

## Шаг 2: Бэкенд

1. В том же проекте нажми **New → GitHub Repo**
2. Выбери репозиторий с проектом
3. Railway спросит **Root Directory** — укажи `backend`
4. Railway должен сам определить Dockerfile. Если нет — в **Settings → Build** выбери **Dockerfile**
5. В **Settings → Networking** → **Public Networking** → добавь порт **8000**
6. В **Variables** добавь:

| Variable | Значение |
|----------|----------|
| `DATABASE_URL` | Скопированный URL из PostgreSQL plugin |
| `SECRET_KEY` | Любая строка, например `railway-deploy-secret` |
| `FRONTEND_URL` | URL фронтенда после деплоя (пока пропусти) |
| `BACKEND_URL` | URL бэкенда (пока пропусти) |
| `CORS_ORIGINS` | URL фронтенда (пока пропусти) |

### Переменные для Railway Service-to-Service

Railway даёт каждому сервису внутренний URL вида `https://backend.railway.internal`. После создания фронтенда вернись сюда и обнови `CORS_ORIGINS` и `FRONTEND_URL`.

## Шаг 3: Фронтенд

1. В том же проекте снова **New → GitHub Repo** (выбери тот же репозиторий)
2. В **Root Directory** укажи `frontend`
3. Railway сам найдёт Dockerfile. В **Settings → Build** должно быть **Dockerfile**
4. В **Settings → Networking** → **Public Networking** → добавь порт **3000** (это будет публичный домен)
5. В **Variables** добавь:

| Variable | Значение |
|----------|----------|
| `BACKEND_HOST` | `backend` (внутреннее имя сервиса в Railway) |
| `BACKEND_PORT` | `8000` |

### Шаг 4: Связать сервисы (Service-to-Service)

Railway автоматически связывает сервисы в одном проекте. Фронтенд будет обращаться к бэкенду по имени `backend:8000` внутри Railway-сети.

## Шаг 5: Финальные переменные

После деплоя обоих сервисов — скопируй их Railway URL и обнови переменные:

**Бэкенд:**
- `FRONTEND_URL` = `https://frontend-xxxx.up.railway.app`
- `CORS_ORIGINS` = `https://frontend-xxxx.up.railway.app`

## Переменные ключей API (опционально)

| Variable | Где | Значение |
|----------|-----|----------|
| `FINNHUB_API_KEY` | Бэкенд | Ключ Finnhub |
| `NEWS_API_KEY` | Бэкенд | Ключ NewsAPI |
| `GOOGLE_CLIENT_ID` | Бэкенд | Для Google OAuth |
| `GOOGLE_CLIENT_SECRET` | Бэкенд | Для Google OAuth |
| `REDIS_URL` | Бэкенд | Из Redis plugin |

## Проверка

После деплоя открой `https://frontend-xxxx.up.railway.app`:

1. `/health` — должен вернуть `{"status":"ok"}`
2. `/register` — создать пользователя
3. `/login` — войти
4. `/` — дашборд с виджетами
5. `/asset/BTC` — страница актива
