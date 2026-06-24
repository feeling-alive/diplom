# План: Фиксы round 2 (по итогам ручного теста)

**Slug:** fixes-round2
**Дата создания:** 2026-06-24
**Ветка:** не создаётся (`git.create_branches=false`) — работа в текущей ветке `master`
**Источник:** `ПРОМТ_фиксы_round2.md`

## Settings

- **Тесты:** НЕТ (по решению пользователя — только реализация, без тестовых задач)
- **Логирование:** Verbose — `console.debug('[ИмяКомпонента] ...')` во фронте, `logger.info/debug` на бэке (конвенция проекта)
- **Документация:** ДА — обязательный чекпоинт `/aif-docs` после реализации (обновить `DESCRIPTION.md`)
- **Конвенции:** ключи только через `get_api_key` (БД→.env), graceful degradation, не ломать рабочее (Google-вход, тёмная тема, перевод новостей, drag-and-drop). По фазам, после каждой — самопроверка + коммит. В конце — отчёт (файлы, миграции, до/после скриншоты по визуалу).

## Roadmap Linkage

Milestone: "none" — `ROADMAP.md` в проекте отсутствует.

---

## Приоритет

🔴 **Фазы A и C критичны** (корректность данных + админка) → затем 🟡 B/D/E → затем 🟢/🟡 F/G/H (полировка).

---

## Tasks

### Фаза A — 🔴 Корректность данных

**Задача #1 (A1) — Цена металлов без forex-502.**
Металлы (`XAU-USD`/`XAG-USD`) бьют в `/api/quotes/forex/...` → Frankfurter 502 → битая цена (графики при этом верные — yfinance GC=F/SI=F).
- Backend `backend/app/routes/quotes.py`: новый `GET /api/quotes/price/{symbol}`, роутит через `candles.classify_symbol`; для `metal` — последний close из `candles.get_candles`/`_fetch_yfinance` (GC=F/SI=F, `candles[-1].c`); для crypto/stock/forex — существующие источники.
- Frontend `frontend/src/hooks/useAssetPrice.ts`: ветка для металлов (не forex), вызов нового эндпоинта. Проверка: золото ~$2000+, серебро ~$20–30.
- Лог: `logger.info('[quotes] price %s route=%s')`, `console.debug('[useAssetPrice] metal %s price=%s')`.

**Задача #2 (A2) — Единый источник капы/объёма.**
Числа капитализации/объёма расходятся (страница актива vs виджет). Свести всё к `/api/quotes/global` (хук `useGlobalMarket.ts`).
- Использовать `useGlobalMarket` в `GlobalMarketCapWidget`, `MarketVolumeWidget`, `components/asset/MetricsBar.tsx`, `components/market-overview/{MarketSummaryBar,AssetTable}.tsx`.
- Единый компактный формат B/M/T через `utils` (`formatMarketCap`/`formatVolume`).
- Лог: `console.debug` в местах потребления.

**Задача #3 (A3) — Реальный график цены в PriceChartWidget.**
Убрать подмешивание `MOCK_PRICES`. График + цена/изменение из `useOHLCV` + `useAssetPrice`; mock только fallback при ошибке/загрузке.
- Файл: `frontend/src/components/dashboard/widgets/PriceChartWidget.tsx`.
- Лог: `console.debug('[PriceChartWidget] symbol=%s source=real|mock')`.

**Задача #4 (A4) — Починить конвертер валют.**
`CurrencyConverterWidget`: реальные курсы Frankfurter через бэкенд-прокси, корректный двусторонний пересчёт по вводу суммы.
- Файл: `frontend/src/components/dashboard/widgets/CurrencyConverterWidget.tsx`.
- Лог: `console.debug('[CurrencyConverterWidget] %s/%s rate=%s amount=%s')`.

**Задача #5 (A5) — Валюта на оси графика актива.** _(blocked by #3)_
Ось Y и подписи цен в `SimpleChart` (components/asset/) и `PriceChartWidget` пересчитываются в активную валюту через `formatPrice`/`convertFromUsd`.
- Лог: `console.debug` при смене валюты в графике.

### Фаза B — 🟡 Виджеты: замена и раскладка

**Задача #6 (B1) — Замена Кит-трекера/Ликвидаций на 2 реальных виджета.**
Удалить `whale_tracker`/`liquidations` (Demo) из типов/реестра/превью/рендера (как `CommunityWidget`): `types/widgets.types.ts` (стр. 24, 27), `constants/widgets.registry.ts`, `WidgetPreview.tsx`, `WidgetCard.tsx`, файлы `WhaleTrackerWidget.tsx`/`LiquidationsWidget.tsx`. `clampWidgets` отбросит осиротевшие типы.
Добавить ДВА не-ИИ виджета: «Доминирование BTC» (`/api/quotes/global` btc dominance, `useGlobalMarket`) и «Трендовые монеты» (новый прокси CoinGecko `/search/trending` в `services/coingecko.py` + роут в `quotes.py` + Redis, фронт-хук + виджет). Проверить существующие `DominanceChartWidget`/`TrendingCoinsWidget` — задействовать/доработать вместо дублей.
- Лог: `logger.info` (бэк), `console.debug` (фронт).

**Задача #7 (B2) — Раскладка «Тикер активов».**
Символ: `ellipsis` + `flexShrink:1`/`minWidth:0`; цена `flexShrink:0`. Проверить ВСЕ пресеты размеров (3×1, 2×1 и т.д.).
- Файл: виджет тикера в `frontend/src/components/dashboard/widgets/`.

**Задача #8 (B3) — Кнопка «Все →» в Воч-листе.**
`useNavigate` на обзор рынка/полный список избранного. Файл: компонент воч-листа в `components/dashboard/`.
- Лог: `console.debug('[Watchlist] navigate to all')`.

**Задача #9 (B4) — Реальные данные + подписи Фандинг/Gas/Корреляция.**
Проверить реальность данных (`/api/quotes/funding-rate`, `/api/quotes/gas`, корреляция из свечей). Добавить короткие подписи/тултипы: фандинг = ставка финансирования перпов; gas = цена газа ETH в gwei; корреляция = матрица совместного движения цен (1..−1).
- Файлы: `FundingRateWidget`, `GasTrackerWidget`, `CorrelationMatrixWidget`.
- Лог: `console.debug` источника данных.

### Фаза C — 🔴 Админка

**Задача #10 (C1) — Персист API-ключей (save→reload→использование).**
Бэк (`routes/admin.py`) выглядит корректно. Найти корневую причину:
1. Фронт `pages/AdminPanelPage.tsx` — не отправляет ли маскированный placeholder обратно как значение (перезапись мусором / фильтр пустого).
2. Uniqueness-constraint на `ApiKey.service` (нужен для `on_conflict_do_update`) — проверить `models.py`/миграции.
3. Полный путь save→reload (маскированный ключ в placeholder)→использование (`get_api_key`, сброс кэша).
- Лог: расширить debug (что отправляет фронт / что сохранил бэк).

**Задача #11 (C2) — Отображение ответов на комментарии.** 
Убедиться, что `routes/news.py` реально возвращает вложенные `replies` (CommentOut). Фронт `pages/NewsArticlePage.tsx`: рендер ответов под родителем с отступом + реакции.
- Лог: `console.debug('[NewsArticlePage] comment %s replies=%d')`.

### Фаза D — 🟡 Уведомления

**Задача #12 (D1) — Авто-очистка уведомлений при заходе.** ВОТ ОТ СЮДА ПРОДОЛЖАЙ!!!!!
После авторизации один раз вызвать `POST /api/notifications/read-all`, чтобы счётчик обнулялся каждый визит. Идемпотентно (раз на сессию/маунт).
- Файлы: `hooks/useNotifications.ts` + точка вызова после auth (`context/AuthContext.tsx` / layout при `isAuthenticated`).
- Лог: `console.debug('[notifications] auto-clear on app load')`.

### Фаза E — 🟡 Производительность

**Задача #13 (E1) — Снизить шторм запросов на маунте дашборда.**
Дедуп/кэш через QueryClient (`staleTime`), ограничить параллелизм (батчинг цен через `/api/quotes/stocks`), ленивая подгрузка тяжёлых виджетов вне вьюпорта (IntersectionObserver/React.lazy).
- Файлы: QueryClient config (`main.tsx`/lib), `hooks/use*.ts`, `components/dashboard/WidgetCard.tsx`/grid.
- Лог: `console.debug` счётчика активных запросов / lazy mount.

### Фаза F — 🟢 Тема и мелочи UI

**Задача #14 (F1) — Улучшить тёмную тему.**
Подкрутить `html[data-theme="dark"]` в `frontend/src/index.css` (сине-чёрный фон, контраст текста, мягкие границы). Не ломать светлую тему. До/после скриншоты.

**Задача #15 (F2) — Видимый «+» на «добавить дашборд».**
Поправить иконку/контраст (lucide `Plus`). Найти в `components/dashboard/` (add page) или `DashboardHeader`. До/после скриншот.

### Фаза G — 🟡 ИИ-чат и тексты

**Задача #16 (G1) — Убрать «FinTrack» из ответов ИИ.**
`backend/app/routes/chat.py` (`_build_system_prompt`) — нейтральное «ассистент», не ломая структуру промта/гибридный сигнал.

**Задача #17 (G2) — Убрать «FinTrack» из письма восстановления.**
`backend/app/services/email.py` (тема + HTML). Проверить прочие упоминания бренда в письмах.

**Задача #18 (G3) — Новые быстрые блоки в ИИ-чате.**
Заменить «Тренды рынка/Обучение/Аналитика/Риски» на «Свежие новости», «Растущие активы», «Падающие активы» + один полезный («Индекс страха и жадности»/«Обзор рынка»). Каждая кнопка шлёт осмысленный запрос.
- Файл: `pages/ChatPage.tsx` (и/или `components/asset/AIPanel.tsx`).
- Лог: `console.debug('[ChatPage] quick block %s')`.

**Задача #19 (G4) — Статичный placeholder в поле чата.**
Убрать анимированный «печатающийся» текст, один статичный текст-подсказку. Файл: `pages/ChatPage.tsx`.

### Фаза H — 🟡 UI восстановления пароля

**Задача #20 (H1) — UI ввода кода в 6 полей.**
Стиль референса (Polza): «Код из письма», подпись «Отправили на &lt;email&gt;», 6 квадратных полей (авто-переход, paste, backspace-навигация), ссылка «← Вернуться к входу». Бэкенд готов — менять только UI: `pages/ResetPasswordPage.tsx`, `ForgotPasswordPage.tsx`. До/после скриншот.
- Лог: `console.debug('[ResetPasswordPage] code entered len=%d')`.

---

## Commit Plan

После каждой фазы — самопроверка + коммит (conventional commits):

1. `fix(quotes):` цена металлов без forex-502 + единый источник капы/объёма (страница=виджет) — **#1, #2**
2. `fix(widgets):` реальный график цены, рабочий конвертер валют, валюта на оси графика — **#3, #4, #5**
3. `feat(widgets):` замена кит-трекера/ликвидаций на доминирование BTC + трендовые монеты; фикс раскладки тикера; кнопка «Все» воч-листа; подписи фандинг/gas/корреляция — **#6, #7, #8, #9**
4. `fix(admin):` персист API-ключей (save→reload→использование) + отображение ответов на комментарии — **#10, #11**
5. `feat(notifications):` авто-очистка при заходе на сайт — **#12**
6. `perf(dashboard):` снижение шторма запросов и подвисаний — **#13**
7. `feat(ui):` улучшенная тёмная тема + видимый «+» на добавлении дашборда — **#14, #15**
8. `feat(chat):` убрать упоминания FinTrack, новые быстрые блоки, статичный placeholder; письмо без FinTrack — **#16, #17, #18, #19**
9. `feat(auth):` UI ввода кода восстановления в 6 полей (как референс) — **#20**

**Docs-чекпоинт (обязательный):** после реализации обновить `.ai-factory/DESCRIPTION.md` через `/aif-docs` (новый эндпоинт `/api/quotes/price`, прокси trending, удаление whale/liquidations виджетов, авто-очистка уведомлений, перф-меры, тема).
