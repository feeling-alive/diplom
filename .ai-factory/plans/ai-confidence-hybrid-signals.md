# План: Комплексное улучшение AI-модуля (повышение уверенности предсказаний)

- **Создан:** 2026-06-06
- **Режим:** Full (ветка не создаётся — `git.create_branches: false`, остаёмся на `master`)
- **Источник:** `promt.md` (4 блока)
- **Slug плана:** `ai-confidence-hybrid-signals`

## Settings

- **Testing:** да — pytest (backend) + Vitest (frontend) на каждый блок
- **Logging:** verbose — `logger.debug/info` с префиксами `[features]`, `[patchtst]`, `[chat]`, `[groq]`; на фронте `console.debug('[TradingViewModal] ...')`
- **Docs:** да — обязательный docs-чекпоинт в конце (через `/aif-docs`), обновить `DESCRIPTION.md` и `app/ml/README.md`

## Roadmap Linkage

- **Milestone:** "none"
- **Rationale:** `.ai-factory/ROADMAP.md` отсутствует в проекте — линковка невозможна.

## Цель

Повысить осмысленность и уверенность сигнала AI-модуля за счёт:
1. полноценной нормализации признаков через `scaler.pkl` (11-фичная матрица вместо унивариантного окна close);
2. гибридного сигнала PatchTST (60%) + правила RSI/MACD/тренд (40%) с бустом при согласии;
3. структурированного русскоязычного промта Groq с дисклеймером;
4. дефолтного таймфрейма 1H на вкладке «Про график».

## Текущее состояние (по результатам разведки кода)

- `services/features.py` — сейчас **унивариантный** конвейер: `build_feature_window` отдаёт окно только из close, `apply_scaler` ждёт колонку `(n, 1)`. Индикаторов (RSI/MACD/Bollinger) в бэкенде **нет**.
- `services/patchtst.py::get_prediction` — шлёт плоское окно close в HF, применяет `_apply_confidence_gate` (порог + margin, гейт боковика). Гибрида и rule-сигнала нет.
- `routes/chat.py::_build_system_prompt` — старый короткий промт; `PredictionOut` без полей `patchtst_prob/rule_score/signals_agree`.
- `components/asset/TradingViewModal.tsx` — вкладка «Про график» = модалка; `buildTvUrl()` хардкодит `interval: 'D'` (строка ~40). `MainCard.tsx` открывает модалку по `setIsProModalOpen(true)`.
- `app/ml/README.md` — документирует scaler как **унивариантный** (1 колонка close).

## ⚠️ Риски и решения (важно для реализации)

1. **Несовпадение формы scaler.pkl.** Текущий `scaler.pkl` обучен на 1 колонке (close). `scaler.transform()` на матрице 11×N даст shape-mismatch → ловим исключение, `logger.WARNING`, degrade на сырую матрицу. Не падаем. (Полноценная нормализация заработает только после переобучения scaler на 11 признаках — вне scope этого плана; зафиксировать в `app/ml/README.md`.)
2. **Контракт HF payload.** HF-модель сейчас принимает плоское окно close. Отправка 11-фичной матрицы может изменить ожидаемый вход → при ошибке инференса срабатывает существующий `_neutral_prediction` (`hf_api_error`/`unexpected_response`). Зафиксировать комментарием в коде.
3. **pandas не вводим.** Промт упоминает `_rule_based_signal(df)` с pandas DataFrame — в проекте pandas не используется (numpy — ленивая зависимость). Адаптируем сигнатуру под candles/ohlcv-dict + хелперы `features.py`. Оправданное отклонение от буквы промта в пользу конвенций (см. ARCHITECTURE.md).
4. **emoji ⚠️ в дисклеймере.** Запрет emoji из `RULES.md` касается **frontend production-кода**; дисклеймер — это серверный текст системного промта Groq, emoji допустим.
5. **Сохранение гейта боковика.** Интеграция гибрида не должна сломать `_apply_confidence_gate`/`low_confidence` и существующие тесты `test_patchtst.py`.

## Tasks

### Блок 1 — Нормализация через scaler.pkl (11 признаков)
- [x] **#1** Индикаторы и OHLCV-извлечение в `features.py` (RSI/MACD/Bollinger, pure Python, без pandas).
- [x] **#2** `build_feature_matrix` (11 колонок, строгий порядок) + `apply_scaler` под 2D (`transform`, fit_transform-фоллбэк при отсутствии файла, degrade при shape-mismatch); проводка в `get_prediction`. *(blocked by #1)*
- [x] **#3** Тесты `test_features.py`. *(blocked by #2)*

Порядок колонок (строго):
`['open','high','low','close','volume','rsi','macd','macd_hist','macd_signal','bb_width','bb_pos']`

### Блок 2 — Гибридный сигнал (PatchTST + правила)
- [x] **#4** `_rule_based_signal` (RSI / MACD-кросс / MA-тренд → rule_score ∈ [-1,1]). *(blocked by #1)*
- [x] **#5** `_combine_signals` (60/40 + буст 15% при согласии, кламп [0.15..0.85]).
- [x] **#6** Интеграция в `get_prediction` + поля `patchtst_prob/rule_score/signals_agree`; проброс в `PredictionOut`. *(blocked by #4, #5)*
- [x] **#7** Тесты `test_patchtst.py`. *(blocked by #6)*

### Блок 3 — Улучшенный промт Groq
- [x] **#8** Новый `_build_system_prompt` (структура «АНАЛИЗ АКТИВА», `rule_score_text`, 4-5 предложений, дисклеймер). *(blocked by #6)*
- [x] **#9** Тесты `test_chat.py`. *(blocked by #8)*

### Блок 4 — Дефолтный таймфрейм 1H
- [x] **#10** `interval: 'D'` → `'60'` в `TradingViewModal.tsx`; гарантировать применение при каждом открытии.
- [x] **#11** Фронт-тест `TradingViewModal.test.tsx` (src содержит `interval=60`). *(blocked by #10)*

### Документация
- [x] **#12** Обновить `DESCRIPTION.md` + `app/ml/README.md`. *(blocked by #7, #9)*

## Commit Plan

Промт требует пошаговости: «Делай блоками, после каждого жди подтверждения». Коммит-чекпоинт на каждый блок:

1. После #1–#3 → `feat(ai/features): 11-feature matrix + indicators + scaler.transform`
2. После #4–#7 → `feat(ai/patchtst): hybrid PatchTST + rule-based signal`
3. После #8–#9 → `feat(ai/chat): structured Groq system prompt`
4. После #10–#11 → `feat(asset/ui): default 1H timeframe in TradingView modal`
5. После #12 → `docs(ai): record hybrid signal + 11-feature upgrade`

## Финальный вывод после всех блоков (требование промта)

В завершение реализации вывести:
- Финальный вид `get_prediction()` (псевдокод/схема: candles → matrix(11) → scaler → HF → patchtst_prob_up → rule_score → combine → gate → результат с patchtst_prob/rule_score/signals_agree).
- Пример вывода при DOWN с уверенностью 62%.
