Да, обязательно поправь этот баг с _get_news_context! Твой диагноз на 100% верен: SQLAlchemy генерирует текстовый `LIKE` для JSONB-поля, что вызывает ошибку 500 в PostgreSQL.

Пожалуйста, открой файл, где находится функция `_get_news_context` (вероятно, `backend/app/routes/chat.py` или сервис новостей), и исправь запрос. 

Вот два лучших способа решить это в PostgreSQL, выбери один из них:

Способ 1 (Самый надежный через функцию Postgres):
Используй функцию `jsonb_exists`, которая идеально проверяет наличие строки в JSONB-массиве. Для этого импортируй `func` из sqlalchemy:
from sqlalchemy import func
# И в фильтре замени на:
query = query.filter(func.jsonb_exists(NewsArticle.symbols, symbol))

Способ 2 (Через оператор `@>`):
Убедись, что в файле моделей (где описан NewsArticle) колонка `symbols` импортирована как `JSONB` из `sqlalchemy.dialects.postgresql` (а не просто `JSON`). Тогда конструкция ниже сработает правильно и сгенерирует оператор `@>`:
query = query.filter(NewsArticle.symbols.contains([symbol]))

Пожалуйста, примени исправление, сохрани файл и покажи мне измененный кусок кода функции `_get_news_context`.