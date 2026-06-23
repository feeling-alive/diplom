# План: исправления после ручного тестирования (OAuth, ключи, новости, графики, чат, комментарии)

**Тип:** fix/feat (backend + frontend)
**Режим:** Full (ветка не создавалась — `git.create_branches: false`)
**Ветка:** master
**Дата:** 2026-06-23
**Источник требований:** `promt.md` (ФАЗА 1–4, факты сверены по коду)

> Это новый раунд исправлений после ручного тестирования. Часть задач пересматривает прошлые
> фиксы новыми диагнозами (Google OAuth → Вариант A вместо proxy-origin; перевод новостей →
> не-застревание + ретрай 429; аудит активов/графиков). Прошлый план
> `bugfix-after-manual-testing.md` завершён ([x]).

## Настройки

- **Тесты:** да — для критичных backend-изменений (OAuth-callback, резолвер API-ключей,
  надёжность перевода новостей). Остальное (графики, чат, комментарии) — ручная проверка/скриншоты.
- **Логирование:** verbose — `logger.debug('[module] ...')` на бэкенде, `console.debug('[Component] ...')`
  на фронте (обязательное соглашение проекта).
- **Документация:** warn-only (без обязательного чекпоинта); после каждой фазы — короткий отчёт.
- **Приоритеты из промта:** 🔴 блокеры (Фазы 1–2), 🔴/🟡 (Фаза 3), 🟡 (Фаза 4).

## Roadmap Linkage

- **Milestone:** none
- **Rationale:** `.ai-factory/ROADMAP.md` отсутствует — линковка неприменима.

## Контекст (сверено по коду)

- **1.1** `backend/app/auth/router.py` — `google_callback` (286-363) сейчас отдаёт `RedirectResponse`
  (307) c `_set_auth_cookie` на редиректе → браузер не закрепляет cookie с проксированного 307.
  Email/пароль-вход ставит cookie на 200 (97/121) и работает. Импорт `RedirectResponse` :16.
- **1.2** `backend/app/routes/admin.py` — `decrypt_value/encrypt_value/mask_value` (:46);
  `get_api_keys` (484, **уже** маскирует реальные ключи из БД), `save_api_keys` (508),
  `test_api_key` (557). Сервисы читают ключи из settings/.env → смена в панели ни на что не влияет.
  ⚠️ `test_api_key` СЕЙЧАС НЕ принимает введённый ключ (нет тела запроса) и при отсутствии строки в
  БД сразу возвращает «Ключ не сохранён» без фоллбэка на .env. DB service-имена (`groq`/`finnhub`/
  `newsapi`/`openrouter`) НЕ совпадают с settings-атрибутами (`*_api_key`/`news_api_key`) — нужен маппинг.
- **2.1** `backend/app/services/news_fetcher.py` — `process_article_with_ai` (266) помечает
  `ai_processed=True` (`_mark_processed`:343) даже при сбое провайдеров (:297); `_openrouter_complete`
   retry-429 УЖЕ есть (:197-219: max_retries=2, sleep 5s) — зеркалить в `_groq_complete` (229);
  `reenrich_unprocessed(limit)` (324) фильтрует только `title_ru IS NULL`; concurrency =
  `asyncio.Semaphore(3)` (:44) + `asyncio.sleep(1)` throttle (:169). Перевод: OpenRouter→Groq.
- **3.1** `backend/app/services/candles.py` — `classify_symbol` (:68): forex только если ОБА сегмента
  фиат; `XAU`/`XAG` не фиат → `XAU-USD`/`XAG-USD` классифицируются как **crypto** → OKX (нет пары) →
  крипто-**mock** (:118), т.е. металлы показывают ЧУЖОЙ mock. stock=yfinance робастный (`Ticker.history`
  + `download()` fallback :175-207). `prices.json` — 47 активов; тикеры: `MATIC-USDT`→POL,
  `FTM-USDT`→Sonic/S; `JNJ`/`PG` — проверить передачу символа/маппинг (источник ок).
- **4.1** `backend/app/routes/chat.py` — `link_cards: list[LinkCard]` (72); бэкенд УЖЕ собирает ВСЕ
  карточки `[LinkCard(**c) for c in raw_cards]` (:679) и персистит (:700-705) — обрезки до одной НЕТ.
  «Несколько блоков» = фронт-рендер списка + фан-аут `_tool_search_news` (:670). tool calling уже есть.
- **4.3** `frontend/src/pages/NewsArticlePage.tsx` — `CommentOut.replies` приходят с бэкенда;
  реакции like/dislike для реплаев уже в БД.

## Задачи

### Фаза 1 — 🔴 Авторизация и ключи (блокеры)

- [x] **1.1** Google OAuth: cookie через `HTMLResponse(200)` + JS-редирект `window.location.replace('/')`,
  `_set_auth_cookie` на 200-ответ; атрибуты cookie не менять; email/пароль не трогать — `auth/router.py` (+ тест)
- [x] **1.2** Резолвер `get_api_key(service)` БД→.env (тихий фоллбэк, маппинг service→settings-атрибут,
  in-memory кэш со сбросом в `save_api_keys`); подключить в `groq_service`/`finnhub`/`news_fetcher`;
  `test_api_key` — добавить body `{key?}` (введённый ключ, при пустом — резолвенный); фронт
  `AdminPanelPage.tsx` слать введённый/пустой ключ — `admin.py` + сервисы + фронт (+ тест)

### Фаза 2 — 🔴 Новости: надёжность перевода

- [x] **2.1** Не помечать `ai_processed` при сбое провайдеров (но «нет ключей»/парс-ошибку — можно);
  поле `enrich_attempts` + alembic-миграция (N=3); зеркалить retry-429 `_openrouter_complete`→`_groq_complete`;
  фильтр `enrich_attempts<N` в `reenrich`/доборе; фоновый `reenrich_unprocessed()` в `lifespan`;
  снизить burst-429 (`Semaphore(3)→2`); ключи через резолвер 1.2 — `news_fetcher.py`/`models.py`/`main.py` (+ тест)
  *(blockedBy 1.2)*

### Фаза 3 — 🔴/🟡 Графики и активы

- [x] **3.1** Аудит всех активов `prices.json`: рабочий источник свечей + валидный TradingView-символ;
  **металлы** — поправить `classify_symbol` (XAU/XAG сейчас → crypto/OKX → крипто-mock) + реальный источник
  (yfinance `GC=F`/`SI=F`); JNJ/PG — проверить маппинг символа; мёртвые тикеры (MATIC→POL, FTM→актуальный)
  — `prices.json`/`candles.py`/TradingView-маппинг
- [x] **3.2** Sparkline в обзоре рынка = график актива (единый источник OHLCV) — `market-overview/*`/`useOHLCV`
  *(blockedBy 3.1)*

### Фаза 4 — 🟡 ИИ-чат и комментарии

- [x] **4.1** ИИ-чат: несколько блоков/карточек — бэкенд уже собирает все (chat.py:679); фокус на
  фронт-рендере списка `link_cards` + фан-аут `_tool_search_news`; свежие новости через `search_news` — `chat.py`/фронт ленты
- [x] **4.2** Формат процентов изменения в ответах ИИ = формат UI страницы актива — `chat.py`/`groq_service`/форматтер UI
- [x] **4.3** Комментарии: отображение `replies` (вложенно) + переход/якорь к комментарию; реакции на реплаях — `NewsArticlePage.tsx`

## Зависимости

- **2.1** — после **1.2** (обе правят чтение ключей в `news_fetcher`; 2.1 использует резолвер из 1.2).
- **3.2** — после **3.1** (общий источник свечей).
- Остальные задачи независимы; выполнять по порядку фаз (промт требует порядок + самопроверку после каждой фазы).

## План коммитов (чекпоинты)

1. `fix(auth): Google OAuth cookie через 200+JS-redirect (Вариант A)` — после 1.1
2. `feat(admin): API-ключи из БД с фоллбэком на .env, маскированное отображение, рабочие тесты` — после 1.2
3. `feat(news): надёжный перевод (ретрай/не-застревание) + дообогащение при старте` — после 2.1
4. `fix(charts): аудит активов, рабочие Recharts для всех классов, актуальные тикеры + единый sparkline` — после 3.1, 3.2
5. `feat(chat): несколько блоков/свежие новости + формат процентов как на активе` — после 4.1, 4.2
6. `feat(comments): отображение ответов и переход к комментарию` — после 4.3

> После каждой фазы — короткий отчёт: изменённые файлы, миграции, результат тестов, до/после
> по визуальным правкам (графики, чат, комментарии; тёмная тема не должна быть задета).
