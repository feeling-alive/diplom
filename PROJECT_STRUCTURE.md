# FinTrack — полная структура проекта

> Дата актуализации: 2026-06-04
> Стек: React 19 + TypeScript strict + Vite (frontend) / FastAPI + PostgreSQL + Redis (backend)

---

## 1. Общая архитектура

```
┌─────────────────────────────────────────────────┐
│                   Frontend                       │
│  React 19 + Vite 8 + TanStack Query 5           │
│  localhost:5173                                  │
│  │                                               │
│  └── Vite Proxy ───→ localhost:8000              │
└──────────┬──────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────┐
│                   Backend                        │
│  FastAPI + uvicorn + SQLAlchemy async            │
│  localhost:8000                                  │
│  │                                               │
│  ├── PostgreSQL (localhost:5432)                  │
│  └── Redis (localhost:6379)                       │
└─────────────────────────────────────────────────┘
```

---

## 2. Frontend (React 19)

### 2.1 Точка входа и провайдеры

**`src/main.tsx`** — корень приложения. Иерархия провайдеров:

```
StrictMode
  BrowserRouter              ← react-router-dom v7
    QueryClientProvider      ← TanStack Query (staleTime: 30s, gcTime: 5min)
      AuthProvider           ← сессия пользователя (HttpOnly cookie)
        CurrencyProvider     ← глобальная валюта (USD/EUR/RUB/BTC)
          SettingsProvider   ← тема, акцент, уведомления
            App              ← роутинг
```

### 2.2 Система роутинга

**`src/App.tsx`** — декларация маршрутов:

| Путь | Компонент | Доступ | Сайдбар |
|------|-----------|--------|---------|
| `/login` | `LoginPage` | Публичный | Нет |
| `/register` | `RegisterPage` | Публичный | Нет |
| `/` | `Dashboard` | Авторизован | Да |
| `/market` | `MarketOverview` | Авторизован | Да |
| `/asset/:symbol` | `AssetPage` | Авторизован | Да |
| `/news` | `NewsPage` | Авторизован | Да |
| `/news/:id` | `NewsArticlePage` | Авторизован | Да |
| `/chat` | `ChatPage` | Авторизован | Да |
| `/profile` | `ProfilePage` | Авторизован | Да |
| `/settings` | `SettingsPage` | Авторизован | Да |
| `/subscription` | `SubscriptionPage` | Авторизован | Да |
| `/admin` | `AdminPanelPage` | Авторизован | Да |
| `*` | `Navigate to="/"` | Авторизован | Да |

**Защита маршрутов:** `src/components/layout/RoutesGuard.tsx`
- `PrivateRoute` — проверяет `isAuthenticated` из `AuthContext`, редирект на `/login` если не авторизован
- `AdminRoute` — определён, но не используется

### 2.3 Контексты (состояние)

#### `AuthContext` (`src/context/AuthContext.tsx`)
- **Значение:** `{ user, isAuthenticated, isLoading, setUser, updateUser, logout, refresh }`
- **Логика:** при монтировании проверяет сессию через `GET /auth/me`, дублирует в `localStorage`
- **API:** `apiMe()`, `apiLogout()`

#### `CurrencyContext` (`src/context/CurrencyContext.tsx`)
- **Значение:** `{ currency, setCurrency, convert, rates }`
- **Валюты:** USD, EUR, RUB, BTC
- **Курсы:** из `usePrices()` (live), fallback при недоступности

#### `SettingsContext` (`src/context/SettingsContext.tsx`)
- **Значение:** `{ theme, accentId, notifications, language, setTheme, setAccent, setNotification, setDefaultCurrency }`
- **Тема:** light / dark
- **Акценты:** rose (`#E11D48`), green (`#22C55E`), slate (`#0F172A`)
- **Язык:** только `ru`
- **Персист:** `localStorage` (ключ `fintrack_settings_v1`)

---

### 2.4 Страницы (pages)

#### `Dashboard.tsx` — `/`
- Кастомизируемый дашборд с react-grid-layout (4 колонки)
- Drag'n'Drop виджетов, resize, добавление/удаление
- Multi-dashboard (вкладки, до 5 дашбордов)
- Персист: `localStorage` для гостей, backend для авторизованных
- **Ключевые компоненты:** `DashboardHeader`, `WidgetCard`, `AddWidgetModal`, `EmptyDashboard`, `DashboardTabs`

#### `MarketOverview.tsx` — `/market`
- Обзор рынка: сводка, топ движений, таблица активов
- Фильтрация по типу: all / crypto / stock / forex / index
- **Компоненты:** `MarketSummaryBar`, `TopMovers`, `AssetTable`

#### `AssetPage.tsx` — `/asset/:symbol`
- Детальная страница актива
- График (Recharts + TradingView iframe), метрики, новости, AI-чат
- Двухколоночная сетка (65% / 35%)
- **Компоненты:** `AssetHeader`, `MainCard`, `MetricsBar`, `NewsPanel`, `AIPanel`, `SimpleChart`, `TradingViewModal`, `CoinInfoBlock`

#### `NewsPage.tsx` — `/news`
- Лента новостей с infinite scroll
- Поиск (debounce 500ms), фильтрация по категориям
- **Хуки:** `useNews`, `useDebounce`

#### `NewsArticlePage.tsx` — `/news/:id`
- Полная статья: реакции (like/dislike), избранное, комментарии
- **Хуки:** `useNewsArticle`, `useComments`

#### `ChatPage.tsx` — `/chat`
- AI-ассистент на Groq API (llama-3.3-70b-versatile)
- История сообщений, suggested prompts, авто-высота textarea

#### `LoginPage.tsx` — `/login`
- Форма email + password, Google OAuth, ссылка на регистрацию
- Редирект на `/` если уже авторизован

#### `RegisterPage.tsx` — `/register`
- Форма nickname + email + password + confirm
- Индикатор силы пароля, Google OAuth

#### `ProfilePage.tsx` — `/profile`
- Аватар, username, email, статус подписки
- **Компоненты:** `ProfileHero`, `ProfileEditCard`, `SubscriptionCard`
- **Хуки:** `useProfile`, `useSubscription`

#### `SettingsPage.tsx` — `/settings`
- Тема (light/dark), акцентный цвет, уведомления, валюта

#### `SubscriptionPage.tsx` — `/subscription`
- Статус подписки, апгрейд до Premium, отмена

#### `AdminPanelPage.tsx` — `/admin`
- Таблица пользователей, API-интеграции, модерация (моковые данные)
- Нет проверки роли admin

---

### 2.5 Хуки

| Хук | Файл | Параметры | Возвращает | API |
|-----|------|-----------|------------|-----|
| `usePrices` | `hooks/usePrices.ts` | — | `{ bySymbol, cryptos, stocks, forex, indices, all, isLoading }` | OKX tickers + forex + stock quotes |
| `useAssetPrice` | `hooks/useAssetPrice.ts` | `symbol, type, useMock` | `{ price, change24h, isLoading, isConnected }` | OKX WS / stock / forex |
| `useOHLCV` | `hooks/useOHLCV.ts` | `symbol, timeframe, useMock` | `{ data, isLoading, error }` | OKX REST / Finnhub |
| `useStockPrice` | `hooks/useStockPrice.ts` | `symbol, useMock` | `{ price, change, isLoading }` | `/api/quotes/stock/{symbol}` |
| `useForexRate` | `hooks/useForexRate.ts` | `from, to, useMock` | `{ rate, isLoading }` | `/api/quotes/forex/{from}/{to}` |
| `useCoinInfo` | `hooks/useCoinInfo.ts` | `symbol` | `{ data, isLoading, error, isUnsupported }` | CoinGecko API |
| `useNews` | `hooks/useNews.ts` | `query, category` | InfiniteQuery | `GET /api/news` (infinite scroll) |
| `useNewsArticle` | `hooks/useNews.ts` | `id` | Query | `GET /api/news/{id}` |
| `useNewsFavorites` | `hooks/useNews.ts` | — | Query | `GET /api/news/favorites` |
| `useGroqChat` | `hooks/useGroqChat.ts` | `{ systemPrompt }` | `{ messages, loading, error, send, clear }` | Groq API |
| `useDashboardConfig` | `hooks/useDashboardConfig.ts` | — | `{ widgets, dashboards, switchDashboard, addDashboard, ... }` | `GET/PUT /dashboard/config` |
| `useProfile` | `hooks/useProfile.ts` | — | `{ data, updateUsername, uploadAvatar, usernameCheck }` | `lib/profileApi.ts` |
| `useSubscription` | `hooks/useSubscription.ts` | — | `{ data, busy, upgradeToPremium, cancel }` | `lib/profileApi.ts` |
| `usePersonalized` | `hooks/usePersonalized.ts` | `useMock` | `{ topAssets, isLoading }` | (только mock) |

---

### 2.6 Компоненты

#### Dashboard (основные) — 21 компонент

| Компонент | Путь | Назначение |
|-----------|------|------------|
| `WidgetCard` | `dashboard/WidgetCard.tsx` | Карточка виджета с drag-заголовком, диспетчер 31 типа |
| `DashboardHeader` | `dashboard/DashboardHeader.tsx` | Хедер: поиск, вкладки дашбордов, кнопки |
| `AddWidgetModal` | `dashboard/AddWidgetModal.tsx` | Модалка выбора виджета с DnD |
| `DashboardTabs` | `dashboard/DashboardTabs.tsx` | Вкладки мульти-дашбордов (пилюли) |
| `WidgetMenu` | `dashboard/WidgetMenu.tsx` | Popover-меню виджетов |
| `WidgetPicker` | `dashboard/WidgetPicker.tsx` | Панель выбора с превью размеров |
| `WidgetPreview` | `dashboard/WidgetPreview.tsx` | Превью виджета |
| `SizeIndicator` | `dashboard/SizeIndicator.tsx` | Индикатор W x H при ресайзе |
| `EmptyDashboard` | `dashboard/EmptyDashboard.tsx` | Пустое состояние с анимацией |
| `WatchlistPanel` | `dashboard/WatchlistPanel.tsx` | Список отслеживаемых активов |
| `PriceChartWidget` | `dashboard/PriceChartWidget.tsx` | График цены (Recharts) |
| `AllocationChart` | `dashboard/AllocationChart.tsx` | Donut-диаграмма распределения |
| `CommunityWidget` | `dashboard/CommunityWidget.tsx` | Посты сообщества |
| `NewsWidget` | `dashboard/NewsWidget.tsx` | Лента новостей |
| `MarketTicker` | `dashboard/MarketTicker.tsx` | Сетка активов |
| `PortfolioHero` | `dashboard/PortfolioHero.tsx` | Hero с анимированным счётчиком |
| `KpiStrip` | `dashboard/KpiStrip.tsx` | KPI портфеля |
| `FloatingAssetCards` | `dashboard/FloatingAssetCards.tsx` | Парящие карточки активов |
| `PersonalizedPanel` | `dashboard/PersonalizedPanel.tsx` | Персонализированные активы |
| `AssetStrip` | `dashboard/AssetStrip.tsx` | Горизонтальный ряд активов |
| `DashboardTopBar` | `dashboard/DashboardTopBar.tsx` | Упрощённый хедер |

#### Виджеты дашборда — 25 компонентов

| Компонент | Тип | Размеры (w x h) | Описание |
|-----------|-----|-------------------|----------|
| `TopMoversWidget` | `top_movers` | 2x2, 2x3, 3x2 | Рост/падение |
| `ForexRatesWidget` | `forex_rates` | 2x1, 3x1, 2x2 | Курсы валют |
| `FearGreedWidget` | `fear_greed` | 1x1, 1x2, 2x2 | Индекс страха/жадности |
| `MarketVolumeWidget` | `market_volume` | 1x1, 2x1 | Объём рынка |
| `TrendingCoinsWidget` | `trending_coins` | 1x2..2x4 | Трендовые монеты |
| `TechnicalAnalysisWidget` | `technical_analysis` | 2x2, 2x3 | Теханализ |
| `EconomicCalendarWidget` | `economic_calendar` | 3x2, 4x2, 3x3 | Экон. календарь |
| `HeatmapWidget` | `heatmap` | 3x2, 4x2, 4x3 | Тепловая карта |
| `PortfolioPnlWidget` | `portfolio_pnl` | 1x1..4x1 | P&L портфеля |
| `DominanceChartWidget` | `dominance_chart` | 1x2, 2x2, 3x2 | Доминация BTC |
| `PriceAlertsWidget` | `price_alerts` | 2x2, 2x3 | Ценовые оповещения |
| `MacdWidget` | `macd_widget` | 2x2, 3x2 | MACD |
| `RsiGaugeWidget` | `rsi_gauge` | 1x1, 1x2, 2x1 | RSI |
| `OrderBookWidget` | `order_book` | 2x2, 2x3 | Стакан ордеров |
| `GlobalMarketCapWidget` | `global_market_cap` | 1x1..3x1 | Капитализация |
| `FundingRateWidget` | `funding_rate` | 2x2, 3x2 | Фандинг |
| `GasTrackerWidget` | `gas_tracker` | 1x1, 1x2, 2x1 | Gas Ethereum |
| `CurrencyConverterWidget` | `currency_converter` | 2x1, 2x2 | Конвертер валют |
| `WhaleTrackerWidget` | `whale_tracker` | 2x2, 3x2 | Киты |
| `StockScreenerWidget` | `stock_screener` | 3x2, 4x2 | Скринер акций |
| `SentimentMeterWidget` | `sentiment_meter` | 1x2, 2x2 | Настроения рынка |
| `LiquidationsWidget` | `liquidations` | 2x2, 3x2 | Ликвидации |
| `YieldCurveWidget` | `yield_curve` | 3x2, 4x2 | Кривая доходности |
| `CorrelationMatrixWidget` | `correlation_matrix` | 3x2, 3x3 | Матрица корреляции |
| `AiSignalWidget` | `ai_signal` | 1x1..3x3 | AI сигнал |

#### Market Overview — 3 компонента

| Компонент | Путь | Назначение |
|-----------|------|------------|
| `MarketSummaryBar` | `market-overview/MarketSummaryBar.tsx` | 4 карточки статистики рынка |
| `TopMovers` | `market-overview/TopMovers.tsx` | Лидеры роста и аутсайдеры |
| `AssetTable` | `market-overview/AssetTable.tsx` | Полная таблица активов с сортировкой |

#### Asset — 8 компонентов

| Компонент | Путь | Назначение |
|-----------|------|------------|
| `AssetHeader` | `asset/AssetHeader.tsx` | Хедер: цена, change%, избранное |
| `MainCard` | `asset/MainCard.tsx` | Табы: график / информация о монете |
| `SimpleChart` | `asset/SimpleChart.tsx` | AreaChart (Recharts) с таймфреймами |
| `TradingViewModal` | `asset/TradingViewModal.tsx` | TradingView iframe + AI панель |
| `AIPanel` | `asset/AIPanel.tsx` | AI-ассистент (заглушка) |
| `CoinInfoBlock` | `asset/CoinInfoBlock.tsx` | Информация о монете (CoinGecko) |
| `MetricsBar` | `asset/MetricsBar.tsx` | Горизонтальный ряд метрик |
| `NewsPanel` | `asset/NewsPanel.tsx` | Новости по активу |

#### Layout — 5 компонентов

| Компонент | Путь | Назначение |
|-----------|------|------------|
| `AppSidebar` | `layout/AppSidebar.tsx` | Боковая иконная панель навигации |
| `RoutesGuard` | `layout/RoutesGuard.tsx` | `PrivateRoute` — защита маршрутов |
| `FinTrackNavBar` | `layout/FinTrackNavBar.tsx` | Горизонтальная навигация (не используется) |
| `CurrencySwitcher` | `layout/CurrencySwitcher.tsx` | Переключатель валюты |

#### UI / Profile / News — 5 компонентов

| Компонент | Путь | Назначение |
|-----------|------|------------|
| `SubscriptionCard` | `ui/SubscriptionCard.tsx` | Карточка подписки |
| `AvatarUploader` | `profile/AvatarUploader.tsx` | Загрузка аватара |
| `ProfileEditCard` | `profile/ProfileEditCard.tsx` | Редактирование профиля |
| `ProfileHero` | `profile/ProfileHero.tsx` | Hero профиля |
| `NewsCard` | `news/NewsCard.tsx` | Карточка новости |

---

### 2.7 Типы

#### `src/types/market.types.ts`
```typescript
Asset             // { symbol, name, type, price, change24h, volume24h, ... }
PricePoint        // { timestamp, open, high, low, close, volume }
NewsItem          // { id, title, summary, source, url, publishedAt, sentiment }
CommunityPost     // { id, author, content, relatedAsset, likes, comments }
WatchlistItem     // { symbol, addedAt, viewCount }
Timeframe         // '1m' | '5m' | '15m' | '1H' | '4H' | '1D' | '1W' | '1M'
```

#### `src/types/widgets.types.ts`
```typescript
WidgetType        // 31 строковых литералов (watchlist, price_chart, ...)
WidgetSize        // { w, h, label }
WidgetDefinition  // { type, title, description, icon, color, availableSizes, ... }
DashboardWidget   // { id, type, size, x, y, w, h }
```

#### `src/constants/widgets.registry.ts`
- `WIDGET_REGISTRY` — массив из 31 `WidgetDefinition` с иконками Lucide, размерами и границами
- **Размеры виджетов:** от 1x1 (FearGreed, RSI) до 4x4 (Heatmap, StockScreener)
- **Правила:** minW === maxW → resize только по вертикали; minH === maxH → только по горизонтали

#### `src/constants/coin-mapping.ts`
- `SYMBOL_TO_COIN_ID` — маппинг 20 криптопар → CoinGecko ID
- `getCoinId()` — lookup-функция

---

### 2.8 Утилиты и lib

#### `src/utils/format.ts`
- `formatPrice(price, type?)` — форматирование цены с валютой
- `formatChange(change)` — `+2.8%` / `-1.5%`
- `formatVolume(vol)` — объём с B/M/K и конвертацией
- `formatMarketCap(cap)` — капитализация с T/B/M
- `convertFromUsd(usd, currency?)` — конвертация USD в текущую валюту
- `setCurrencyState()` / `getCurrencyState()` — синглтон валюты

#### `src/utils/avatarColor.ts`
- `initial(name)` — первый символ имени
- `hashToHsl(name)` — детерминированный HSL-цвет

#### `src/lib/env.ts`
- `USE_MOCK` — флаг мок-режима
- `ENV` — объект с API-ключами и URL провайдеров

#### `src/lib/authApi.ts`
- `apiRegister()`, `apiLogin()`, `apiLogout()`, `apiMe()`

#### `src/lib/dashboardApi.ts`
- `getDashboardConfig()`, `putDashboardConfig()`
- `DashboardEnvelope`, `DashboardEntry`

#### `src/lib/dashboardLayout.ts`
- `generateId()`, `findEmptySlot()`, `clampWidgets()`
- `createDefaultWidgets()`, `makeDashboard()`
- `normalizeToEnvelope()`, `loadLocalEnvelope()`, `saveLocalEnvelope()`
- Миграции localStorage v2→v4

#### `src/lib/profileApi.ts`
- `getProfile()`, `updateUsername()`, `uploadAvatar()`, `checkUsername()`
- `getSubscriptionStatus()`, `upgradeSubscription()`, `cancelSubscription()`

---

### 2.9 Моковые данные и static data

#### `src/data/prices.json`
- 46 активов: 20 crypto, 9 forex, 2 metals, 15 stocks, 3 indices, 2 oil
- Цены, капитализация, объёмы, цвета, иконки

#### `src/mock/prices.mock.ts`
- `MOCK_PRICES: Asset[]` — из `prices.json`

#### `src/mock/news.mock.ts`
- `MOCK_NEWS: NewsItem[]` — 10 новостей

#### `src/mock/ohlcv.mock.ts`
- `getMockOHLCV(symbol, count)` — генератор свечей random walk

#### `src/mock/community.mock.ts`
- `MOCK_COMMUNITY: CommunityPost[]` — 8 постов

---

## 3. Backend (FastAPI)

### 3.1 Конфигурация и запуск

- **Точка входа:** `backend/app/main.py` — uvicorn на порту 8000
- **Конфиг:** `backend/app/config.py` — Pydantic Settings из `.env`
- **БД:** PostgreSQL 14 + asyncpg (SQLAlchemy 2.0 async)
- **Кэш:** Redis (graceful degradation)
- **Планировщик:** APScheduler (новости каждые 4 часа)

### 3.2 Модели ORM (9 таблиц)

| Модель | Таблица | Ключевые поля | Связи |
|--------|---------|---------------|-------|
| `User` | `users` | id (UUID), email, username, password_hash, google_id, role, avatar_url, is_active | 1:1 Subscription, DashboardConfig; 1:N ChatSession, Comment, Favorite |
| `Subscription` | `subscriptions` | id, user_id, plan (free/premium), expires_at, ai_requests_used | 1:1 User |
| `DashboardConfig` | `dashboard_configs` | id, user_id, layout (JSONB), updated_at | 1:1 User |
| `ChatSession` | `chat_sessions` | id, user_id, symbol, messages (JSON), created_at | N:1 User |
| `Comment` | `comments` | id, user_id, article_url, text (1000), likes | N:1 User |
| `Favorite` | `favorites` | id, user_id, symbol | N:1 User; Unique(user_id, symbol) |
| `NewsArticle` | `news_articles` | id, title, title_ru, url (unique), source_name, category, symbols, market_impact, ai_processed | 1:N NewsReaction, NewsFavorite |
| `NewsReaction` | `news_reactions` | id, user_id, article_id, reaction_type (like/dislike) | Unique(user_id, article_id) |
| `NewsFavorite` | `news_favorites` | id, user_id, article_id | Unique(user_id, article_id) |

### 3.3 Эндпониты API (27 шт.)

#### Публичные (без аутентификации)

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/health` | Liveness probe |
| GET | `/api/quotes/stock/{symbol}` | Котировка акции (Finnhub) |
| GET | `/api/quotes/stocks?symbols=...` | Батч-котировки |
| GET | `/api/quotes/crypto/{symbol}` | Тикер крипты (OKX) |
| GET | `/api/quotes/forex/{base}/{quote}` | Курс валюты (Frankfurter) |
| POST | `/auth/register` | Регистрация |
| POST | `/auth/login` | Вход |
| POST | `/auth/logout` | Выход |
| GET | `/auth/google` | Google OAuth login |
| GET | `/auth/google/callback` | Google OAuth callback |
| GET | `/api/news` | Лента новостей (с пагинацией) |
| GET | `/api/news/{id}` | Детали статьи |
| GET | `/api/news/{id}/comments` | Комментарии к статье |

#### Требуют аутентификации

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/auth/me` | Текущий пользователь |
| GET | `/users/me` | Профиль + подписка |
| PATCH | `/users/me` | Смена username |
| GET | `/users/me/check-username` | Проверка доступности username |
| POST | `/users/me/avatar` | Загрузка аватара |
| GET | `/subscription/status` | Статус подписки |
| POST | `/subscription/upgrade` | Активация Premium |
| POST | `/subscription/cancel` | Отмена подписки |
| GET | `/dashboard/config` | Получить layout дашборда |
| PUT | `/dashboard/config` | Сохранить layout дашборда |
| GET | `/api/news/favorites` | Избранные новости |
| POST | `/api/news/{id}/comments` | Добавить комментарий |
| DELETE | `/api/news/comments/{id}` | Удалить комментарий |
| POST | `/api/news/{id}/react` | Реакция (like/dislike) |
| POST | `/api/news/{id}/favorite` | Toggle избранного |

### 3.4 Сервисы (внешние API)

| Сервис | Файл | Провайдер | Кэш (TTL) |
|--------|------|-----------|-----------|
| `cache` | `services/cache.py` | Redis | — |
| `finnhub` | `services/finnhub.py` | Finnhub.io | stock_ttl (60s) |
| `okx` | `services/okx.py` | OKX REST | crypto_ttl (30s) |
| `frankfurter` | `services/frankfurter.py` | Frankfurter.app | forex_ttl (300s) |
| `news_fetcher` | `services/news_fetcher.py` | NewsAPI + OpenRouter | — |

### 3.5 Аутентификация

- **JWT** в HttpOnly cookie (`access_token`), 7 дней
- **bcrypt** напрямую (без passlib), обрезание до 72 байт
- **Google OAuth** — опционально (501 если не настроен)
- **Зависимости FastAPI:** `get_current_user`, `get_optional_user`, `require_admin`

### 3.6 Модуль auth (`app/auth/`)

| Файл | Назначение |
|------|------------|
| `router.py` | Эндпоинты `/auth/*` |
| `schemas.py` | `RegisterRequest`, `LoginRequest`, `UserResponse`, `TokenResponse` |
| `utils.py` | `hash_password()`, `verify_password()`, `create_access_token()`, `decode_access_token()` |
| `dependencies.py` | `get_current_user()`, `get_optional_user()`, `require_admin()` |

### 3.7 Миграции Alembic

| Миграция | Описание |
|----------|----------|
| `22708b5bcbc0` | Начальные таблицы (users, subscriptions, dashboard_configs, chat_sessions, comments, favorites) |
| `3b1f7c2a9d04` | `ai_requests_used` в `subscriptions` |
| `639880bfd01c` | Заглушка для news-таблиц |

### 3.8 Тесты (pytest)

| Файл | Описание |
|------|----------|
| `conftest.py` | Фикстуры: in-memory SQLite + aiosqlite |
| `test_health.py` | GET /health |
| `test_config.py` | Настройки, маскировка DSN |
| `test_models_metadata.py` | 9 таблиц, constraints, enums |
| `test_auth.py` | Register/Login/Me/Google-501 |
| `test_dashboard.py` | GET/PUT config, лимиты, backward compat |
| `test_profile.py` | Profile/username/avatar/subscription |
| `test_news.py` | Feed/reactions/favorites/comments |

---

## 4. Инфраструктура

### 4.1 Docker Compose

**Файл:** `docker-compose.yml`

| Сервис | Образ | Порт |
|--------|-------|------|
| `postgres` | postgres:14-alpine | 5432 |
| `redis` | redis:alpine | 6379 |
| `backend` | сборка из `backend/Dockerfile` | 8000 |

### 4.2 Vite Proxy (файл: `vite.config.ts`)

| Префикс | Цель |
|---------|------|
| `/auth` | `http://localhost:8000` |
| `/api/quotes` | `http://localhost:8000` |
| `/api/news` | `http://localhost:8000` |
| `/users` | `http://localhost:8000` |
| `/subscription` | `http://localhost:8000` |
| `/dashboard` | `http://localhost:8000` |
| `/api/finnhub` | `https://finnhub.io` |
| `/api/forex` | `https://api.frankfurter.dev` |
| `/api/okx` | `https://www.okx.com` |
| `/uploads` | `http://localhost:8000` |

---

## 5. Проблемы и TODO

1. **Несоответствие навигации:** В `AppSidebar` есть пункт `/assets`, но такого роута нет → редирект на `/`
2. **Неиспользуемый `AdminRoute`:** Определён в `RoutesGuard.tsx`, но не применяется — `/admin` доступен любому авторизованному
3. **Неиспользуемый `FinTrackNavBar`:** Не импортируется нигде
4. **Нет 404 страницы:** Catch-all `*` редиректит на `/`
5. **Двойной редирект при logout:** `logout()` + `window.location.href = '/login'`
6. **`AdminPanelPage`:** Нет проверки роли admin
7. **`i18n`:** Только русский язык, английский не реализован
8. **`usePersonalized`:** Только мок-режим, реальный API не реализован
9. **Тесты:** Только базовые, нет покрытия для виджетов и AssetPage
10. **Виджеты:** Все виджеты используют статические/моковые данные, live API не подключено

---

## 6. Ключевые архитектурные решения

1. **Все data-хуки** принимают `useMock?: boolean = true` и возвращают `{ data, isLoading, error }`
2. **HttpOnly JWT cookie** — защита от XSS, same-origin через Vite proxy
3. **Graceful degradation** — Redis/PostgreSQL недоступны → сервис не падает
4. **Multi-dashboard envelope** — один JSON-столбец для всех дашбордов
5. **AI-обогащение новостей** — OpenRouter (бесплатно) переводит и категоризирует
6. **WIDGET_REGISTRY** — единый источник правды для 31 типа виджетов
7. **Закрытая дизайн-система** — 3 акцента, 2 темы, без новых цветов
8. **Никаких `any`** — TypeScript strict mode, `no-explicit-any: error`

---

## 7. Счётчики

| Категория | Количество |
|-----------|-----------|
| Страницы (pages) | 12 |
| Хуки (hooks + context) | 18 |
| Компоненты (всего) | ~60 |
| Виджеты дашборда | 25 + 6 основных |
| Эндпоинты API | 27 |
| ORM-модели | 9 |
| Сервисы backend | 5 |
| Тесты frontend | ~11 |
| Тесты backend | 8 |
| Миграции Alembic | 3 |
