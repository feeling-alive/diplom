# FinTrack Dashboard

> Настраиваемый финансовый дашборд: 31 виджет, iPhone-style DnD, страница актива с TradingView и AI-чат.

Дипломный проект — React 19 + TypeScript strict + Vite. Данные в реальном времени: OKX (крипто), Finnhub (акции), Frankfurter (форекс), NewsAPI (новости), CoinGecko (метаданные), Groq (AI).

## Структура репозитория

Монорепо из двух приложений:

```
frontend/   # React 19 + Vite SPA (интерфейс)
backend/    # FastAPI + Redis — прокси/кэш котировок
```

## Быстрый старт

**Фронтенд:**

```bash
cd frontend
npm install
cp .env.example .env   # заполнить ключи API
npm run dev            # http://localhost:5173
```

`.env` уже игнорируется git. Шаблон переменных см. в комментариях `frontend/src/lib/env.ts`.

**Бэкенд (опционально — прокси/кэш котировок):**

```bash
docker run -d -p 6379:6379 redis:alpine    # Redis
cd backend
python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                        # указать FINNHUB_API_KEY
uvicorn app.main:app --reload --port 8000
```

Эндпоинты и план миграции — в [`backend/README.md`](backend/README.md).

## Возможности

- **Настраиваемый дашборд** — 31 тип виджета, drag-and-drop в стиле iPhone, ресайз за невидимый край, карусель страниц, edit mode
- **Несколько дашбордов** — до 5 именованных дашбордов с каруселью таблеток; добавление/удаление/переименование без потери данных
- **Страница актива** (`/asset/:symbol`) — TradingView Advanced Chart в fullscreen, Recharts area-чарт, CoinGecko-описание, новости
- **Market Overview** (`/market`) — сводка рынка, кликабельные top movers и карточки статистики, таблица активов со sparklines
- **Переключатель валют** — USD / EUR / RUB / BTC, Liquid Glass дизайн, пересчёт цен по всему интерфейсу
- **Страница настроек** (`/settings`) — тёмная/светлая тема, акцентный цвет, уведомления, язык, валюта по умолчанию
- **AI-чат** — Groq `llama-3.3-70b-versatile`, контекстный по активу
- **Live-данные** — OKX WebSocket, Finnhub/Frankfurter/NewsAPI/CoinGecko через Vite proxy; кэш TanStack Query (без перезагрузки при навигации)
- **Персистентность** — раскладка дашборда в PostgreSQL (бэкенд) + fallback на localStorage; несколько дашбордов в envelope-схеме без миграций БД

## Пример

```tsx
// Виджет на дашборде декларируется одной записью в реестре:
{
  type: 'market_ticker',
  title: 'Тикер активов',
  icon: TrendingUp,
  color: '#e11d48',
  availableSizes: [{ w: 2, h: 1 }, { w: 3, h: 1 }, { w: 2, h: 2 }, { w: 3, h: 2 }],
  defaultSize: { w: 3, h: 1 },
  minW: 2, minH: 1, maxW: 3, maxH: 2,
}
// Размер автоматически адаптируется в самом компоненте через gridW/gridH props.
```

## Скрипты

```bash
# из папки frontend/
npm run dev      # vite dev server
npm run build    # production bundle
npm run preview  # serve production build
npm run lint     # eslint flat config
npx vitest run   # vitest + RTL
```

## Стек

React 19 · TypeScript strict (no `any`) · Vite 8 · react-router-dom v7 · TanStack Query 5 · react-grid-layout · Recharts · lightweight-charts v5 · TradingView Widget · Framer Motion · lucide-react · Vitest + RTL · FastAPI · PostgreSQL · SQLAlchemy 2 async · Alembic · Redis

## Документация

| Раздел | Описание |
|--------|----------|
| [Система виджетов](docs/widgets.md) | Реестр виджетов, DnD, resize, edit mode, persisted layout |
| [Несколько дашбордов](docs/multi-dashboard.md) | Карусель дашбордов, envelope-схема БД, лимиты |
| [Настройки и валюты](docs/settings.md) | SettingsContext, CurrencyContext, страница `/settings` |
| [Бэкенд API](docs/backend.md) | FastAPI роуты, PostgreSQL-модели, Redis-кэш, docker-compose |
| [AGENTS.md](AGENTS.md) | Структурная карта проекта для AI-агентов и новых разработчиков |
| [.ai-factory/ARCHITECTURE.md](.ai-factory/ARCHITECTURE.md) | Feature-based Modular: правила зависимостей и примеры |
| [.ai-factory/RULES.md](.ai-factory/RULES.md) | Дизайн-система: цвета, типографика, радиусы, тени |

## Лицензия

Дипломный проект, без лицензии.
