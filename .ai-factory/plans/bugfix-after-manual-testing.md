# План: Исправления багов FinTrack (после ручного тестирования)

**Источник:** `ПЛАН_исправлений_багов.md`
**Дата создания:** 2026-06-21
**Ветка:** master (ветка не создавалась — `git.create_branches: false`)
**Режим:** Full

> Приоритеты из записки: 🔴 блокер для защиты · 🟡 заметно · 🟢 косметика.
> «Тестирование» в ПЗ = ПМИ + протокол, поэтому unit-тесты пишутся только для критичных багов (для собственной уверенности), не для всех задач.

## Settings

- **Testing:** только для критичных багов (backend: auth/cookie, candles, news enrichment, история чата, реакции комментариев). Остальное — ручная проверка (ПМИ).
- **Logging:** verbose — `console.debug('[Component] ...')` на фронте и `logger.debug('[module] ...')` на бэкенде (обязательное соглашение проекта).
- **Docs:** warn-only — без обязательного чекпоинта документации (`WARN [docs]`).

## Roadmap Linkage

- **Milestone:** none
- **Rationale:** `.ai-factory/ROADMAP.md` отсутствует — линковка пропущена.

## Контекст (проверено по коду; уточнено в /aif-improve)

- **#1** `backend/app/auth/router.py:271,304` — `redirect_uri` использует `{settings.backend_url}` → cookie на :8000. Подтверждено.
- **#2** ⚠️ Уточнено: StrictMode-гард (`fetchingRef`) и init-эффект без `clearUser` УЖЕ есть в `AuthContext.tsx`. Корень — `authApi.ts:86 apiMe()`: возвращает `null` и для 401, и для network/5xx (стр.88-92), сетевой сбой пробрасывается → `refresh()` (стр.99) и init (стр.141) сбрасывают юзера. Фикс — разделить 401 vs network в `apiMe()` и сохранять юзера на network-ошибках.
- **#6** `backend/app/services/candles.py:254-257` — при любой ошибке yfinance тихий fallback на `_mock_candles` (крипто-mock, символ-агностичный). Подтверждено.
- **#11.1** `backend/app/routes/chat.py` — есть `/predict`, `/message`, `/save`; GET/DELETE `/chat/history` отсутствуют. `useGroqChat.ts:27` стартует с `messages=[]`, `clear()` чистит только локальный стейт. Подтверждено.
- **#11.3** ⚠️ Уточнено: `groq_service.py:31 get_groq_response` возвращает plain `str` и не передаёт `tools`; `ChatResponse` (`chat.py:58`) = `reply`+`prediction`. Нужно расширить оба под tool calling + `link_cards[]`.
- **#9** ⚠️ Уточнено: `Comment.likes` Integer (`models.py:150`) без привязки к юзеру; есть ГОТОВЫЙ шаблон — `react_to_article` toggle (`news.py:417`) + `NewsReaction` (`models.py:228`). Текущий баг — endpoint `like_comment` (`news.py:394`). Комментарии живут в `news.py` (keyed by `article_url`), есть вложенные `replies` (`CommentOut.replies`) — реакции считать и для них.
- **#5** `backend/app/services/news_fetcher.py` — enrichment через `OPENROUTER_API_KEY`, пропускается при отсутствии ключа/ответа. Подтверждено.
- **#4** ⚠️ Уточнено: отдельного сообщения ассистента нет — «авто-сообщение» это приветственный empty-state блок в ветке `messages.length === 0` (`ChatPage.tsx:111`, `AIPanel.tsx:111`). Убрать блок, placeholder оставить.
- **#3** `admin.py` comments уже пагинирован (`page/limit`, default 20) → фронту нужна UI-пагинация; stats расширить метриками.

---

## Tasks (по фазам)

### Фаза 1 — Авторизация и сессия (🔴 блокеры)
- [x] **#1** Google OAuth: cookie через proxy-origin фронта — `backend/app/auth/router.py` (+ тест)
- [x] **#2** Не выкидывать из аккаунта при reload/StrictMode — `AuthContext.tsx` *(blockedBy #1)*

### Фаза 2 — Рыночные данные (🔴/🟡)
- [x] **#6** Акции: реальные свечи yfinance + убрать тихий mock-fallback + единый источник цены — `candles.py`/`quotes.py` (+ тест)
- [x] **#7** Sparkline = график актива (один источник OHLCV) — `AssetTable`/`SimpleChart`/`useOHLCV` *(blockedBy #6)*

### Фаза 3 — Новости (🔴)
- [x] **#5-backend** Чинить enrichment (OpenRouter→Groq фоллбэк) + endpoint переобогащения — `news_fetcher.py`/`news.py`/`groq_service.py` (+ тест)
- [x] **#5-frontend** Теги `symbols[]`, фильтр по символу, бридж `market_impact` на странице актива *(blockedBy #5-backend)*

### Фаза 4 — ИИ-чат: сессия и навигация (🔴/🟡)
- [x] **#4** Убрать авто-сообщение ассистента (placeholder оставить) — `ChatPage.tsx`/`AIPanel.tsx`
- [x] **#11.1-backend** GET/DELETE `/chat/history` (схему не менять, всё в `messages`) (+ тест)
- [x] **#11.1-frontend** Грузить историю на маунте, `clear()` чистит БД — `useGroqChat.ts` *(blockedBy #11.1-backend, #4)*
- [x] **#11.2** Тематический guardrail general-чата (только финансы) — `chat.py::_build_system_prompt`
- [x] **#11.3-backend** Groq tool calling: `search_news`, `get_asset` *(blockedBy #11.2)*
- [x] **#11.3-frontend** Карточки-ссылки новостей/активов в ленте чата → react-router *(blockedBy #11.3-backend, #11.1-frontend)*

> Решение по «сохранению сессии ИИ-чата» (раздел обсуждения): выбран **вариант C** — персистентность через существующую таблицу `chat_sessions` (бэкенд уже пишет каждый обмен). Реализуется задачами #11.1.

### Фаза 5 — Комментарии, UI, админка (🟡/🟢)
- [x] **#10** ATR/Z-объём в ответе ИИ + CSS overflow вкладки «Про график» — `chat.py`/`TradingViewModal.tsx`/`AIPanel.tsx`
- [x] **#9** Реакции комментариев like/dislike (таблица `CommentReaction` + миграция) (+ тест)
- [x] **#8** Авто-рост textarea комментария — `NewsArticlePage.tsx`
- [x] **#3** Админ-панель: больше метрик (UI-пагинация комментариев уже была) — `admin.py`/`AdminPanelPage.tsx`/хуки

---

## Commit Plan (чекпоинты)

1. **fix(auth):** Google OAuth cookie через proxy-origin + сохранение сессии при reload — после #1, #2
2. **fix(market):** реальные свечи акций без mock-fallback + единый sparkline — после #6, #7
3. **feat(news):** enrichment с Groq-фоллбэком + теги символов и бридж влияния — после #5-backend, #5-frontend
4. **feat(chat):** убрать авто-сообщение + история/очистка сессии (GET/DELETE) — после #4, #11.1-backend, #11.1-frontend
5. **feat(chat):** тематический guardrail + навигационные tools (карточки-ссылки) — после #11.2, #11.3-backend, #11.3-frontend
6. **fix(asset):** ATR/Z-объём в ответе ИИ + overflow «Про график»; **feat(comments):** реакции like/dislike — после #10, #9
7. **feat(ui):** auto-grow textarea; **feat(admin):** метрики + пагинация комментариев — после #8, #3
