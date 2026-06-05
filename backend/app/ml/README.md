# app/ml — модели и препроцессинг PatchTST

Сюда кладётся **`scaler.pkl`** — обученный `scikit-learn`-скейлер (например
`StandardScaler`/`MinMaxScaler`), сериализованный через `joblib.dump`, который
применяется к окну close-цен **перед** отправкой в Hugging Face Inference API.

## Как это работает

- Путь к файлу задаётся в конфиге: `settings.scaler_path` (по умолчанию
  `app/ml/scaler.pkl`, env-переменная `SCALER_PATH`).
- Загрузка ленивая и кэшируется: `services/features.py::load_scaler()`.
- Применение: `services/features.py::apply_scaler()` — окно reshape'ится в
  `(seq_len, 1)` (предполагается **унивариантный** скейлер, обученный на одной
  колонке цены закрытия) и прогоняется через `scaler.transform()`.

## Graceful degradation

Если `scaler.pkl` **отсутствует**, битый, или не установлены `numpy`/`joblib` —
инференс работает на **сырых close-ценах** (поведение как до внедрения скейлера),
с предупреждением в логах. Сервис не падает.

## Как сгенерировать scaler.pkl

Скейлер должен быть обучен **тем же пайплайном**, что и модель
`nikasq/PatchTST-Time-Series-Classifier`:

```python
import joblib
from sklearn.preprocessing import StandardScaler

# closes_train: 2D-массив формы (n_samples, 1) из обучающего набора
scaler = StandardScaler().fit(closes_train)
joblib.dump(scaler, "backend/app/ml/scaler.pkl")
```

> ⚠️ Тип скейлера, набор признаков и `seq_len`
> (`settings.prediction_seq_len`, по умолчанию 100) **обязаны совпадать** с
> обучающим пайплайном модели — иначе предсказания будут некорректны.

Сам `*.pkl` в git не коммитится (см. `.gitignore` в этой папке).
