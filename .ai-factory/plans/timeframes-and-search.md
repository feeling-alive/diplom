# Implementation Plan: Таймфреймы графика + рабочий поиск

Branch: master (create_branches: false)
Created: 2026-06-11

## Settings
- Testing: no
- Logging: verbose
- Docs: yes — обязательный чекпойнт в /aif-implement

## Roadmap Linkage
Milestone: "none"
Rationale: Roadmap не найден (.ai-factory/ROADMAP.md отсутствует)

---

## Задача 1 — Таймфреймы графика

### Контекст
- `SimpleChart.tsx` — Recharts AreaChart с 8 таймфреймами (1m/5m/15m/1H/4H/1D/1W/1M)
- Тип `Timeframe` в `types/market.types.ts` — объединение 8 строк
- Бэкенд `candles.py`: маппинг Finnhub содержит все 8 tf; `30m` → `"30"` **отсутствует**
- OKX принимает строки напрямую — `30m` поддерживается без изменений
- Finnhub поддерживает resolution=`30` (30 минут)

### Требуется
- Оставить ровно 5 таймфреймов: 30м · 1ч · 1д · 1н · 1м
- Добавить `30m` в тип и маппинг, убрать 5m/15m/4H
- Активная кнопка: `background #E11D48`, белый текст; компактный pill-ряд

---

## Задача 2 — Поиск

### Контекст
| Место | Состояние |
|-------|-----------|
| Dashboard (глобальный) | Заглушка в DashboardHeader.tsx / DashboardTopBar.tsx — нет логики |
| /market (таблица) | Нет поиска вообще — только сортировка |
| /news | Работает: 500мс debounce + ILIKE бэкенд. Нужна визуальная полировка |
| AddWidgetModal | Работает: useMemo фильтр. Нужна визуальная полировка |

### MUI — НЕ установлен
В проекте нет `@mui/*`. «MUI TextField» в задаче = визуальный стиль (outlined input с иконкой).
Реализуем кастомный `SearchInput` через дизайн-систему проекта (CSS-переменные, lucide-react).

---

## Commit Plan

- **Commit 1** (после задач 1–3): `feat(chart): reduce timeframes to 5 — 30m/1H/1D/1W/1M`
- **Commit 2** (после задач 4, 11): `feat(ui): SearchInput + EmptySearchState shared components`
- **Commit 3** (после задач 5–6): `feat(search): global search backend endpoint + useGlobalSearch hook`
- **Commit 4** (после задач 7–8): `feat(search): global dashboard search dropdown + market table filter`
- **Commit 5** (после задач 9–10): `feat(search): polish news and widget modal search`

---

## Tasks

### Phase 1: Таймфреймы

- [x] **Задача 1**: Обновить тип `Timeframe` в `types/market.types.ts`
  - Убрать `'1m' | '5m' | '15m' | '4H'`, добавить `'30m'`
  - Итоговый тип: `'30m' | '1H' | '1D' | '1W' | '1M'`
  - Файлы: `frontend/src/types/market.types.ts`, `frontend/src/mock/ohlcv.mock.ts`
  - Logging: добавить `console.debug` в mock при генерации

- [x] **Задача 2**: Маппинг 30m в бэкенде `candles.py`
  - `_FINNHUB_TF_MAP`: добавить `"30m": "30"`, удалить `"5m"/"15m"/"4H"`
  - `sec_per_bar`: добавить `"30": 1800`, удалить `"5"/"15"/"240"`
  - Файл: `backend/app/services/candles.py`
  - Зависимости: независимая задача

- [x] **Задача 3**: SimpleChart — 5 кнопок таймфрейма (зависит от задачи 1)
  - Массив: `[{key:'30m',label:'30м'}, {key:'1H',label:'1ч'}, {key:'1D',label:'1д'}, {key:'1W',label:'1н'}, {key:'1M',label:'1м'}]`
  - Активная кнопка: `backgroundColor: 'var(--accent)'`, `color: '#fff'`, `fontWeight: 600`
  - Неактивная: `transparent`, `color: 'var(--muted)'`, hover `color: 'var(--ink)'`
  - Размер: `padding: '4px 10px'`, `borderRadius: '999px'`, `border: '1px solid var(--border)'`
  - Ряд: `display: flex`, `gap: 4`, `flexWrap: 'nowrap'`
  - Файл: `frontend/src/components/asset/SimpleChart.tsx`

<!-- Commit checkpoint 1: задачи 1–3 -->

### Phase 2: Общие UI-компоненты поиска

- [ ] **Задача 4**: `SearchInput` компонент
  - Props: `value, onChange, placeholder?, fullWidth?, className?`
  - Search icon слева (lucide `Search`, 16px, `var(--muted)`), X кнопка справа при `value !== ''`
  - Border `1px solid var(--border)`, borderRadius `12px`, focus/hover → `var(--accent)`
  - `fullWidth` или 220px; mobile (`≤600px`) всегда 100%
  - Файл: `frontend/src/components/ui/SearchInput.tsx`

- [ ] **Задача 11**: `EmptySearchState` компонент
  - Prop: `message?: string` (дефолт: «Ничего не найдено»)
  - Иконка `SearchX` (40px, `var(--soft)`), текст `var(--muted)` 13px
  - Framer Motion: `scale 0.9→1, opacity 0→1`
  - Файл: `frontend/src/components/ui/EmptySearchState.tsx`

<!-- Commit checkpoint 2: задачи 4, 11 -->

### Phase 3: Глобальный поиск — бэкенд и хук

- [ ] **Задача 5**: Бэкенд `GET /api/search?q=...` (зависит от ничего)
  - Новый файл: `backend/app/routes/search.py`
  - Response: `{ assets: AssetResult[], news: NewsResult[] }`, limit 5 каждой группы
  - Assets: фильтровать JSON-снимок активов по symbol/name (ILIKE)
  - News: ILIKE по title/description (переиспользовать логику из `routes/news.py`)
  - Если `q < 2 символов`: вернуть пустые списки (без запросов к БД)
  - Регистрация в `backend/app/main.py`
  - Vite proxy: проверить что `/api` проксируется на `:8000` (уже должно быть)

- [ ] **Задача 6**: Хук `useGlobalSearch` (зависит от задачи 5)
  - 400мс debounce: `useState(rawQuery) + useEffect(setDebounced, 400ms)`
  - `useQuery(['search', debouncedQuery], ..., { enabled: len >= 2, staleTime: 30_000 })`
  - `useMock = true`: возвращать mock-данные при ошибке или отсутствии ключа
  - Файл: `frontend/src/hooks/useGlobalSearch.ts`

<!-- Commit checkpoint 3: задачи 5–6 -->

### Phase 4: Глобальный поиск и таблица рынка

- [ ] **Задача 7**: Глобальный поиск на Dashboard (зависит от задач 4, 6, 11)
  - Определить активный компонент (DashboardHeader vs DashboardTopBar — проверить Dashboard.tsx)
  - Заменить stub на `<SearchInput>` + подключить `useGlobalSearch`
  - Dropdown: секция «Активы» + секция «Новости», клик → navigate
  - Закрытие: клик снаружи (useRef) + Escape
  - Framer Motion: `opacity/y` dropdown, stagger результатов
  - Mobile: dropdown ширина `100vw - 32px`

- [ ] **Задача 8**: Поиск в таблице рынка (зависит от задач 4, 11)
  - `MarketOverview.tsx`: добавить `searchQuery` state + `<SearchInput>`
  - `AssetTable.tsx`: prop `searchQuery?: string`, `useMemo` фильтр по symbol/name
  - EmptyState при `filtered.length === 0`

<!-- Commit checkpoint 4: задачи 7–8 -->

### Phase 5: Полировка существующего поиска

- [ ] **Задача 9**: NewsPage — SearchInput + 400мс + Framer Motion (зависит от задач 4, 11)
  - Заменить input на `<SearchInput>`
  - Debounce: 500мс → 400мс
  - Framer Motion stagger карточек новостей
  - EmptyState при пустом результате

- [ ] **Задача 10**: AddWidgetModal — SearchInput + EmptyState + Framer Motion (зависит от задач 4, 11)
  - Заменить input на `<SearchInput>`
  - EmptyState при `filtered.length === 0`
  - Framer Motion stagger виджетов

<!-- Commit checkpoint 5: задачи 9–10 -->

### Phase 6: Документация

- [ ] **Задача Docs**: обязательный чекпойнт `/aif-docs` после завершения всех задач
  - Обновить `docs/` с описанием новых компонентов `SearchInput`, `EmptySearchState`
  - Задокументировать `useGlobalSearch` и эндпоинт `/api/search`
