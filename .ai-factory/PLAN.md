# Implementation Plan: Dashboard Widgets Refactoring

Branch: none (Fast mode)
Created: 2026-06-05

## Settings
- Testing: no
- Logging: verbose
- Docs: no

## Tasks

### Phase 1: Global Fixes
- [x] Task 1: Fix `compactType` in Dashboard
  - File: `frontend/src/pages/Dashboard.tsx`
  - Action: Set `compactType="vertical"` on ReactGridLayout to fix widgets disappearing during drag.
  - Logging: Minimal, just verify layout behavior.
- [x] Task 2: Fix widget internal padding
  - File: `frontend/src/components/dashboard/WidgetCard.tsx` (and affected widgets)
  - Action: Adjust internal padding and layout so content fills the widget space properly instead of leaving gaps.
  - Logging: None.

### Phase 2: Group 1 - UI Fixes
- [x] Task 3: Watchlist UI Fixes
  - File: `frontend/src/components/dashboard/WatchlistPanel.tsx`
  - Action: Add asset name next to ticker (e.g. BTC, ETH), reduce padding between rows, add `onClick` to navigate to `/asset/${symbol}`, and add hover effects.
  - Logging: `DEBUG` on navigation clicks.
- [x] Task 4: Asset Ticker UI Fixes
  - File: `frontend/src/components/dashboard/widgets/AssetTickerWidget.tsx` (or similar)
  - Action: Reduce padding inside cards, add navigation on click, align styles with the app theme.
  - Logging: `DEBUG` on navigation.
- [x] Task 5: Top Movers UI Fixes
  - File: `frontend/src/components/dashboard/widgets/TopMoversWidget.tsx`
  - Action: Add click navigation, add colored ▲/▼ icons, display full asset name, remove empty space at the bottom.
  - Logging: `DEBUG` on navigation.
- [x] Task 6: Trending Coins UI Fixes
  - File: `frontend/src/components/dashboard/widgets/TrendingCoinsWidget.tsx`
  - Action: Add full coin names, make scrollable (5-6 visible), add click navigation.
  - Logging: `DEBUG` on navigation.
- [x] Task 7: Forex Rates UI Fixes
  - File: `frontend/src/components/dashboard/widgets/ForexRatesWidget.tsx`
  - Action: Convert 2x2 grid to compact horizontal list (`EUR/USD | 1.1646 | +0.30%`), add navigation to forex page, add flag icons.
  - Logging: `DEBUG` on render and navigation.
- [x] Task 8: Heatmap UI Fixes
  - File: `frontend/src/components/dashboard/widgets/HeatmapWidget.tsx`
  - Action: Reduce cell size (show 16-20 coins), add navigation on click, add hover tooltip (name + % + price).
  - Logging: `DEBUG` on interactions.
- [x] Task 9: Allocation / Donut UI Fixes
  - File: `frontend/src/components/dashboard/widgets/AllocationWidget.tsx` (or similar)
  - Action: Add permanent legend (name + %), hover tooltip on segments, click navigation.
  - Logging: `DEBUG` on interactions.
- [x] Task 10: Price Chart UI Fixes
  - File: `frontend/src/components/dashboard/widgets/PriceChartWidget.tsx` (or similar)
  - Action: Remove vertical padding to fill height, make timeframe switches more compact.
  - Logging: None.

### Phase 3: Group 2 - Real Data Integration
- [x] Task 11: RSI Indicator Data
  - File: `frontend/src/components/dashboard/widgets/RsiGaugeWidget.tsx`
  - Action: Calculate RSI (14) using `useOHLCV`, reduce SVG to 64px, add asset switcher, color zones (<30 red, 30-70 gray, >70 green), show prev value + direction arrow.
  - Logging: `DEBUG` RSI calculation inputs/outputs.
- [x] Task 12: MACD Indicator Data
  - File: `frontend/src/components/dashboard/widgets/MacdWidget.tsx`
  - Action: Calculate MACD (12, 26, 9) from `useOHLCV`, add asset and timeframe switchers, color lines (blue/orange/green/red), show current values.
  - Logging: `DEBUG` MACD calculation values.
- [x] Task 13: Fear & Greed Data
  - File: `frontend/src/components/dashboard/widgets/FearGreedWidget.tsx`
  - Action: Connect `https://api.alternative.me/fng/`, show value + label + date, color code (<25 red, 25-50 yellow, 50-75 orange, >75 green), add 1h caching.
  - Logging: `INFO` on API fetch and cache hit.
- [x] Task 14: Market Volume & BTC Dominance Data
  - File: `frontend/src/components/dashboard/widgets/GlobalMarketCapWidget.tsx`, `frontend/src/components/dashboard/widgets/DominanceChartWidget.tsx`
  - Action: Connect CoinGecko `/api/v3/global` (via backend or proxy), show Total Cap + Volume 24h + BTC Dom in one, and split Dominance (BTC/ETH/Others) in the other. Add legends, 24h change, tooltips.
  - Logging: `INFO` on CoinGecko API fetch.
- [x] Task 15: Technical Analysis Signal
  - File: `frontend/src/components/dashboard/widgets/TechnicalAnalysisWidget.tsx`
  - Action: Calculate signal (RSI+MACD+MA). Buy: RSI<30 & MACD>Signal. Sell: RSI>70. Neutral: else. Add asset switcher and indicator breakdown.
  - Logging: `DEBUG` signal logic evaluation.

### Phase 4: Group 3 - Complex Widgets
- [x] Task 16: Economic Calendar
  - File: `frontend/src/components/dashboard/widgets/EconomicCalendarWidget.tsx`
  - Action: Connect Finnhub `/calendar/economic` (or update mock), ellipsis+tooltip for long names, scroll (5-6 rows), color code importance (red/yellow/green dots).
  - Logging: `INFO` on data fetch.
- [x] Task 17: Price Alerts
  - File: `frontend/src/components/dashboard/widgets/PriceAlertsWidget.tsx`
  - Action: Compare `usePrices`, trigger Notification API, add creation form (asset, >/<, price), delete button, active/triggered states, persist in `localStorage`.
  - Logging: `INFO` on alert trigger, `DEBUG` on check loop.
- [x] Task 18: Order Book
  - File: `frontend/src/components/dashboard/widgets/OrderBookWidget.tsx`
  - Action: Rename to "Книга ордеров", connect OKX WS `books5`, show top 5 bid/ask, add asset switcher. Hide/fallback if WS fails.
  - Logging: `DEBUG` WS connection status and updates.
- [x] Task 19: Portfolio P&L
  - File: `frontend/src/components/dashboard/widgets/PortfolioPnlWidget.tsx`
  - Action: Link to user favorites, show empty state message, calculate P&L using current prices from `usePrices`.
  - Logging: `DEBUG` P&L calculation.
- [x] Task 20: Community
  - File: `frontend/src/components/dashboard/widgets/CommunityWidget.tsx` (or similar)
  - Action: Link to news comments, show latest comments, add scroll, navigate to `/news/${id}` on click.
  - Logging: `DEBUG` comment mapping.
