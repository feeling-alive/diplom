# План реализации: Приведение кода FinTrack в соответствие с пояснительной запиской (5 задач)

Branch: master (ветка не создаётся — git.create_branches=false)
Created: 2026-06-20

## Settings
- Testing: yes  — после каждой задачи прогон тестов (backend: pytest; frontend: npm run test), отчёт в конце
- Logging: verbose (DEBUG, формат `[ИмяМодуля] ...` / `console.debug('[Component] ...')`)
- Docs: yes — обязательный docs-чекпоинт в /aif-implement (обновить `.ai-factory/DESCRIPTION.md` и docs/ по изменённым модулям)

## Roadmap Linkage
Milestone: "none"
Rationale: `.ai-factory/ROADMAP.md` отсутствует — линковка пропущена.

## Жёсткие ограничения (из промта)
- **ЗАПРЕЩЕНО** менять обученную модель PatchTST, `app/ml/scaler.pkl` и размерность входа **60×11**.
  ATR(14) и Z-оценку объёма (задача 1) подавать **только в LLM-контекст**, НЕ в `FEATURE_ORDER`/`build_feature_matrix`.
- Никаких новых зависимостей для индикаторов (чистый Python). Новые внешние зависимости допускаются
  только там, где явно указано: `yfinance` (задача 2).
- TradingView-модал (iframe) не трогать.
- Сохранять контракт ответа свечей `{symbol, timeframe, candles:[{t,o,h,l,c,v}], source}`, Redis-кэш с TTL,
  graceful-degradation (fallback на mock).

## Ключевые находки разведки
- `services/features.py` — индикаторы на чистом Python (`_rsi/_macd/_bollinger`), есть `extract_ohlcv`
  (high/low/close/volume доступны) → ATR и Z-объём встают по тому же паттерну.
- `services/candles.py` — детект `_is_stock_symbol` = отсутствие `-`. **Проблема:** форекс-символы тоже
  с дефисом (`EUR-USD`, `USD-JPY`, см. `frontend/src/data/prices.json`), т.е. сейчас форекс уходит в OKX →
  падает → mock. Нужен детект по набору фиатных валют.
- Лимит ИИ в `routes/chat.py POST /message` **сейчас не enforced** — он жил только в feature-matrix
  `subscription.py`. Удаляя подписку, лимит нужно реализовать заново (Redis 30/мин), иначе требование ПЗ
  «ограничение числа обращений к ИИ» будет потеряно.
- `Subscription`/`SubscriptionPlan` используются в: `models.py`, `auth/router.py` (register + google_callback),
  `routes/admin.py` (КРУПНО — статистика premium, фильтр/PATCH плана, create-user), `routes/profile.py`
  (`SubscriptionInfo` в `ProfileResponse` → контракт `/users/me`). `services/news_fetcher.py` и
  `services/coingecko.py` **НЕ** трогать (ложное срабатывание grep на `429`).
- **Свежая (некоммиченная) админ-панель** завязана на план: фронт `useAdminUsers`/`useAdminStats`/`adminApi`/
  `AdminPanelPage` (`subscription_plan`, `active_premium`, `expiring_soon`) → отдельная задача 11.
- Тесты завязаны на модель: `test_models_metadata.py` ассертит таблицу `"subscriptions"` и enum
  `subscription_plan`; `test_admin.py`/`test_profile.py` — план/премиум. Все требуют правок.
- Alembic: `subscription_plan` — Postgres ENUM-тип; миграция дропает **и таблицу, и тип**, `down_revision` = head.
- **Конфликт промта с кодом:** задача 3 промта писалась до админ-панели и её не упоминает; решение —
  удалить только premium/plan-части админки, сохранив управление ролью и блокировкой.
- `usePersonalized.ts` — real-ветка возвращает `[]` (заглушка); дефолт `useMock=true`.
- Сброс пароля сейчас token-флоу (`password_reset:{token}` + ссылка `/reset-password?token=...`).

## Commit Plan
- **Commit 1** (задачи 1-2): `feat(ai): ATR(14) и Z-оценка объёма в контекст ИИ-ассистента`
- **Commit 2** (задачи 3-4): `feat(charts): реальные свечи для акций (yfinance) и форекса (Frankfurter)`
- **Commit 3** (задачи 5-7, 11): `refactor(billing): удалить подписку, тихий Redis-лимит ИИ 30/мин (429)`
- **Commit 4** (задача 8): `feat(dashboard): реальные данные в персонализированной панели`
- **Commit 5** (задачи 9-10): `feat(auth): сброс пароля по 6-значному коду вместо ссылки`

## Tasks

### Фаза 1 — ЗАДАЧА 1: ATR и Z-оценка объёма в ИИ-ассистента
- [x] Task 1: ATR(14) + Z-оценка объёма в `services/features.py` (чистый Python, length-preserving, тесты)
- [x] Task 2: `atr`/`volume_zscore` в `indicator_details` (`patchtst.py`) и блок «Индикаторы» промта (`chat.py`) — *(depends on 1)*
<!-- Commit checkpoint: задачи 1-2 -->

### Фаза 2 — ЗАДАЧА 2: React-графики для акций и форекса
- [x] Task 3: `services/candles.py` — детект crypto/forex/stock, yfinance (акции) + Frankfurter /timeseries (форекс), кэш+TTL, mock-fallback; `yfinance` в requirements
- [x] Task 4: Проверка фронта — `useOHLCV` source-union, SimpleChart/PriceChartWidget рисуют реальные свечи для всех типов — *(depends on 3)*
<!-- Commit checkpoint: задачи 3-4 -->

### Фаза 3 — ЗАДАЧА 3: убрать подписку, оставить тихий лимит ИИ
- [x] Task 5: Redis-лимит 30 запросов/мин на пользователя в `chat.py POST /message` → 429, fail-open при недоступности Redis, лимит в `config.py`
- [x] Task 6: Удалить подписку на бэкенде — model/enum/relationship, `subscription.py`, переработка `admin.py` (убрать premium/plan, оставить роль/блок) и `profile.py` (убрать `SubscriptionInfo`), Alembic drop table+enum, правка backend-тестов (`test_models_metadata`/`test_admin`/`test_profile`) — *(depends on 5)*
- [x] Task 7: Удалить потребительский subscription/premium UI на фронте (SubscriptionPage/PremiumModal/SubscriptionCard/useSubscription, маршрут, sidebar, ProfilePage+profileApi/useProfile, Dashboard) + обработать 429 в чат-UI — *(depends on 5, 6)*
- [x] Task 11: Убрать подписку из админ-панели (фронт): `useAdminUsers`/`useAdminStats`/`adminApi`/`AdminPanelPage` — снять plan/premium, оставить роль/блокировку — *(depends on 6)*
<!-- Commit checkpoint: задачи 5-7, 11 -->

### Фаза 4 — ЗАДАЧА 4: реальные данные в персонализированной панели
- [x] Task 8: `usePersonalized.ts` на реальный источник (топ рынка/избранное), `PersonalizedPanel`/`FloatingAssetCards` — реальные данные при USE_MOCK=false
<!-- Commit checkpoint: задача 8 -->

### Фаза 5 — ЗАДАЧА 5: восстановление пароля через код
- [x] Task 9: Бэкенд — 6-значный код в Redis `reset:{email}` TTL 15 мин, письмо с кодом, graceful без SMTP (код в DEBUG-лог); схемы + email-сервис
- [x] Task 10: Фронт — экран email → экран кода+нового пароля, `authApi` `{email, code, new_password}` — *(depends on 9)*
<!-- Commit checkpoint: задачи 9-10 -->

## Финальный отчёт
В конце реализации — по каждой из 5 задач: какие файлы изменены и прошли ли тесты (pytest / npm run test).
