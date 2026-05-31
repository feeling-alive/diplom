# FinTrack Backend — FastAPI + Redis

Прокси-сервис, который ходит во внешние API котировок (Finnhub, OKX, Frankfurter)
и кэширует ответы в Redis, чтобы фронт не обращался к внешним API напрямую и не
светил ключи в браузере.

> Статус: каркас. Эндпоинты, кэш и сервисы добавляются по плану
> `.ai-factory/plans/backend-fastapi-redis.md`.

## Стек

- FastAPI + Uvicorn (ASGI)
- Redis (кэш с TTL: акции 60с, крипта 30с, форекс 300с)
- httpx (async HTTP-клиент к внешним API)
- pydantic-settings + python-dotenv (конфиг из `.env`)

## Быстрый старт

```bash
# 1. Redis (Docker — рекомендуется)
docker run -d --name fintrack-redis -p 6379:6379 redis:alpine

# 2. Зависимости (виртуальное окружение)
cd backend
python -m venv .venv
# Windows PowerShell:  .venv\Scripts\Activate.ps1
# Windows CMD/bash:    .venv\Scripts\activate
pip install -r requirements.txt

# 3. Конфиг
cp .env.example .env        # затем впишите свой FINNHUB_API_KEY

# 4. Запуск
uvicorn app.main:app --reload --port 8000
```

Проверка: <http://localhost:8000/health> → `{"status":"ok"}`.

## Переменные окружения

| Переменная | По умолчанию | Назначение |
|---|---|---|
| `FINNHUB_API_KEY` | `""` | Ключ Finnhub (котировки акций). Только в `backend/.env`. |
| `REDIS_URL` | `redis://localhost:6379` | Подключение к Redis. |
| `CORS_ORIGINS` | `http://localhost:5173` | Разрешённые origin (Vite dev). |
| `STOCK_TTL` / `CRYPTO_TTL` / `FOREX_TTL` | `60` / `30` / `300` | TTL кэша, сек. |

## Эндпоинты

| Метод | Путь | Источник | TTL |
|---|---|---|---|
| GET | `/health` | — | — |
| GET | `/api/quotes/stock/{symbol}` | Finnhub | 60с |
| GET | `/api/quotes/stocks?symbols=AAPL,MSFT` | Finnhub (батч) | 60с |
| GET | `/api/quotes/crypto/{symbol}` | OKX REST | 30с |
| GET | `/api/quotes/forex/{from}/{to}` | Frankfurter | 300с |

Формат котировки: `{symbol, price, change, changePercent, volume}` (у форекса
дополнительно `from`, `to`, `rate`). Volume у акций всегда `0` — Finnhub `/quote`
его не отдаёт.

## Миграция фронта (на потом — в этой итерации хуки НЕ меняем)

Сейчас фронт ходит во внешние API напрямую/через старый vite-proxy. Бэкенд
поднят параллельно (vite-proxy `/api/quotes → :8000`), хуки пока не тронуты.

Текущие точки обращения (что переключать позже):

| Хук | Сейчас | После миграции |
|---|---|---|
| `useStockPrice.ts` | `/api/finnhub/quote?symbol=X&token=KEY` | `/api/quotes/stock/X` |
| `usePrices.ts` (акции) | `${ENV.FINNHUB_BASE_URL}/quote?...&token=KEY` | `/api/quotes/stocks?symbols=...` |
| `useAssetPrice.ts` (stock) | `/api/finnhub/quote?...&token=KEY` | `/api/quotes/stock/X` |
| `useAssetPrice.ts` (forex) | `${ENV.FRANKFURTER_BASE_URL}/latest` | `/api/quotes/forex/{from}/{to}` |
| `useForexRate.ts` | `${ENV.FRANKFURTER_BASE_URL}/latest` | `/api/quotes/forex/{from}/{to}` |
| `usePrices.ts` (крипта) | прямой `https://www.okx.com/...` | `/api/quotes/crypto/{symbol}` |

Шаги миграции (отдельная задача):
1. В `src/lib/env.ts` сменить дефолт `FINNHUB_BASE_URL` на `/api/quotes` (или ввести `QUOTES_BASE_URL`).
2. В хуках заменить пути и **убрать `token` из URL** — ключ теперь только на бэкенде.
3. OKX **WebSocket** в `useAssetPrice.ts` НЕ трогать — realtime остаётся на фронте.

## Безопасность

Старый Finnhub-ключ утёк в публичную git-историю и в `proxy.md` — **перевыпустите
его** и держите новый только в `backend/.env` (он в `.gitignore`).
