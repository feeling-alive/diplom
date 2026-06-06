# app/ml — модели и препроцессинг PatchTST

Сюда кладётся **`scaler.pkl`** — обученный `scikit-learn`-скейлер (например
`StandardScaler`/`MinMaxScaler`), сериализованный через `joblib.dump`, который
применяется к матрице признаков **перед** отправкой в Hugging Face Inference API.

> ⚠️ **С 2026-06-06 инференс использует 11-фичную матрицу**, а не окно close-цен.
> Колонки (строгий порядок): `open, high, low, close, volume, rsi, macd,
> macd_hist, macd_signal, bb_width, bb_pos` (см. `services/features.py::FEATURE_ORDER`).
> **Текущий закоммиченный `scaler.pkl` обучен на одной колонке (close)**, поэтому
> `scaler.transform()` на матрице 11×N бросает shape-mismatch — `apply_scaler`
> это ловит и **graceful degrade на сырую матрицу** (предсказание продолжает
> работать, но без нормализации). Полноценная нормализация заработает только
> после **переобучения скейлера на всех 11 признаках** (см. ниже).

## Как это работает

- Путь к файлу задаётся в конфиге: `settings.scaler_path` (по умолчанию
  `app/ml/scaler.pkl`, env-переменная `SCALER_PATH`).
- Загрузка ленивая и кэшируется: `services/features.py::load_scaler()`.
- Применение: `services/features.py::apply_scaler()` — матрица признаков
  `(seq_len, 11)` прогоняется через `scaler.transform()` (теперь **мультивариантный**
  скейлер, обученный на всех 11 колонках). Для обратной совместимости функция всё
  ещё принимает и 1D-окно (`(seq_len, 1)`).

## Graceful degradation

`apply_scaler` никогда не валит сервис:

- `scaler.pkl` **отсутствует** / битый / нет `numpy`·`joblib` → `fit_transform`
  на текущем окне «на лету» (свежий `StandardScaler`), с предупреждением в логах.
- `scaler.transform()` бросает ошибку (например, форма скейлера не совпадает с
  матрицей — текущий унивариантный `scaler.pkl` на 11 колонках) → degrade на
  **сырую матрицу признаков**, с предупреждением. Предсказание продолжает работать.

## Как сгенерировать scaler.pkl

Скейлер должен быть обучен **тем же пайплайном**, что и модель
`nikasq/PatchTST-Time-Series-Classifier`, на **матрице 11 признаков** в порядке
`services/features.py::FEATURE_ORDER`:

```python
import joblib
from sklearn.preprocessing import StandardScaler

# X_train: 2D-массив формы (n_samples, 11) — колонки в порядке FEATURE_ORDER:
# open, high, low, close, volume, rsi, macd, macd_hist, macd_signal, bb_width, bb_pos
scaler = StandardScaler().fit(X_train)
joblib.dump(scaler, "backend/app/ml/scaler.pkl")
```

> ⚠️ Тип скейлера, **набор и порядок признаков (11 колонок)** и `seq_len`
> (`settings.prediction_seq_len`, по умолчанию 100) **обязаны совпадать** с
> обучающим пайплайном модели — иначе предсказания будут некорректны.

Сам `*.pkl` в git не коммитится (см. `.gitignore` в этой папке).
