# План: Блок A — PostgreSQL + Docker Compose + SQLAlchemy + Alembic

**Slug:** `block-a-postgres-sqlalchemy-alembic`
**Ветка:** не создаётся (`git.create_branches=false`) — работа на `master`
**Дата создания:** 2026-06-02
**Источник требований:** `promt.md` (Блок A)

## Цель

Поднять PostgreSQL и подключить его к существующему FastAPI-сервису (`backend/`) через
SQLAlchemy 2.0 async (`asyncpg`), настроить миграции Alembic и оркестрацию через
Docker Compose (postgres + redis + backend). Это фундамент под будущие блоки (auth,
подписки, дашборд-конфиги, чат, комментарии, избранное).

## Настройки

- **Тесты:** да — лёгкие smoke-тесты (pytest), детерминированные, без живой БД.
- **Логирование:** verbose — INFO/DEBUG на старте БД, создании таблиц, инициализации
  движка. Секреты (пароль DSN, `secret_key`) **никогда** не логируются в открытом виде —
  только `present`/`ABSENT` или с маскированием.
- **Docs:** да — обязательный чекпоинт документации при завершении `/aif-implement`
  (обновить `backend/README.md`: запуск стенда, БД, миграции, Docker Compose).

## Roadmap Linkage

Milestone: "none"
Rationale: Roadmap-артефакт (`.ai-factory/ROADMAP.md`) отсутствует — линковка пропущена.

## Контекст текущего кода (важные расхождения с промтом)

Промт писался «по памяти» и местами расходится с реальным состоянием репозитория.
Реализация следует промту по существу, но с поправками ниже:

1. **Конфиг — pydantic-settings, не голые переменные.** `backend/app/config.py` уже
   использует класс `Settings(BaseSettings)`. Новые поля (`database_url`, `secret_key`,
   `algorithm`, `access_token_expire_minutes`, `uploads_dir`) добавляются **в этот класс**
   (нижний регистр, маппинг на UPPER_CASE env), а НЕ как отдельные модульные переменные.
   В коде используем `settings.database_url`, не `settings.DATABASE_URL`.
2. **Опечатка в healthcheck.** В промте `["CMD-EXEC", ...]` — такого Docker не знает.
   Используем `["CMD-SHELL", "pg_isready -U fintrack"]`.
3. **Python 3.11 vs 3.13.** Промт фиксирует `python:3.11-slim` в Dockerfile; DESCRIPTION.md
   упоминает 3.13 для локального запуска. Намеренно следуем промту (3.11-slim), при сборке
   проверяем установку зависимостей.
4. **`backend/.venv`.** Windows-venv лежит в `backend/` и несовместим с linux-контейнером —
   добавляем `.dockerignore`, чтобы он не попадал в образ через `COPY . .` / bind-mount.
5. **Нет `docker-compose.yml`, `Dockerfile`, Alembic, `database.py`, `models.py`** —
   всё создаётся с нуля. `main.py` lifespan уже есть и расширяется аддитивно.

**Не трогать:** роуты `/api/quotes/*`, CORS, Redis `close_client()`, `/health`,
`vite.config.ts` и всё во `frontend/src/`, фронтенд-хуки.

## Архитектурные рамки

Бэкенд — отдельный сервис, **не подчиняется** правилам зависимостей `src/` из
`ARCHITECTURE.md`. Слои бэкенда: `routes → services → cache/external`; добавляемый слой
данных (`database.py` + `models.py`) — горизонтальный, доступен из роутов через
dependency `get_db`. Enum-типы PostgreSQL именуются явно (`name=`) для корректного
autogenerate Alembic.

## Задачи по фазам

### Фаза 1 — Инфраструктура (Docker)
- [x] **Task 1** — `docker-compose.yml` в корне: postgres:14-alpine (+healthcheck CMD-SHELL),
  redis:alpine, backend (build ./backend, depends_on healthy postgres), volumes
  `postgres_data`/`uploads_data`.
- [x] **Task 2** — `backend/Dockerfile` (python:3.11-slim, uvicorn --reload) + `backend/.dockerignore`
  (.venv, __pycache__, .env). _Блокируется Task 3 (нужен финальный requirements для слоя кэша сборки)._

### Фаза 2 — Зависимости и конфигурация
- [x] **Task 3** — дополнить `backend/requirements.txt`: sqlalchemy[asyncio]>=2.0, asyncpg,
  alembic, passlib[bcrypt], python-jose[cryptography], python-multipart, aiofiles, pillow.
- [x] **Task 4** — расширить `Settings` в `backend/app/config.py` (database_url, secret_key,
  algorithm, access_token_expire_minutes, uploads_dir) + маскирующее логирование +
  обновить `backend/.env.example`.

### Фаза 3 — Слой данных (SQLAlchemy)
- [x] **Task 5** — `backend/app/database.py`: async engine, `AsyncSessionLocal`, `Base`,
  `get_db`. _Блокируется Task 3, 4._
- [x] **Task 6** — `backend/app/models.py`: 6 моделей (User, Subscription, DashboardConfig,
  ChatSession, Comment, Favorite) в стиле SQLAlchemy 2.0. _Блокируется Task 5._

### Фаза 4 — Миграции (Alembic)
- [x] **Task 7** — `alembic init alembic` в `backend/`, настройка `alembic.ini` + async
  `env.py` (импорт Base/models, target_metadata, run_async_migrations, compare_type=True),
  `alembic revision --autogenerate -m "initial tables"`. _Блокируется Task 1 (нужен
  поднятый postgres) и Task 6._

### Фаза 5 — Интеграция и проверка
- [x] **Task 8** — расширить lifespan в `backend/app/main.py`: `metadata.create_all` на старте
  (dev) в try/except, не ломая `/api/quotes/*` и Redis-shutdown. _Блокируется Task 6._
- [x] **Task 9** — smoke-тесты (pytest: metadata/health/config, без живой БД) + ручная
  проверка стенда из Шага 7 промта. _Блокируется Task 1, 2, 7, 8._

## Граф зависимостей

```
3 ─┬─> 2
   ├─> 4 ─> 5 ─> 6 ─┬─> 7 ─┐
   │                ├─> 8 ─┤
1 ─────────────────────────┴─> 9
```

## Commit Plan (чекпоинты)

> 9 задач → чекпоинты каждые ~3 задачи. Conventional Commits.

1. **После Task 1–2** (инфраструктура Docker):
   `chore(backend): docker-compose (postgres+redis+backend) + Dockerfile + dockerignore`
2. **После Task 3–6** (конфиг + слой данных):
   `feat(backend): SQLAlchemy async engine, Settings для БД/JWT и 6 моделей домена`
3. **После Task 7–8** (миграции + интеграция):
   `feat(backend): Alembic async + initial-миграция, create_all в lifespan`
4. **После Task 9** (тесты + проверка):
   `test(backend): smoke-тесты моделей/health/config + проверка стенда`

## Критерии готовности (DoD)

- `docker compose config` валиден; `docker compose up -d postgres redis` поднимает БД (healthy).
- `pip install -r requirements.txt` проходит на python 3.11.
- `alembic upgrade head` применяет initial-миграцию; в БД 6 таблиц + enum-типы.
- `uvicorn app.main:app` стартует, в логах видно создание таблиц, `GET /health` → 200.
- `pytest` зелёный (детерминирован, без внешней БД).
- Секреты не утекают в логи; `/api/quotes/*` и фронтенд не затронуты.
- `backend/README.md` обновлён (docs-чекпоинт).
