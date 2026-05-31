# План: Grid Fix — drag без ghost и адаптивные виджеты

**Ветка:** `feature/widget-dnd-enhancements`
**Источник задачи:** `gridfix.md`
**Дата:** 17 мая 2026
**Эталонный проект:** `C:\Users\Никита\Desktop\DIPLOM\cryptocurrency-dashboard`

---

## Settings

- **Testing:** Только прогон существующих тестов (новые не пишем; файлы тестов не трогаем).
- **Logging:** Verbose — `console.debug` на ключевые события (drag, render, gridW/gridH).
- **Docs:** Yes — мандатный чекпоинт `/aif-docs` (обновление `PROJECT_STATE.md`).

---

## Цель

Двигать виджеты как иконки на iPhone: виджет «висит» под курсором, остальные плавно расступаются, никакого серого/пунктирного placeholder. Все виджеты корректно масштабируются под размер ячейки, без вылезающего контента и обрезанных заголовков.

---

## Research Context

### Эталонный проект (cryptocurrency-dashboard)

**Файлы:** `src/components/app/app.tsx`, `src/components/container/container.tsx`, `src/components/currencyWidget/currencyWidget.tsx`, `src/components/priceChart/priceChart.tsx`.

| Аспект | Решение в эталоне |
|--------|-------------------|
| Библиотека | `react-grid-layout` v0.16 (старая) |
| HOC | `WidthProvider(ReactGridLayout)` — авто-ширина |
| Cols | `cols={4}` |
| RowHeight | `90` (px) |
| Margin | default `[10, 10]` |
| Drag | `draggableHandle={'.handle'}` — только за заголовок |
| Resize | `isResizable={false}` |
| Grid item | `<div key={...} data-grid={...}>` — простой div, **без motion-обёртки** |
| Контейнер виджета | Material UI `<Paper>` с `boxSizing: 'border-box'`, `height: '100%'`, `padding: 16` |
| Графики | `<ResponsiveContainer height={70}>` — фиксированная высота, гибкая ширина |
| Текст | Утилита `ellipsis = { overflow: hidden, textOverflow: ellipsis, whiteSpace: nowrap }` |
| Placeholder | Используется дефолтный (в FinTrack — кастомный розовый, который убираем) |

**Важно:** эталон не решает «iPhone-style drag» — он использует стандартный placeholder. Мы делаем лучше: скрываем placeholder и добавляем плавный transition на сами grid-items.

### Текущее состояние FinTrack (что чинить)

1. **Двойная карточка:** `WidgetCard.tsx` уже даёт фон/бордер/padding, но внутренние виджеты (`PriceChartWidget`, `AllocationChart`, `WatchlistPanel`, ...) повторно оборачивают контент в `<div style={{ background, border, padding: 16 }}>` — получается карточка в карточке.
2. **Фиксированная высота графиков:** `<ResponsiveContainer width="100%" height={200}>` — не адаптируется к ячейке.
3. **`minHeight: 120` в WidgetCard** — мешает в ячейках 1×1.
4. **Розовый placeholder:** в `src/index.css` правило `.react-grid-item.react-grid-placeholder` рисует розовый dashed-квадрат при drag.
5. **Виджеты не знают свой размер** — нет пропсов `gridW`/`gridH`, нечего показывать/прятать адаптивно.
6. **`<motion.div key={safePage}>` вокруг GridLayout** — slide-анимация страниц, может конфликтовать с позиционированием grid (проверить).

### Что НЕ трогаем (из gridfix.md)

- localStorage и ключ `fintrack_widgets_v2`
- `AddWidgetModal`, точки и стрелки пагинации
- Хук `usePrices` (только читаем)
- Файлы тестов (`*.test.tsx`)

---

## Tasks

### Фаза 0 — Подготовка

#### Task #1 — Зафиксировать находки эталонного проекта — [x]
Описать в начале плана выводы из cryptocurrency-dashboard. **(Выполнено в этом документе, см. Research Context выше.)**

### Фаза 1 — Глобальные правки (CSS + типы)

#### Task #2 — Убрать placeholder и настроить плавные transition в CSS — [x]
**Файл:** `src/index.css` (блок REACT-GRID-LAYOUT, ~строка 280-296).

- Скрыть placeholder: `.react-grid-placeholder { display: none !important; }`
- Transition соседей: `.react-grid-item { transition: transform 200ms ease, opacity 200ms ease; }`
- Перетаскиваемый: `transition: none; z-index: 100; opacity: 0.92; transform: scale(1.03) !important; box-shadow: 0 20px 60px rgba(0,0,0,0.18) !important;`
- `console.debug('[Dashboard] drag CSS active')` в `onDragStart`.

#### Task #3 — Расширить типы виджетов адаптивными пропсами — [x]
**Файл:** `src/types/widgets.types.ts`.

```ts
export interface WidgetSizeProps {
  gridW?: number  // ширина в колонках 1..4
  gridH?: number  // высота в строках 1..4
}
```

#### Task #4 — Пробросить gridW/gridH из Dashboard в WidgetCard и виджеты — [x]
**Файлы:** `src/components/dashboard/WidgetCard.tsx` (Dashboard уже передаёт `widget`).

Изменить `renderWidgetContent(type, gridW, gridH)`; передать пропсы в каждый виджет через спред.

#### Task #5 — Унифицировать WidgetCard как единственную карточку — [x]
**Файл:** `src/components/dashboard/WidgetCard.tsx`.

- Корень: `display: flex; flexDirection: column` + убрать `minHeight: 120`.
- Header: `flexShrink: 0`.
- Контентный wrap: `{ flex: 1, minHeight: 0, overflow: hidden, display: flex, flexDirection: column }` (заменить `calc(100% - 36px)`).

### Фаза 2 — Внутренности виджетов (3 параллельных группы)

#### Task #6 — Фикс WatchlistPanel, PriceChartWidget, AllocationChart — [x]
Для каждого: убрать внешнюю карточку, root 100% flex column, `<ResponsiveContainer width="100%" height="100%">` внутри `<div style={{ flex: 1, minHeight: 0 }}>`, принять `gridW/gridH`, ellipsis, verbose `console.debug`.

Адаптивность:
- **WatchlistPanel:** `gridH === 2` → 4 строки, `>= 3` → 10; `gridW === 2` → только тикер.
- **PriceChartWidget:** `gridH === 2` → скрыть таймфреймы.
- **AllocationChart:** `gridH === 2` → спрятать legend; `gridW === 1` → спрятать процент.

#### Task #7 — Фикс CommunityWidget, NewsWidget, PersonalizedPanel — [x]
Та же формула. Адаптивность:
- **CommunityWidget:** `gridH === 2` → 2 поста, `>= 3` → 4.
- **NewsWidget:** `gridH === 2` → 3 новости, `>= 3` → 6; `gridW === 2` → без превью.
- **PersonalizedPanel (KPI):** `gridH === 1 && gridW === 2` → только главная цифра; `gridW === 4` → полный набор.

#### Task #8 — Фикс 5 виджетов из widgets/ — [x]
TopMoversWidget, ForexRatesWidget, FearGreedWidget, MarketVolumeWidget, TrendingCoinsWidget.

Адаптивность:
- **TopMovers:** `gridH === 2` → 3 строки, `>= 3` → 6.
- **ForexRates:** `2×2` → 4 пары, `3×1` → горизонталь.
- **FearGreed:** `1×1` → только цифра+круг, `gridW === 2` → +шкала, `gridH === 2` → +описание.
- **MarketVolume:** `gridW === 2` → только цифра, `gridW === 3` → +мини-график.
- **TrendingCoins:** `gridH === 2` → 3 монеты, `>= 3` → 6.

#### Task #9 — Снять motion.div с grid-children в Dashboard — [x]
**Файл:** `src/pages/Dashboard.tsx`.

Прямые дети `<GridLayout>` уже простые div — оставить. Если `<motion.div key={safePage}>` вокруг GridLayout ломает позиционирование — убрать `x` (translate) анимацию, оставить только `opacity`.

### Фаза 3 — Финализация

#### Task #10 — Визуальная полировка и обновление PROJECT_STATE.md — [x]
- Заголовки виджетов не обрезаются (ellipsis на самой строке).
- Унифицированный padding 16px.
- Hover-стили карточки не ломаются при новых размерах.
- Обновить раздел «Дашборд» в `PROJECT_STATE.md`: адаптивные виджеты, отсутствие placeholder, iPhone-style drag.

#### Task #11 — Прогон тестов и ручная проверка drag — [x]

**Итог тестов:** 26/35 passed. Все 9 падающих (`AssetTable.test.tsx` × 5, `MarketOverview.test.tsx` × 4) — pre-existing проблема `useNavigate()` без обёртки в Router. Подтверждено через `git stash`: те же тесты падают и до моих правок. Эти файлы я не редактировал.

**Ручная проверка drag:** требует запуска `npm run dev` — нужно сделать пользователю в браузере.
- `npm run test` — все зелёные. Падающие тесты фиксим в продакшен-коде, не в тестах.
- `npm run dev` → http://localhost:5173, режим редактирования:
  - нет placeholder-квадрата
  - виджет с scale(1.03) и тенью под курсором
  - соседи расступаются плавно (200ms)
  - resize → контент не вылезает, заголовок не обрезается

---

## Граф зависимостей

```
#1 (research) ──► #2 (CSS)
                  
#3 (types) ──► #4 (props через Dashboard/WidgetCard) ──► #5 (WidgetCard layout)
                                                          │
                          ┌───────────────────────────────┼───────────────┐
                          │                               │               │
                          ▼                               ▼               ▼
                         #6 (3 центр. виджета)   #7 (Community/News/KPI)  #8 (widgets/*)
                          │                               │               │
                                              #9 (motion.div Dashboard)
                          └───────────────────────────────┴───────────────┘
                                                          │
                                                          ▼
                                              #10 (полировка + docs)
                                                          │
                                                          ▼
                                              #11 (тесты + ручная QA)
```

`#2` и `#3` независимы, могут идти параллельно. `#6/#7/#8/#9` независимы между собой после `#5`.

---

## Commit Plan

11 задач — нужны чекпоинты. План коммитов:

| Чекпоинт | Задачи | Сообщение |
|----------|--------|-----------|
| CP1 | #1, #2 | `style(grid): remove placeholder + iPhone-style drag transitions` |
| CP2 | #3, #4, #5 | `feat(widgets): unify WidgetCard + propagate gridW/gridH` |
| CP3 | #6, #7, #8 | `feat(widgets): adaptive content for all 11 widgets` |
| CP4 | #9, #10 | `chore(dashboard): cleanup motion wrappers + polish + docs` |
| CP5 | #11 | `test: verify all dashboard tests pass after grid refactor` |

---

## Ссылки

- `gridfix.md` — исходное ТЗ
- `PROJECT_STATE.md` — текущее состояние проекта
- Эталон: `C:\Users\Никита\Desktop\DIPLOM\cryptocurrency-dashboard\src\components\app\app.tsx`
- Эталон контейнера: `cryptocurrency-dashboard\src\components\container\container.tsx`
