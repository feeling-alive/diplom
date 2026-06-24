# План: тёмная тема, убрать тултипы с иконок, живые цены в поиске

**Тип:** feat/fix (frontend + backend)
**Режим:** fast
**Дата:** 2026-06-22
**Ветка:** master (создание веток отключено в конфиге)
**Источник требований:** `promt.md` (3 задачи)

## Контекст

Три независимые задачи проекта FinTrack:
1. Доделать тёмную тему — инфраструктура (`data-theme` + переопределение CSS-переменных) уже есть, но ~190 хардкод-цветов в инлайн-стилях/CSS не используют переменные и остаются светлыми в dark.
2. Убрать всплывающий текст при наведении на иконки (рейл + прочие `title=`).
3. Живые цены в поиске дашборда — `/api/search` отдаёт статичную цену из `prices.json`.

Логирование: **verbose** (DEBUG/INFO в новом backend-коде; `console.debug` во фронте по образцу существующего).

## Диагностика (по результатам анализа кода)

**Тёмная тема:**
- `index.css:14-42` — `:root` палитра; `:47-55` — `html[data-theme="dark"]` уже переопределяет `--ink/--text/--muted/--soft/--bg/--white/--border`. НЕТ семантических `--pos/--neg` (рост/падение) — зелёный `#22C55E`/красный `#E11D48` и прочие (`#16a34a`, `#dc2626`) хардкодятся.
- `SettingsContext.tsx` — тема применяется через `data-theme` + инлайн `--accent/--accent-bg/--red`, сохраняется в localStorage, восстанавливается при загрузке. `prefers-color-scheme` как дефолт первого входа НЕ реализован (`DEFAULTS.theme='light'`).
- Хардкоды: ~190 вхождений в ~76 файлах. Приоритетные: layout-CSS (`Sidebar.css`, `TopBar.css`, `IconRail.css`, `UserChipsBar.css`), страницы (`AdminPanelPage` 13, `NewsArticlePage` 6), компоненты (`AIPanel` 7, виджеты). Многие `#fff`/`#FFFFFF` → `var(--white)`, тёмный текст → `var(--text)`/`var(--ink)`, границы → `var(--border)`.

**Тултипы:**
- `AppSidebar.tsx` — главный источник «всплывающего текста»: КАСТОМНЫЙ tooltip-портал на `framer-motion` (`showTooltip`/`hideTooltip`/`activeTooltip`/`tooltipTimerRef`, рендер в конце компонента) ПЛЮС нативные `title="Профиль"/"Настройки"/"Выйти"`. Нужно убрать и портал, и `title=`, оставив `aria-label` для доступности.
- Ещё 12 файлов с `title=` (AdminPanelPage, TradingViewModal, MarketImpactBadge, DashboardHeader, TopMovers, WidgetCard, HeatmapWidget, EconomicCalendarWidget, TopMoversWidget, DashboardTabs, SettingsPage, MarketSummaryBar) — заменить `title` на `aria-label` (иконки-кнопки действий) либо удалить избыточные.

**Живые цены:**
- `search.py` — `_search_assets` берёт `price` прямо из `prices.json` (cached `lru_cache`). Типы активов: `crypto` (symbol `BTC-USDT`), `stock` (`AAPL`), `forex` (`EUR-USD`).
- Quotes-слой готов и Redis-кэширован: `okx.get_ticker(symbol)`, `finnhub.get_quote(symbol)` → `{price,...}`; `frankfurter.get_rate(base, quote)` → `{price,...}`. Обогащать только найденные (≤5) активы, конкурентно (`asyncio.gather`), с graceful-fallback на snapshot-цену при ошибке/нуле.
- Фронт: `useGlobalSearch` уже прокидывает `price`, `DashboardHeader` рендерит его — менять фронт не требуется (проверить визуально).

## Настройки

- **Тесты:** нет (UI/визуальные + backend-обогащение; проверка ручная/скриншоты).
- **Логирование:** verbose.
- **Документация:** warn-only (отдельный чекпоинт не нужен).

## Roadmap Linkage

Milestone: "none" — Rationale: ROADMAP.md отсутствует, линковка неприменима.

## Задачи

### [x] Задача 1 — Тёмная тема: семантические переменные + dark-overrides + дефолт темы
**Файлы:** `frontend/src/index.css`, `frontend/src/context/SettingsContext.tsx`
1. В `index.css` `:root` завести `--pos`/`--neg` (+ опц. `--pos-bg`/`--neg-bg`) КАК АЛИАСЫ существующих палитровых хексов — **не новые цвета** (RULES.md: «use ONLY these variables, no new colors ever»): `--pos: #22C55E` (=`--green`), `--neg: #E8264A` (задокументирован в RULES «Negative → #E8264A»). Переопределить их (и при необходимости `--pos-bg/--neg-bg`) в `html[data-theme="dark"]` на читаемые на тёмном фоне оттенки.
2. **КРИТИЧНО:** `SettingsContext.tsx:96` перезаписывает `--red` цветом акцента (`root.style.setProperty('--red', accent.accent)`). Семантическое «падение» НЕЛЬЗЯ вешать на `--red` — использовать `--neg`. `--green` акцентом не трогается — для «роста» стабилен (или `--pos`).
3. Убедиться, что dark-блок покрывает тени и `--accent-bg` достаточно (проверить `--shadow-*`, при необходимости приглушить на dark).
4. (По желанию из промта) Дефолт темы по `prefers-color-scheme` при ПЕРВОМ входе: в `SettingsContext.loadSettings()` — если в localStorage НЕТ сохранённого `theme`, взять `window.matchMedia('(prefers-color-scheme: dark)').matches`. Не ломать сохранённый выбор пользователя.
5. Проверить тоггл в `SettingsPage`: мгновенное переключение, persist в localStorage, восстановление при перезагрузке (логика уже есть — подтвердить).

### [x] Задача 2 — Тёмная тема: замена хардкод-цветов на переменные
**Файлы:** `frontend/src/**` (CSS + компоненты/страницы с инлайн-стилями)
Заменить хардкод фона/текста/границ/теней на существующие переменные. Порядок по влиянию:
1. Layout-CSS: `components/layout/Sidebar.css`, `TopBar.css`, `IconRail.css`, `UserChipsBar.css`.
2. Страницы с большим числом хардкодов: `pages/AdminPanelPage.tsx` (13), `pages/NewsArticlePage.tsx` (6), `pages/NewsPage.tsx`, `pages/AssetPage.tsx`, `pages/MarketOverview.tsx`, auth-страницы.
3. Компоненты: `components/asset/AIPanel.tsx` (7), `AssetHeader.tsx`, `news/*`, `dashboard/*` и виджеты, `market-overview/*`.
Правила замены: `#fff`/`#FFFFFF`→`var(--white)`; тёмный текст (`#1A1A1A`/`#0F172A`)→`var(--text)`/`var(--ink)`; границы (`#ECEAE3`)→`var(--border)`; muted→`var(--muted)`; семантический зелёный/красный (рост/падение)→`var(--pos)`/`var(--neg)` (НЕ `--red` — он перехватывается акцентом, см. Задачу 1).
**Исключить из замены:** тест-файлы (`**/__tests__/**`, `*.test.*` — 5 файлов с цветами), брендовые цвета активов в `data/prices.json` и `constants/widgets.registry.ts`, `assets/vite.svg`.
После прохода — grep остаточных хардкодов в ключевых экранах. Проверить читаемость в dark: дашборд+виджеты, актив, новости, чат, профиль, админка, модалки.

### [x] Задача 3 — Убрать всплывающий текст при наведении на иконки
**Файлы:** `frontend/src/components/layout/AppSidebar.tsx` + 12 файлов с `title=`
1. `AppSidebar.tsx`: удалить кастомный tooltip-портал целиком — `useState activeTooltip`, `tooltipTimerRef`, `showTooltip`/`hideTooltip`, `useEffect` очистки таймера, `onMouseEnter/onMouseLeave` на иконках, и блок `<AnimatePresence>`-портала в конце. Убрать `framer-motion`-импорт, если он больше не нужен в файле. Удалить нативные `title="Профиль"/"Настройки"/"Выйти"`, добавить вместо них `aria-label` на соответствующие кнопки/ссылки (вкл. nav-иконки и админ-иконку).
2. Остальные файлы с `title=` (см. диагностику): заменить `title` на `aria-label` для иконок-кнопок действий; удалить там, где тултип избыточен и подпись уже видна рядом. `aria-label` визуальный тултип не показывает.
3. Проверить grep `title=` по `frontend/src` — не осталось всплывающих подсказок на иконках рейла и кнопках-иконках.

### [x] Задача 4 — Живые цены в /api/search (backend enrichment)
**Файл:** `backend/app/routes/search.py`
0. Добавить импорты: `import asyncio`, `import httpx`, `from app.services import okx, finnhub, frankfurter` (валидные сабмодули `app.services`; в файле их сейчас нет).
1. После `_search_assets(q)` обогащать каждую найденную (≤5) запись актуальной ценой по `type`:
   - `crypto` → `okx.get_ticker(symbol)` (symbol уже формата `BTC-USDT`); извлечь `price`;
   - `stock` → `finnhub.get_quote(symbol)`; извлечь `price`;
   - `forex` → `symbol.split('-')` → `frankfurter.get_rate(base, quote)`; извлечь `price`.
   Конкурентно через `asyncio.gather`. НЕ мутировать закешированный (`lru_cache`) dict из `prices.json` — строить новый `AssetResult` с live-ценой и snapshot как fallback.
2. Graceful-fallback на snapshot-цену при: `LookupError` (OKX/Frankfurter — неизвестный символ), `httpx.HTTPError`, либо `price in (None, 0)` (напр. `finnhub` без `FINNHUB_API_KEY` вернёт 0). Сервисы уже Redis-кэшированы — доп. кэш не нужен.
3. **Edge:** форекс-металлы `XAU-USD`/`XAG-USD` Frankfurter не поддерживает (только фиат) → `LookupError` → snapshot (ожидаемо, не баг).
4. Verbose-логирование: DEBUG по каждому символу (источник: live/snapshot), INFO-итог (сколько обогащено живой ценой).
5. Фронт не менять: `useGlobalSearch`/`DashboardHeader` уже рендерят `price`. Проверить визуально.

### [x] Задача 5 — Пересборка dev и проверка (после 1-4)
> Код-проверка выполняется агентом: `tsc --noEmit` + `eslint` (фронт), импорт/синтаксис backend. Визуальная проверка/скриншоты до-после — за пользователем (агент не управляет браузером).
Убедиться, что Vite пересобрал фронт и backend перезапущен. Проверить: тёмная тема без светлых «дыр» на всех ключевых экранах; при наведении на иконки рейла текст не всплывает; ввод `BTC`/`EUR`/`AAPL` в поиск дашборда показывает реальную текущую цену и переход на `/asset/:symbol`. В отчёте — изменённые файлы и скриншоты до/после.

## Зависимости

- Задача 2 — после Задачи 1 (нужны `--pos/--neg` перед заменой семантических цветов).
- Задачи 3 и 4 — независимы от 1-2 и друг от друга.
- Задача 5 — после 1-4 (финальная проверка).

## Коммит (5 задач → чекпоинты)

- После Задач 1-2: `feat(theme): семантические переменные --pos/--neg, dark-overrides и замена хардкод-цветов`
- После Задачи 3: `fix(ui): убрать всплывающие тултипы с иконок (aria-label вместо title и кастомного портала)`
- После Задачи 4: `feat(search): живые цены в /api/search через quotes-слой с fallback на snapshot`
- Задача 5 — без коммита (проверка/отчёт).
