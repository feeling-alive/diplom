# Implementation Plan: Asset Page — полная реализация

Created: 2026-05-14

## Settings
- Testing: no
- Logging: verbose
- Docs: warn-only

## Description
Полная реализация страницы актива `/asset/:symbol` по `asset-page-prompt.md`:
- Шапка с иконкой / именем / ценой / change24h / star
- Главная карточка с 3 табами: "Обычный" (Recharts AreaChart), "Про график ↗" (TradingView modal), "Информация о монете" (CoinGecko)
- Метрики со скроллом колесиком
- TradingView Advanced Chart Widget в fullscreen modal + AI заглушка
- Правая колонка: новости (`useNews`) + AI заглушка
- Новый хук `useCoinInfo` — CoinGecko без авторизации, React Query 30мин кэш
- 65/35 двухколоночный layout, без `NavBar` и без `app-page` wrapper (использует `main-content` как Dashboard / MarketOverview)

## Tasks

### Phase 1 — Data layer

- [x] Task 1: Создать `useCoinInfo` хук + маппинг символов
  - Файл: `src/constants/coin-mapping.ts` — `SYMBOL_TO_COIN_ID` для крипто (BTC→bitcoin, ETH→ethereum, SOL→solana, и т.д. — ~20 mapping'ов)
  - Файл: `src/hooks/useCoinInfo.ts` — React Query, `staleTime: 30*60*1000`, fetch `https://api.coingecko.com/api/v3/coins/{coinId}` без авторизации
  - Возврат: `{ data: CoinInfo | null, isLoading, error, isUnsupported }`
  - `isUnsupported = true` если символ нет в маппинге (для акций/форекс)
  - Тип `CoinInfo`: description, homepage, github, twitter, genesisDate, hashingAlgorithm, marketCapRank, ath, athDate, atl, atlDate, totalSupply, circulatingSupply
  - Log: `console.debug('[useCoinInfo] symbol=%s coinId=%s', symbol, coinId)`

### Phase 2 — Asset components

- [x] Task 2: Переписать `AssetHeader`
  - Файл: `src/components/asset/AssetHeader.tsx`
  - Полная ширина, над колонками: иконка-круг (color/icon из Asset), имя, тикер серым, цена крупно (использовать `useAssetPrice(symbol, type)`), change24h в pill, кнопка-звезда "Добавить в список"
  - Star button — `useState` локальный isStarred toggle (без localStorage в этой задаче)
  - Log: `console.debug('[AssetHeader] %s price=%s change=%s', symbol, price, change)`

- [x] Task 3: Создать `SimpleChart` (для таба "Обычный")
  - Файл: `src/components/asset/SimpleChart.tsx`
  - Recharts `AreaChart` по `useOHLCV(symbol, timeframe)` (`useMock=true` для скорости)
  - Пропс: `{ symbol, change24h }` (для определения цвета)
  - Pill-группа таймфреймов справа над графиком: 1Ч / 4Ч / 1Д / 1Н / 1М (`'1H'|'4H'|'1D'|'1W'|'1M'`)
  - Активный — тёмный фон. Линия и градиент — accent при росте, red при падении
  - YAxis справа, XAxis снизу, серые пунктирные горизонтальные гайдлайны, tooltip
  - Скелетон при загрузке (анимация pulse)
  - Log: `console.debug('[SimpleChart] tf=%s points=%d', tf, points)`

- [x] Task 4: Создать `CoinInfoBlock` (для таба "Информация о монете")
  - Файл: `src/components/asset/CoinInfoBlock.tsx`
  - Использует `useCoinInfo(symbol)`
  - Описание (первые 400 символов + кнопка "Читать далее" → раскрывает полное описание)
  - Ссылки с иконками (Globe / GitHub / Twitter из lucide-react)
  - Дата запуска, алгоритм, рейтинг
  - Статистика: ATH/ATL с датами, total/circulating supply (форматировать через formatBillion и пр.)
  - При `isUnsupported` — карточка с текстом "Расширенная информация доступна только для криптоактивов"
  - Скелетон при загрузке
  - Log: `console.debug('[CoinInfoBlock] unsupported=%s loaded=%s', isUnsupported, !!data)`

- [x] Task 5: Создать `MainCard` — карточка с 3 табами
  - Файл: `src/components/asset/MainCard.tsx`
  - Состояние: `activeTab: 'simple' | 'info'`, `isProModalOpen: boolean`
  - Табы визуально "выступают" из верхней грани карточки как язычки (отрицательный margin-top, активный сливается с карточкой)
  - 3 кнопки-таба: "Обычный", "Про график ↗" (иконка `ExternalLink`), "Информация о монете"
  - Клик на "Про график" — открывает `TradingViewModal` (НЕ переключает контент)
  - `AnimatePresence` для переключения между `<SimpleChart />` и `<CoinInfoBlock />` (slide right/left + fade)
  - Log: `console.debug('[MainCard] activeTab=%s modalOpen=%s', activeTab, isProModalOpen)`

- [x] Task 6: Создать `MetricsBar` с горизонтальным скроллом
  - Файл: `src/components/asset/MetricsBar.tsx`
  - Метрики (Asset + CoinGecko): Капитализация, Объём 24ч, Макс 24ч, Мин 24ч, Спред, Сделок (последние 2 — из CoinGecko если доступно)
  - Горизонтальный flex row, wheel scroll handler (на onWheel → scrollLeft += delta)
  - Стрелки слева/справа поверх контейнера, появляются только когда есть что скроллить (canScrollLeft / canScrollRight через `scrollLeft` + `scrollWidth`)
  - Stagger appear animation (Framer Motion, delay i * 0.05s)
  - Log: `console.debug('[MetricsBar] canL=%s canR=%s', canScrollLeft, canScrollRight)`

- [x] Task 7: Создать `TradingViewModal` с iframe TradingView
  - Файл: `src/components/asset/TradingViewModal.tsx`
  - Apple-style: backdrop `rgba(0,0,0,0.6)` + `backdrop-filter: blur(20px)`
  - Размер: 92vw × 90vh, скругление 20px
  - Появление: Framer Motion `scale: 0.95→1, opacity: 0→1, spring`
  - Левая зона (70%) — `<iframe>` с TradingView Advanced Chart Widget; URL формируется из тикера: `BTC-USDT → BINANCE:BTCUSDT`, `AAPL → NASDAQ:AAPL`, `EUR-USD → FX:EURUSD`. Параметры iframe: theme=light, locale=ru, allow_symbol_change=false, hide_top_toolbar=false
  - Правая зона (30%) — заглушка ИИ: `Bot` иконка, заголовок "ИИ-ассистент", subtitle серым, 3 серые неактивные кнопки ("Проанализируй текущий тренд", "Найди уровни поддержки", "Оцени риски входа")
  - Закрытие: крестик в правом верхнем углу + клик на backdrop
  - Log: `console.debug('[TradingViewModal] tvSymbol=%s', tvSymbol)`

### Phase 3 — Right column

- [x] Task 8: Создать `NewsPanel` для правой колонки
  - Файл: `src/components/asset/NewsPanel.tsx`
  - Заголовок "Новости · {ticker}"
  - `useNews(symbol)` (USE_MOCK=true даёт mock)
  - Внутренний `overflow-y: auto`, фиксированная высота 60% правой колонки
  - Каждая новость: цветная точка настроения (positive=green, negative=red, neutral=gray), заголовок, source · time
  - Клик → `window.open(news.url, '_blank')`
  - Stagger appear, skeleton при загрузке
  - Log: `console.debug('[NewsPanel] %s count=%d', symbol, news.length)`

- [x] Task 9: Создать `AIPanel` заглушку
  - Файл: `src/components/asset/AIPanel.tsx`
  - 40% высоты правой колонки, серая внутренняя зона
  - `Bot` иконка 48px, заголовок "ИИ-ассистент", подзаголовок "Будет доступен после подключения аналитической модели"
  - 3 серые неактивные кнопки-подсказки, поле ввода (disabled)
  - opacity 0.6, cursor: not-allowed на интерактивных элементах
  - Log: `console.debug('[AIPanel] rendered for %s', symbol)`

### Phase 4 — Assembly

- [x] Task 10: Переписать `AssetPage.tsx`
  - Убрать `<NavBar />`, убрать `app-page` wrapper (страница уже внутри `ProtectedLayout`)
  - Структура: `<div className="main-content">` → padding 20/24 → `<AssetHeader />` → `<div grid 65/35>` → левая (`MainCard` + `MetricsBar`) / правая (`NewsPanel` + `AIPanel`)
  - 404-страница без `app-page` тоже
  - Найти Asset по символу через `usePrices().bySymbol[symbol]` (а не статично через MOCK_PRICES)
  - Log: `console.debug('[AssetPage] symbol=%s found=%s', symbol, !!asset)`

- [x] Task 11: TypeScript check + удалить старые asset-компоненты
  - Удалить старый `CandlestickChart.tsx` (не используется), `ChatPanel.tsx` (заменён на AIPanel)
  - Файл: `src/components/asset/CandlestickChart.tsx` — удалить
  - Файл: `src/components/asset/ChatPanel.tsx` — удалить
  - `npx tsc --noEmit` без ошибок

## Commit Plan

- After Task 4 (Phase 1+2 part 1): `feat(asset): add useCoinInfo, AssetHeader, SimpleChart, CoinInfoBlock`
- After Task 7 (Phase 2 part 2): `feat(asset): add MainCard with 3 tabs, MetricsBar, TradingView modal`
- After Task 11 (final): `feat(asset): wire NewsPanel + AIPanel, rebuild AssetPage layout, cleanup`
