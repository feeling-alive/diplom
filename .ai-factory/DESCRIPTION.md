# FinTrack — финансовый дашборд (дипломный проект)

## Обзор

FinTrack — настраиваемый финансовый дашборд для отслеживания крипто-, фондовых и форекс-активов в реальном времени. Дипломный проект (ВятГУ, ИСПк-402-52-00). Цель — впечатляющая демонстрация для руководителя: гибкий drag-and-drop дашборд в стиле iPhone, страница актива с TradingView-графиком и AI-чатом, агрегированные рыночные данные из публичных API.

## Ключевые функции

- **Кастомизируемый дашборд** — 20+ типов виджетов (KPI, watchlist, price chart, news, allocation, top movers, fear & greed, forex rates и др.), iPhone-style drag-and-drop, ресайз за край с овальным индикатором размера, карусель страниц, edit mode.
- **Страница актива** (`/asset/:symbol`) — TradingView Advanced Chart Widget в fullscreen, Recharts area-чарт, метрики со скроллом, CoinGecko-описание монеты, новости.
- **Market Overview** (`/market`) — сводка рынка, top movers, таблица активов со sparklines.
- **AI-чат** — Groq API, модель `llama-3.3-70b-versatile`, контекстный по активу.
- **Источники данных в реальном времени** — OKX WebSocket (крипто), Finnhub (акции), Frankfurter (форекс), NewsAPI (новости), CoinGecko (описание монет). Vite-прокси обходит CORS.
- **Авторизация** — LoginPage / RegisterPage / ProfilePage / SubscriptionPage / AdminPanelPage с `PrivateRoute`-гвардом.
- **Персистентность раскладки** — `localStorage` (`fintrack_widgets_v2`) с версионированием ключа и клампом по схеме виджет-реестра.

## Технологический стек

- **Язык:** TypeScript 6 (strict, `@typescript-eslint/no-explicit-any: error` — никаких `any`)
- **Сборка:** Vite 8 + `@vitejs/plugin-react`
- **UI-фреймворк:** React 19
- **Маршрутизация:** react-router-dom v7 (layout route с `<Outlet />`)
- **Состояние / данные:** TanStack Query 5, локальный `useState` + `localStorage`
- **Грид и DnD:** react-grid-layout (компактный по вертикали), react-resizable; `@dnd-kit/core`+`sortable` — резерв для других сценариев
- **Графики:** Recharts (area, pie), lightweight-charts v5 (свечи на странице актива), TradingView Advanced Chart Widget (через iframe)
- **Анимация:** Framer Motion (страничные переходы, hover, stagger)
- **Иконки:** lucide-react (никаких emoji в production-коде)
- **AI:** Groq REST API (env `VITE_GROQ_API_KEY`)
- **Тесты:** Vitest 4 + React Testing Library + jsdom (48+ тестов)
- **Линтер:** ESLint 10 flat config (`recommended` + `react-hooks` + `react-refresh` + ts-плагин)

## Заметки по архитектуре

- **Структура `src/`:** `pages/` (роуты), `components/{layout,dashboard,market-overview,asset}/`, `hooks/` (один файл на источник данных), `mock/` (fallback-данные), `types/` (market.types, widgets.types), `utils/` (format helpers), `lib/` (env), `config/`, `constants/`, `data/` (JSON-снимок 46 активов).
- **Хуки:** каждый принимает `useMock?: boolean = true` для разработки без ключей API. Поллинг — таймеры внутри хука (Finnhub 60s, прайсы 15s + jitter). OKX — WebSocket.
- **Виджеты:** описываются в `WIDGET_REGISTRY` (`src/types/widgets.types.ts` + соответствующий объект) — `minW/maxW/minH/maxH` обязательны на каждом элементе layout (иначе react-grid-layout не блокирует ручки ресайза).
- **Дизайн-система:** строгая палитра 11 цветов (см. `.ai-factory/RULES.md`), типографика Inter, радиусы 8/12/16/24/999, набор теней sm/md/lg.
- **Прокси:** `vite.config.ts` маршрутизирует `/api/finnhub`, `/api/news`, `/api/forex` на внешние API без раскрытия ключей в браузере.
- **Бэкенд (с 2026-05-30):** отдельный сервис `backend/` (FastAPI + Redis, Python 3.13) — прокси/кэш котировок (Finnhub/OKX/Frankfurter) под `/api/quotes`, TTL 60/30/300с, graceful degradation. Запуск: `uvicorn app.main:app --port 8000`. Миграция хуков фронта на него пока отложена.
- **Персистентность бэкенда (с 2026-06-02, Блок A):** PostgreSQL 14 + SQLAlchemy 2.0 async (`asyncpg`) + миграции Alembic. Слой данных — `backend/app/database.py` (async engine, `get_db`, `Base`) и `backend/app/models.py` (6 моделей: User, Subscription, DashboardConfig, ChatSession, Comment, Favorite). Оркестрация — `docker-compose.yml` в корне (postgres + redis + backend) и `backend/Dockerfile`. На этой машине host-порт Postgres = **5433** (5432 занят нативным PostgreSQL); внутри compose-сети — `postgres:5432`. Конфиг расширен полями `database_url`, `secret_key`, `algorithm`, `access_token_expire_minutes`, `uploads_dir` (auth-поля — задел под будущие блоки).

## Нефункциональные требования

- **Логирование:** verbose `console.debug('[ИмяКомпонента] ...')` во всех хуках и ключевых компонентах — обязательное соглашение, упрощает отладку демо.
- **Обработка ошибок:** каждый хук возвращает `{ data, isLoading, error }`; fallback на mock при ошибке внешнего API; компоненты рендерят empty state при отсутствии данных.
- **Безопасность:** ключи API только в `.env` (`VITE_*`), Vite-прокси для serverless-эндпоинтов; никогда не коммитить `.env` (он уже в `.gitignore`).
- **Производительность:** TanStack Query кэширует (`staleTime: 30мин` для статичных coin info), `useMemo`/`useCallback` для тяжёлых вычислений, мемоизация selector'ов.
- **Совместимость:** разработка на Windows 10 + PowerShell; пути в коде только относительные / POSIX-стиль.
- **Версионирование persisted state:** при изменении схемы виджет-реестра — бамп ключа `localStorage` + явное удаление legacy-ключей в `loadWidgets()`.

## Архитектура

Подробные правила архитектуры см. в `.ai-factory/ARCHITECTURE.md`.
Паттерн: **Feature-based Modular** (React SPA, вертикальные срезы по фичам + горизонтальные модули hooks/types/utils/lib).
