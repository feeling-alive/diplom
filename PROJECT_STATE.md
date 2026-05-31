# FinTrack — состояние проекта

> Дипломный проект, ВятГУ, ИСПк-402-52-00, Панкратов Н.В.  
> Актуально на: **17 мая 2026**

---

## Общее

**FinTrack** — финансовый дашборд-SPA для мониторинга портфеля, рыночных данных и аналитики активов.  
Стек: React 19 + TypeScript strict + Vite 8. Запуск: `npm run dev` (порт 5173).

---

## Технологии

| Категория | Библиотека / инструмент |
|-----------|------------------------|
| UI-фреймворк | React 19 + ReactDOM |
| Язык | TypeScript (strict, no `any`) |
| Сборщик | Vite 8 |
| Роутинг | react-router-dom v7 |
| Анимации | Framer Motion v12 |
| Grid-дашборд | react-grid-layout v2 + react-resizable |
| Drag-and-drop | @dnd-kit (core, sortable, utilities) |
| Графики | Recharts v3 |
| Иконки | Lucide React |
| Data fetching | TanStack Query v5 (не всюду применён) |
| Тесты | Vitest + React Testing Library + jsdom |

---

## Структура приложения

```
src/
├── App.tsx                    # Роуты + ProtectedLayout
├── main.tsx                   # BrowserRouter + QueryClientProvider
│
├── pages/
│   ├── Dashboard.tsx          # Главный дашборд (grid-виджеты)
│   ├── MarketOverview.tsx     # Обзор рынка
│   ├── AssetPage.tsx          # Страница актива
│   ├── LoginPage.tsx          # Логин
│   ├── RegisterPage.tsx       # Регистрация
│   ├── NewsPage.tsx           # Лента новостей
│   ├── NewsArticlePage.tsx    # Отдельная статья
│   ├── ChatPage.tsx           # AI-чат (глобальный)
│   ├── ProfilePage.tsx        # Профиль пользователя
│   ├── SubscriptionPage.tsx   # Подписка
│   └── AdminPanelPage.tsx     # Панель администратора
│
├── components/
│   ├── layout/
│   │   ├── AppSidebar.tsx     # Icon-rail с тултипами
│   │   ├── FinTrackNavBar.tsx # Верхняя панель (Market page)
│   │   └── RoutesGuard.tsx    # PrivateRoute + AdminRoute
│   │
│   ├── dashboard/             # Всё для дашборда
│   └── market-overview/       # Компоненты Market Overview
│       └── asset/             # Компоненты страницы актива
│
├── hooks/                     # Кастомные хуки
├── constants/                 # Реестр виджетов, coin-mapping
├── data/prices.json           # Стартовые данные 54 активов
├── mock/                      # Мок-данные (news, ohlcv, community)
└── types/                     # market.types.ts, widgets.types.ts
```

---

## Роутинг и авторизация

| Путь | Страница | Доступ |
|------|----------|--------|
| `/login` | LoginPage | Публичный |
| `/register` | RegisterPage | Публичный |
| `/` | Dashboard | Авторизован |
| `/market` | MarketOverview | Авторизован |
| `/asset/:symbol` | AssetPage | Авторизован |
| `/news` | NewsPage | Авторизован |
| `/news/:id` | NewsArticlePage | Авторизован |
| `/chat` | ChatPage | Авторизован |
| `/profile` | ProfilePage | Авторизован |
| `/subscription` | SubscriptionPage | Авторизован |
| `/admin` | AdminPanelPage | Авторизован |

**Авторизация** — localStorage-based (`fintrack_is_authenticated = "true"`, `fintrack_user`).  
`PrivateRoute` редиректит на `/login`, если ключ не установлен.  
`AdminRoute` дополнительно проверяет `user.role === 'admin'`.

---

## Навигация

**AppSidebar** — вертикальный icon-rail слева:

- Дашборд → `/`
- Рынок → `/market`
- Новости → `/news`
- Активы → `/assets` *(ссылка есть, страница = Dashboard пока)*
- AI Чат → `/chat`
- Профиль → `/profile`
- Аватар (буква Н), Настройки, Выход

Тултипы появляются через 300 мс на hover с анимацией Framer Motion.  
Выход очищает localStorage и переходит на `/login`.

---

## Дашборд (/)

Ключевой экран. Построен на **react-grid-layout** с 4 колонками, высота ячейки 160 px.

### Режимы
- **Просмотр** — drag/resize выключены, карточки статичны.
- **Редактирование** — включается кнопкой «Редактировать»; разрешены drag, resize, удаление виджетов.

### iPhone-style drag
- Дефолтный placeholder `react-grid-layout` скрыт (`.react-grid-placeholder { display: none }`).
- Перетаскиваемый виджет «висит» под курсором: `scale(1.03)`, `opacity 0.92`, мягкая тень.
- Соседи плавно расступаются благодаря `transition: transform 200ms ease` на `.react-grid-item`.

### Адаптивные виджеты
Каждый виджет получает опциональные пропсы `gridW`/`gridH` из `WidgetCard` (типы — `src/types/widgets.types.ts → WidgetSizeProps`) и сам решает, что показывать на маленьких размерах:
- **KPI Portfolio** в `2×1` — только первая карточка с ценой и change; в `4×1` — все активы в строку.
- **Watchlist** в `2×2` — 4 строки без названия; в `3×2`/`2×3` — 10 строк с названием.
- **Price Chart** — таймфреймы только при `gridH >= 3`.
- **News** — 3 новости в `2×2`, 6 в `2×3`; превью-строка темнее обрезается при `gridW < 3`.
- **Allocation** — legend и проценты появляются при `gridH >= 3`.
- **Fear & Greed** в `1×1` — только цифра + цветной круг; в `1×2` — полная gauge со шкалой.
- **Market Volume** — мини-график появляется при `gridW >= 3`.
- **Forex Rates** в `3×1` — горизонтальная компоновка.

### Единая карточка (`WidgetCard`)
Только `WidgetCard` рисует фон/бордер/padding. Внутренние компоненты виджетов — flex-column на `100%/100%` без собственных карточек. Графики Recharts — `<ResponsiveContainer width="100%" height="100%">`.

### Хранение раскладки
Раскладка сохраняется в `localStorage` под ключом `fintrack_widgets_v2`.  
При первом запуске создаётся дефолтный набор: KPI-портфеля 4×1, Вотч-лист 2×2, Распределение 1×2, График цены 2×2.

### Добавление виджетов
Два способа:
1. Кнопка «Добавить виджет» → модальное окно `AddWidgetModal` → клик или drag-and-drop прямо на сетку.
2. Drag из модального окна на конкретную позицию сетки (external drop через `droppingItem`).

### Пагинация
Виджеты разбиваются на «страницы» по 4 строки. Переключение — точки и стрелки, плавный fade при смене страницы.

### Реестр виджетов (`widgets.registry.ts`)

| Тип | Название | Доступные размеры |
|-----|----------|------------------|
| `kpi_portfolio` | KPI Портфеля | 2×1, 3×1, 4×1 |
| `watchlist` | Вотч-лист | 2×2, 2×3, 3×2 |
| `price_chart` | График цены | 2×2, 3×2, 4×2 |
| `allocation` | Распределение | 1×2, 2×2 |
| `community` | Сообщество | 2×2, 2×3 |
| `news` | Новости рынка | 2×2, 3×2 |
| `top_movers` | Топ движения | 2×2, 2×3 |
| `forex_rates` | Форекс курсы | 2×2, 3×1 |
| `fear_greed` | Страх и жадность | 1×1, 1×2, 2×1 |
| `market_volume` | Объём рынка | 2×1, 3×1 |
| `trending_coins` | Трендовые монеты | 2×2, 3×2 |

При resize показывается `SizeIndicator` с текущими размерами в сетке.

---

## Обзор рынка (/market)

Три основных блока:

1. **MarketSummaryBar** — глобальная статистика (капитализация, объём, доминация BTC и т.д.).
2. **TopMovers** — лидеры роста и падения с фильтром по типу актива.
3. **AssetTable** — таблица всех 54 активов с sparkline-графиком.

Фильтр по типу: Все / Крипто / Акции / Форекс / Индексы. Клик по строке → `/asset/:symbol`.

---

## Страница актива (/asset/:symbol)

Двухколоночный лейаут (65% / 35%):

**Левая колонка:**
- `AssetHeader` — название, символ, тег типа, цена, изменение за 24 ч, кнопка «Добавить в вотч-лист».
- `MainCard` — интерактивный график (Recharts area/line/bar) + переключатель периода (1H / 1D / 1W / 1M / 1Y) + переключатель типа (`SimpleChart`). Кнопка «Открыть в TradingView» → `TradingViewModal`.
- `MetricsBar` — ключевые метрики: рыночная капитализация, объём 24 ч, High/Low 24 ч, блок дополнительных данных (`CoinInfoBlock`).

**Правая колонка:**
- `NewsPanel` — новостная лента по символу (mock-данные).
- `AIPanel` — заглушка AI-ассистента (показывает 3 кнопки-подсказки, disabled; подпись «Будет доступен после подключения аналитической модели»).

Если символ не найден в `usePrices` — показывается 404-экран с кнопкой «Вернуться к рынку».

---

## Слой данных

### `usePrices` (главный хук)

Стартует с `prices.json` (54 актива: ~20 крипто, 10 акций, 12 форекс-пар, 5 индексов).  
Каждые **60 секунд** делает параллельные запросы к реальным API:

| API | Данные | Прокси-путь |
|-----|--------|-------------|
| **OKX** `SPOT tickers` | цена + объём для крипто | прямой fetch (CORS открыт) |
| **Frankfurter** | форекс-курсы (USD base) | `/api/forex` → `api.frankfurter.app` |
| **Finnhub** `quote` | цена + change для 10 акций | `/api/finnhub` → `finnhub.io/api/v1` |

Если ответ не получен — цена слегка джиттерит (`±0.5%` случайно).  
Vite-proxy настроен для CORS (4 правила: `/api/finnhub`, `/api/news`, `/api/forex`, `/api/okx`).

### Бэкенд (FastAPI + Redis) — новое (2026-05-30)

Отдельный сервис `backend/` (FastAPI + Redis), проксирующий и кэширующий котировки, чтобы фронт не ходил во внешние API напрямую и не светил ключи. Запуск: `uvicorn app.main:app --reload --port 8000` (Redis — `docker run -p 6379:6379 redis:alpine`).

| Эндпоинт | Источник | TTL кэша |
|----------|----------|----------|
| `GET /api/quotes/stock/{symbol}` | Finnhub | 60с |
| `GET /api/quotes/stocks?symbols=...` | Finnhub (батч) | 60с |
| `GET /api/quotes/crypto/{symbol}` | OKX REST | 30с |
| `GET /api/quotes/forex/{from}/{to}` | Frankfurter (`api.frankfurter.dev/v1`) | 300с |
| `GET /health` | — | — |

- Кэш Redis с **graceful degradation**: если Redis недоступен — лог `cache unavailable` и прямой вызов внешнего API (сервис не падает).
- Формат котировки: `{symbol, price, change, changePercent, volume}`. Volume у акций = `0` (Finnhub `/quote` его не отдаёт).
- Vite-proxy: добавлено правило `/api/quotes → http://localhost:8000` (**аддитивно** — старые 4 правила оставлены).
- **Миграция хуков фронта пока НЕ сделана** (по ТЗ): хуки ходят по-старому, бэкенд работает параллельно. План миграции — в `backend/README.md`.
- Ключ Finnhub — только в `backend/.env` (gitignored). ⚠️ Старый ключ утёк в публичный git/`proxy.md` — перевыпустить.

### Переменные окружения (`.env.local`)

```
VITE_FINNHUB_API_KEY=...
VITE_GROQ_API_KEY=...          # для будущего AI-чата
```

---

## Тесты

Конфигурация: Vitest + jsdom + React Testing Library, setup-файл `src/test-setup.ts`.

Тест-файлы:
- `Dashboard.test.tsx`
- `components/dashboard/__tests__/CommunityWidget.test.tsx`
- `components/dashboard/__tests__/NewsWidget.test.tsx`
- `components/dashboard/__tests__/PriceChartWidget.test.tsx`
- `components/layout/__tests__/AppSidebar.test.tsx`
- `components/market-overview/__tests__/AssetTable.test.tsx`
- `pages/__tests__/MarketOverview.test.tsx`

Запуск: `npm run test` (или `npx vitest`).

---

## Текущая ветка

**`feature/widget-dnd-enhancements`** — последние правки по DnD и зависимостям react-grid-layout.

Последние коммиты:
```
8aa589d fix: add react-grid-layout deps to package.json
5c57d0d fix: useOHLCV with real API proxy, USE_MOCK default
88e2b3f feat: add prices.json store, usePrices with API merge
```

---

## Что ещё не сделано / заглушки

| Место | Статус |
|-------|--------|
| `AIPanel` на странице актива | Заглушка (disabled, нет Groq-интеграции) |
| `ChatPage` (AI Чат в сайдбаре) | Заглушка / пустая страница |
| `/assets` в сайдбаре | Ведёт на несуществующий роут |
| `AdminPanelPage` | Страница создана, содержимое не уточнено |
| `SubscriptionPage` | Страница создана, UI не полностью |
| `ProfilePage` | Страница создана, UI не полностью |
| `useOHLCV` | Хук есть, но `SimpleChart` использует мок-данные |
| `useGroqChat` | Хук написан, не подключён к UI |
