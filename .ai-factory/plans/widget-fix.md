# План: Widget Fix — drag-баг, глобальные стили, ревизия 11 виджетов, реестр

**Ветка:** `master` (по конфигу `git.create_branches=false` — на текущей ветке)
**Источник задачи:** `vidget fix.md`
**Дата:** 2026-05-17
**Связанные планы:** `widget-dnd-enhancements.md` (завершён, не пересоздавать)

---

## Settings

- **Testing:** Только прогон существующих тестов (новых не пишем). `npm run test` в финале — все 48 должны быть зелёные. Если переименование `kpi_portfolio` ломает тест — обновить тест.
- **Logging:** Verbose — `console.debug('[ИмяКомпонента] ...')` на ключевые события (drag, render, gridW/gridH, миграция localStorage).
- **Docs:** warn-only — без обязательного `/aif-docs` чекпоинта, но в случае правок UX обновить `STATUS.md`/`docs/widgets.md` приветствуется.

---

## Roadmap Linkage

Milestone: `none` — Rationale: roadmap-артефакт в проекте отсутствует.

---

## Цель

1. Починить критический баг: при начале drag виджет «телепортируется» в начало сетки вместо того, чтобы следовать за курсором.
2. Привести общие стили (resize-хэндлеры, X-кнопка, скроллбар, плотность контента) к более полированному виду.
3. Пройтись по 11 ключевым виджетам, обновив размеры и адаптивную раскладку.
4. Привести `WIDGET_REGISTRY` в полное соответствие новым правилам.

---

## Контекст из текущей кодовой базы

- `Dashboard.tsx:297` уже использует `WidthProvider`, `useCSSTransforms={true}`, `preventCollision={false}`, `compactType="vertical"`, корректные resize-handles. **Конфиг RGL не источник бага.**
- `src/index.css:285` — `.react-grid-item.react-draggable-dragging { transform: scale(1.03) !important; ... }` — **именно эта строка вытирает translate(x,y), который RGL ставит во время drag, и виджет визуально остаётся в нулевых координатах (или прыгает в начало сетки)**. Это первоисточник бага из Блока 1.
- `src/index.css:248-278` — resize-handle уже прозрачный, но размер 14px (углы) / 8px (стороны). По ТЗ — 20×20.
- `src/index.css:306-326` — `.widget-remove-btn` сейчас `top:4 right:4`. По ТЗ — 8/8.
- Глобального правила `::-webkit-scrollbar` в проекте нет — есть только локальные `.main-scroll`, `.sidebar-scroll`, `.picker-scroll`.
- Реестр виджетов: `src/constants/widgets.registry.ts` (vidget fix.md был прав, текст «обнови src/constants/widgets.registry.ts» — точное название файла).
- Тип `kpi_portfolio` рендерится через `PersonalizedPanel`. По ТЗ — переименовать в `market_ticker` с новым компонентом «Тикер активов».
- `STORAGE_KEY = 'fintrack_widgets_v3'` — при переименовании типа нужна миграция или новая версия ключа.
- `PriceChartWidget.tsx:154` — `change24h.toFixed(1)`. Если `useAssetPrice` вернёт `NaN`/`Infinity` (деление на 0 в openPrice) — будет «NaN%».

---

## Tasks

### Фаза 0 — Критический баг (Блок 1)

#### Task #7 — Починить баг drag-телепорта — [x]
**Файлы:** `src/index.css` (главная правка), `src/pages/Dashboard.tsx` (верификация).

- **`src/index.css:285-293`** — заменить правило `.react-grid-item.react-draggable-dragging`: убрать `transform: scale(1.03) !important;`. Перенести scale на ВНУТРЕННИЙ wrapper (`.widget-card` уже корневой блок виджета — можно завести правило `.react-grid-item.react-draggable-dragging .widget-card { transform: scale(1.03); box-shadow: ... }`). Тогда RGL свободно ставит translate на `.react-grid-item`, а scale применяется к содержимому.
- Оставить `z-index: 100; cursor: grabbing; opacity: 0.92;`.
- В `Dashboard.tsx` подтвердить (изменения не нужны, только проверка):
  - `useCSSTransforms={true}` ✅
  - `transformScale` не задан (≠1) ✅
  - `onDragStart` (строка 226) не мутирует item.x/item.y ✅
  - У `.main-content`/`.main-scroll` нет `transform: scale()` или `position: relative` со смещением (Grep).
- Лог: `console.debug('[Dashboard] drag start — fix applied')` оставить.

#### Логирование
- В `onDragStart`/`onDragStop` оставить существующие `console.debug` с координатами.
- В CSS-фиксе добавить комментарий-маркер `/* [FIX] move scale to inner .widget-card so RGL translate stays intact */`.

---

### Фаза 1 — Глобальные стили (Блок 2)

#### Task #8 — Resize handle 20×20, прозрачный — [x]
**Файл:** `src/index.css:248-278`.

- `.react-grid-item > .react-resizable-handle` → `opacity: 0; width: 20px; height: 20px;`.
- Удалить угловые/боковые переопределения `width/height` (`-se`, `-sw`, `-ne`, `-nw`, `-s`, `-e`) либо оставить только `cursor: *-resize` без размеров — спецификация говорит «20×20» унифицированно.
- Зона клика 20px достаточно по краю; курсор у браузера сам меняется на `nwse-resize/ns-resize/ew-resize`.
- Лог: не нужен (CSS-правка).

**Блокирует:** Task #7 завершён.

#### Task #9 — Сдвинуть X-кнопку внутрь карточки — [x]
**Файл:** `src/index.css:306-326`.

- `.widget-remove-btn` → `top: 8px; right: 8px;` (вместо 4/4).
- Оставить остальные свойства (размер 18px, hover-стили) без изменений.
- Визуально проверить — X не должна перекрывать заголовок виджета.

#### Task #10 — Глобальный кастомный скроллбар — [x]
**Файл:** `src/index.css` (добавить в начало, после `:root` или сразу после reset-секции).

```css
/* [FIX] Global custom scrollbar — 4px, slate thumb, transparent track */
*::-webkit-scrollbar { width: 4px; height: 4px; }
*::-webkit-scrollbar-track { background: transparent; }
*::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.4);
  border-radius: 999px;
}
*::-webkit-scrollbar-thumb:hover { background: rgba(148, 163, 184, 0.7); }
* { scrollbar-width: thin; scrollbar-color: rgba(148,163,184,0.4) transparent; }
```

- Существующие локальные правила (`.main-scroll`, `.sidebar-scroll`, `.picker-scroll`) оставить — они идут позже и переопределяют где надо.
- Firefox: `scrollbar-width: thin` + `scrollbar-color`.

---

### Фаза 2 — Виджеты (Блок 3) + параллельные правки реестра

> **Правило для каждой задачи в этой фазе:** изменения в реестре `src/constants/widgets.registry.ts` идут вместе с правкой компонента виджета — в одном коммите по чекпоинту.

#### Task #11 — Переименовать `kpi_portfolio` → `market_ticker` — [x]
**Файлы:**
- `src/types/widgets.types.ts` — заменить литерал в `WidgetType`.
- `src/constants/widgets.registry.ts` — изменить `type: 'kpi_portfolio'` → `'market_ticker'`, `title: 'Тикер активов'`, новые размеры (см. ниже).
- `src/components/dashboard/WidgetCard.tsx:44` — `case 'market_ticker'`.
- `src/pages/Dashboard.tsx:109` — в `createDefaultWidgets` заменить тип.
- `src/components/dashboard/WidgetPreview.tsx:14` — заменить ключ в map.
- Поиск по проекту: `grep -rn "kpi_portfolio" src/` — заменить все вхождения.

**Размеры в реестре:** `availableSizes: [{w:2,h:1},{w:3,h:1},{w:2,h:2},{w:3,h:2}]`, `defaultSize: {w:3,h:1}`, `minW:2, maxW:3, minH:1, maxH:2`.

**Миграция localStorage:**
- В `Dashboard.tsx:19` бамп `STORAGE_KEY = 'fintrack_widgets_v4'`, добавить `'fintrack_widgets_v3'` в `LEGACY_STORAGE_KEYS`.
- В `loadWidgets` (или в начале миграции старого ключа) — попытка ОДНОКРАТНО прочитать `v3`, найти `type === 'kpi_portfolio'`, заменить на `'market_ticker'`, clamp размеров по новому реестру, сохранить под `v4`, удалить `v3`.
- Лог: `console.debug('[FIX] migrating kpi_portfolio -> market_ticker (v3 -> v4)')`.

#### Task #12 — Компонент `MarketTicker.tsx` — [x]
**Файл:** `src/components/dashboard/MarketTicker.tsx` (новый).

- Принимает `WidgetSizeProps` (`gridW`, `gridH`).
- Использует `usePrices()` для списка активов.
- **На 2×1 / 3×1** (горизонтальная строка): grid `grid-template-columns: repeat(N, 1fr)`, где N = `gridW * 2` (2→4 актива, 3→6 активов). Каждый элемент — иконка 24px (`Avatar`/CSS-круг с инициалом) + тикер + цена + изменение, всё в одну строку, padding `8px`, gap `8px`.
- **На 2×2 / 3×2**: сетка `grid-template-columns: repeat(gridW, 1fr)` × `grid-template-rows: repeat(2, 1fr)` → `gridW * 2` карточек.
- Цена через `formatPrice`, изменение через `formatChange` (из `src/utils/format.ts`), цвета `var(--green)` / `var(--accent)`.
- Лог: `console.debug('[MarketTicker] gridW=%d gridH=%d assets=%d', gridW, gridH, count)`.
- Подвязать в `WidgetCard.tsx:44` — `case 'market_ticker': return <MarketTicker gridW={gridW} gridH={gridH} />`.
- `PersonalizedPanel.tsx` оставить файл, если ещё нужен в других местах; иначе пометить депрекейтом.

**Блокирует:** Task #11 завершён.

#### Task #13 — Watchlist: размеры + компактный режим — [x]
**Файлы:** `src/constants/widgets.registry.ts`, `src/components/dashboard/WatchlistPanel.tsx`.

- **Реестр:** `availableSizes: [{w:1,h:2},{w:1,h:3},{w:1,h:4},{w:2,h:2},{w:2,h:3},{w:2,h:4}]`, `minW:1, maxW:2, minH:2, maxH:4`, `defaultSize: {w:2,h:2}`.
- **Компонент:** `gridW===1` → только иконка-круг 22px + цена + change%, без названия и тикера. `gridW===2` → иконка + тикер + цена + change%. Кол-во строк по `gridH` (2→4, 3→8, 4→12).
- Лог: `console.debug('[WatchlistPanel] gridW=%d gridH=%d compact=%s', gridW, gridH, compact)`.

#### Task #14 — PriceChart: размеры + NaN%-фикс — [x]
**Файлы:** `src/constants/widgets.registry.ts`, `src/components/dashboard/PriceChartWidget.tsx`, возможно `src/hooks/useAssetPrice.ts`.

- **Реестр:** `availableSizes: [{w:2,h:2},{w:3,h:2},{w:4,h:2}]`, `minW:2, maxW:4, minH:2, maxH:2`, `defaultSize: {w:3,h:2}`.
- **NaN%-фикс:**
  - В `PriceChartWidget.tsx:154`: обернуть `change24h.toFixed(1)` в guard: `Number.isFinite(change24h) ? change24h.toFixed(1) : '0.0'`.
  - В `useAssetPrice.ts` найти место вычисления `change24h`: если используется формула `(current-open)/open*100` и `open===0` — вернуть `0`. По вводным ТЗ формула должна быть `((currentPrice - openPrice) / openPrice) * 100` с защитой `openPrice > 0`.
  - Лог: `console.warn('[useAssetPrice] non-finite change24h for %s, defaulting to 0', symbol)`.
- ResponsiveContainer уже 100%/100% — оставить (`PriceChartWidget.tsx:202`).

#### Task #15 — Allocation: donut + градиент — [x]
**Файлы:** `src/constants/widgets.registry.ts`, `src/components/dashboard/AllocationChart.tsx`.

- **Реестр:** `availableSizes: [{w:2,h:2},{w:2,h:3}]`, `minW:2, maxW:2, minH:2, maxH:3`, `defaultSize: {w:2,h:2}`.
- **Компонент:**
  - Заменить `<Pie ... innerRadius=0>` на donut: `innerRadius="60%" outerRadius="90%"`.
  - Градиентные сегменты: один `<defs>` с `<linearGradient id="gradN" />` на каждый сегмент (5 шт по `SLICE_DATA`), `<Cell fill="url(#gradN)" />`.
  - Анимация появления — `isAnimationActive=true, animationDuration=600`.
  - `gridH===2` → только кольцо + tooltip (без легенды снизу).
  - `gridH===3` → кольцо + легенда: ряд цветная точка(8px) + тикер + `%`.
  - Убрать `renderCustomizedLabel` overlays на 2×2.
- Лог: `console.debug('[AllocationChart] gridH=%d legend=%s', gridH, gridH >= 3)`.

#### Task #16 — Community: размеры + плотность — [x]
**Файлы:** `src/constants/widgets.registry.ts`, `src/components/dashboard/CommunityWidget.tsx`.

- **Реестр:** `availableSizes: [{w:2,h:2},{w:2,h:3},{w:3,h:2},{w:3,h:3}]`, `minW:2, maxW:3, minH:2, maxH:3`, `defaultSize: {w:2,h:2}`.
- **Компонент:** число постов по `gridH` (2→2, 3→4). `gap` между постами `≤ 8px`. Внутренний скролл (overflow:auto, кастомный скроллбар уже глобальный).
- Никаких `justify-content: space-between` если постов меньше чем влезает.

#### Task #17 — News: размеры + перенос заголовков — [x]
**Файлы:** `src/constants/widgets.registry.ts`, `src/components/dashboard/NewsWidget.tsx`.

- **Реестр:** `availableSizes: [{w:2,h:2},{w:2,h:3},{w:3,h:2},{w:3,h:3}]`, `minW:2, maxW:3, minH:2, maxH:3`, `defaultSize: {w:2,h:2}`.
- **Компонент:**
  - Фильтры сохраняются на всех размерах.
  - Заголовки `white-space: normal; overflow-wrap: anywhere;` — никаких `text-overflow: ellipsis` для заголовков (только для подписей-источников).
  - Кол-во новостей растёт с `gridH` (2→3, 3→6) и `gridW` (3→+2 поста).
  - Убрать `flex justify-content: space-between` снизу — пустоты быть не должно.

#### Task #18 — TopMovers: два столбца + плотность — [x]
**Файлы:** `src/constants/widgets.registry.ts`, `src/components/dashboard/widgets/TopMoversWidget.tsx`.

- **Реестр:** `availableSizes: [{w:2,h:2},{w:2,h:3},{w:3,h:2}]`, `minW:2, maxW:3, minH:2, maxH:3`, `defaultSize: {w:2,h:2}`.
- **Компонент:** layout `grid-template-columns: 1fr 1fr` — слева «Рост», справа «Падение». Padding строки `6-8px`. Без bottom-пустоты.

#### Task #19 — ForexRates: 3 размера, две раскладки — [x]
**Файлы:** `src/constants/widgets.registry.ts`, `src/components/dashboard/widgets/ForexRatesWidget.tsx`.

- **Реестр:** `availableSizes: [{w:2,h:1},{w:3,h:1},{w:2,h:2}]`, `minW:2, maxW:3, minH:1, maxH:2`, `defaultSize: {w:2,h:2}`.
- **Компонент:**
  - `gridH===1` → одна строка пар (`flex` с равными flex:1, иконка-флаг + пара + курс + %).
  - `gridH===2` → grid 2×2 крупные карточки (пара жирно сверху, курс крупно, % внизу в pill).
- Лог: `console.debug('[ForexRatesWidget] gridW=%d gridH=%d layout=%s', gridW, gridH, gridH===1?'row':'grid')`.

#### Task #20 — FearGreed: gauge без воздуха, maxW:2 — [x]
**Файлы:** `src/constants/widgets.registry.ts`, `src/components/dashboard/widgets/FearGreedWidget.tsx`.

- **Реестр:** уже `minW:1, maxW:2, minH:1, maxH:2` и размеры `1x1, 2x1, 1x2, 2x2` — заменить на `1x1, 1x2, 2x2` (убрать `2x1` если не вписывается в логику, оставить если нужен — спека ТЗ перечисляет `1×1, 1×2, 2×2`). `defaultSize: {w:1, h:2}`.
- **Компонент:** SVG-gauge заполняет всю карточку (без выраженных margin/padding); число + подпись (например «Greed») идут вплотную под стрелкой, без отступа `space-between`.

#### Task #21 — MarketVolume: 1×1 и 2×1 — [x]
**Файлы:** `src/constants/widgets.registry.ts`, `src/components/dashboard/widgets/MarketVolumeWidget.tsx`.

- **Реестр:** `availableSizes: [{w:1,h:1},{w:2,h:1}]`, `minW:1, maxW:2, minH:1, maxH:1`, `defaultSize: {w:2,h:1}`.
- **Компонент:**
  - `gridW===1` → только крупная цифра объёма (например `$24.5B`) + подпись «Объём 24ч» снизу.
  - `gridW===2` → цифра слева (40-50% ширины), мини-`LineChart`/`AreaChart` справа (50-60% ширины), `ResponsiveContainer 100%/100%`.

#### Task #22 — TrendingCoins: только вертикальный рост — [x]
**Файлы:** `src/constants/widgets.registry.ts`, `src/components/dashboard/widgets/TrendingCoinsWidget.tsx`.

- **Реестр:** `availableSizes: [{w:1,h:2},{w:1,h:3},{w:1,h:4},{w:2,h:2},{w:2,h:3}]`, `minW:1, maxW:2, minH:2, maxH:4`, `defaultSize: {w:2,h:2}`.
- **Компонент:** плотные строки (иконка + тикер + цена + %), рост числа строк по `gridH` (2→5, 3→8, 4→11).

---

### Фаза 3 — Финал (Блок 4)

#### Task #23 — Финальная сверка реестра + тесты
- Пройтись по всему `WIDGET_REGISTRY` — проверить, что для каждого изменённого виджета `defaultSize`/`minW`/`maxW`/`minH`/`maxH`/`availableSizes` соответствуют spec из Блока 3. Виджеты не из списка ТЗ (`technical_analysis`, `economic_calendar`, `heatmap`, `portfolio_pnl`, `dominance_chart`, `price_alerts`, `macd_widget`, `rsi_gauge`, `order_book`, `global_market_cap`, `funding_rate`, `gas_tracker`, `currency_converter`, `whale_tracker`, `stock_screener`, `sentiment_meter`, `liquidations`, `yield_curve`, `correlation_matrix`, `ai_signal`) не трогать.
- `npm run lint` — 0 ошибок.
- `npm run test` — все тесты зелёные. Если тест ссылается на `kpi_portfolio` — заменить на `market_ticker`.
- `npm run build` — собирается без ошибок типов.
- Открыть `http://localhost:5173` (`npm run dev`) и вручную проверить:
  - Drag любого виджета — следует за курсором без телепорта.
  - Resize за край — курсор меняется, ручки невидимы, область клика 20×20 работает.
  - X-кнопка отступлена от края на 8/8.
  - Скроллбар внутри виджетов 4px тонкий.

**Блокирует:** все задачи #8–#22 завершены.

---

## Граф зависимостей

```
#7 (drag-баг) ──► #8 (resize handle)
                      
                      #9 (X-кнопка)
                      #10 (scrollbar)

#11 (rename) ──► #12 (MarketTicker)

#13 (watchlist) ┐
#14 (price_chart) │
#15 (allocation)  │
#16 (community)   │
#17 (news)        ├──► #23 (финал + тесты)
#18 (top_movers)  │
#19 (forex)       │
#20 (fear_greed)  │
#21 (market_vol)  │
#22 (trending)    ┘
```

#7 блокирует #8 (на одном файле `index.css` — лучше последовательно, чтобы не было конфликтов). #9, #10 могут идти параллельно с #8. #11 блокирует #12. #13–#22 независимы между собой после фазы 1.

---

## Commit Plan

17 задач → нужны чекпоинты. Все коммиты на ветке `master`.

| Чекпоинт | Задачи | Сообщение |
|----------|--------|-----------|
| CP1 | #7 | `fix(dashboard): drag teleport — move scale to inner card so RGL translate stays` |
| CP2 | #8, #9, #10 | `style(grid): 20x20 resize hit-area, X offset 8/8, global thin scrollbar` |
| CP3 | #11, #12 | `feat(widgets): rename kpi_portfolio -> market_ticker + new MarketTicker component` |
| CP4 | #13, #14 | `feat(watchlist,price-chart): new size matrix + guard NaN% change` |
| CP5 | #15, #16, #17 | `feat(allocation,community,news): donut+gradient, density, title wrapping` |
| CP6 | #18, #19, #20, #21, #22 | `feat(widgets): topmovers/forex/feargreed/volume/trending — new sizes and density` |
| CP7 | #23 | `chore: registry final pass + green tests after widget revision` |

---

## Файлы, которых план НЕ касается

- `localStorage` ключи и пакеты, кроме описанной миграции `v3→v4`.
- `AddWidgetModal.tsx`, `SizeIndicator.tsx`, `WidgetPreview.tsx` (кроме map для `market_ticker` в Preview).
- Хуки `usePrices`/`useStockPrice`/`useForexRate`/`useNews`/`useGroqChat`/`useOHLCV` — только чтение. Правка `useAssetPrice` ограничена защитой `change24h` от деления на 0.
- Тесты (`*.test.tsx`) — править только если переименование `kpi_portfolio` вызвало failure.
- Дизайн-палитра (`.ai-factory/RULES.md`) — нельзя вводить новые цвета.

---

## Ссылки

- `vidget fix.md` — исходное ТЗ
- `.ai-factory/plans/widget-dnd-enhancements.md` — завершённый предыдущий план (фундамент: WidthProvider, motion-обвязка, gridW/gridH props)
- `.ai-factory/RULES.md` — дизайн-система (цвета, типографика, тени) — приоритет
- `.ai-factory/ARCHITECTURE.md` — Feature-based Modular: компоненты в `components/dashboard/`, типы — в `types/widgets.types.ts`, реестр — в `constants/widgets.registry.ts`
