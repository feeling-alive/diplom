# План: Улучшения дашборда — Блок «Промежуточный» (без виджетов)

> Источник: `promt.md` (10 задач). Создано: 2026-06-03.
> Ветка: **master** (создание веток отключено в `.ai-factory/config.yaml` → `git.create_branches: false`).
> Режим: **Full**. Язык артефактов: ru.

## Settings

- **Тесты:** да — pytest для новых бэкенд-роутов (dashboard config / multi-dashboard) + Vitest для ключевой фронт-логики (fallback конфига, индексы, кликабельность, CurrencySwitcher).
- **Логирование:** verbose — `console.debug('[Component] ...')` во фронте, `logger.debug/info` на бэкенде (обязательная конвенция проекта).
- **Документация:** да — обязательный чек-поинт `/aif-docs` в конце (`/aif-implement` обновит DESCRIPTION/ARCHITECTURE: новый роут `/dashboard`, CurrencyContext, multi-dashboard, страница настроек).

## Состояние кодовой базы на старте (важно — часть уже сделана)

Разведка перед планированием выявила:

- **Задача 8 (drag-fix):** `compactType="vertical"` + `preventCollision={false}` **уже выставлены** в `Dashboard.tsx:332-333`. Реальная работа осталась по reset/resize/×-кнопке.
- **Задача 9 (сайдбар):** нижняя кнопка профиля + всплывающее меню вверх (Профиль/Настройки/Выйти) **уже реализованы** в `AppSidebar.tsx` (дизайн-система, НЕ MUI — это корректно по правилам проекта). В `DashboardHeader.tsx:115-134` остался **дубль аватара «П»** — убрать. `overflow:hidden`/`100vw` в основном на месте → задача сводится к полировке двойного скролла.
- **Задача 1:** модель `DashboardConfig` (1 строка/пользователь, JSON-колонка `layout`) **есть, но роута нет** → бэкенд greenfield.
- **Задача 7:** массив нескольких дашбордов помещается ВНУТРЬ существующей JSON-колонки `layout` → **миграция БД не нужна**.
- **Задача 2:** хуки цен **в незакоммиченном состоянии** (миграция на бэкенд-прокси `/api/quotes/*`), но всё ещё `setInterval`+`useState` — кэширования через React Query пока НЕТ. Задача 2 строится поверх этой миграции, не затирая её.
- **Задача 3 (SPX):** индексы (`SPX/IXIC/DJI/...`, `type:"index"` в `data/prices.json:49-55`) **не имеют живого источника**; `usePrices` применяет к ним случайный jitter поверх статичного снимка (`usePrices.ts:80-81`) → SPX «дрожит» вокруг 5842. Finnhub free-план индексы не отдаёт.

## Ключевые архитектурные решения (документировать в коде)

1. **Состояние цен = кэш TanStack Query, не Redux.** В промте упомянут Redux, но в проекте его нет (как и для auth выбран Context). Общий «стор» цен — кэш QueryClient, переживающий размонтирование → данные сохраняются при возврате со страницы актива. (Задачи 2, 6)
2. **Глобальная валюта = `CurrencyContext` + localStorage**, по образцу `AuthContext` (единственный допустимый cross-cutting global по `ARCHITECTURE.md`). (Задачи 6, 10)
3. **Несколько дашбордов — без миграции БД:** форма `{ dashboards: [{id,name,layout}], activeId }` хранится внутри существующей JSON-колонки `DashboardConfig.layout`. Обратная совместимость со старой одиночной формой — на чтении. (Задача 7)
4. **Дизайн-система закрыта** (`RULES.md`): никаких новых цветов. Стекло CurrencySwitcher — через `rgba()` существующих переменных. Акцентный цвет в настройках — выбор только из палитры.
5. **Тёмная тема (Задача 10) — риск.** Приложение сейчас только светлое. Реализация через `data-theme` + dark-оверрайды CSS-переменных (best-effort, может не покрыть все компоненты). Объём ограничен; полный охват — follow-up.

## Зависимости задач

```
Фаза 1 (независимы): #1 #2 #3 #4 #5
Фаза 2: #6(1a) → #7(1b) ;  #8(2) — рекомендуется после #7 (не жёсткая блокировка)
Фаза 3: #9(6)
Фаза 4: #6(1a) → #10(7a) → #11(7b) ;  #11 также ← #7(1b)
Фаза 5: #9(6) → #12(10)
```

---

## Задачи

### Фаза 1 — Быстрые победы (видимый результат сразу)

**#1 — Задача 8: UX управления виджетами.** ✅ Готово
`Dashboard.tsx`, `DashboardHeader.tsx`, `Dashboard.test.tsx`. Итог: 3 из 4 пунктов уже были в коде (drag-fix `compactType=vertical`; ресайз без иконок — `index.css:264-273` рендерит ручки прозрачными edge-хитзонами; ×-кнопка hover-only + inset 8px). Реализовано: reset → **очистка всех виджетов** (пустой дашборд) + иконка `Trash2` + **фикс персистентности** (`loadWidgets` теперь возвращает `null` при отсутствии ключа vs `[]` при очистке — иначе пустой дашборд откатывался к дефолтам при перезагрузке). Тесты: 4 passed. Запись reset в БД — в #7.

**#2 — Задача 9: Верстка и сайдбар.** ✅ Готово
`App.tsx`, `index.css`, `DashboardHeader.tsx`, `AppSidebar.test.tsx`. Корневые причины «выезжает за экран»: (1) `.app-rail` имел `min-height:100vh` — выше своего контейнера (`.app-page` с padding:12px), из-за чего нижняя кнопка профиля уезжала под обрез → `height:100%`; (2) `<main overflow:auto>` конфликтовал с внутренним `.main-scroll` (двойной скролл) и без `min-width:0` широкие гриды/таблицы вылезали по горизонтали → `overflow:hidden; min-width:0; display:flex column`. Убран дубль аватара «П» из хедера (профиль только снизу в сайдбаре — уже был). Бонус: починен пред-существующий красный `AppSidebar.test` (мок `useAuth`). Тесты: 10 passed. Ручная проверка 1280/1440/1920 — за пользователем.

**#3 — Задача 3: Баг цены SPX / индексы.** ✅ Готово
`usePrices.ts` (главный фикс), `useAssetPrice.ts` (защитная ветка), `usePrices.test.ts`. Корень: `usePrices` тянул живые данные только для OKX/forex/10 акций, а ко ВСЕМ остальным (включая индексы) применял случайный jitter поверх снимка → SPX «дрожал» ~5842. Фикс: `if (a.type === 'index') return a`. AssetPage берёт цену из `usePrices` (не из `useAssetPrice`), `AssetHeader` уже падал на `asset.price` при `livePrice=0` — фикс `usePrices` покрывает все экраны. Доп: `useAssetPrice` получил ветку `index` (снимок из data/prices.json, без Finnhub) — защита на будущее. tsc clean. Тест: 1 passed.

**#4 — Задача 4: Кликабельность лидеров.** ✅ Готово (TopMovers + дашбордный TopMoversWidget; тесты green)
`market-overview/TopMovers.tsx` (+ при наличии `dashboard/widgets/TopMoversWidget.tsx`). Каждая строка → `navigate('/asset/'+encodeURIComponent(symbol))`, `cursor:pointer`, hover, a11y (role/tabIndex/Enter). Vitest: клик вызывает navigate.

**#5 — Задача 5: Интерактивные карточки статистики.** ✅ Готово (Dominance→BTC, остальные→поповер; тесты green)
`market-overview/MarketSummaryBar.tsx`. Dominance → navigate `/asset/BTC-USDT`; Капитализация/Объём/Активов → лёгкая поповер-расшифровка (дизайн-система); hover (`whileHover` + shadow), tooltip. Vitest на оба пути.

### Фаза 2 — Персистентность дашборда

**#6 — Задача 1a (бэкенд): роут `/dashboard/config`.** ✅ Готово
НОВЫЙ `backend/app/routes/dashboard.py` (GET сеет дефолт из 4 виджетов, PUT upsert; `layout` хранится непрозрачно — поддерживает и массив виджетов, и envelope `{dashboards,activeId}` для #10; лимит 100 виджетов), регистрация в `main.py`, `PUT` добавлен в CORS. НОВЫЙ `backend/tests/test_dashboard.py` — 7 passed (дефолт, 401×2, roundtrip, пустой layout, envelope, лимит).

**#7 — Задача 1b (фронт): дашборд ↔ БД + fallback localStorage.** ✅ Готово ⟸ #6
НОВЫЙ `lib/dashboardApi.ts` (GET/PUT fetch), НОВЫЙ `lib/dashboardLayout.ts` (вынесены `generateId/findEmptySlot/createDefaultWidgets/clampWidgets` + localStorage-кэш — единый источник для страницы и хука), НОВЫЙ `hooks/useDashboardConfig.ts` (выбор источника: авторизован → бэкенд с fallback на localStorage, гость → localStorage; PUT дебаунсится 600ms; localStorage как офлайн-кэш), правка `Dashboard.tsx` (использует хук, guard «Загрузка дашборда…»), `vite.config.ts` (proxy `/dashboard`). Кламп по `WIDGET_REGISTRY`. Завершает «reset пишет в БД» из #1 (mutate→PUT). Тесты: `useDashboardConfig.test.ts` (4 — guest/backend/fallback/debounce) + правка `Dashboard.test.tsx` (мок useAuth). tsc clean, 45 passed.

**#8 — Задача 2: кэш цен (без перезагрузки при возврате).** ✅ Готово
`usePrices.ts` (useQuery `['prices','all']`, queryFn=чистый fetchAllPrices, `refetchInterval:60s`, `staleTime:30s`, `refetchOnMount:false`, `placeholderData=снимок` ≈ keepPreviousData), `useStockPrice.ts`/`useForexRate.ts` (useQuery по символу/паре), `useAssetPrice.ts` (useQuery для stock/forex/index + WS оставлен для crypto в useEffect), `main.tsx` (дефолты QueryClient: staleTime 30s, gcTime 5m, refetchOnWindowFocus off). Кэш QueryClient переживает размонтирование → возврат со страницы актива не сбрасывает данные. Тесты: `usePrices.test.ts` (индексы + повторный маунт без флэша isLoading), правка `TopMovers.test.tsx` (QueryClientProvider). 46 passed, tsc clean.

### Фаза 3 — Переключение валют

**#9 — Задача 6: CurrencySwitcher (Liquid Glass) + пересчёт.** ✅ Готово
`utils/format.ts` (singleton currencyState + `convertFromUsd`/symbol — formatPrice/Volume/MarketCap пересчитывают; forex-пары НЕ конвертируются), НОВЫЙ `context/CurrencyContext.tsx` (USD/EUR/RUB/BTC, курсы из usePrices: USD-EUR/USD-RUB/BTC-USDT, персист localStorage, синк в singleton), НОВЫЙ `components/layout/CurrencySwitcher.tsx` (овал, glass через rgba палитры, framer-motion `layoutId` пилюля), `main.tsx` (CurrencyProvider), `App.tsx` (switcher во floating top-right + `useCurrency()` в ProtectedLayout → весь Outlet перерисовывается при смене). Охват: все 11 потребителей utils/format (AssetTable, виджеты, MetricsBar, MarketTicker…) + AssetHeader/MarketSummaryBar (локальные форматтеры переведены на utils). Тест `format.currency.test.ts` (5: convert/formatPrice/forex/BTC/volume). 51 passed, tsc clean.

### Фаза 4 — Несколько дашбордов

**#10 — Задача 7a (бэкенд): массив дашбордов.** ✅ Готово ⟸ #6
`routes/dashboard.py` (envelope `{dashboards:[{id,name,layout}],activeId}`; `_normalize_to_envelope` мигрирует None/legacy-массив на чтении; валидация: лимит 5 дашбордов, ≤100 виджетов/доску, форма item; дефолт «Основной»; фикс activeId), `tests/test_dashboard.py` переписан под envelope — 9 passed (сид, 401×2, wrap-массива, roundtrip, bad-activeId, лимит дашбордов, malformed, лимит виджетов).

**#11 — Задача 7b (фронт): карусель дашбордов.** ✅ Готово ⟸ #10, #7
`lib/dashboardApi.ts` (типы `DashboardEntry`/`DashboardEnvelope`), `lib/dashboardLayout.ts` (envelope-хелперы: `createDefaultEnvelope`/`normalizeToEnvelope`/`loadLocalEnvelope`+миграция legacy-ключа), `hooks/useDashboardConfig.ts` (переписан на envelope: `widgets`/`mutate` работают с активной доской + `switch/add/remove/rename`, лимит 5), НОВЫЙ `components/dashboard/DashboardTabs.tsx` (таблетки, framer-motion `layoutId`, «+» disabled@5 с prompt, «×» с confirm, скрыт при 1), `Dashboard.tsx` (рендер табов). Тесты: `useDashboardConfig.test.ts` (+add/switch/remove/лимит/последний-нельзя), правки Dashboard/hook тестов под envelope-ключ. 53 passed, tsc clean.

### Фаза 5 — Настройки

**#12 — Задача 10: страница `/settings`.** ✅ Готово ⟸ #9
НОВЫЙ `context/SettingsContext.tsx` (theme/accent/notifications/language + defaultCurrency→CurrencyContext; персист localStorage; применяет `data-theme` + инлайн `--accent`), НОВЫЙ `pages/SettingsPage.tsx` (секции: Внешний вид тема+акцент, Уведомления тумблеры, Валюта по умолчанию, Язык), `App.tsx` (route + провайдер), `main.tsx` (SettingsProvider под CurrencyProvider), `AppSidebar.tsx` (шестерёнка + пункт меню → `/settings`), `index.css` (dark-оверрайды переменных, best-effort). Тест `SettingsContext.test.tsx` (4: тема→html+LS, акцент→--accent, тумблер, делегирование валюты). 57 passed, tsc clean.

---

## Commit Plan (12 задач → чекпоинты по логическим группам)

| Чекпоинт | Задачи | Сообщение коммита (conventional) |
|---|---|---|
| A | #1, #2 | `fix(dashboard): UX виджетов + верстка/сайдбар (Задачи 8, 9)` |
| B | #3 | `fix(prices): корректная обработка индексов SPX/DJI/NASDAQ (Задача 3)` |
| C | #4, #5 | `feat(market): кликабельные карточки лидеров и статистики (Задачи 4, 5)` |
| D | #6, #7 | `feat(dashboard): персистентность раскладки в БД + fallback localStorage (Задача 1)` |
| E | #8 | `perf(prices): кэш TanStack Query, без перезагрузки при возврате (Задача 2)` |
| F | #9 | `feat(currency): переключатель валют Liquid Glass + пересчёт (Задача 6)` |
| G | #10, #11 | `feat(dashboard): несколько дашбордов (карусель) (Задача 7)` |
| H | #12 | `feat(settings): страница настроек (Задача 10)` |

Финал: чек-поинт `/aif-docs` (обязателен по настройке Docs: yes).

## Открытые вопросы / решены по умолчанию

- **Задача 5** — у метрик нет одного актива → выбран поповер-расшифровка (Dominance → переход на BTC). Можно заменить на модалку, если потребуется.
- **Задача 10 тема** — тёмная тема ограничена best-effort (`data-theme` + оверрайды переменных); полный охват компонентов — отдельный follow-up.
- **Задача 6 охват** — пересчёт валют в первом раунде покрывает MarketOverview + ключевые виджеты + хедер актива; остальные виджеты — по мере необходимости.
