# AGENTS.md

> Структурная карта проекта для AI-агентов. Поддерживай актуальность при существенных изменениях структуры. Раздел «Документация» автоматически обновляется командой `/aif-docs`.

## Обзор проекта

FinTrack — настраиваемый финансовый дашборд (крипто / акции / форекс) с iPhone-style drag-and-drop виджетов, страницей актива (TradingView + AI-чат) и Market Overview. Дипломный проект на React 19 + TypeScript strict + Vite. Подробное описание — `.ai-factory/DESCRIPTION.md`.

## Технологический стек

- **Язык:** TypeScript 6 (strict, `no-explicit-any: error`)
- **Фреймворк:** React 19 + react-router-dom v7
- **Сборка:** Vite 8
- **Состояние:** TanStack Query 5 + локальный `useState` + `localStorage`
- **Грид и DnD:** react-grid-layout, react-resizable, `@dnd-kit/core`
- **Графики:** Recharts, lightweight-charts v5, TradingView Advanced Chart Widget (iframe)
- **Анимация:** Framer Motion
- **Иконки:** lucide-react
- **AI:** Groq API (`llama-3.3-70b-versatile`)
- **Тесты:** Vitest 4 + React Testing Library + jsdom
- **Линтер:** ESLint 10 flat config

## Структура проекта

```
.
├── src/
│   ├── pages/                    # роуты приложения (Dashboard, MarketOverview, AssetPage, NewsPage, ChatPage, LoginPage, RegisterPage, ProfilePage, SubscriptionPage, AdminPanelPage)
│   ├── components/
│   │   ├── layout/               # AppSidebar, FinTrackNavBar, RoutesGuard
│   │   ├── dashboard/            # WidgetCard, SizeIndicator, WidgetPreview, AddWidgetModal, DashboardHeader, WatchlistPanel, widgets/
│   │   ├── market-overview/      # MarketSummaryBar, TopMovers, AssetTable
│   │   └── asset/                # AssetHeader, CandlestickChart, SimpleChart, ChatPanel
│   ├── hooks/                    # один файл на источник данных (useAssetPrice, useOHLCV, useStockPrice, useForexRate, useNews, usePrices, useCoinInfo, useGroqChat, usePersonalized)
│   ├── types/                    # market.types.ts, widgets.types.ts
│   ├── mock/                     # prices.mock.ts, news.mock.ts, ohlcv.mock.ts, community.mock.ts (fallback-данные)
│   ├── utils/                    # format.ts (formatPrice, formatChange, formatVolume, formatMarketCap)
│   ├── lib/                      # env.ts (централизованный доступ к VITE_*)
│   ├── config/                   # статичные конфигурации
│   ├── constants/                # SYMBOL_TO_COIN_ID и т.п.
│   ├── data/                     # prices.json (снимок 46 активов)
│   ├── assets/                   # статика
│   ├── App.tsx                   # роутинг с layout route и <Outlet />
│   ├── main.tsx                  # точка входа, BrowserRouter
│   ├── index.css                 # глобальные стили, react-grid-layout overrides
│   └── test-setup.ts             # Vitest setup
├── public/                       # статика, отдаваемая как есть
├── docs/                         # пользовательская документация (widgets.md, ...)
├── .ai-factory/                  # AI-контекст и артефакты (config, rules, plans, sessions)
├── .claude/                      # установленные skills и agents (Claude Code)
├── .opencode/                    # alt-конфигурация для OpenCode
├── cryptocurrency-dashboard/     # эталонный сторонний проект (reference DnD-grid)
├── eslint.config.js              # ESLint flat config
├── vite.config.ts                # Vite + прокси /api/finnhub, /api/news, /api/forex
├── tsconfig.json                 # TS strict
├── package.json                  # зависимости и скрипты
└── .env                          # ключи API (gitignored)
```

## Ключевые точки входа

| Файл | Назначение |
|------|------------|
| `src/main.tsx` | Точка входа React, монтирует `<App />` в `<BrowserRouter>` |
| `src/App.tsx` | Декларация маршрутов, `ProtectedLayout` с `<Outlet />` и сайдбаром |
| `src/pages/Dashboard.tsx` | Кастомизируемый дашборд: react-grid-layout, виджеты, DnD, ресайз, persist в `localStorage` |
| `src/pages/AssetPage.tsx` | Страница актива (`/asset/:symbol`), TradingView modal, Recharts area, CoinGecko |
| `src/types/widgets.types.ts` | `WIDGET_REGISTRY` — единый источник правды по типам виджетов и их размерам |
| `src/lib/env.ts` | Доступ к `VITE_*` переменным окружения |
| `vite.config.ts` | Сборка + прокси внешних API |
| `tsconfig.json` | Конфиг компилятора TypeScript (strict) |
| `eslint.config.js` | Flat config линтера |
| `.env` | Ключи API (`VITE_GROQ_API_KEY`, `VITE_FINNHUB_KEY`, `VITE_NEWS_API_KEY`) — не коммитить |

## Документация

| Документ | Путь | Описание |
|----------|------|----------|
| README | `README.md` | Краткое описание проекта и инструкции запуска |
| Статус DnD/виджетов | `STATUS.md` | Сводка реализованных и нерешённых задач по дашборду |
| Снимок состояния проекта | `PROJECT_STATE.md` | Точечный снапшот состояния (untracked) |
| Документация виджетов | `docs/widgets.md` | Описание типов и поведения виджетов |
| Asset page prompt | `asset-page-prompt.md` | Спецификация страницы актива |
| Hooks overview | `hooks-overview.md` | Обзор кастомных хуков |

## Файлы AI-контекста

| Файл | Назначение |
|------|------------|
| `AGENTS.md` | Эта структурная карта проекта |
| `.ai-factory/config.yaml` | Конфигурация AI Factory (язык, пути, git, rules) |
| `.ai-factory/DESCRIPTION.md` | Подробное описание проекта (стек, фичи, NFR) |
| `.ai-factory/ARCHITECTURE.md` | Архитектурные правила (Feature-based Modular), таблица зависимостей, примеры кода и антипаттерны |
| `.ai-factory/RULES.md` | Дизайн-система (палитра, типографика, радиусы, тени) — приоритет над base.md |
| `.ai-factory/rules/base.md` | Базовые конвенции кода (именование, структура, TS, тесты) |
| `.ai-factory/PLAN.md` | Текущий fast-план |
| `.ai-factory/plans/` | Полные плановые файлы по фичам |
| `.ai-factory/sessions/` | Логи сессий /aif-implement |
| `.ai-factory/patches/` | Self-improvement патчи от /aif-evolve |
| `.ai-factory/skill-context/` | Project-overrides для отдельных skills (aif-implement, aif-verify, ...) |
| `.mcp.json` | Подключённые MCP-серверы (GitHub, Playwright) |
| `.claude/skills/`, `.claude/agents/` | Установленные skills и agents для Claude Code |

## Правила для агентов

- **Декомпозиция shell-команд.** Никаких `cmd1 && cmd2` для git-операций; pre-hook'и и проверки прав могут сбоить на цепочке.
  - Неправильно: `git checkout master && git pull`
  - Правильно: сначала `git checkout master`, затем `git pull origin master`
- **Только PowerShell или Bash, не CMD.** В Bash-инструменте — `rm <path>`, а не `del`. Пути в коде — POSIX-стиль.
- **Язык ответов и артефактов — русский** (см. `.ai-factory/config.yaml → language`). Технические термины (API, hook, component, store, props) оставлять английскими.
- **Дизайн-система — закрытая палитра.** Никаких новых цветов, кроме перечисленных в `.ai-factory/RULES.md`.
- **Никаких `any`** в TypeScript, никаких `console.log` в коммитах, никаких emoji в production-коде, никаких внешних URL аватаров.
- **Каждый data-хук** принимает `useMock?: boolean = true` и возвращает `{ data, isLoading, error }`.
- **При изменении схемы виджет-реестра** — бамп версии `localStorage` ключа в `Dashboard.tsx`.
- **Перед изменениями `Dashboard.tsx`** свериться с `cryptocurrency-dashboard/src/components/app/app.tsx` — это эталон для react-grid-layout настроек.
