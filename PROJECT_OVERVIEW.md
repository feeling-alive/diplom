# FinTrack — Обзор реализации

## Что это

FinTrack — веб-приложение для мониторинга финансовых рынков с настраиваемым дашбордом, AI-чатом, ML-предсказаниями и новостной лентой. Дипломный проект, ВятГУ ИСПк-402-52-00.

---

## Стек технологий

### Frontend
| Технология | Версия | Назначение |
|---|---|---|
| React | 19 | UI-фреймворк |
| TypeScript | 6 (strict) | Типизация |
| Vite | 8 | Сборка и dev-сервер |
| TanStack Query | 5 | Кэширование серверного состояния |
| react-grid-layout | — | Drag-and-drop сетка дашборда |
| @dnd-kit | — | Сортировка виджетов |
| Framer Motion | — | Анимации |
| Recharts | — | Графики (area, bar, line) |
| lightweight-charts | 5 | TradingView-совместимые свечные графики |
| Vitest + RTL | 4 | Тестирование |

### Backend
| Технология | Версия | Назначение |
|---|---|---|
| Python | 3.13 | Основной язык |
| FastAPI + Uvicorn | — | HTTP API |
| PostgreSQL | 14 | Основная БД |
| SQLAlchemy | 2.0 async | ORM |
| Alembic | — | Миграции |
| Redis | Alpine | Кэш котировок |
| Groq (Llama 3.3-70B) | — | AI-чат |
| PyTorch (PatchTST) | — | ML-предсказания временных рядов |
| APScheduler | — | Фоновые задачи (новости каждые 4ч) |

### Инфраструктура
- Docker Compose: postgres (5433), redis (6379), backend (8000)
- Frontend dev-сервер: 5173 (проксирует `/api`, `/auth`, `/users` на backend)

---

## Архитектура

```
dashboard-app/
├── frontend/src/
│   ├── pages/          # 12 страниц-маршрутов
│   ├── components/     # layout, dashboard/widgets, market-overview, news, ui
│   ├── hooks/          # 17 кастомных хуков
│   ├── context/        # AuthContext, CurrencyContext, SettingsContext
│   ├── types/          # TypeScript-интерфейсы
│   ├── utils/          # formatPrice, formatVolume и др.
│   └── lib/            # API-клиенты
└── backend/app/
    ├── main.py         # Entrypoint, CORS, lifecycle
    ├── models.py       # 9 ORM-моделей (UUID PK)
    ├── auth/           # JWT, bcrypt, Google OAuth
    ├── routes/         # 8 роутеров
    └── services/       # 15 сервисов (внешние API, кэш, ML)
```

**Принцип:** фронтенд не обращается к внешним API напрямую — всё проксируется через бэкенд. Это обходит CORS, даёт кэширование через Redis и скрывает API-ключи.

---

## Реализованные модули

### 1. Настраиваемый дашборд

**Файлы:** `frontend/src/pages/Dashboard.tsx`, `frontend/src/components/dashboard/`

- 31 тип виджета: тикеры, графики, индикаторы, новости, портфель, форекс, крипто
- Drag-and-drop перетаскивание (DnD Kit), resize за края (react-resizable)
- До 5 именованных дашбордов с переключением вкладками
- Режим редактирования: добавление / удаление / изменение размера
- Размерные пресеты (1×1 → 4×3) с ограничениями minW/maxW/minH/maxH
- Сохранение раскладки в PostgreSQL, fallback на localStorage

**Виджеты:** MarketTicker, PriceChart, MacdChart, RsiGauge, HeatmapWidget, CorrelationMatrix, YieldCurve, FearGreedWidget, SentimentMeter, AiSignalWidget, TopMovers, WatchlistWidget, MarketVolume, GlobalMarketCap, DominanceWidget, ForexRates, FundingRate, LiquidationsWidget, TrendingCoins, WhaleTracker, PortfolioPnL, AllocationChart, EconomicCalendar, CurrencyConverter, StockScreener, OrderBook, PriceAlerts, NewsWidget, CommunityWidget и другие.

---

### 2. Страница актива (`/asset/:symbol`)

**Файлы:** `frontend/src/pages/AssetPage.tsx`, `frontend/src/components/asset/`

- TradingView Advanced Chart (fullscreen-модал через iframe)
- Recharts area-график с OHLCV-данными
- Котировки реального времени, изменение за 24ч
- Метаданные из CoinGecko: описание, market cap, объём
- Новостная лента, отфильтрованная по символу
- AI-чат с контекстом конкретного актива

---

### 3. Обзор рынка (`/market`)

**Файл:** `frontend/src/pages/MarketOverview.tsx`

- Сводная строка: total market cap, 24h volume, доминирование BTC
- Топ-муверы (гейнеры / лузеры с %)
- Таблица активов со спарклайнами и сортировкой
- Кликабельные карточки → переход на `/asset/:symbol`
- Категории активов: крипта, акции, форекс (биржевые индексы удалены — нет API-источника)

---

### 4. Новостная система

**Файлы:** `backend/app/services/news_fetcher.py`, `backend/app/routes/news.py`, `frontend/src/pages/NewsPage.tsx`, `frontend/src/pages/NewsArticlePage.tsx`

- Автоматический фетч из NewsAPI каждые 4 часа (APScheduler)
- AI-обогащение: перевод заголовков/описаний через Groq
- Категории: general, crypto, stocks, forex
- Классификация влияния на рынок (bullish/bearish/neutral)
- Реакции пользователей (лайк/дизлайк) — таблица `news_reactions`
- Комментарии к статьям — таблица `comments`
- Избранные статьи — таблица `news_favorites`

---

### 5. AI-чат и ML-предсказания

**Файлы:** `backend/app/routes/chat.py`, `backend/app/services/groq_service.py`, `backend/app/services/patchtst.py`, `frontend/src/pages/ChatPage.tsx`

**AI-чат:**
- Groq API, модель Llama 3.3-70B
- Общий финансовый чат и чат в контексте конкретного актива
- История сессий хранится в PostgreSQL (таблица `chat_sessions`)
- Лимиты: free — 5 запросов/день, premium — безлимит

**ML-предсказания (PatchTST):**
- Локальный PyTorch-инференс (без внешних API)
- Модель: PatchTST — трансформер для временных рядов
- 11 фичей: OHLCV + RSI, MACD, Bollinger Bands, ATR, Volume Z-score
- Выход: UP / DOWN / SIDEWAYS + confidence score
- Гибридный сигнал: ML-предсказание + rule-based индикаторы
- Смягчённый confidence gate: направление сохраняется при слабом сигнале
- Кэш предсказаний: 60 секунд

---

### 6. Аутентификация и авторизация

**Файлы:** `backend/app/auth/`

- Регистрация / логин по email + пароль
- JWT в HttpOnly-куках
- Хэширование паролей bcrypt
- Google OAuth (готово)
- Роли: user / admin
- RoutesGuard на фронтенде: защита приватных маршрутов
- **Восстановление пароля через email:** `/forgot-password` → токен в Redis (TTL 15 мин) → письмо через fastapi-mail (HTML-шаблон, акцент #E11D48) → `/reset-password?token=...` → обновление хэша + удаление токена. Нейтральный ответ не раскрывает существование аккаунта; без настроенного SMTP ссылка пишется в DEBUG-лог (graceful degradation). SMTP-переменные — в `backend/.env.example`.

---

### 7. Подписки и биллинг

**Файлы:** `backend/app/routes/subscription.py`, `frontend/src/pages/SubscriptionPage.tsx`

- **Free:** 5 AI-запросов/день, базовые функции
- **Premium:** безлимит AI, расширенные графики, экспорт данных, приоритетные обновления
- Пробный период: 30 дней premium
- Таблица `subscriptions`: план, срок, счётчик AI-запросов

---

### 8. Настройки и персонализация (`/settings`)

**Файлы:** `frontend/src/context/SettingsContext.tsx`, `frontend/src/pages/SettingsPage.tsx`

- Dark / light тема
- Цвет акцента (color picker)
- Базовая валюта: USD / EUR / RUB / BTC (живые курсы через Frankfurter API)
- Языковые настройки
- Уведомления (подготовлено)

---

### 9. База данных

9 таблиц, все с UUID PK и timezone-aware timestamp:

| Таблица | Описание |
|---|---|
| `users` | Аккаунты, роли, аватары |
| `subscriptions` | Планы, срок, счётчик AI |
| `dashboard_configs` | JSON-раскладки дашборда |
| `chat_sessions` | История чатов |
| `comments` | Комментарии к новостям |
| `favorites` | Вотчлист символов |
| `news_articles` | Кэш новостей (AI-обогащённые) |
| `news_reactions` | Лайки/дизлайки на статьи |
| `news_favorites` | Закладки статей |

---

### 10. Внешние источники данных

| Источник | Что предоставляет |
|---|---|
| OKX REST + WebSocket | Криптокотировки в реальном времени, фандинг, ликвидации |
| Finnhub | Акции: котировки, исторические данные |
| Frankfurter | Форекс-курсы (EUR, GBP, JPY, CAD, CHF, CNY, RUB, INR) |
| CoinGecko | Метаданные крипты: market cap, описание, volume |
| NewsAPI | Финансовые новости (фетч каждые 4ч) |
| Groq | AI-чат, перевод новостей |
| SMTP (fastapi-mail) | Письма восстановления пароля (опционально; без SMTP — лог) |

---

## Запуск

```bash
# Полный стек
docker compose up -d postgres redis
cd backend && pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
cd frontend && npm install && npm run dev
```

```bash
# Только фронтенд (моковые данные)
cd frontend && npm install && npm run dev
```

Тесты:
```bash
cd frontend && npm run test
cd backend && pytest tests/
```

---

## Состояние реализации

| Модуль | Статус |
|---|---|
| Настраиваемый дашборд (31 виджет) | Готово |
| Страницы активов | Готово |
| Обзор рынка | Готово |
| Новостная система | Готово |
| AI-чат (Groq) | Готово |
| ML-предсказания (PatchTST) | Готово |
| Аутентификация (JWT + OAuth) | Готово |
| Мультивалютность | Готово |
| Настройки / темы | Готово |
| Подписки / биллинг | Готово |
| Сохранение раскладок (PG + LS) | Готово |
| Загрузка аватаров | Готово |
| Административная панель | Готово |
| Восстановление пароля (email) | Готово |
