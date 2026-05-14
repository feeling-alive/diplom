# DnD + Виджеты — статус

## ✅ Что сделано

### Система виджетов (Dashboard.tsx)
- GridLayout 4 колонки, react-grid-layout
- 11 типов виджетов из WIDGET_REGISTRY
- Добавление через модалку (клик или drag)
- Resize за край с овальным SizeIndicator
- Карусель страниц со стрелками и точками

### DnD (Dashboard.tsx)
- `compactType="vertical"` + `preventCollision={true}`
- Виджеты раздвигаются анимированно как на iPhone
- Drag только в Edit Mode (`isDraggable={isEditMode}`)
- `isDraggingRef` защищает layout от записи во время драга

### Модалка (AddWidgetModal.tsx)
- Центрированная, spring-анимация
- Поиск (oval Apple-style)
- WidgetPreview — реальные виджеты в уменьшенном виде
- Страницы с прокруткой (стрелки + точки)
- Нет кнопки «Добавить» — клик по карточке = add
- Размер контейнера фиксированный, содержимое scale

### API / Данные
- `src/data/prices.json` — единый JSON со всеми ценами (46 активов)
- `usePrices()` — загружает JSON, API обновляет поверх
- Vite proxy: `/api/finnhub`, `/api/news`, `/api/forex` (без CORS)
- OKX: 1252+ крипто-тикера, Frankfurter: 29 forex пар, Finnhub: 10 stocks
- Обновление каждые 15 секунд + jitter

### Сторонние хуки
- `useNews` → NewsAPI с fallback на mock
- `useStockPrice` → Finnhub с 60s polling + mock fallback
- `useForexRate` → Frankfurter (однократный fetch)
- `useAssetPrice` → OKX WS (crypto) + Finnhub (stock) + Frankfurter (forex)
- `useGroqChat` → Groq AI

### Чистка проекта
- Удалены старые .jsx компоненты (analytics, charts, revenue, ui, icons, data)
- Удалены main.jsx, App.css, i18n.js, format.js
- Удалены лишние .md файлы из корня (9 шт)
- index.html → main.tsx

### Роутинг (App.tsx)
- Исправлен на layout route с `<Outlet />` вместо вложенного `<Routes>`
- Все страницы работают.

### Тесты
- 48 тестов, 9 файлов — все проходят
- WidgetCard, SizeIndicator, Dashboard

## ❌ Что не работает / недоделано

1. **«Активы» в сайдбаре** — ведёт на `/assets`, такого роута нет
2. **Настройки (шестерёнка)** — декоративная кнопка, без onClick
3. **useForexRate** — нет интервала обновления (один fetch)
4. **useAssetPrice WS** — нет реконнекта при обрыве WebSocket
5. **Виджеты не все подвязаны на `usePrices`** — некоторые используют `MOCK_PRICES` напрямую
6. **Цены мигают** — сначала JSON, потом API (миллисекунды, но есть)
7. **Страница `/assets`** — нет списка всех активов

## 📁 Какие файлы меняли

### Изменённые
| Файл | Что |
|------|-----|
| `src/pages/Dashboard.tsx` | GridLayout, DnD, carousel, swap |
| `src/pages/Dashboard.test.tsx` | тесты |
| `src/App.tsx` | layout route с Outlet |
| `src/index.css` | Apple-style, DnD, resize corner, отступы |
| `src/components/dashboard/WidgetCard.tsx` | экспорт renderWidgetContent, размеры |
| `src/components/dashboard/AddWidgetModal.tsx` | полная переработка |
| `src/components/dashboard/DashboardHeader.tsx` | apple search |
| `src/components/layout/AppSidebar.tsx` | AI Чат, Sparkles |
| `src/hooks/useNews.ts` | ENV + mock fallback |
| `src/hooks/useStockPrice.ts` | ENV + 60s |
| `src/hooks/useForexRate.ts` | ENV |
| `src/hooks/useAssetPrice.ts` | ENV + OKX WS |
| `src/hooks/useGroqChat.ts` | ENV |
| `src/components/dashboard/WatchlistPanel.tsx` | usePrices + formatPrice |
| `src/components/dashboard/widgets/TopMoversWidget.tsx` | usePrices |
| `src/components/dashboard/widgets/MarketVolumeWidget.tsx` | usePrices |
| `src/components/dashboard/widgets/TrendingCoinsWidget.tsx` | usePrices |
| `src/components/dashboard/widgets/FearGreedWidget.tsx` | — |
| `src/components/dashboard/widgets/ForexRatesWidget.tsx` | — |
| `src/mock/prices.mock.ts` | переписан на импорт из prices.json |
| `vite.config.ts` | proxy для API |
| `.env` | proxy paths |
| `tsconfig.json` | убран ignoreDeprecations |
| `index.html` | main.jsx → main.tsx |
| `README.md` | обновлён |

### Созданные
| Файл | Что |
|------|-----|
| `src/data/prices.json` | единый JSON с 46 активами |
| `src/components/dashboard/SizeIndicator.tsx` | овальное окно с размерами |
| `src/components/dashboard/WidgetPreview.tsx` | превью виджета в модалке |
| `src/hooks/usePrices.ts` | центральный хук цен |
| `src/utils/format.ts` | formatPrice, formatChange и т.д. |
| `src/lib/env.ts` | централизованный ENV |
| `src/pages/ChatPage.tsx` | AI чат |
| `docs/widgets.md` | документация |
