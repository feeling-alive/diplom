# План: детали индикаторов → новый промт → новый бейдж

**Дата:** 2026-06-06
**Ветка:** master (git.create_branches=false — ветка не создаётся)
**Источник:** `promt.md` («Три связанных изменения. Делай блоками»)
**Тип:** enhancement (расширение существующего гибридного AI-модуля)

## Настройки

- **Тесты:** да — обновить `test_patchtst.py` / `test_chat.py`, добавить фронт-тест бейджа
- **Логирование:** verbose (DEBUG `[patchtst]` / `[chat]` / `[AIPanel]` — в стиле существующего кода)
- **Документация:** warn-only (отдельного docs-чекпоинта не требуется; при желании обновить `STRUCTURE-ai-chat.md`)
- **Язык артефактов:** ru

## Roadmap Linkage

Milestone: "none" — Rationale: `.ai-factory/ROADMAP.md` в проекте отсутствует.

## Контекст / отправная точка (уже в коде)

Гибридный сигнал уже реализован (коммиты `716b31b…d62a8d8`):
- `backend/app/services/patchtst.py`: `_rule_based_signal(candles) -> float` (RSI/MACD-кросс/тренд SMA20-vs-SMA50), `get_prediction()` возвращает `patchtst_prob`, `rule_score`, `signals_agree`.
- `backend/app/routes/chat.py`: `PredictionOut` + `_to_prediction_out` + `_build_system_prompt(...)` (старый блок «АНАЛИЗ АКТИВА») + `_rule_score_text` + `_DISCLAIMER`.
- `frontend/src/components/asset/AIPanel.tsx`: `PredictionBadge({direction, probability, lowConfidence})`.
- `frontend/src/hooks/useGroqChat.ts`: `PredictionInfo { direction, probability, source, low_confidence }`.

Эта задача **надстраивается** над этим: добавляет детальные индикаторы, упрощает промт под них и заменяет бейдж на основанный на `rule_score`.

## Ключевые решения / нюансы

1. **`_rule_based_signal` меняет сигнатуру** `float -> tuple[float, dict]`. Единственный прод-вызов — в `get_prediction()`. Autouse-фикстура в `test_patchtst.py` (монкипатч `-> 0.0`) и прямые юнит-тесты должны вернуть кортеж.
2. **SMA20-guard (уточнение #13)**: существующий код считает `sma20`/`sma50` только внутри `len(closes) >= 50`. Но `price_vs_sma20` и `trend` осмысленны с ~20 свечей → считать `sma20` под отдельным guard `len(closes) >= 20`. `<20` свечей → `price_vs_sma20 = 0.0`, `trend = "смешанный"`, без деления на ноль.
3. **news_block + сентинел-константа (уточнение #15)**: вынести `_NO_NEWS_SENTINEL` в модульную константу `chat.py`, `_get_news_context` возвращает её в пустом случае, промт-билдер ветвится по `has_news = news_context not in («», _NO_NEWS_SENTINEL)`. Единый источник правды — без молчаливого дрейфа литерала.
4. **Деградация**: `indicator_details` может быть `{}` (мало свечей). И в `get_prediction`, и в промте — доступ через `.get(...)` с безопасными дефолтами, без KeyError / деления на ноль.
5. **Семантика промта**: новый промт опирается ТОЛЬКО на rule-based индикаторы + `rule_score_text`; PatchTST UP/DOWN/probability из текста промта убираются (намеренно, по спеку).
6. **Дисклеймер хардкодом** добавляется к ответу Groq в ветке актива ДО сохранения в БД (чтобы он попал и в историю).
7. **Бейдж**: рендерить безусловно — `null/undefined rule_score` сам даёт состояние «Загрузка…» (Loader2-спиннер). Без процентов, без «боковика».

## Задачи

### Фаза 1 — Блок 1: детали индикаторов (backend)
- [x] **#13** `_rule_based_signal` → `(rule_score, indicator_details)`; распаковка в `get_prediction()` + success-dict + `_neutral_prediction` default
- [x] **#14** проброс `indicator_details` в `PredictionOut` + `_to_prediction_out` *(blocked by #13)*

### Фаза 2 — Блок 2: новый системный промт (backend)
- [x] **#15** переписать `_build_system_prompt()` под `indicator_details` + `_build_news_block` + `_NO_NEWS_SENTINEL` *(blocked by #14)*
- [x] **#16** проброс `indicator_details` из `chat_message`; хардкод дисклеймера на ответ Groq *(blocked by #15)*

### Фаза 3 — Блок 3: новый бейдж (frontend)
- [x] **#18** добавить `rule_score` (+`indicator_details`) в `PredictionInfo` (`useGroqChat.ts`)
- [x] **#17** переписать `PredictionBadge` под `ruleScore` + обновить вызов в `AIPanel` (импорт `Loader2`) *(blocked by #18)*

### Фаза 4 — Тесты
- [x] **#19** backend-тесты: кортеж, `indicator_details`, новый промт, дисклеймер *(blocked by #16)* — 50 passed
- [x] **#20** frontend-тест бейджа + `tsc`/eslint *(blocked by #17, #18)* — 11 passed, tsc/eslint clean

### Фаза 5 — Демонстрация
- [x] **#21** пример итогового промта + ответа Groq для нисходящего сценария (RSI=32, MACD ниже сигнальной, цена ниже SMA50, без новостей) *(blocked by #16)*

## План коммитов (9 задач → чекпоинты)

1. **Блок 1** (после #13, #14): `feat(ai): rule_based_signal returns indicator details; thread through PredictionOut`
2. **Блок 2** (после #15, #16): `feat(ai/chat): indicator-driven system prompt + hardcoded disclaimer`
3. **Блок 3** (после #17, #18): `feat(ui): rule_score-based PredictionBadge`
4. **Тесты** (после #19, #20): `test(ai/ui): coverage for indicator_details, prompt, badge`

(#21 — демонстрация в чате, без коммита.)

## Как тестировать

Backend (из `backend/`):
```
python -m pytest tests/test_features.py tests/test_patchtst.py tests/test_chat.py -q
```
Frontend (из `frontend/`):
```
npx tsc --noEmit
npx vitest run src/components/asset/__tests__/
```
Ручная: `npm run dev` → страница актива → вкладка «Про график» → бейдж показывает «Бычий/Медвежий/Нейтральный» (или «Загрузка…»), без процентов; ответ чата заканчивается дисклеймером.
