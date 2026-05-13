# FinTrack — Claude Code Prompt v1.1
# Dashboard → Market Overview → News → Asset Page + ИИ-чат

---

## 🛠 СТЕК И ИНСТРУМЕНТЫ

### Frontend
| Инструмент | Версия | Назначение |
|---|---|---|
| React | 18+ | UI фреймворк |
| TypeScript | 5+ | Типизация |
| Material-UI (MUI) | 5+ | UI компоненты, темизация |
| Redux Toolkit | 2+ | Глобальный стейт (юзер, вотчлист, настройки) |
| React Query (TanStack) | 5+ | Серверный стейт, кэш, хуки для API |
| Framer Motion | 11+ | Анимации: page transitions, stagger, hover, draw |
| 21dev UI | MCP | Готовые анимированные компоненты, адаптируем под стиль |
| TradingView Lightweight Charts | 4+ | Свечной график на странице актива (Приоритет 4) |
| Lucide React | latest | Иконки (outline стиль) |
| React Grid Layout | latest | Drag-and-drop сетка виджетов (Приоритет 3) |

### Backend (уже прописан в дипломе, фронт готовит структуру хуков)
| Инструмент | Назначение |
|---|---|
| FastAPI (Python 3.11+) | REST API + WebSocket эндпоинты |
| PostgreSQL 14+ | Основная база данных |
| Redis | Кэш цен, сессии, очередь Celery |
| Celery | Асинхронные задачи (обучение ИИ, тяжёлые запросы) |

### Внешние API
| API | Назначение | Лимит (free) |
|---|---|---|
| OKX API | Крипто: цены, OHLCV, WebSocket | 20 req/2s |
| Finnhub | Акции: котировки, история | 60 req/min |
| frankfurter.app | Форекс: курсы валют | Без лимита |
| World Bank API | Макро: инфляция, индексы | Без лимита |
| Alpha Vantage | Резерв / дополнительные данные | 25 req/day |
| NewsAPI | Новости финансового рынка | 100 req/day |
| Groq API (LLaMA 3) | ИИ-ассистент — быстрый инференс | Free tier |

---

## 📋 ПРИОРИТЕТЫ РАЗРАБОТКИ

```
Приоритет 1 → Dashboard (текущий файл)
Приоритет 2 → Market Overview
Приоритет 3 → News Feed + Article
Приоритет 4 → Asset Page: TradingView график + ИИ-чат (для показа руководителю)
Приоритет 5 → Login / Register (3D элементы из 21dev)
Приоритет 6 → Profile + Subscription
Приоритет 7 → Admin Panel
```

---

## 🎨 ДИЗАЙН-СИСТЕМА

```css
/* Цвета — НЕ МЕНЯТЬ */
--accent:     #E8264A   /* красный, основной акцент */
--accent-bg:  #FFE5EC   /* светло-розовый фон для пилюль */
--ink:        #0D0D0D   /* чёрный для тёмных карточек */
--text:       #1A1A1A   /* основной текст */
--muted:      #8A8A8A   /* вторичный текст */
--soft:       #B8B6B0   /* подсказки, плейсхолдеры */
--bg:         #F4F3F1   /* фон страницы (тёплый серый) */
--white:      #FFFFFF   /* фон карточек */
--border:     #ECEAE3   /* линии, границы */
--green:      #22C55E   /* рост цены */
--red:        #E8264A   /* падение цены (совпадает с акцентом) */

/* Типографика */
font-family: 'Inter', -apple-system, sans-serif;
/* Размеры: 48px hero, 22px h1, 16px h2, 13px body, 11px small, 9px label */
/* Веса: 800 hero, 700 числа, 600 заголовки, 500 кнопки, 400 текст */

/* Скруглення */
--radius-sm:  8px
--radius-md:  12px
--radius-lg:  16px
--radius-xl:  24px
--radius-pill: 999px

/* Тени */
--shadow-sm:  0 4px 14px -4px rgba(20,20,20,.10)
--shadow-md:  0 6px 18px -6px rgba(20,20,20,.10), 0 2px 6px -2px rgba(20,20,20,.06)
--shadow-lg:  0 24px 60px -20px rgba(20,20,20,.18), 0 8px 24px -8px rgba(20,20,20,.08)
```

---

## 🗂 СТРУКТУРА ФАЙЛОВ

```
src/
├── hooks/
│   ├── useAssetPrice.ts       # OKX WebSocket / polling цена
│   ├── useOHLCV.ts            # OKX + Finnhub свечи OHLCV
│   ├── useStockPrice.ts       # Finnhub котировки акций
│   ├── useForexRate.ts        # frankfurter.app форекс
│   ├── useNews.ts             # NewsAPI: общие + по активу
│   └── usePersonalized.ts     # топ активов по viewCount юзера
├── types/
│   └── market.types.ts        # все интерфейсы
├── mock/
│   ├── prices.mock.ts         # моковые цены активов
│   ├── news.mock.ts           # 10 моковых новостей
│   ├── community.mock.ts      # 8 моковых постов сообщества
│   └── ohlcv.mock.ts          # моковые свечи для графика
├── components/
│   └── dashboard/
│       ├── FloatingAssetCards.tsx
│       ├── PortfolioHero.tsx
│       ├── KpiStrip.tsx
│       ├── AssetStrip.tsx
│       ├── WatchlistPanel.tsx
│       ├── AllocationChart.tsx
│       ├── PersonalizedPanel.tsx
│       ├── PriceChartWidget.tsx
│       ├── CommunityWidget.tsx
│       ├── NewsWidget.tsx
│       └── AddWidgetModal.tsx
└── pages/
    └── Dashboard.tsx
```

---

## 📐 ШАГ 1 — ТИПЫ (src/types/market.types.ts)

```typescript
export interface Asset {
  symbol: string          // 'BTC-USDT' | 'ETH-USDT' | 'AAPL' | 'EUR-USD'
  name: string            // 'Bitcoin'
  type: 'crypto' | 'stock' | 'forex' | 'index'
  price: number
  change24h: number       // процент изменения за 24ч
  changeDollar: number    // изменение в долларах
  volume24h: number
  marketCap?: number
  high24h: number
  low24h: number
  color: string           // цвет иконки '#F7931A'
  icon?: string           // буква для аватара 'B' | 'E' | 'A'
}

export interface PricePoint {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface NewsItem {
  id: string
  title: string
  summary: string
  source: string
  url: string
  publishedAt: string
  sentiment: 'positive' | 'negative' | 'neutral'
  relatedAssets: string[]
  imageUrl?: string
}

export interface CommunityPost {
  id: string
  author: {
    name: string
    handle: string
    initials: string
    avatarColor: string
  }
  content: string
  relatedAsset: string
  assetColor: string
  likes: number
  comments: number
  createdAt: string
  isLiked: boolean
}

export interface WatchlistItem {
  symbol: string
  addedAt: string
  viewCount: number       // для персонализации — инкрементируем при каждом открытии
}

export type Timeframe = '1m' | '5m' | '15m' | '1H' | '4H' | '1D' | '1W' | '1M'
```

---

## 🔌 ШАГ 2 — ХУКИ

### useAssetPrice.ts
```
Логика:
- Крипто (type === 'crypto'): WebSocket OKX
  URL: wss://ws.okx.com:8443/ws/v5/public
  Subscribe: { op: 'subscribe', args: [{ channel: 'tickers', instId: symbol }] }
  
- Акции (type === 'stock'): polling Finnhub каждые 30s
  GET https://finnhub.io/api/v1/quote?symbol={symbol}&token={FINNHUB_KEY}

- Форекс (type === 'forex'): polling frankfurter каждые 60s
  GET https://api.frankfurter.app/latest?from=EUR&to=USD

Параметры хука: useAssetPrice(symbol: string, type: Asset['type'], useMock = true)
Возвращает: { price: number, change24h: number, isLoading: boolean, isConnected: boolean }

Если useMock === true — возвращает данные из prices.mock.ts
```

### useOHLCV.ts
```
Логика:
- Крипто: GET https://www.okx.com/api/v5/market/candles?instId={symbol}&bar={tf}&limit=100
- Акции: GET https://finnhub.io/api/v1/stock/candle?symbol={s}&resolution={r}&from={ts}&to={ts}

React Query настройки:
  staleTime: 5 * 60 * 1000     (5 минут)
  refetchInterval: 60 * 1000   (обновление каждую минуту)

Параметры: useOHLCV(symbol: string, timeframe: Timeframe, useMock = true)
Возвращает: { data: PricePoint[], isLoading: boolean, error: Error | null }
```

### usePersonalized.ts
```
Логика (пока на моке):
- Читает WatchlistItem[] из Redux store
- Сортирует по viewCount DESC
- Возвращает топ-5 часто просматриваемых активов

В будущем: GET /api/user/personalized — бэкенд считает по user_asset_views таблице
Параметры: usePersonalized(useMock = true)
Возвращает: { topAssets: Asset[], isLoading: boolean }
```

---

## 🎭 ШАГ 3 — MOCK DATA

### prices.mock.ts — реалистичные данные:
```
BTC-USDT: $94,320, +2.8%, объём $42.1B, цвет #F7931A, иконка 'B'
ETH-USDT: $3,210, +1.4%, объём $18.7B, цвет #627EEA, иконка 'E'
SOL-USDT: $178.50, +4.2%, объём $8.3B, цвет #9945FF, иконка 'S'
AAPL:     $189.45, -0.6%, объём $4.2B, цвет #1A1A1A, иконка 'A'
MSFT:     $415.20, +0.9%, объём $3.1B, цвет #00A4EF, иконка 'M'
EUR-USD:  1.08420, +0.3%, объём $89.3B, цвет #003399, иконка '€'
GBP-USD:  1.26540, -0.2%, объём $45.1B, цвет #C8102E, иконка '£'
SPX:      5842.30, +0.8%, объём $12.4B, цвет #2E4057, иконка 'S'
```

### news.mock.ts — 10 новостей на русском:
```
Микс: 4 крипто + 3 акции + 2 форекс + 1 макро
Примеры заголовков:
- "Bitcoin преодолел $94,000 на фоне институционального спроса" (positive)
- "ФРС сохраняет ставку: рынки реагируют умеренным ростом" (neutral)
- "Apple отчёт Q4: выручка превысила прогнозы аналитиков" (positive)
- "Ethereum готовится к обновлению: объём DEX вырос на 23%" (positive)
- "Инфляция в США снизилась до 2.4%: форекс волатильность растёт" (neutral)
```

### community.mock.ts — 8 постов:
```
Авторы с инициалами и цветными аватарами:
@alex_btc (AB, #F7931A) — 2 поста о BTC
@eth_trader (ET, #627EEA) — 2 поста о ETH
@stock_pro (SP, #1A1A1A) — 2 поста об акциях
@fx_master (FM, #003399) — 1 пост о форекс
@crypto_anna (CA, #9945FF) — 1 пост о SOL

Пример поста:
{
  author: { name: "Алекс Б.", handle: "alex_btc", initials: "AB", avatarColor: "#F7931A" },
  content: "BTC формирует бычий флаг на 4H таймфрейме. Жду пробоя $95,400 для входа в лонг...",
  relatedAsset: "BTC",
  assetColor: "#F7931A",
  likes: 42,
  comments: 8
}
```

---

## 🧩 ШАГ 4 — КОМПОНЕНТЫ

### FloatingAssetCards.tsx
```
Визуал: горизонтальный ряд 4-5 карточек + кнопка "+"
Позиционирование: между топбаром и заголовком дашборда
Карточки: белые, border, border-radius 14px, box-shadow

Framer Motion:
- Появление: staggerChildren delay 0.1s, y: -15 → 0, opacity: 0 → 1
- Постоянная анимация: animate={{ y: [0, -4, 0] }}, duration 4s, ease "easeInOut", repeat Infinity
- Каждая карточка своя задержка: delay: index * 0.8s

Содержимое карточки:
- Цветной кружок 28px с иконкой актива (буква, цвет = asset.color)
- Название актива (13px, 600)
- Цена (12px, 700, ink)
- % изменение (10px, цвет: green/accent)

Данные: топ-4 из usePersonalized() или дефолт [BTC, ETH, AAPL, EUR-USD]
```

### PortfolioHero.tsx
```
Layout: flex, justify-content: space-between

Левая сторона:
- Label "Стоимость портфеля" (12px, muted)
- Большое число с анимацией count-up:
  useEffect: от 0 до целевого значения за 1500ms
  Framer Motion: animate с custom easing
- Пилюли: background #FFE5EC, color #E8264A, border-radius 999px
  Пилюля 1: "↑ 7.9%" (иконка arrow_up)
  Пилюля 2: "+$27,335.09" (контурная версия)
- Подпись: "к пред. $501,641.73 · 1 июн – 31 авг 2025" (12px, muted)

Правая сторона:
- Toggle "Период" + MUI Switch красный
- Дропдаун с датой (MUI Select) "1 сен – 30 ноя 2025"
```

### KpiStrip.tsx
```
Grid: 5 карточек + 1 кнопка (6 колонок)

Карточка 1 "Топ актив":
  - Кружок актива + имя + стрелка

Карточка 2 "Лучшая позиция" — ТЁМНАЯ:
  - background: #0D0D0D
  - color: white
  - Название актива + сумма + кнопка → (белый кружок)
  - Star иконка (Lucide) жёлтая

Карточки 3,4,5: белые, данные из Asset

Кнопка "Подробнее":
  - background: #0D0D0D, color: white
  - border-radius: 14px
  - Hover: translateY(-2px) через framer-motion whileHover

Анимация всех карточек: stagger появление снизу при загрузке страницы
```

### PriceChartWidget.tsx
```
СНАЧАЛА: проверь в 21dev компоненты по тегам "chart", "sparkline", "area chart", "finance"
Если найдёшь подходящий — адаптируй под Asset + PricePoint[] и наши цвета

Если не найдёшь — создай кастомный SVG area chart:

Верхняя часть виджета:
  - Дропдаун выбора актива (BTC/ETH/AAPL/EUR-USD)
  - Название актива + текущая цена + % изменение
  - Кнопки таймфрейма: 1Д | 1Н | 1М | 3М (активный = ink, остальные = bg)

График SVG:
  - Размер: 100% width, 200px height
  - Линия цены: stroke #E8264A, strokeWidth 2.5
  - Градиентная заливка: от #E8264A opacity 0.2 → прозрачный
  - Анимация прорисовки: strokeDasharray + strokeDashoffset, 2s ease
  - Hover: вертикальная линия + тултип (цена + время)
  - Ось X: метки Н1 Н3 Н5 Н7 Н9 Н11
  - Горизонтальные гайдлайны: пунктир, border-color

Данные: useOHLCV(selectedSymbol, selectedTimeframe)
```

### CommunityWidget.tsx
```
Заголовок: "Идеи сообщества" + "Смотреть все → " (ссылка)

3 поста из community.mock.ts

Каждый пост:
  Flex row, gap 10px:
  - Аватар 32px: цветной кружок, инициалы, font 12px bold white
  - Правая часть:
    - "@handle · время" (9px, muted)
    - Текст (12px): обрезан до 85 символов + "..."
    - Footer: тег актива (пилюля с цветом актива) + "❤ N" + "💬 N"

Hover на посте: background #F8F8F7, border-radius 10px
Разделители между постами: border-bottom 1px #ECEAE3
```

### NewsWidget.tsx
```
Заголовок: "Новости рынка"
Фильтры: "Всё | Крипто | Акции | Форекс" (активный = ink pill)

3-4 новости из news.mock.ts

Каждая новость:
  - Цветная точка настроения: green (positive), accent (negative), muted (neutral)
  - Заголовок 12px 600, 2 строки макс
  - Источник + время: 10px muted
  - Hover: лёгкий сдвиг влево border-left 2px accent

onClick: navigate('/news/:id')
```

---

## 🏗 ШАГ 5 — СБОРКА Dashboard.tsx

```tsx
// Структура layout:
<DashboardPage>           {/* framer-motion: opacity 0→1, y 20→0, duration 0.4s */}
  
  {/* Плавающие карточки активов */}
  <FloatingAssetCards />

  {/* Топбар: поиск + иконки + аватар */}
  <Topbar />

  {/* Заголовок + Портфель */}
  <PortfolioHero />

  {/* 5 KPI карточек */}
  <KpiStrip />

  {/* Горизонтальный скролл активов */}
  <AssetStrip />              {/* активы из вотчлиста, overflow-x: auto */}

  {/* Три колонки */}
  <Grid container spacing={2}>
    <Grid item xs={4}>
      <WatchlistPanel />       {/* список активов с ценами */}
    </Grid>
    <Grid item xs={4}>
      <AllocationChart />      {/* распределение — иконки активов */}
    </Grid>
    <Grid item xs={4}>
      <PersonalizedPanel />    {/* часто смотришь + теги */}
    </Grid>
  </Grid>

  {/* Нижняя секция */}
  <Grid container spacing={2}>
    <Grid item xs={6}>
      <PriceChartWidget />     {/* простой area chart */}
    </Grid>
    <Grid item xs={6}>
      <Stack spacing={2}>
        <CommunityWidget />    {/* идеи сообщества */}
        <NewsWidget />         {/* новости рынка */}
      </Stack>
    </Grid>
  </Grid>

</DashboardPage>
```

---

## 🔄 ШАГ 6 — ЗАМЕНЫ КОНТЕНТА (ОБЯЗАТЕЛЬНО)

| Было (Codename.com) | Стало (FinTrack) |
|---|---|
| Codename.com | FinTrack |
| Список продаж | Список активов |
| Доход | Стоимость портфеля |
| Лучшая сделка | Лучшая позиция |
| Армин А. / Микаса А. / Эрен Й. | BTC / ETH / SOL (кружки с инициалами) |
| Dribbble / Instagram / Behance / Google | BTC / ETH / AAPL / EUR-USD |
| Динамика продаж | Динамика рынка |
| Новый отчёт | Мой дашборд |
| Продавец | Актив |
| Лиды | Алерты |
| Стоимость платформы | Стоимость актива |

---

## ✅ ТРЕБОВАНИЯ К КОДУ

1. **TypeScript строгий** — все props типизированы, no `any`
2. **Mock режим** — каждый хук принимает `useMock?: boolean = true`
3. **Empty states** — каждый компонент рендерит заглушку при пустых данных
4. **Цвета** — ТОЛЬКО из дизайн-системы выше, никаких новых цветов
5. **Шрифт** — Inter везде, подключить через Google Fonts или уже есть в проекте
6. **Аватары** — только CSS-кружки с инициалами, никаких внешних image URL
7. **Иконки** — только Lucide React, никаких emoji в продакшн-коде
8. **Framer Motion** — обязательно для: появление страницы, stagger карточек, плавающие карточки активов, hover на кнопках и карточках

---

## ❌ НЕ ДЕЛАТЬ В ЭТОЙ ЗАДАЧЕ

- TradingView Lightweight Charts → Приоритет 4 (Asset Page)
- ИИ-чат компонент → Приоритет 4 (Asset Page)
- Drag-and-drop редактирование виджетов → Приоритет 3+ 
- Реальные API запросы (только структура хуков + mock = true)
- Авторизацию и Protected Routes → отдельный этап
- Мобильную адаптивность → финальный этап
- Admin Panel → Приоритет 7

---

## 📦 ЗАВИСИМОСТИ ДЛЯ УСТАНОВКИ (если не установлены)

```bash
npm install framer-motion
npm install @tanstack/react-query
npm install lucide-react
npm install lightweight-charts        # TradingView (понадобится в Приоритете 4)
npm install react-grid-layout          # drag-and-drop (понадобится в Приоритете 3)
npm install @types/react-grid-layout
```

---

*FinTrack — Diploma Project 2026 | ВятГУ Колледж | ИСПк-402-52-00 | Панкратов Н.В.*
