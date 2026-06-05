# FinTrack — финансовый дашборд (дипломный проект)

## Обзор

FinTrack — настраиваемый финансовый дашборд для отслеживания крипто-, фондовых и форекс-активов в реальном времени. Дипломный проект (ВятГУ, ИСПк-402-52-00). Цель — впечатляющая демонстрация для руководителя: гибкий drag-and-drop дашборд в стиле iPhone, страница актива с TradingView-графиком и AI-чатом, агрегированные рыночные данные из публичных API.

## Ключевые функции

- **Кастомизируемый дашборд** — 20+ типов виджетов (KPI, watchlist, price chart, news, allocation, top movers, fear & greed, forex rates и др.), iPhone-style drag-and-drop, ресайз за край с овальным индикатором размера, карусель страниц, edit mode.
- **Страница актива** (`/asset/:symbol`) — TradingView Advanced Chart Widget в fullscreen, Recharts area-чарт, метрики со скроллом, CoinGecko-описание монеты, новости.
- **Market Overview** (`/market`) — сводка рынка, top movers, таблица активов со sparklines.
- **AI-чат** — бэкенд-endpoint `POST /api/chat/message`: авторизация JWT, свечи OHLCV → Hugging Face PatchTST (прогноз UP/DOWN/SIDEWAYS) → Groq Llama 3.3 (ответ на русском), сохранение истории в `ChatSession`, кэш прогноза в Redis (60s), graceful degradation на каждом этапе.
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
- **AI-чат (с 2026-06-05):** эндпоинт `POST /api/chat/message` — OHLCV свечи → Hugging Face PatchTST (прогноз UP/DOWN/SIDEWAYS) → Groq Llama 3.3 (фин. аналитик на русском). Кэш прогноза в Redis (60s), сохранение истории в `ChatSession` (мердж по symbol+user). Graceful degradation на каждом этапе. Сервисы: `services/patchtst.py`, `services/groq_service.py`, `routes/chat.py`.
- **Апгрейд ИИ-модуля (с 2026-06-05):** параметры инференса вынесены в конфиг (`prediction_seq_len`/`prediction_timeframe`/`prediction_confidence_threshold`/`prediction_margin`, `news_context_limit`, `general_news_enabled`). Подготовка признаков + опц. нормализация скейлером — `services/features.py` (ленивый `joblib`-load `app/ml/scaler.pkl`, graceful fallback на сырые close-цены; новые зависимости `numpy`/`joblib`/`scikit-learn`, импортируются лениво). **Порог уверенности**: слабый `UP`/`DOWN` (ниже порога или с малым margin над runner-up) понижается до `SIDEWAYS` с флагом `low_confidence` — решает «проблему боковика». Новости в чат-контексте матчатся по базовому тикеру (`services/symbols.py::base_ticker`, `BTC-USDT→BTC`) с фоллбэками (текст/категория). Фронт: хук `hooks/usePrediction.ts`, `low_confidence` в бейдже `AIPanel` (теперь смонтирован на `AssetPage`), виджет `AiSignalWidget` переведён с мока на реальные данные.
- **Персистентность бэкенда (с 2026-06-02, Блок A):** PostgreSQL 14 + SQLAlchemy 2.0 async (`asyncpg`) + миграции Alembic. Слой данных — `backend/app/database.py` (async engine, `get_db`, `Base`) и `backend/app/models.py` (9 моделей: User, Subscription, DashboardConfig, ChatSession, Comment, Favorite, NewsArticle, NewsReaction, NewsFavorite). Оркестрация — `docker-compose.yml` в корне (postgres + redis + backend) и `backend/Dockerfile`. На этой машине host-порт Postgres = **5433** (5432 занят нативным PostgreSQL); внутри compose-сети — `postgres:5432`. Конфиг расширен полями `database_url`, `secret_key`, `algorithm`, `access_token_expire_minutes`, `uploads_dir` (auth-поля — задел под будущие блоки).
- **Профиль + подписка (с 2026-06-02, Блок C+G):** модуль профиля пользователя и демо-подписки. Backend — роуты `backend/app/routes/profile.py` (prefix `/users`: `GET/PATCH /me`, `check-username`, `POST /me/avatar` — Pillow center-crop 200×200 в `uploads/avatars/{id}.jpg`) и `subscription.py` (prefix `/subscription`: `status`/`upgrade` (демо-premium 30 дн)/`cancel`). Лимиты/фича-флаги выводятся из `plan` в коде (free=5 / premium=9999+всё true), в БД не хранятся; добавлена колонка `Subscription.ai_requests_used` (миграция `3b1f7c2a9d04`). `main.py` монтирует статику `/uploads` (StaticFiles) и расширяет CORS до `PATCH`. Frontend — светлая дизайн-система (НЕ MUI): `lib/profileApi.ts`, хуки `useProfile`/`useSubscription` (auth-backed, без `useMock`), `AuthContext.updateUser(partial)`, компоненты `components/profile/` (ProfileHero+blobs, AvatarUploader, ProfileEditCard) и общий `components/ui/SubscriptionCard.tsx` (Free/Premium-переключатель, цены в ₽: 990₽/мес), переписанная `ProfilePage` (Hero+2 карточки) и `SubscriptionPage` (на бэкенд, без localStorage/эмодзи), сайдбар с реальным аватаром (self-hosted `/uploads`, fallback — CSS-инициал) и всплывающим меню. Vite-proxy `/users|/subscription|/uploads → :8000`. Тесты — `backend/tests/test_profile.py` (7 кейсов, зелёные).
- **Аутентификация (с 2026-06-02, Блок B):** JWT в HttpOnly-cookie + Google OAuth. Backend — модуль `backend/app/auth/` (`utils` bcrypt+jose, `schemas`, `dependencies` `get_current_user`/`require_admin`, `router` `/auth/register|login|logout|me|google|google/callback`). Хэш паролей — библиотека **`bcrypt` напрямую** (passlib 1.7.4 несовместим с bcrypt 5.x). `EmailStr` требует `email-validator`. Конфиг: `google_client_id/secret`, `backend_url`, `frontend_url` (пустой client_id → `/auth/google` отдаёт 501). Frontend — сессия через **React Context** `frontend/src/context/AuthContext.tsx` (`useAuth`) + `frontend/src/lib/authApi.ts` (НЕ Redux — отклонение от промта в пользу конвенций проекта); guard `RoutesGuard` на `useAuth`; формы Login/Register ходят на `/auth/*`; vite-proxy `/auth → :8000`. UI — дизайн-система (НЕ MUI). `AuthProvider` зеркалит сессию в legacy localStorage-ключи (`fintrack_is_authenticated`/`fintrack_user`) для обратной совместимости.

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
