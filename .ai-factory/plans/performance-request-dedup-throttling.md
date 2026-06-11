# Implementation Plan: Оптимизация производительности — дедупликация запросов и троттлинг OpenRouter

Branch: master (create_branches: false)
Created: 2026-06-11

## Settings
- Testing: no
- Logging: verbose
- Docs: no (warn-only)

## Roadmap Linkage
Milestone: "none"
Rationale: Roadmap не найден (.ai-factory/ROADMAP.md отсутствует)

---

## Контекст и ключевые решения

### Проблема 1 — 80+ запросов при запуске (фронтенд)

**QueryClient (main.tsx):** уже есть `staleTime: 30_000` и `refetchOnWindowFocus: false`, но отсутствуют `retry: 1` и `retryDelay: 5000`. Дефолтный TanStack Query `retry: 3` при ошибке сразу делает ещё 3 попытки — при нескольких одновременных ошибках возникает лавина.

**`/auth/me` × 4-5 вызовов:** AuthContext.tsx использует чистый `useState + useEffect` (без TanStack Query). Причина кратных вызовов:
- `React.StrictMode` в dev-режиме делает двойной маунт (`mount → unmount → mount`) → 2 параллельных `apiMe()` вызова в полёте одновременно. `active`-флаг прерывает устаревший callback, но оба HTTP-запроса уже ушли.
- Ни один компонент не вызывает `useAuth().refresh()` напрямую (проверено grep'ом) — `useAuth` потребляется только для чтения состояния.

**Решение:** Добавить ref-гвард `fetchingRef.current` в `AuthContext`, чтобы одновременно не было двух `apiMe()` в полёте.

**`useNotifications` — `staleTime: 0`:** В отличие от остальных хуков (staleTime 30s), `useNotifications` использует `staleTime: 0`, что означает рефетч при каждом маунте компонента. Это создаёт дополнительные запросы при навигации. Нужно поднять до `staleTime: 30_000` (уведомления не требуют идеальной свежести).

**Дедупликация форекс/акций:** QueryKey-based дедупликация уже работает (`['quote', 'forex', from, to]`, `['assetPrice', type, symbol]`, `['prices', 'all']`). Дополнительных изменений не требуется.

### Проблема 2 — 429 Too Many Requests от OpenRouter (бэкенд)

**Текущий код:** `asyncio.create_task(process_article_with_ai(id))` + `asyncio.sleep(0.5)` — это создаёт N задач с паузой 0.5s между стартами, но все задачи выполняются параллельно. При 120 новых статьях при старте возникает пик из 120 параллельных HTTP-запросов к OpenRouter.

**Решение:**
- Заменить fire-and-forget на прямой вызов с await
- `asyncio.Semaphore(3)` — не более 3 запросов к OpenRouter одновременно
- Задержка 1 секунда после каждого успешного запроса
- При 429: `await asyncio.sleep(5)`, повтор до 2 раз. Если после retry — 429 снова, сохранить статью без AI-обогащения
- Логировать `enriched / skipped / total` в конце каждого цикла фетча

---

## Tasks

### Phase 1: Frontend — QueryClient + Auth + Notifications

- [x] **Задача 1**: QueryClient defaults — добавить retry и retryDelay
  - Файл: `frontend/src/main.tsx`
  - Добавить в `defaultOptions.queries`:
    ```ts
    retry: 1,
    retryDelay: 5000,
    ```
  - Итоговая конфигурация: `{ staleTime: 30_000, gcTime: 5*60_000, refetchOnWindowFocus: false, retry: 1, retryDelay: 5000 }`
  - Logging: `console.debug('[QueryClient] configured: retry=1 retryDelay=5000 staleTime=30s')`

- [x] **Задача 2**: AuthContext — ref-гвард от параллельных apiMe() вызовов
  - Файл: `frontend/src/context/AuthContext.tsx`
  - Добавить `const fetchingRef = useRef(false)` внутри `AuthProvider`
  - В `useEffect` (строка 112): перед вызовом `apiMe()` проверить `if (fetchingRef.current) return`; выставить `fetchingRef.current = true`; в `finally` — сбросить в `false`
  - В `refresh()` (строка 79): аналогичная проверка + сброс
  - Цель: гарантировать, что никогда не летят 2 `apiMe()` одновременно
  - Logging: `console.debug('[useAuth] already fetching — skip duplicate')` при срабатывании гварда

- [x] **Задача 3**: useNotifications — поднять staleTime
  - Файл: `frontend/src/hooks/useNotifications.ts`
  - Заменить `staleTime: 0` на `staleTime: 30_000`
  - Причина: при навигации между страницами компонент размонтируется/монтируется; `staleTime: 0` вынуждает рефетч при каждом маунте; 30s достаточно для уведомлений
  - Logging: `console.debug('[useNotifications] staleTime=30s — skipping refetch within window')`
    (добавить только если захочется дебажить; основной `console.debug` при `fetched count=` уже есть)

<!-- Commit checkpoint: задачи 1–3 -->

### Phase 2: Backend — news_fetcher троттлинг

- [x] **Задача 4**: news_fetcher — последовательная обработка + Semaphore + retry на 429
  - Файл: `backend/app/services/news_fetcher.py`
  - Убрать fire-and-forget loop:
    ```python
    # БЫЛО:
    for article_id in inserted:
        asyncio.create_task(process_article_with_ai(article_id))
        await asyncio.sleep(0.5)
    ```
  - Добавить module-level: `_ai_semaphore = asyncio.Semaphore(3)`
  - Заменить на вызов нового хелпера `await _enrich_articles(inserted)`:
    ```python
    async def _enrich_articles(ids: list[uuid.UUID]) -> None:
        enriched = 0
        skipped = 0
        async def _bounded(article_id):
            nonlocal enriched, skipped
            async with _ai_semaphore:
                success = await process_article_with_ai(article_id)
                if success:
                    enriched += 1
                else:
                    skipped += 1
                await asyncio.sleep(1)  # 1s throttle между запросами
        await asyncio.gather(*[_bounded(aid) for aid in ids])
        logger.info("[news_fetcher] enrichment done: enriched=%d skipped=%d total=%d", enriched, skipped, len(ids))
    ```
  - Изменить `process_article_with_ai` → возвращать `bool` (True = успех, False = пропущено):
    - При 429: `await asyncio.sleep(5)` + повтор (счётчик `retries`, max 2). Если всё равно 429 — `_mark_processed` + `return False`
    - При других ошибках — без изменений: `_mark_processed` + `return False`
    - При успехе — `return True`
  - Логировать 429 явно: `logger.warning("[news_fetcher] 429 rate limit for %s, retry %d/2", article_id, attempt)`
  - Logging: `logger.debug("[news_fetcher] semaphore acquired for %s", article_id)` при входе в семафор

<!-- Commit checkpoint: задача 4 (финальный коммит) -->
