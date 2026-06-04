[Back to README](../README.md) · [Несколько дашбордов →](multi-dashboard.md)

# Система виджетов

Кастомизируемый дашборд на `react-grid-layout` с iPhone-style drag-and-drop, ресайзом за невидимый край и каруселью страниц. Реестр содержит **31 тип виджета** — основной набор для крипто/акций/форекс плюс расширенный набор технических и рыночных индикаторов.

## Реестр виджетов

Источник правды: `src/constants/widgets.registry.ts`. Каждое описание содержит `type`, `title`, `description`, `icon` (lucide-react), `color`, `availableSizes`, `defaultSize`, `minW/maxW/minH/maxH`.

### Основной набор (11 виджетов)

| Тип | Название | Цвет | Размеры |
|-----|----------|------|---------|
| `market_ticker` | Тикер активов | `#e11d48` | 2×1, 3×1, 2×2, 3×2 |
| `watchlist` | Вотч-лист | `#f59e0b` | 1×2, 1×3, 1×4, 2×2, 2×3, 2×4 |
| `price_chart` | График цены | `#3b82f6` | 2×2, 3×2, 4×2 |
| `allocation` | Распределение | `#8b5cf6` | 2×2, 2×3 |
| `community` | Сообщество | `#06b6d4` | 2×2, 2×3, 3×2, 3×3 |
| `news` | Новости рынка | `#64748b` | 2×2, 2×3, 3×2, 3×3 |
| `top_movers` | Топ движения | `#22c55e` | 2×2, 2×3, 3×2 |
| `forex_rates` | Форекс курсы | `#0ea5e9` | 2×1, 3×1, 2×2 |
| `fear_greed` | Страх и жадность | `#f97316` | 1×1, 1×2, 2×2 |
| `market_volume` | Объём рынка | `#a855f7` | 1×1, 2×1 |
| `trending_coins` | Трендовые монеты | `#ef4444` | 1×2, 1×3, 1×4, 2×2, 2×3 |

### Расширенный набор (20 виджетов)

Технические индикаторы и рыночные данные:

`technical_analysis` · `economic_calendar` · `heatmap` · `portfolio_pnl` · `dominance_chart` · `price_alerts` · `macd_widget` · `rsi_gauge` · `order_book` · `global_market_cap` · `funding_rate` · `gas_tracker` · `currency_converter` · `whale_tracker` · `stock_screener` · `sentiment_meter` · `liquidations` · `yield_curve` · `correlation_matrix` · `ai_signal`

Полные размеры и описания — в `src/constants/widgets.registry.ts`.

## Адаптивность по размеру

Каждый виджет принимает `WidgetSizeProps` (`gridW`, `gridH`) и сам решает, что показать:

- **`MarketTicker`** — grid `gridW × gridH` ячеек; на каждой иконка 24px + тикер + цена + изменение
- **`WatchlistPanel`** — `gridW===1` → компактная строка (только иконка + цена + %); `gridW===2` → полная строка с тикером. Растёт только вниз
- **`PriceChartWidget`** — ResponsiveContainer 100%; гард `Number.isFinite` на change24h (не показывает «NaN%»)
- **`AllocationChart`** — donut `innerRadius:60%`, градиентные сегменты через `<defs>`, легенда снизу при `gridH===3`
- **`CommunityWidget`** / **`NewsWidget`** — кол-во записей растёт с `gridH × gridW`; заголовки новостей переносятся, не обрезаются ellipsis
- **`FearGreedWidget`** — gauge заполняет всю карточку, число рендерится прямо внутри SVG
- **`MarketVolumeWidget`** — `gridW===1`: только цифра; `gridW===2`: цифра + sparkline справа

## Drag-and-Drop

Реализация: `react-grid-layout/legacy` обёрнут в `WidthProvider` в `src/pages/Dashboard.tsx`.

Конфигурация (стандартный iPhone-style):

```
cols={4}
rowHeight={110}
useCSSTransforms={true}
compactType="vertical"
preventCollision={false}
isDraggable={true}
draggableHandle=".widget-drag-handle"
```

- Перетаскивание — за полоску-заголовок виджета (`.widget-drag-handle`).
- Соседи плавно «расходятся», нет розового placeholder'а.
- **Drag-fix (важный историчный нюанс):** scale-эффект во время drag применяется на ВНУТРЕННИЙ `.widget-card`, а не на `.react-grid-item`. Иначе `transform: scale()` с `!important` затирает inline `transform: translate(x,y)` от RGL — виджет визуально остаётся в (0,0) и только увеличивается. См. `src/index.css` блок `.react-grid-item.react-draggable-dragging`.

## Resize

- Невидимые hit-области 20×20 во всех 6 направлениях (углы + s/e edges). См. `src/index.css` → `.react-grid-item > .react-resizable-handle`.
- Курсор браузера сам меняется (`nwse-resize`, `ns-resize`, `ew-resize`) — пользователь видит, где «схватить».
- `minW/maxW/minH/maxH` из реестра пробрасываются на каждый `LayoutItem` в `buildGridLayout()` — RGL блокирует ручку на границе.
- Овальный `SizeIndicator` показывает `W × H` поверх виджета во время resize.
- `onResizeStop` дополнительно clamp'ит значения по реестру (defence-in-depth, если ручка вышла за пределы).

## Карусель страниц

Когда виджеты не помещаются на одну страницу — `DashboardHeader` показывает стрелки и точки. Слайд-анимация через Framer Motion (`AnimatePresence mode="wait"`).

## Edit Mode

Кнопка «Редактировать» в `DashboardHeader` включает режим:

- Появляется крестик удаления (`.widget-remove-btn`, offset `top:8 right:8`).
- Активируется resize за края.
- Поверх драг-полоски курсор `grab`/`grabbing`.

## Добавление виджетов

Модальное окно `AddWidgetModal`:

- Поиск по `title` и `description`.
- Превью виджетов через `WidgetPreview` (фиксированные `PREVIEW_HEIGHTS` для каждого типа, чтобы Recharts не схлопывался).
- Клик по карточке = добавить (без явной кнопки).
- Поддержка drag-from-modal через RGL `droppingItem` + `onDrop`.

## Персистентность layout

Раскладка дашборда синхронизируется с бэкендом (PostgreSQL) при наличии сессии. localStorage — офлайн-кэш и хранилище для гостей.

**Для авторизованных пользователей:**

1. При загрузке страницы — `GET /dashboard/config` (бэкенд).
2. При ошибке сети — fallback на `localStorage` (`fintrack_dashboard_v4`).
3. Любое изменение (DnD, добавление/удаление виджета, смена дашборда) → дебаунсированный `PUT /dashboard/config` (600 мс) + запись в localStorage-кэш.

**Для гостей:** весь envelope хранится только в localStorage.

**Схема ключей localStorage:**

| Ключ | Назначение |
|------|------------|
| `fintrack_dashboard_v4` | Envelope `{dashboards, activeId}` (текущая схема) |
| `fintrack_widgets_v4` | Legacy — одиночный массив виджетов (автомигрируется на чтении) |

При смене схемы реестра — бамп ключа (v4 → v5) + добавление старого ключа в список legacy-ключей для очистки.

Любая загруженная раскладка clamp'ится по текущему реестру (`minW/maxW/minH/maxH`) — старые «широкие» виджеты не воскреснут после ужатия `maxW`.

## Глобальные стили (общие)

`src/index.css`:

- Тонкий кастомный скроллбар 4px (`*::-webkit-scrollbar`), полупрозрачный slate-thumb с потемнением на hover.
- Запрет розового placeholder'а: `.react-grid-placeholder { display: none !important }`.
- Плавный transition соседей: `.react-grid-item { transition: transform 200ms ease, opacity 200ms ease }`.

## Ключевые файлы

| Файл | Назначение |
|------|------------|
| `src/pages/Dashboard.tsx` | GridLayout config, DnD, resize, save/load, миграции |
| `src/types/widgets.types.ts` | `WidgetType`, `WidgetDefinition`, `WidgetSizeProps`, `DashboardWidget` |
| `src/constants/widgets.registry.ts` | `WIDGET_REGISTRY` — все 31 описаний |
| `src/components/dashboard/WidgetCard.tsx` | Обёртка карточки + `renderWidgetContent()` |
| `src/components/dashboard/AddWidgetModal.tsx` | Модалка добавления |
| `src/components/dashboard/SizeIndicator.tsx` | Индикатор `W × H` при resize |
| `src/components/dashboard/MarketTicker.tsx` | Новый компонент, заменил `PersonalizedPanel` для `market_ticker` |
| `src/components/dashboard/widgets/*` | 20 виджетов расширенного набора |
| `src/index.css` (блок `REACT-GRID-LAYOUT`) | CSS для drag/resize/placeholder |

## См. также

- `../AGENTS.md` — общая карта проекта
- `../.ai-factory/ARCHITECTURE.md` — Feature-based Modular pattern и правила зависимостей
- `../.ai-factory/RULES.md` — закрытая дизайн-палитра и типографика
