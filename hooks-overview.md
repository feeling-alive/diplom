# Хуки — краткое описание реализации

## usePrices
Главный хук, обеспечивающий глобальный стор цен для всего дашборда.

- Стартует с `prices.json` (статические seed-данные)
- Каждые **15 секунд** вызывает `tick()`:
  - OKX REST `/market/tickers` → крипто (50 пар)
  - Frankfurter REST `/latest` → форекс
  - Finnhub REST `/quote` × 10 акций (параллельно через `Promise.allSettled`)
- Если API не вернул данные для актива — применяет **±0.5% jitter** (имитация движения)
- Возвращает `{ bySymbol, cryptos, stocks, forex, indices, all, isLoading, lastUpdated }`

## useAssetPrice
Хук для одного конкретного актива. Используется в карточках и виджете графика.

| Тип | Источник | Метод |
|---|---|---|
| crypto | OKX WebSocket `wss://` | `channel: tickers` — push в реальном времени |
| stock | Finnhub REST | polling каждые **60 сек** |
| forex | Frankfurter REST | polling каждые **60 сек** |
| mock | `prices.mock.ts` | статика, без сети |

Возвращает `{ price, change24h, isLoading, isConnected }`.

## useOHLCV
Хук для исторических свечей (OHLCV). Используется в графике PriceChartWidget.

- Построен на **React Query** (`useQuery`)
- `staleTime: 5 мин`, `refetchInterval: 60 сек`
- Маршрутизация по формату символа:
  - `BTC-USDT` (содержит `-`) → OKX `/market/candles`
  - `AAPL` → Finnhub `/stock/candle`
- В mock-режиме → `getMockOHLCV()` из локального файла

Возвращает `{ data: PricePoint[], isLoading, error }`.
