# Архитектура: Feature-based Modular (React SPA)

## Обзор

FinTrack использует **feature-based модульную архитектуру** — единый Vite-бандл, организованный по доменным фичам (`dashboard`, `market-overview`, `asset`, `layout`) вместо технических слоёв. Внутри каждой фичи живут её UI-компоненты, виджеты, страничные точки входа и feature-specific логика. Перпендикулярно фичам идут горизонтальные модули: `hooks/` (источники данных, один файл = один внешний API/WebSocket), `types/` (контракты доменной модели), `utils/`, `lib/`, `mock/`, `data/`.

Такой подход выбран потому, что фронтенд-SPA на React 19 с 10+ страницами и кастомизируемым дашбордом естественно делится по экранам / контекстам. Привязка кода к фиче делает поиск по «откуда взялась эта кнопка» тривиальным, локализует регрессии и позволяет одиночному разработчику быстро ориентироваться. При этом сохраняется единое деплой-приложение и минимальная операционная сложность — критично для дипломного проекта.

## Бэкенд-сервис (FastAPI + Redis) — с 2026-05-30

Помимо фронтенд-бандла появился отдельный сервис `backend/` (FastAPI + Redis), **не входящий** в `src/` и в правила зависимостей выше. Назначение — прокси + кэш котировок (Finnhub/OKX/Frankfurter), чтобы фронт не обращался к внешним API напрямую и не светил ключи.

- Структура: `backend/app/{main.py, config.py, routes/, services/}` — роуты тонкие, вся логика и кэш в `services/` (слой `routes → services → cache/external`).
- Эндпоинты под префиксом `/api/quotes` (`stock`, `stocks`, `crypto`, `forex`) + `/health`.
- Кэш Redis с TTL (60/30/300с) и graceful degradation при недоступном Redis.
- Связь с фронтом: vite-proxy `/api/quotes → :8000` (аддитивно). Миграция хуков фронта на бэкенд — отложена (см. `backend/README.md`).
- OKX **WebSocket** остаётся на фронте (`useAssetPrice.ts`) — бэкенд использует только OKX REST.

### Слой данных (Блок A, с 2026-06-02)

К горизонтальному слою бэкенда добавлен слой персистентности (PostgreSQL 14 + SQLAlchemy 2.0 async + Alembic):

- `backend/app/database.py` — async engine (`asyncpg`), `AsyncSessionLocal`, declarative `Base`, FastAPI-dependency `get_db`. Единственный канал к БД: роуты получают `AsyncSession` через `get_db`, сами движки/сессии не создают.
- `backend/app/models.py` — 6 ORM-моделей (User, Subscription, DashboardConfig, ChatSession, Comment, Favorite) в стиле SQLAlchemy 2.0 (`Mapped`/`mapped_column`); UUID-ключи, PG-enum'ы с явным `name=`, JSON-колонки как `JSON().with_variant(JSONB, "postgresql")` для портируемости (sqlite в тестах).
- `backend/alembic/` — async `env.py` (URL из `settings.database_url`, `target_metadata = Base.metadata`, `run_async_migrations` через `connection.run_sync`, `compare_type=True`). Миграции — единственный owner схемы; `create_all` в lifespan оставлен только как dev-удобство (обёрнут в try/except — недоступная БД не валит сервис).
- Оркестрация: корневой `docker-compose.yml` (postgres + redis + backend) + `backend/Dockerfile` (python:3.11-slim) + `.dockerignore` (исключает Windows-`.venv`). Host-порт Postgres = 5433 на этой машине (5432 занят нативным PG); внутри сети — `postgres:5432`.
- Тесты бэкенда: `backend/tests/` (pytest, `asyncio_mode=auto`) — детерминированы, без живой БД (метаданные + sqlite `create_all` + health).

### Модуль аутентификации (Блок B, с 2026-06-02)

- Backend: `backend/app/auth/` — отдельный вертикальный срез (`utils.py` bcrypt+JWT, `schemas.py`, `dependencies.py`, `router.py`). В БД ходит только через `get_db`/модели; подключается в `main.py` как `auth_router` (собственный prefix `/auth`). CORS расширен до `GET,POST` (cookie требует `allow_credentials=True`). Пароли — `bcrypt` напрямую (passlib несовместим с bcrypt 5.x).
- Frontend: auth-сессия — единственный кросс-срезовый Context (`src/context/AuthContext.tsx`, `useAuth`), мост к API — `src/lib/authApi.ts` (fetch с `credentials:'include'`). Guard `components/layout/RoutesGuard.tsx` потребляет `useAuth`. Решение адаптировано под стек проекта: **Context вместо Redux**, **дизайн-система вместо MUI** (см. RULES). `AuthProvider` зеркалит состояние в legacy localStorage-ключи для компонентов, которые читают их напрямую.
- Тесты auth: `backend/tests/test_auth.py` + `conftest.py` (sqlite in-memory StaticPool, override `get_db`, httpx ASGITransport — без lifespan/живой БД).

## Обоснование решения

- **Тип проекта:** React 19 SPA, дашборд + страница актива + auth-секция
- **Стек:** TypeScript strict, Vite, react-router-dom v7, TanStack Query, react-grid-layout
- **Размер команды:** 1 разработчик
- **Ключевые факторы:**
  - Чёткое разделение по UX-зонам (`/`, `/market`, `/asset/:symbol`, `/news`, `/chat`, auth) → фичи естественны
  - Текущий код уже следует этому паттерну (`components/dashboard/`, `components/market-overview/`, `components/asset/`, `components/layout/`)
  - Горизонтальные хуки для источников данных переиспользуются между фичами → их выделение в `src/hooks/` оправдано
  - Излишество Clean Architecture / DDD для одного разработчика и срока в семестр

## Структура каталогов

```
src/
├── pages/                            # роут-уровень: одна страница = одна фича
│   ├── Dashboard.tsx                  # фича: настраиваемый дашборд
│   ├── MarketOverview.tsx             # фича: обзор рынка
│   ├── AssetPage.tsx                  # фича: страница актива
│   ├── NewsPage.tsx / NewsArticlePage # фича: новости
│   ├── ChatPage.tsx                   # фича: AI-чат
│   ├── LoginPage.tsx / RegisterPage   # фича: auth
│   ├── ProfilePage.tsx / SubscriptionPage / AdminPanelPage
│   └── __tests__/                     # страничные тесты
│
├── components/
│   ├── layout/                        # горизонтальный модуль: shell, sidebar, route guards
│   │   ├── AppSidebar.tsx
│   │   ├── FinTrackNavBar.tsx
│   │   └── RoutesGuard.tsx
│   ├── dashboard/                     # фича: всё для Dashboard.tsx
│   │   ├── WidgetCard.tsx
│   │   ├── SizeIndicator.tsx
│   │   ├── WidgetPreview.tsx
│   │   ├── AddWidgetModal.tsx
│   │   ├── DashboardHeader.tsx
│   │   ├── WatchlistPanel.tsx
│   │   └── widgets/                   # конкретные типы виджетов
│   │       ├── TopMoversWidget.tsx
│   │       ├── MarketVolumeWidget.tsx
│   │       ├── FearGreedWidget.tsx
│   │       └── ...
│   ├── market-overview/               # фича: Market Overview
│   │   ├── MarketSummaryBar.tsx
│   │   ├── TopMovers.tsx
│   │   └── AssetTable.tsx
│   └── asset/                         # фича: Asset Page
│       ├── AssetHeader.tsx
│       ├── CandlestickChart.tsx
│       ├── SimpleChart.tsx
│       └── ChatPanel.tsx
│
├── hooks/                             # горизонтальный модуль: data sources (один файл = один источник)
│   ├── useAssetPrice.ts               # OKX WS (crypto) + Finnhub (stock) + Frankfurter (forex)
│   ├── useOHLCV.ts                    # свечные данные
│   ├── useStockPrice.ts               # Finnhub polling
│   ├── useForexRate.ts                # Frankfurter
│   ├── useNews.ts                     # NewsAPI с fallback на mock
│   ├── usePrices.ts                   # центральный хук цен (JSON + поверх API)
│   ├── useCoinInfo.ts                 # CoinGecko метаданные (TanStack Query, 30мин кэш)
│   ├── useGroqChat.ts                 # Groq AI
│   └── usePersonalized.ts
│
├── types/                             # контракты доменной модели (только типы, без логики)
│   ├── market.types.ts                # Asset, PricePoint, OHLCV, NewsItem
│   └── widgets.types.ts               # WidgetType, WidgetConfig, WIDGET_REGISTRY
│
├── mock/                              # fallback-данные для useMock=true
│   ├── prices.mock.ts
│   ├── news.mock.ts
│   ├── ohlcv.mock.ts
│   └── community.mock.ts
│
├── utils/                             # чистые функции
│   └── format.ts                      # formatPrice, formatChange, formatVolume, formatMarketCap
│
├── lib/                               # обвязки внешних библиотек / env
│   └── env.ts                         # централизованный доступ к VITE_*
│
├── config/                            # статичные конфигурации
├── constants/                         # неизменяемые маппинги (SYMBOL_TO_COIN_ID)
├── data/                              # JSON-снимки (prices.json — 46 активов)
├── assets/                            # статика, импортируемая в код
│
├── App.tsx                            # composition root: маршруты + layout
├── main.tsx                           # bootstrap: ReactDOM, BrowserRouter, QueryClient
├── index.css                          # глобальные стили + react-grid-layout overrides
└── test-setup.ts                      # Vitest setup
```

## Правила зависимостей

| Из | Может зависеть от |
|----|--------------------|
| `pages/<Feature>` | `components/<feature>/`, `components/layout/`, `hooks/`, `types/`, `utils/`, `lib/`, `mock/`, `data/`, `constants/` |
| `components/<feature>/` | `hooks/`, `types/`, `utils/`, `lib/`, `mock/`, `constants/`, **другие компоненты той же фичи** |
| `components/layout/` | `hooks/`, `types/`, `utils/`, `lib/`, react-router-dom |
| `hooks/` | `types/`, `utils/`, `lib/`, `mock/`, `constants/`, `data/` |
| `types/` | **ничего** (только встроенные типы TS) |
| `utils/` | `types/` |
| `mock/` | `types/`, `data/` |
| `lib/` | внешние библиотеки, переменные окружения |

- ✅ **Разрешено:** `dashboard/WatchlistPanel.tsx` → `usePrices`, `formatPrice`, `Asset` тип
- ✅ **Разрешено:** `dashboard/widgets/TopMoversWidget.tsx` → `usePrices`, `dashboard/WidgetCard.tsx`
- ✅ **Разрешено:** `pages/AssetPage.tsx` → `components/asset/AssetHeader.tsx`, `useAssetPrice`
- ❌ **Запрещено:** `components/market-overview/AssetTable.tsx` → `components/dashboard/WatchlistPanel.tsx` (cross-feature импорт компонентов)
- ❌ **Запрещено:** `hooks/useNews.ts` → `components/...` (хук не зависит от UI)
- ❌ **Запрещено:** `types/market.types.ts` → что-либо вне `types/`
- ❌ **Запрещено:** `utils/format.ts` → `hooks/`, `components/` (utility должна оставаться чистой)

## Коммуникация между модулями

### Между фичами
- **Только через `pages/`** — страница импортирует компоненты двух фич и связывает их через props/state. Прямые импорты компонентов из чужой фичи запрещены.
- Если два компонента из разных фич должны разделять логику — выноси её в `hooks/` (для состояния/данных) или в `utils/` (для чистых функций).
- Общие визуальные элементы (кнопка, модалка, скелетон) выноси в `components/layout/` или создавай новый `components/ui/` модуль когда накопится.

### Между UI и данными
- **Хуки — единственный канал к внешним API**. Компоненты не делают `fetch` напрямую; всё через `useFoo()`.
- Каждый хук принимает `useMock?: boolean = true` и возвращает `{ data, isLoading, error }`.
- TanStack Query — для запросов с кэшированием (например, `useCoinInfo` с `staleTime: 30мин`). Локальные таймеры/WebSocket — внутри хуков (`useStockPrice` polling 60s, `useAssetPrice` OKX WS).

### Глобальное состояние
- **Минимизируй**. Используй `useState` + `localStorage` для feature-local (раскладка дашборда — `fintrack_widgets_v2`).
- TanStack Query кэш — основной «общий стор» для серверных данных.
- React Context только когда без него никак (например, auth user) и только узким scope'ом.

### Persisted state
- Любой `localStorage`-ключ — версионируется (`fintrack_widgets_v2`). При смене схемы реестра/типов — бамп версии и явное удаление legacy-ключей в `loadFromStorage()` с логом `[FIX] purging legacy localStorage key %s`.
- В `loadFromStorage()` обязательно валидировать/кламповать данные относительно текущей схемы. Никогда не возвращать сырой `JSON.parse(...)` в React state.

## Ключевые принципы

1. **Фича — это вертикальный slice.** Всё, что нужно для отображения экрана, лежит под одним каталогом фичи. Перенос фичи в другой проект = копирование одной папки + её зависимостей по таблице правил.

2. **Хуки — единственный мост к внешнему миру.** API-вызовы, WebSocket, `localStorage`, таймеры — внутри хука. Компонент потребляет результат и не знает, mock это или Finnhub.

3. **Типы — без логики.** `types/` декларирует контракты. Если для type нужна функция (например, `parsePrice`), эта функция живёт в `utils/`.

4. **Mock как first-class fallback.** Каждый источник данных имеет mock в `src/mock/`. Хук должен корректно работать без ключей API — это критично для разработки и демонстрации диплома.

5. **Strict TypeScript без компромиссов.** `no-explicit-any: error`. Если хочется `any` — значит контракт неверен; описывай через `unknown` + сужение.

6. **Verbose `console.debug` — обязательная конвенция.** Префикс `[ИмяКомпонента]` обязателен. Облегчает отладку демо-сценариев в реальном времени.

7. **Empty state — часть контракта.** Каждый компонент рендерится корректно при `data === null|undefined|[]`.

8. **Дизайн-система — закрытая.** Никаких новых цветов, радиусов, размеров шрифта вне списка в `.ai-factory/RULES.md`. Никаких inline-стилей с произвольными значениями.

## Примеры кода

### Пример 1: data-хук с mock fallback и логированием

```ts
// src/hooks/useStockPrice.ts
import { useEffect, useState } from 'react'
import { env } from '../lib/env'
import { MOCK_PRICES } from '../mock/prices.mock'
import type { PricePoint } from '../types/market.types'

export interface UseStockPriceResult {
  data: PricePoint | null
  isLoading: boolean
  error: Error | null
}

export function useStockPrice(symbol: string, useMock: boolean = true): UseStockPriceResult {
  const [state, setState] = useState<UseStockPriceResult>({
    data: null,
    isLoading: true,
    error: null,
  })

  useEffect(() => {
    let cancelled = false
    const tick = async () => {
      try {
        if (useMock || !env.FINNHUB_KEY) {
          const mock = MOCK_PRICES.find((p) => p.symbol === symbol) ?? null
          console.debug('[useStockPrice] mock %s -> %o', symbol, mock)
          if (!cancelled) setState({ data: mock, isLoading: false, error: null })
          return
        }
        const res = await fetch(`/api/finnhub/quote?symbol=${symbol}`)
        if (!res.ok) throw new Error(`Finnhub ${res.status}`)
        const json = await res.json()
        console.debug('[useStockPrice] live %s -> %o', symbol, json)
        if (!cancelled) setState({ data: json, isLoading: false, error: null })
      } catch (err) {
        console.warn('[useStockPrice] API failed, using mock', err)
        const mock = MOCK_PRICES.find((p) => p.symbol === symbol) ?? null
        if (!cancelled) setState({ data: mock, isLoading: false, error: err as Error })
      }
    }
    tick()
    const id = window.setInterval(tick, 60_000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [symbol, useMock])

  return state
}
```

Иллюстрирует: `useMock` обязателен, fallback на mock при ошибке, `console.debug` с префиксом, единая форма `{ data, isLoading, error }`, чистка таймера в cleanup.

### Пример 2: feature-компонент с empty state

```tsx
// src/components/dashboard/widgets/TopMoversWidget.tsx
import { usePrices } from '../../../hooks/usePrices'
import { formatChange } from '../../../utils/format'
import { WidgetCard } from '../WidgetCard'

export function TopMoversWidget() {
  const { data, isLoading } = usePrices()

  if (isLoading) return <WidgetCard title="Top movers" loading />
  if (!data || data.length === 0) {
    return (
      <WidgetCard title="Top movers">
        <p style={{ color: 'var(--muted)' }}>Нет данных</p>
      </WidgetCard>
    )
  }

  const top = [...data].sort((a, b) => b.change24h - a.change24h).slice(0, 5)
  return (
    <WidgetCard title="Top movers">
      {top.map((a) => (
        <div key={a.symbol}>
          {a.symbol} — {formatChange(a.change24h)}
        </div>
      ))}
    </WidgetCard>
  )
}
```

Иллюстрирует: импорт только из своей фичи (`WidgetCard`) и горизонтальных модулей (`usePrices`, `formatChange`), три состояния (loading, empty, data), цвета только через CSS-переменные дизайн-системы.

### Пример 3: страничный слой связывает фичи

```tsx
// src/pages/AssetPage.tsx (фрагмент)
import { useParams } from 'react-router-dom'
import { AssetHeader } from '../components/asset/AssetHeader'
import { SimpleChart } from '../components/asset/SimpleChart'
import { ChatPanel } from '../components/asset/ChatPanel'
import { useAssetPrice } from '../hooks/useAssetPrice'
import { useCoinInfo } from '../hooks/useCoinInfo'
import { useNews } from '../hooks/useNews'

export default function AssetPage() {
  const { symbol = 'BTC' } = useParams<{ symbol: string }>()
  const price = useAssetPrice(symbol)
  const info = useCoinInfo(symbol)
  const news = useNews({ q: symbol })

  console.debug('[AssetPage] %s price=%o info=%o', symbol, price.data, info.data)

  return (
    <div className="asset-page">
      <AssetHeader symbol={symbol} price={price.data} />
      <div style={{ display: 'grid', gridTemplateColumns: '65fr 35fr', gap: 16 }}>
        <SimpleChart symbol={symbol} />
        <ChatPanel symbol={symbol} info={info.data} news={news.data} />
      </div>
    </div>
  )
}
```

Иллюстрирует: страница импортирует компоненты ровно одной фичи (`asset/`), оркеструет хуки, передаёт данные в дочерние компоненты через props.

## Антипаттерны

- ❌ **Кросс-фичевый импорт компонентов.** `market-overview/AssetTable.tsx` импортирует `dashboard/WatchlistPanel.tsx`. Решение: вынеси общий компонент в `components/layout/` или общий `components/ui/`.
- ❌ **`fetch` в компоненте.** Сетевой запрос напрямую внутри JSX-компонента вместо вынесения в хук.
- ❌ **`useState` для серверных данных.** Когда есть TanStack Query — используй его, чтобы не плодить дубли запросов и не терять кэш при размонтировании.
- ❌ **Глобальный Context для всего.** Раздутый AuthContext + ThemeContext + DataContext убивает производительность и читаемость. Только когда без него никак.
- ❌ **`any` или `as any`.** Линтер запрещает; если хочется — описывай через `unknown` и type guards.
- ❌ **emoji в production-коде.** Лежат только в комментариях/docs/commit-сообщениях; иконки — только lucide-react.
- ❌ **inline-цвета вне дизайн-системы.** `style={{ color: '#ff00aa' }}` запрещено; используй CSS-переменные / класс / цвет из списка `.ai-factory/RULES.md`.
- ❌ **Сырой `JSON.parse` из `localStorage` в React state.** Всегда валидируй и кламповай по текущей схеме виджет-реестра, иначе старые данные сломают новый UI.
- ❌ **Файлы `.jsx` рядом с `.tsx`.** Vite тихо выбирает `.jsx`; удаляй `.jsx` сразу при миграции.
- ❌ **`background` вместо `backgroundColor` в motion-пропсах.** Ломает strict TS — TS2590 «union type too complex».
