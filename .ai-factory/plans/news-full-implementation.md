# План: Блок D — Новости, полная реализация

> Источник: `promt.md` (9 шагов). Создано: 2026-06-03.
> Ветка: **master** (`git.create_branches: false`).
> Режим: **Full**. Язык артефактов: ru.

## Settings

- **Тесты:** да — pytest для бэкенд-роутов (`/api/news`, реакции, избранное, комментарии)
- **Логирование:** verbose — `console.debug('[Component] ...')` на фронте, `logger.debug/info` на бэкенде
- **Документация:** нет (опциональный /aif-docs по желанию)

---

## Зависимости задач

```
Фаза 1: #1 (модели) → #2 (миграция) → #3 (сборщик) → #4 (роуты) → #5 (тесты)
Фаза 2: #6 (useNews) → #7 (NewsPage) → #8 (NewsArticlePage) → #9 (виджет)
Фаза 3: #10 (ручная проверка)
```

Фаза 2 требует #4 (роуты бэкенда готовы).

---

## Задачи

### Фаза 1 — Бэкенд

**#1 — Модели БД** ✅ Готово
`backend/app/models.py`

Добавить три модели:

- `NewsArticle` — статьи: UUID pk, title, title_ru, description, description_ru, content, content_ru, url (unique), url_to_image, source_name, published_at, category, symbols (JSONB), keywords (JSONB), market_impact, language='en', ai_processed=False, created_at
- `NewsReaction` — лайки/дизлайки: UUID pk, user_id FK→users, article_id FK→news_articles, reaction_type ('like'/'dislike'), created_at; UNIQUE(user_id, article_id)
- `NewsFavorite` — избранное: UUID pk, user_id FK→users, article_id FK→news_articles, created_at; UNIQUE(user_id, article_id)

Существующую `Comment` не трогать.

Логирование: `logger.debug('[models] NewsArticle/NewsReaction/NewsFavorite defined')`

---

**#2 — Миграция Alembic** ✅ Готово
`backend/alembic/`

```bash
cd backend
alembic revision --autogenerate -m "news tables"
alembic upgrade head
```

Проверить что в миграции появились таблицы `news_articles`, `news_reactions`, `news_favorites`. Применить.

---

**#3 — Переменные окружения + зависимости** ✅ Готово
`backend/app/config.py`, `backend/requirements.txt`, `backend/.env.example`

В `config.py` добавить поля:
```python
NEWS_API_KEY: str = ""
OPENROUTER_API_KEY: str = ""
OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
OPENROUTER_MODEL: str = "meta-llama/llama-3.3-70b-instruct:free"
```

В `requirements.txt` добавить: `apscheduler`, `httpx` (если нет).

В `.env.example` добавить:
```
NEWS_API_KEY=your_newsapi_key
OPENROUTER_API_KEY=your_openrouter_key
```

---

**#4 — Сборщик новостей (APScheduler)** ✅ Готово
НОВЫЙ `backend/app/services/news_fetcher.py`

Функция `fetch_and_store_news()`:
- 4 параллельных запроса к NewsAPI через `httpx.AsyncClient`:
  - `category=business&pageSize=30` — общие финансы
  - `q=bitcoin OR ethereum OR crypto&pageSize=30`
  - `q=stocks OR earnings OR S%26P500&pageSize=30`
  - `q=forex OR dollar OR euro OR Fed&pageSize=30`
- Дедупликация по `url` — INSERT только новых
- После вставки → запускает `asyncio.create_task(process_article_with_ai(article_id))`

Функция `process_article_with_ai(article_id)`:
- Берёт статью из БД
- Один запрос к OpenRouter (модель из config):
```python
prompt = f"""Analyze this financial news article and return ONLY valid JSON...
Title: {article.title}
Description: {article.description or ''}
Return: {{"title_ru": ..., "description_ru": ..., "category": "crypto|stocks|forex|general",
           "symbols": [...], "keywords": [...], "market_impact": "positive|negative|neutral"}}"""
```
- Парсит JSON, обновляет `NewsArticle` в БД
- При ошибке парсинга — логирует, ставит `ai_processed=True` (не повторять)

В `backend/app/main.py` в `lifespan`:
```python
scheduler = AsyncIOScheduler()
scheduler.add_job(fetch_and_store_news, 'interval', hours=4, next_run_time=datetime.now())
scheduler.start()
```

Логирование: `logger.info('[news_fetcher] fetch started')`, `logger.debug('[news_fetcher] inserted {n} articles')`, `logger.warning('[news_fetcher] ai parse error: {e}')`

---

**#5 — Бэкенд роуты** ✅ Готово
НОВЫЙ `backend/app/routes/news.py` (prefix `/api/news`)

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/news` | Лента: query, category, page, limit=20; Redis кэш 300с; поля is_favorited+user_reaction для авториз. |
| GET | `/api/news/favorites` | Избранные текущего пользователя |
| GET | `/api/news/{id}` | Статья + likes_count, dislikes_count, comments_count, is_favorited, user_reaction |
| GET | `/api/news/{id}/comments` | Комментарии (из таблицы `comments` по article_url) |
| POST | `/api/news/{id}/comments` | Добавить комментарий (auth, min 3 символа) |
| DELETE | `/api/news/comments/{comment_id}` | Удалить (автор или admin) |
| POST | `/api/news/{id}/react` | Лайк/дизлайк (toggle, replace если другая реакция) |
| POST | `/api/news/{id}/favorite` | Избранное (toggle) |

Redis ключ: `news:list:{hash(params)}`, TTL 300с. Graceful degradation если Redis недоступен.

Зарегистрировать в `main.py`: `app.include_router(news_router)`.

Логирование: `logger.debug('[news] GET /api/news page={page} category={category}')`, `logger.info('[news] reaction {type} for article {id} by user {uid}')`

---

**#6 — Pytest: бэкенд-тесты** ✅ Готово (11 passed)
НОВЫЙ `backend/tests/test_news.py`

Минимальный набор (моки для scheduler/httpx):
- `GET /api/news` — 200, возвращает `{articles, total, page, has_more}`
- `GET /api/news/{id}` — 200 / 404
- `POST /api/news/{id}/react` — 401 без авторизации, toggle логика
- `POST /api/news/{id}/favorite` — 401 без авторизации, toggle
- `POST /api/news/{id}/comments` — 401 без авторизации, валидация min 3 символа

---

### Фаза 2 — Фронтенд

**#7 — Proxy + useNews хук** ✅ Готово
`frontend/vite.config.ts`, `frontend/src/hooks/useNews.ts`

В `vite.config.ts` добавить proxy: `/api/news → http://localhost:8000`.

Переписать `useNews.ts`:
```typescript
// useInfiniteQuery(['news', query, category], fetchPage, {
//   staleTime: 5 * 60 * 1000,
//   getNextPageParam: (lastPage) => lastPage.has_more ? lastPage.page + 1 : undefined
// })
```

Экспортировать: `{ data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading }`.

Логирование: `console.debug('[useNews] fetch page', page, 'category', category)`

---

**#8 — NewsPage** ✅ Готово
`frontend/src/pages/NewsPage.tsx`

Структура:
- Строка поиска с debounce 500ms (хук `useDebounce` или inline `useEffect+setTimeout`)
- Табы: Все / Крипто / Акции / Форекс (переключают `category`)
- Список `NewsCard` компонентов
- Infinite scroll: `IntersectionObserver` на последнем элементе → `fetchNextPage()`

Компонент `NewsCard` (`src/components/news/NewsCard.tsx`):
- Картинка / градиентный placeholder (первая буква источника)
- Плашка: 📈 Позитивно (зелёная) / 📉 Негативно (красная) / ➡️ Нейтрально (серая)
- `title_ru || title`, источник + дата («2 июня 2026»), чипы символов
- Кнопки: 👍 N | 👎 N | 💬 N | ⭐
- Клик → `navigate('/news/' + id)`

Логирование: `console.debug('[NewsPage] category', category, 'query', query)`

---

**#9 — NewsArticlePage** ✅ Готово
`frontend/src/pages/NewsArticlePage.tsx` (роут `/news/:id`)

Содержимое:
- Кнопка «← Назад»
- Картинка статьи (если есть)
- Заголовок (`title_ru || title`), источник, дата, плашка влияния
- Теги ключевых слов (`keywords`) — чипы
- Текст (`description_ru || description`)
- Кнопка «Читать оригинал» → `window.open(url, '_blank')`
- Блок реакций: 👍 N | 👎 N | ⭐
- Секция комментариев: textarea (авториз.) / «Войдите...» (гость), список комментариев

Добавить роут в `frontend/src/App.tsx`:
```tsx
<Route path="/news/:id" element={<NewsArticlePage />} />
```

Логирование: `console.debug('[NewsArticlePage] load article', id)`

---

**#10 — Виджет новостей на дашборде** ✅ Готово
`frontend/src/components/dashboard/widgets/NewsWidget.tsx`

Логика:
- `GET /api/news/favorites` (авториз.) → если есть → показывать их
- Иначе `GET /api/news?limit=5` → последние 5

Каждая строка: миниатюра + `title_ru || title` + источник + плашка влияния. Клик → `/news/{id}`.

Логирование: `console.debug('[NewsWidget] using', useFavorites ? 'favorites' : 'latest')`

---

## Commit Plan

| Чекпоинт | Задачи | Сообщение |
|---|---|---|
| A | #1–#3 | `feat(news): модели БД + миграция + конфиг env` |
| B | #4–#5 | `feat(news): APScheduler сборщик + OpenRouter AI обработка` |
| C | #6 | `feat(news): бэкенд роуты /api/news + Redis кэш` |
| D | #7 | `test(news): pytest бэкенд-тесты новостей` |
| E | #8–#9 | `feat(news): useNews useInfiniteQuery + proxy vite` |
| F | #10–#11 | `feat(news): NewsPage + NewsCard + NewsArticlePage` |
| G | #12 | `feat(news): виджет новостей на дашборде` |

---

## Риски

- **OpenRouter rate limit** — при старте 120 статей одновременно. Решение: добавить `asyncio.sleep(0.5)` между задачами `process_article_with_ai`.
- **NewsAPI ключ** — если пустой, `fetch_and_store_news` должна gracefully вернуть `[]` с `logger.warning`.
- **Comment таблица** — существующая схема работает по `article_url`, не по `article_id`. Комментарии к новостям хранятся по `article.url` — не менять схему.
