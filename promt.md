ПРОМТ — Блок D: Новости полная реализация
Изучи весь проект — backend/app/, src/hooks/useNews.ts, существующие таблицы в backend/app/models.py. Реализуй полную систему новостей.

ШАГ 1 — Таблицы в PostgreSQL
Добавь в backend/app/models.py три новые модели:
python# Статьи новостей
class NewsArticle(Base):
    __tablename__ = "news_articles"
    id: UUID (primary key)
    title: str
    title_ru: str | None          # перевод
    description: str | None
    description_ru: str | None    # перевод
    content: str | None
    content_ru: str | None        # перевод (заполняется по запросу)
    url: str (unique)             # для дедупликации
    url_to_image: str | None
    source_name: str
    published_at: datetime
    category: str                 # crypto / stocks / forex / general
    symbols: list (JSONB)         # ['BTC', 'ETH', 'AAPL']
    keywords: list (JSONB)        # ключевые слова на русском
    market_impact: str | None     # positive / negative / neutral
    language: str default 'en'
    ai_processed: bool default False
    created_at: datetime

# Реакции на новости
class NewsReaction(Base):
    __tablename__ = "news_reactions"
    id: UUID
    user_id: FK → users
    article_id: FK → news_articles
    reaction_type: str  # like / dislike
    created_at: datetime
    # UNIQUE (user_id, article_id)

# Избранные новости
class NewsFavorite(Base):
    __tablename__ = "news_favorites"
    id: UUID
    user_id: FK → users
    article_id: FK → news_articles
    created_at: datetime
    # UNIQUE (user_id, article_id)
Существующую таблицу Comment не трогай — она уже есть и работает с article_url.
Создай миграцию: alembic revision --autogenerate -m "news tables" и примени.

ШАГ 2 — Сборщик новостей (APScheduler)
Установи apscheduler в requirements.txt.
Создай backend/app/services/news_fetcher.py:
Функция fetch_and_store_news():

Делает 4 запроса к NewsAPI параллельно через httpx.AsyncClient:

language=en&category=business&pageSize=30 — общие финансы
language=en&q=bitcoin OR ethereum OR crypto&pageSize=30 — крипто
language=en&q=stocks OR earnings OR S%26P500&pageSize=30 — акции
language=en&q=forex OR dollar OR euro OR Fed&pageSize=30 — форекс


Для каждой статьи проверяет: есть url в БД? → пропустить
Новые статьи вставляет в news_articles с ai_processed=False
После вставки запускает фоновую задачу process_article_with_ai(article_id)

Функция process_article_with_ai(article_id):

Берёт статью из БД
Один запрос к OpenRouter API (модель meta-llama/llama-3.3-70b-instruct:free):

pythonprompt = f"""
Analyze this financial news article and return ONLY valid JSON, no other text:

Title: {article.title}
Description: {article.description or ''}

Return this exact JSON structure:
{{
  "title_ru": "translated title in Russian",
  "description_ru": "translated description in Russian",
  "category": "crypto|stocks|forex|general",
  "symbols": ["BTC", "ETH"],
  "keywords": ["ключевое слово 1", "ключевое слово 2"],
  "market_impact": "positive|negative|neutral"
}}

For symbols: only include if explicitly mentioned (BTC, ETH, SOL, AAPL, MSFT, GOOGL, etc.)
For category: crypto if about cryptocurrency, stocks if about equities, forex if about currencies/Fed, general otherwise
"""

Парсит JSON из ответа
Обновляет статью в БД: title_ru, description_ru, category, symbols, keywords, market_impact, ai_processed=True
При ошибке парсинга — логирует и ставит ai_processed=True чтобы не повторять

В backend/app/main.py в lifespan запускать APScheduler:
pythonscheduler = AsyncIOScheduler()
scheduler.add_job(fetch_and_store_news, 'interval', hours=4, next_run_time=datetime.now())
scheduler.start()

ШАГ 3 — Бэкенд эндпоинты
Создай backend/app/routes/news.py с prefix /api/news:
GET /api/news — лента новостей:

Query params: query (поиск по title/description), category (crypto/stocks/forex/general), page (default 1), limit (default 20)
SELECT из news_articles с фильтрами, ORDER BY published_at DESC
Кэшировать в Redis ключ news:list:{hash(params)} TTL 300 секунд
Для авторизованного пользователя — добавлять поля is_favorited и user_reaction
Возвращать: {articles: [...], total: int, page: int, has_more: bool}

GET /api/news/{id} — одна статья:

Возвращает полную статью + likes_count, dislikes_count, comments_count, is_favorited, user_reaction

GET /api/news/{id}/comments — комментарии к статье:

SELECT из comments WHERE article_url = article.url, ORDER BY created_at DESC
Возвращать: автор (username + avatar_url), текст, дата, лайки

POST /api/news/{id}/comments — добавить комментарий (требует авторизации):

Принимает {"text": "..."}, минимум 3 символа
INSERT в comments

DELETE /api/news/comments/{comment_id} — удалить комментарий (автор или admin)
POST /api/news/{id}/react — лайк/дизлайк (требует авторизации):

Принимает {"type": "like"} или {"type": "dislike"}
Если такая реакция уже есть — удалить (toggle)
Если другая реакция — заменить

POST /api/news/{id}/favorite — избранное (требует авторизации):

Toggle: если есть — убрать, если нет — добавить

GET /api/news/favorites — избранные новости текущего пользователя
Добавить роутер в main.py. Добавить proxy в vite.config.ts: /api/news → http://localhost:8000.

ШАГ 4 — Переменные окружения
В backend/app/config.py добавить:
pythonNEWS_API_KEY: str = ""
OPENROUTER_API_KEY: str = ""
OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
OPENROUTER_MODEL: str = "meta-llama/llama-3.3-70b-instruct:free"
В backend/.env.example добавить:
NEWS_API_KEY=your_newsapi_key
OPENROUTER_API_KEY=your_openrouter_key

ШАГ 5 — Фронт: хук useNews переделать
Найди src/hooks/useNews.ts. Сейчас он ходит напрямую в NewsAPI. Переписать чтобы ходил на наш бэкенд:
typescript// GET /api/news?query=...&category=...&page=...
// Infinite scroll через TanStack Query useInfiniteQuery
// staleTime: 5 минут
// getNextPageParam: (lastPage) => lastPage.has_more ? lastPage.page + 1 : undefined

ШАГ 6 — Фронт: NewsPage
Найди существующий NewsPage.tsx. Реализуй полностью:
Вверху — строка поиска с debounce 500ms.
Табы под поиском: Все / Крипто / Акции / Форекс — переключают category параметр.
Карточка новости (NewsCard):

Картинка (если нет — градиентный placeholder с первой буквой источника)
Плашка влияния на рынок: зелёная «📈 Позитивно» / красная «📉 Негативно» / серая «➡️ Нейтрально»
Переведённый заголовок (title_ru если есть, иначе title)
Источник + дата (формат «2 июня 2026»)
Теги символов: маленькие чипы BTC ETH AAPL
Кнопки внизу карточки: 👍 N | 👎 N | 💬 N | ⭐ (избранное)
Клик на карточку → /news/{id}

Infinite scroll: когда пользователь долистал до конца — загружать следующую страницу через useInfiniteQuery.

ШАГ 7 — Фронт: NewsArticlePage
Создай src/pages/NewsArticlePage.tsx — роут /news/:id.
Содержимое:

Кнопка «← Назад»
Картинка статьи если есть
Заголовок (title_ru или title)
Источник + дата + плашка влияния на рынок
Теги ключевых слов — чипы с подсветкой
Текст статьи (description_ru или description) — в content_ru пока не переводим
Кнопка «Читать оригинал» → открыть url в новой вкладке
Блок реакций: 👍 N кнопка | 👎 N кнопка | ⭐ кнопка
Секция комментариев:

Заголовок «Комментарии (N)»
Если не авторизован — «Войдите чтобы оставить комментарий»
Если авторизован — textarea + кнопка «Отправить»
Список комментариев: аватар, username, дата, текст, 👍 N



Добавить роут в App.tsx/router.

ШАГ 8 — Фронт: виджет новостей на дашборде
Найди виджет news в src/components/dashboard/widgets/. Переделать чтобы:

Если у пользователя есть избранные новости — показывать их (GET /api/news/favorites)
Если избранных нет — показывать последние 5 свежих (GET /api/news?limit=5)
Клик на новость → /news/{id}
Показывать: картинка-миниатюра + заголовок на русском + источник + плашка влияния


ШАГ 9 — Проверка

Запусти бэкенд — APScheduler должен сразу запустить первый сбор новостей
Проверь что статьи появились в БД: SELECT count(*) FROM news_articles;
Проверь что ai_processed=True у статей через несколько минут
Открой GET /api/news — должен вернуть список статей с переводами
Проверь фронт — лента новостей должна показывать переведённые заголовки
Поставь лайк — убедись что он сохранился и после refresh остался

Не трогай: все существующие роуты, хуки котировок, страницы кроме NewsPage и NewsArticlePage.