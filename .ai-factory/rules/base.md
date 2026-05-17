# Базовые правила проекта FinTrack

> Автоматически собранные конвенции на основе анализа кодовой базы. Редактируй по мере развития проекта. Дизайн-правила (палитра, типографика, радиусы) живут в `.ai-factory/RULES.md` и имеют приоритет.

## Соглашения по именованию

- **Файлы компонентов:** `PascalCase.tsx` (например, `AssetHeader.tsx`, `DashboardHeader.tsx`)
- **Файлы хуков:** `useCamelCase.ts` (`useAssetPrice.ts`, `useGroqChat.ts`)
- **Утилиты / mock / types / lib:** `kebab-case.ts` или `lowercase.ts` (`format.ts`, `prices.mock.ts`, `market.types.ts`)
- **Тесты:** рядом с файлом или в `__tests__/`, имя `<Subject>.test.tsx`
- **Переменные / функции:** `camelCase`
- **Компоненты / типы / интерфейсы:** `PascalCase`
- **Константы-объекты реестра:** `SCREAMING_SNAKE_CASE` (`WIDGET_REGISTRY`, `SYMBOL_TO_COIN_ID`)

## Структура модулей

- `src/pages/` — страницы-роуты, по одной на путь
- `src/components/<feature>/` — компоненты, сгруппированные по фиче (`dashboard/`, `market-overview/`, `asset/`, `layout/`)
- `src/components/dashboard/widgets/` — конкретные виджеты дашборда
- `src/hooks/` — один файл на источник данных, всегда возвращает `{ data, isLoading, error }`
- `src/types/` — только типы (`market.types.ts`, `widgets.types.ts`), без логики
- `src/mock/` — fallback-данные, используются когда `useMock=true` или внешний API недоступен
- `src/utils/` — чистые функции форматирования / преобразования
- `src/lib/` — обвязки внешних библиотек / env-конфиг
- `src/config/`, `src/constants/`, `src/data/` — статичные конфигурации, JSON-снимки

Запрещено создавать новые файлы в корне `src/` кроме точек входа (`main.tsx`, `App.tsx`, `index.css`, `vite-env.d.ts`).

## TypeScript

- **Strict mode + `@typescript-eslint/no-explicit-any: error`** — никаких `any` (ни явно, ни через каст). Используй `unknown` + сужение типов.
- **Все props компонентов типизированы** через интерфейс или type alias.
- **Хуки декларируют возвращаемый тип** (вывод TS допустим, если очевидно).
- Никаких файлов `.jsx` — Vite при наличии `.jsx` и `.tsx` под одним именем тихо берёт `.jsx`; удалять `.jsx` сразу при миграции.

## React-конвенции

- **Функциональные компоненты + хуки**, классов нет.
- **`useMock?: boolean = true`** — обязательный опциональный аргумент в каждом data-хуке, позволяет разработке без ключей API.
- **Empty state** — каждый компонент должен корректно рендериться при `data === null/undefined/[]` (placeholder или скелетон).
- **NavLink с `to="/"`** всегда с `end`-prop, иначе матчит все пути.

## Обработка ошибок

- Каждый хук ловит ошибки внешнего API и возвращает `{ data: null|fallback, isLoading: false, error }`.
- При ошибке внешнего API — fallback на mock-данные с логированием (`console.warn('[useFoo] API failed, using mock', err)`).
- Никаких `throw` из хуков в render.

## Логирование

- **`console.debug('[ИмяКомпонента] сообщение', ...args)`** — verbose-логи, обязательная конвенция. Префикс в квадратных скобках — имя компонента / хука.
- `console.warn(...)` — для fallback и нештатных, но не критических ситуаций.
- `console.error(...)` — только при действительно сломанной операции (которую не получилось скрыть fallback'ом).
- Не использовать `console.log` в коммитах.

## Тестирование

- **Vitest 4 + React Testing Library + jsdom** (`src/test-setup.ts`).
- Тесты компонентов с навигацией оборачивать в `MemoryRouter` либо мокать `react-router-dom` (`useNavigate: () => () => undefined`).
- `getByRole('heading', {name})` вместо `getByText` для `<h1>`, чтобы не пересекаться с `<NavLink>` той же подписи.
- `getAllByText(...).length >= 1` когда текст ожидается в нескольких блоках.

## Иконки и эмодзи

- **lucide-react только** для иконок.
- **Никаких emoji в production-коде**. (Допустимо в комментариях / commit-сообщениях / документации.)

## Анимация

- **Framer Motion** — для page entrance, stagger карточек, hover-эффектов, floating-карточек.
- В motion-пропсах использовать `backgroundColor`, не `background` (`background` ломает строгий TS — TS2590 "union type too complex").

## react-grid-layout

- `preventCollision={false}` + `compactType="vertical"` — обязательно для iPhone-style свободного DnD.
- `minW/maxW/minH/maxH` указывать на каждом элементе layout (не только в реестре виджетов) — иначе ручки ресайза не блокируются на границе.
- Чтобы зафиксировать одну ось — установить `minX === maxX` (KPI strip всегда 1 строка, watchlist всегда 2 колонки).
- При изменении схемы реестра — бамп версии ключа `localStorage` + удаление legacy-ключей в `loadWidgets()`.

## Recharts

- `ResponsiveContainer` требует, чтобы у родителя была явная высота в px (или `flex:1; min-height:0` внутри flex-колонки). В превью/модалках задавать фиксированную px-высоту.

## Графики на странице актива

- **lightweight-charts v5:** `chart.addSeries(CandlestickSeries, options)` (не `chart.addCandlestickSeries()` — удалено в v5). `PricePoint.timestamp` — миллисекунды, делить на 1000 перед передачей в `Time`. Сортировать данные по возрастанию перед `setData()`.

## Windows shell

- В Bash-инструменте использовать `rm <path>`, а не `del` (CMD-only).
- Пути в коде — POSIX (`src/foo/bar.ts`), не `\`.
