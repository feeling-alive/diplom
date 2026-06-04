# Plan: 3 точечных UI-фикса (News / Profile / PremiumModal)

**Дата:** 2026-06-04  
**Режим:** fast  
**Ветка:** master (create_branches: false)

## Настройки

- **Тесты:** нет
- **Логирование:** verbose (существующие `console.debug`)
- **Документация:** warn-only

---

## Задачи

### Фикс 1 — NewsPage (`/news`)

**Файл:** `frontend/src/pages/NewsPage.tsx`

- [x] **Задача 1** — Убрать белую карточку-обёртку и заголовок:
  - Удалить внешний `<div>` с `background:'var(--white)', boxShadow:'var(--shadow-lg)', borderRadius:22`
  - Удалить внутренний скролл-контейнер `<div style={{ flex:1, overflowY:'auto', padding:'16px 20px 24px' }}>` (оставить только содержимое)
  - Удалить тег `<h1>📰 Новости рынка</h1>` и `<p>` подзаголовок под ним
  - Корневой `<div>` оставить с `padding:16, height:'100%', boxSizing:'border-box'` — это уже правильный контейнер
  - Добавить `overflowY:'auto'` на корневой div чтобы сохранить скролл
  - Результат: страница начинается прямо со строки поиска, фон совпадает с `--bg` (как дашборд)

---

### Фикс 2 — ProfileHero градиент

**Файл:** `frontend/src/components/profile/ProfileHero.tsx`

- [x] **Задача 2** — Сделать градиент баннера зависимым от темы:
  - Добавить `import { useSettings } from '../../context/SettingsContext'`
  - Внутри `ProfileHero` добавить: `const { theme } = useSettings()`
  - Вычислить `const isDark = theme === 'dark'`
  - Заменить хардкод градиента на условный:
    ```
    isDark
      ? 'linear-gradient(135deg, #1a1a2e 0%, #2d1b3d 40%, #1e0a14 100%)'
      : 'linear-gradient(135deg, #fdf2f5 0%, #fce7ed 50%, #f9d0da 100%)'
    ```
  - Адаптировать цвета текста на баннере:
    - Имя пользователя: `isDark ? '#fff' : 'var(--ink)'`
    - Email/since: `isDark ? 'rgba(255,255,255,0.8)' : 'var(--muted)'`
    - role badge: убрать хардкод `rgba(255,255,255,0.2)` — заменить на `isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.08)'` для фона и `isDark ? '#fff' : 'var(--ink)'` для цвета текста

---

### Фикс 3 — PremiumModal компонент

**Файлы:** `frontend/src/components/ui/PremiumModal.tsx` (новый), `frontend/src/pages/Dashboard.tsx`

- [x] **Задача 3** — Вынести апгрейд-модалку в отдельный компонент:
  - Создать `frontend/src/components/ui/PremiumModal.tsx`:
    - Props: `{ open: boolean; onClose: () => void; dashboardLimit: number }`
    - Использовать `AnimatePresence` + `motion.div` (framer-motion, не MUI)
    - Overlay: НЕ закрывается по клику вне (убрать `onClick` с overlay), только X-кнопка
    - X-кнопка (lucide `X`, size 16) в правом верхнем углу карточки
    - Содержимое: Crown иконка (gold gradient), заголовок "Нужен Premium", подзаголовок "Вы достигли лимита дашбордов"
    - Список фич со звёздочкой `★`: До 5 кастомных дашбордов / Безлимитный ИИ-ассистент / Значок Premium в профиле / Безлимитные запросы к ИИ
    - Цена: `990₽ / месяц`, зачёркнутая `1499₽`
    - Кнопка "Перейти на Premium" (`.sub-shimmer`, navigate('/subscription') + onClose)
    - Кнопка "Остаться на Free" (текстовая, только onClose)
    - `console.debug('[PremiumModal] open=%s', open)` при рендере
  - Обновить `Dashboard.tsx`:
    - Убрать inline-блок апгрейд-модалки (весь `{showUpgradeModal && <motion.div ...>}`)
    - Убрать `Crown, X` из импорта lucide (если больше нигде не используются)
    - Импортировать `PremiumModal` из `../components/ui/PremiumModal`
    - Заменить на `<PremiumModal open={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} dashboardLimit={dashboardLimit} />`

---

## Commit план

Один коммит после всех задач:
```
fix(ui): news header, profile gradient theme-aware, PremiumModal component
```
