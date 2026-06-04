[← Система виджетов](widgets.md) · [Back to README](../README.md) · [Настройки и валюты →](settings.md)

# Несколько дашбордов

До 5 именованных дашбордов с каруселью таблеток, добавлением, удалением и переименованием — без миграций БД.

## Архитектурное решение

Несколько дашбордов хранятся **внутри существующей JSON-колонки** `DashboardConfig.layout` в виде envelope-объекта. Миграция схемы БД не понадобилась.

```json
{
  "dashboards": [
    { "id": "uuid-1", "name": "Основной", "layout": [...виджеты...] },
    { "id": "uuid-2", "name": "Крипто",   "layout": [...виджеты...] }
  ],
  "activeId": "uuid-1"
}
```

Бэкенд хранит это значение непрозрачно — он не интерпретирует структуру виджетов, только применяет лимиты (см. ниже).

## Обратная совместимость

При чтении бэкенд вызывает `_normalize_to_envelope()`:

| Что хранится в БД | Что возвращается |
|---|---|
| `null` (новый пользователь) | Дефолтный envelope: 1 дашборд «Основной» с 4 виджетами |
| Старый массив виджетов `[...]` | Оборачивается в envelope (1 дашборд «Основной») |
| Envelope `{dashboards, activeId}` | Возвращается как есть (с коррекцией `activeId` если не найден) |

Фронт зеркалит ту же логику в `lib/dashboardLayout.ts` → `normalizeToEnvelope()` (для localStorage-fallback).

## Лимиты

| Параметр | Значение |
|---|---|
| Максимум дашбордов | 5 |
| Максимум виджетов на дашборд | 100 |
| Минимум дашбордов | 1 (последний удалить нельзя) |

При превышении лимита 5 дашбордов бэкенд возвращает `400`. Кнопка «+» на фронте дизейблится при достижении 5 с подсказкой.

## Компоненты

### `DashboardTabs`

`src/components/dashboard/DashboardTabs.tsx`

Карусель таблеток с анимацией через Framer Motion `layoutId`:

- Активная таблетка плавно перемещается при переключении.
- `«×»` появляется при hover; клик вызывает `window.confirm` перед удалением.
- Скрыт при 1 дашборде (нет смысла показывать карусель из одного пункта).
- Кнопка `«+»` disabled при 5 дашбордах; при нажатии запрашивает имя через `prompt`.

### `useDashboardConfig`

`src/hooks/useDashboardConfig.ts`

Хук управляет всем envelope-состоянием:

```ts
const {
  widgets,      // виджеты активного дашборда
  mutate,       // сохранить текущие виджеты
  switchDashboard(id),
  addDashboard(name),
  removeDashboard(id),
  renameDashboard(id, name),
  dashboards,   // список { id, name }
  activeId,
} = useDashboardConfig();
```

PUT в БД дебаунсируется 600 мс.

## localStorage-fallback

Гость (не авторизован) → весь envelope в `localStorage` под ключом `fintrack_dashboard_v4`.

Авторизованный пользователь → бэкенд как источник правды; localStorage — офлайн-кэш:

1. При загрузке страницы: запрос на бэкенд (показывается «Загрузка дашборда…»).
2. При ошибке сети: fallback на последний кэш из localStorage.
3. При успехе: кэш обновляется.
4. Любое изменение (DnD, добавление виджета, смена дашборда) → дебаунсированный PUT.

## Ключевые файлы

| Файл | Назначение |
|------|------------|
| `src/hooks/useDashboardConfig.ts` | Единый хук: envelope, switch/add/remove/rename, sync с бэкендом |
| `src/lib/dashboardApi.ts` | `GET /dashboard/config`, `PUT /dashboard/config` (типы + fetch) |
| `src/lib/dashboardLayout.ts` | Envelope-хелперы, `createDefaultEnvelope`, `normalizeToEnvelope`, localStorage |
| `src/components/dashboard/DashboardTabs.tsx` | Карусель таблеток |
| `backend/app/routes/dashboard.py` | GET/PUT + `_normalize_to_envelope` + валидация лимитов |
| `backend/tests/test_dashboard.py` | 9 тестов (дефолт, 401, wrap-массива, roundtrip, лимиты) |

## См. также

- [Система виджетов](widgets.md) — DnD, resize, edit mode
- [Бэкенд API](backend.md) — роут `/dashboard/config`, схема БД
- [Настройки и валюты](settings.md) — SettingsContext, CurrencyContext
