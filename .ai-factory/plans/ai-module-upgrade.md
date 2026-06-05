# План: Полный апгрейд ИИ-модуля FinTrack

**Создан:** 2026-06-05
**Режим:** Full (ветка не создаётся — `git.create_branches: false`, работаем в `master`)
**Файл плана:** `.ai-factory/plans/ai-module-upgrade.md`
**Источник:** находки отчёта по `promt.md` (анализ AI-интеграции)

## Settings

- **Testing:** да — pytest (backend) + Vitest/RTL (frontend) для нового поведения
- **Logging:** verbose — `logger.debug`/`console.debug` по конвенции (`[ИмяМодуля] ...`), `warn` для фоллбэков
- **Docs:** warn-only (без обязательного docs-чекпоинта)
- **Roadmap Linkage:** артефакт `.ai-factory/ROADMAP.md` отсутствует — линковка пропущена

## Контекст и проблемы (из отчёта)

Текущее состояние AI-модуля и выявленные дефекты:

1. **PatchTST** вызывается удалённо через Hugging Face Inference API (`services/patchtst.py:85`), отправляются **сырые close-цены** без нормализации. `scaler.pkl`, нормализация признаков и константа `SEQ_LEN` — **не реализованы**; окно `limit=100`, таймфрейм `1H` захардкожены в `routes/chat.py:144`.
2. **Боковик / слабый сигнал:** **нет порога уверенности**. Берётся argmax метки (`patchtst.py:74`), сигнал `UP 51%` проходит как уверенный. `SIDEWAYS` возникает только как технический fallback (`patchtst.py:51`), его не отличить от «модель колеблется».
3. **Новости:** привязка через `NewsArticle.symbols` (тикеры вида `BTC`), а чат фильтрует по полному символу `BTC-USDT` (`routes/chat.py:168`) → для крипты совпадений нет, контекст пустой. В общий чат новости не передаются.
4. **UI:** `AIPanel.tsx` определён, но **нигде не импортируется** — asset-чат не отрендерен. Виджет `AiSignalWidget.tsx` — **полностью мок** (хардкод `BTC 78%`).

## Целевая архитектура

- Конвенции бэкенда: FastAPI + async SQLAlchemy 2.0, сервисы в `backend/app/services/`, graceful degradation на каждом шаге, `logger = logging.getLogger("backend.<module>")`.
- Конвенции фронта: хуки возвращают `{ data, isLoading, error }`, обязательный `useMock?: boolean = true`, `console.debug('[Имя] ...')`, lucide-иконки, без emoji, без `any`.
- Полный символ (`BTC-USDT`) идёт в OKX-свечи как есть; для новостей вычисляется базовый тикер (`BTC`) новым хелпером `base_ticker`.
- Порог уверенности и окно инференса выносятся в конфиг — единая точка настройки.

---

## Tasks

### Фаза 1 — Бэкенд: конфиг и подготовка признаков

- [x] **T1 — Расширить конфиг параметрами инференса и порога** (`backend/app/config.py`)
  Поля: `prediction_seq_len=100`, `prediction_timeframe="1H"`, `prediction_confidence_threshold=0.55`, `prediction_margin=0.10`, `scaler_path="app/ml/scaler.pkl"`, `news_context_limit=5`, `general_news_enabled=False`. Залогировать в `log_startup_config()`.

- [x] **T2 — Хелпер нормализации символов** (`backend/app/services/symbols.py`, новый)
  `base_ticker(symbol)`: `BTC-USDT→BTC`, `ETH-USDT-SWAP→ETH`, `AAPL→AAPL`. Чистая функция, DEBUG-лог. *(зависит от: —)*

- [x] **T3 — Модуль признаков + scaler** (`backend/app/services/features.py` новый, `requirements.txt`, `backend/app/ml/README.md`)
  `build_feature_window(candles, seq_len)`, `load_scaler()` (ленивый joblib-кэш + graceful), `apply_scaler()`. Зависимости: `numpy`, `joblib`, `scikit-learn`. `.pkl` в `.gitignore`. *(зависит от: T1)*

### Фаза 2 — Бэкенд: инференс и порог боковика

- [x] **T4 — Инференс PatchTST + порог боковика** (`backend/app/services/patchtst.py`)
  Окно/таймфрейм из конфига, признаки через `features` + scaler. Разбор всех меток, top-1/top-2 + margin, понижение слабого `UP/DOWN` до `SIDEWAYS` с `low_confidence=True`. Возврат `{symbol, prediction, probability, raw_probabilities, low_confidence, source}`. *(зависит от: T1, T3)*

- [x] **T5 — Проброс low_confidence в схему, промт, кэш** (`backend/app/routes/chat.py`)
  `_get_prediction_cached` берёт конфиг; `PredictionOut += low_confidence`; промт явно сообщает о слабом сигнале/боковике. *(зависит от: T4)*

### Фаза 3 — Бэкенд: новости в контексте

- [x] **T6 — Фикс привязки новостей по тикеру** (`backend/app/routes/chat.py`)
  `_get_news_context` фильтрует по `base_ticker`; фоллбэк по category/title-ilike, лимит из конфига. *(зависит от: T1, T2)*

- [x] **T7 — Опц. новости в общем чате** (`backend/app/routes/chat.py`)
  При `general` + `general_news_enabled` — блок свежих общерыночных новостей. По умолчанию выключено. *(зависит от: T1)*

### Фаза 4 — Фронтенд: предсказание в UI

- [x] **T8 — Хук usePrediction** (`frontend/src/hooks/usePrediction.ts`, новый)
  `GET /api/chat/predict/{symbol}`, `usePrediction(symbol, useMock=true)`, `{data,isLoading,error}`, тип `+ low_confidence`. *(зависит от: —)*

- [x] **T9 — low_confidence в бейдже и типах чата** (`frontend/src/hooks/useGroqChat.ts`, `frontend/src/components/asset/AIPanel.tsx`)
  `PredictionInfo += low_confidence`; `PredictionBadge` показывает «Боковик/Слабый сигнал» нейтрально при слабом сигнале. *(зависит от: T5)*

- [x] **T10 — Подключить AIPanel на странице актива** (`frontend/src/pages/AssetPage.tsx`)
  Отрендерить ныне неиспользуемый `AIPanel` с `symbol={asset.symbol}`, рядом с `NewsPanel`. *(зависит от: T9)*

- [x] **T11 — Заменить мок AiSignalWidget** (`frontend/src/components/dashboard/widgets/AiSignalWidget.tsx`)
  Убрать хардкод, использовать `usePrediction` (символ по умолчанию `BTC-USDT`), состояния loading/empty, сохранить визуал и `gridH`-логику. *(зависит от: T8)*

### Фаза 5 — Тесты

- **T12 — Бэкенд-тесты** (`backend/tests/test_symbols.py`, `test_patchtst.py` новые; `test_chat.py` расширить)
  `base_ticker`; порог→`SIDEWAYS`+`low_confidence`; margin; scaler через мок joblib; отличимость fallback по `source`; news_context по base_ticker + фоллбэк. Мокать httpx. Зелёный pytest. *(зависит от: T4, T5, T6)*

- **T13 — Фронтенд-тесты** (Vitest + RTL, `__tests__/`)
  `PredictionBadge` low_confidence; `usePrediction` (мок fetch); `AiSignalWidget` real/loading/empty. Зелёный vitest. *(зависит от: T9, T11)*

---

## Commit Plan

План на 13 задач — чекпоинты коммитов по фазам:

1. **После T1–T3** — `feat(ai/backend): config params + symbol/feature/scaler scaffolding`
2. **После T4–T5** — `feat(ai/patchtst): confidence threshold + sideways/low-confidence handling`
3. **После T6–T7** — `fix(ai/news): bind chat news context by base ticker (+optional general news)`
4. **После T8–T11** — `feat(ai/ui): usePrediction hook, low-confidence badge, mount AIPanel, real AiSignalWidget`
5. **После T12–T13** — `test(ai): backend + frontend coverage for prediction/threshold/news`

## Заметки и риски

- **scaler.pkl и препроцессинг.** Точный пайплайн признаков модели `nikasq/PatchTST-Time-Series-Classifier` на стороне репозитория неизвестен. T3/T4 делают препроцессинг конфигурируемым и graceful (без `.pkl` — поведение как сейчас, сырые close-цены). **Перед продакшеном** препроцессинг (тип признаков, нормализация, `seq_len`) нужно сверить с обучающим пайплайном модели и положить актуальный `scaler.pkl` в `backend/app/ml/`.
- **Авторизация.** `AIPanel` ходит на `POST /api/chat/message` (JWT-only). На странице актива (T10) это ок при наличии сессии; для гостей предусмотреть пустое/гостевое состояние.
- **Кэш предсказаний.** Ключ `cache:predict:{symbol}` остаётся на полном символе; новые поля (`low_confidence`, `raw_probabilities`) попадают в кэш автоматически (TTL 60с) — учесть при чтении старых значений.
- **Без секретов в логах** — следовать существующему `_mask_*`-подходу `config.py`.
