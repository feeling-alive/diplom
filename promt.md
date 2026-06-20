Контекст: дипломный проект FinTrack (dashboard-app). Бэкенд FastAPI (Python 3.13),
фронт React/TS. Привести код в соответствие с пояснительной запиской: 5 задач.
ЗАПРЕЩЕНО: менять обученную модель PatchTST, scaler.pkl и размерность входа 60×11.
После каждой задачи прогоняй тесты (backend: pytest; frontend: npm run test) и дай отчёт.

ЗАДАЧА 1 — ATR и Z-оценку объёма подать в ИИ-ассистента (НЕ в модель).
- В backend/app/services/features.py добавь расчёт ATR(14) и Z-оценки объёма
  (volume z-score по окну ~20 свечей), чистый Python, без новых зависимостей,
  в стиле существующих _rsi/_macd.
- В backend/app/services/patchtst.py в словарь indicator_details (рядом с rsi,
  rsi_zone, macd_cross, macd_position, trend, price_vs_sma20) добавь atr и volume_zscore.
- В backend/app/routes/chat.py в _build_system_prompt выведи их в блок
  "Индикаторы (реальные значения)": "• ATR(14): ..." и "• Z-оценка объёма: ...".
- Вход модели остаётся 11 признаков без изменений. ATR/Z-объём идут ТОЛЬКО в LLM-контекст.

ЗАДАЧА 2 — починить React-графики (Recharts) для акций и форекса.
- Сейчас frontend SimpleChart/PriceChartWidget тянут свечи через useOHLCV ->
  /api/quotes/ohlcv/{symbol} -> backend candles.py. В candles.py источник есть только
  для крипты (OKX); акции идут в Finnhub (на бесплатном тарифе свечей нет -> mock),
  форекс источника не имеет -> mock. Из-за этого React-графики у акций и форекса пустые.
- В backend/app/services/candles.py добавь источники истории свечей:
  * акции (AAPL и т.п.) -> yfinance (добавь в requirements.txt);
  * форекс -> Frankfurter endpoint /timeseries (дневной таймфрейм; часовых там нет —
    для форекса ограничься дневными свечами).
  Крипта остаётся на OKX. Маршрутизация по типу символа.
- Сохрани контракт ответа {symbol, timeframe, candles:[{t,o,h,l,c,v}], source} и кэш в Redis
  с TTL. Сохрани graceful-degradation (fallback на mock при ошибке).
- Проверь, что SimpleChart на странице актива и PriceChartWidget на дашборде рисуют
  реальные свечи для крипты, акций и форекса. TradingView-модал (iframe) не трогай.

ЗАДАЧА 3 — удалить подписку, оставить тихий лимит на ИИ.
- Удали функционал подписки/премиума: frontend SubscriptionPage.tsx, PremiumModal.tsx,
  SubscriptionCard.tsx, useSubscription.ts, страницу/маршрут подписки, все premium-ветки в UI,
  backend routes/subscription.py и связанные схемы.
- ВАЖНО: ограничение на ИИ-чат должно ОСТАТЬСЯ (требование ПЗ "ограничение числа обращений
  к ИИ-модулю"). Переделай его в фиксированный лимит 30 запросов/минуту на пользователя,
  через Redis-счётчик. Лимит нигде в интерфейсе не показывать; при превышении возвращать
  понятную ошибку (HTTP 429). Поле ai_requests_used / план free-premium больше не используем —
  но не сломай существующих пользователей при удалении модели Subscription (сделай миграцию).

ЗАДАЧА 4 — реальные данные в персонализированной панели.
- frontend/src/hooks/usePersonalized.ts сейчас всегда возвращает захардкоженный mock
  (useMock=true по умолчанию). Подключи его к реальному источнику: топ-активы рынка
  и/или избранное пользователя через существующие бэкенд-эндпоинты. Затронуты
  PersonalizedPanel.tsx и FloatingAssetCards.tsx. Данные должны быть реальными при USE_MOCK=false.

ЗАДАЧА 5 — восстановление пароля через КОД (сейчас через ссылку).
- Сейчас backend/app/auth/router.py шлёт ссылку с токеном (/reset-password?token=...),
  а фронт ResetPasswordPage ждёт token из URL.
- Переделай на одноразовый 6-значный код: forgot-password генерирует код, хранит в Redis
  15 минут (ключ вида reset:{email}), и отправляет КОД на почту (не ссылку).
  reset-password принимает email + код + новый пароль, сверяет код, обновляет хэш, удаляет ключ.
- Переделай фронт: экран ввода email -> экран ввода кода и нового пароля. Сохрани нейтральный
  ответ (не раскрывать существование аккаунта) и graceful-degradation без SMTP (код в DEBUG-лог).

В конце — отчёт по каждой задаче: какие файлы изменены и прошли ли тесты.