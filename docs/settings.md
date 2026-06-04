[← Несколько дашбордов](multi-dashboard.md) · [Back to README](../README.md) · [Бэкенд API →](backend.md)

# Настройки и валюты

Глобальные настройки интерфейса (`SettingsContext`) и переключатель валют (`CurrencyContext`) — через React Context + localStorage.

## SettingsContext

`src/context/SettingsContext.tsx`

Хранит и применяет пользовательские предпочтения:

| Параметр | Тип | Значение по умолчанию | Где применяется |
|----------|-----|-----------------------|-----------------|
| `theme` | `'light' \| 'dark'` | `'light'` | `data-theme` атрибут на `<html>` |
| `accent` | hex-строка | `'#3b82f6'` | CSS-переменная `--accent` инлайн на `<html>` |
| `notifications` | `{ price, news, system }` | все `true` | локальная логика уведомлений |
| `language` | `'ru' \| 'en'` | `'ru'` | i18n (задел) |
| `defaultCurrency` | `'USD' \| 'EUR' \| 'RUB' \| 'BTC'` | `'USD'` | делегируется в `CurrencyContext` |

Все значения персистируются в localStorage под ключом `fintrack_settings`.

### Тёмная тема

Реализована через `data-theme="dark"` на `<html>` + CSS-переменные оверрайды в `src/index.css`:

```css
[data-theme="dark"] {
  --bg-primary: #0f172a;
  --bg-secondary: #1e293b;
  /* ... */
}
```

Текущий охват — best-effort (основные контейнеры и карточки). Полный охват всех компонентов — follow-up задача.

### Акцентный цвет

Выбирается из закрытой палитры (5 вариантов) и применяется как `--accent` инлайн:

```ts
document.documentElement.style.setProperty('--accent', accent);
```

### Страница `/settings`

`src/pages/SettingsPage.tsx`

Секции:

- **Внешний вид** — выбор темы (Light/Dark) + акцентного цвета (5 кружков из палитры)
- **Уведомления** — три тумблера: цены, новости, системные
- **Валюта по умолчанию** — выбор из 4 вариантов (синхронизируется с `CurrencyContext`)
- **Язык** — RU / EN (задел для i18n)

Навигация: шестерёнка в нижней части `AppSidebar` + пункт меню в popup.

---

## CurrencyContext

`src/context/CurrencyContext.tsx`

Глобальное переключение валюты отображения цен.

| Валюта | Курс берётся из |
|--------|----------------|
| USD | базовая (×1) |
| EUR | usePrices → форекс-пара `USD-EUR` |
| RUB | usePrices → форекс-пара `USD-RUB` |
| BTC | usePrices → крипто-пара `BTC-USDT` |

Курсы обновляются в реальном времени из кэша TanStack Query. Синхронизируются в `utils/format.ts` singleton `currencyState`.

### Что конвертируется, что нет

- **Конвертируется:** все цены через `formatPrice()`, объёмы через `formatVolume()`, капитализация через `formatMarketCap()`.
- **Не конвертируется:** форекс-пары (EUR/USD и т.п.) — их конвертировать бессмысленно.

### CurrencySwitcher

`src/components/layout/CurrencySwitcher.tsx`

Floating кнопка в правом верхнем углу приложения (вне `<Outlet>`):

- Овальная таблетка; активная валюта подсвечивается «пилюлей» с анимацией `layoutId`.
- Стекло через `rgba()` существующих переменных палитры (закрытая дизайн-система — новые цвета не добавлялись).
- Смена валюты → `useCurrency()` в `ProtectedLayout` → перерисовка всего `<Outlet>`.

### Персистентность

Выбранная валюта сохраняется в `localStorage` под ключом `fintrack_currency`. При старте восстанавливается до первого рендера.

## Дерево провайдеров

```
<SettingsProvider>      ← применяет data-theme, --accent
  <CurrencyProvider>    ← восстанавливает валюту из LS, загружает курсы
    <App />
  </CurrencyProvider>
</SettingsProvider>
```

`SettingsProvider` должен быть снаружи `CurrencyProvider`, потому что `defaultCurrency` из Settings инициализирует Currency.

## Ключевые файлы

| Файл | Назначение |
|------|------------|
| `src/context/SettingsContext.tsx` | Контекст настроек + применение theme/accent |
| `src/context/CurrencyContext.tsx` | Контекст валюты + курсы из TanStack Query |
| `src/components/layout/CurrencySwitcher.tsx` | Floating Liquid Glass переключатель |
| `src/pages/SettingsPage.tsx` | Страница `/settings` |
| `src/utils/format.ts` | `convertFromUsd`, `formatPrice`, `formatVolume`, `formatMarketCap` |

## См. также

- [Несколько дашбордов](multi-dashboard.md) — SettingsContext делегирует defaultCurrency
- [Система виджетов](widgets.md) — виджеты используют `formatPrice` из utils/format
- [Бэкенд API](backend.md) — настройки пока в localStorage, не в БД
