# План: Профиль пользователя + Подписка (Блок C + G)

- **Тип:** feature (полная реализация модуля профиля и подписки)
- **Ветка:** master (git.create_branches=false — работаем на текущей ветке)
- **Дата:** 2026-06-02
- **Источник ТЗ:** `promt.md` + уточнения пользователя

## Ключевое решение по дизайну

ТЗ из `promt.md` написано под **MUI + Redux + тёмный glassmorphism mesh-градиент**. Реальный проект использует:
- **светлую дизайн-систему** (`#F4F3F1` фон, белые скруглённые карточки, акцент-роза `#E11D48`, Inter, inline-стили + CSS-переменные, framer-motion, lucide-react);
- **React Context, НЕ Redux** (`src/context/AuthContext.tsx`, `useAuth`);
- **никакого MUI** (см. `.ai-factory/RULES.md`, `ARCHITECTURE.md`).

По решению пользователя («оставить тот, который больше подходит сайту, цена в ₽») реализуем модуль в **светлой дизайн-системе сайта**, а не по MUI-макету из промта. Выбран вариант **«Светлый Hero + 2 карточки»**: широкая шапка с мягким градиентом `accent-bg → white` и парящими розовыми кругами, аватар внахлёст, ниже две карточки — слева редактирование профиля, справа подписка. Цены — в рублях (апгрейд 990₽/мес, зачёркнуто 1499₽).

## Настройки

- **Тесты:** да — только бэкенд (`backend/tests/test_profile.py`). Фронтовые тесты не пишем.
- **Логирование:** verbose (`console.debug('[Component] …')` на фронте, `logger.debug/info` на бэке) — конвенция проекта.
- **Документация:** warn-only (без обязательного docs-чекпоинта).
- **Roadmap linkage:** none (не привязывался).

## Контекст кодовой базы (факты на момент планирования)

- `ProfilePage.tsx` — сырой неоформленный HTML-плейсхолдер → полный rewrite.
- `SubscriptionPage.tsx` — уже в дизайн-системе, но на `localStorage('fintrack_plan')` и с эмодзи (⭐/✓) → рефактор под бэкенд, убрать эмодзи.
- Бэкенд: модели `User` + `Subscription` есть; при регистрации создаётся free-подписка. **Нет** роутов `/users` и `/subscription`, нет загрузки аватара, нет mount `/uploads`. У `Subscription` нет колонки счётчика AI-запросов. CORS разрешает только `GET,POST` (нужен `PATCH`). `pillow`/`python-multipart`/`aiofiles` уже в `requirements.txt`.
- `UserResponse` (исп. `/auth/me`) не включает подписку — **не менять**, для `/users/me` отдельная схема.
- `AuthContext` имеет `setUser`, но нет `updateUser(partial)`.
- Сайдбар (`AppSidebar.tsx`): аватар захардкожен буквой «Н», меню нет.
- Тесты бэка: `conftest.py` поднимает sqlite in-memory через `Base.metadata.create_all` (новая колонка появится автоматически), регистрация даёт cookie клиенту.

## Границы (scope)

- **Не трогать:** роуты `/api/quotes/*`, `/auth/*`, хуки котировок, страницы кроме `ProfilePage`, `SubscriptionPage` и `AppSidebar`.
- Новых роутов фронта не заводить (пункт «Настройки» в меню сайдбара временно ведёт на `/profile`).
- Аватар-картинки разрешены, т.к. self-hosted через `/uploads` (не внешний URL) — соответствует духу правила дизайн-системы; fallback — CSS-круг с инициалом.

## Задачи

### Фаза 1 — Бэкенд: данные и роуты
1. [x] **ai_requests_used в Subscription + миграция Alembic** — колонка-счётчик + ревизия (down_revision `22708b5bcbc0`).
2. [x] **`backend/app/routes/profile.py` (`/users`)** — GET/PATCH `/users/me`, `check-username`, POST `avatar` (Pillow 200×200 center-crop). *(blockedBy: 1)*
3. [x] **`backend/app/routes/subscription.py` (`/subscription`)** — `status`, `upgrade` (30 дн), `cancel`. *(blockedBy: 1)*
4. [x] **`main.py`** — include routers, CORS `+PATCH`, `StaticFiles` mount `/uploads`, создание `uploads/avatars`. *(blockedBy: 2,3)*
5. [x] **Vite proxy** — `/users`, `/subscription`, `/uploads` → `:8000` (аддитивно).

### Фаза 2 — Бэкенд: тесты
6. [x] **`backend/tests/test_profile.py`** — get/unauth/update/taken/check/upgrade/already-premium. *(blockedBy: 4)* ✅ 7/7 проходят

> **Checkpoint commit** после фазы 1–2:
> `feat(backend): профиль + подписка — роуты /users и /subscription, аватары, миграция, тесты`

### Фаза 3 — Фронтенд: слой данных
7. [x] **`src/lib/profileApi.ts`** — fetch-обёртки + типы (`ProfileData`, `SubscriptionInfo`, `SubscriptionStatus`).
8. [x] **`src/hooks/useProfile.ts` + `src/hooks/useSubscription.ts`** — состояние, debounce check-username, upgrade/cancel + refetch. *(blockedBy: 7)*
9. [x] **`AuthContext.updateUser(partial)`** — обновление аватара/ника без повторного `/auth/me`.

### Фаза 4 — Фронтенд: UI
10. [x] **`components/profile/`** — `ProfileHero`, `AvatarUploader`, `ProfileEditCard` (светлый Hero, дизайн-система). *(blockedBy: 8,9)*
11. [x] **`components/ui/SubscriptionCard.tsx`** — общий компонент Free/Premium-переключателя (исп. профиль и `/subscription`). *(blockedBy: 8)*
12. [x] **Rewrite `ProfilePage.tsx`** — Hero + 2 карточки, оркестрация хуков. *(blockedBy: 10,11)*
13. [x] **Рефактор `SubscriptionPage.tsx`** — на `useSubscription` + `SubscriptionCard`, убрать localStorage и эмодзи. *(blockedBy: 11)*
14. [x] **Сайдбар** — реальный аватар из `useAuth` + всплывающее меню (Профиль/Настройки/Выйти), сохранить `data-testid`. *(blockedBy: 9)*

> **Checkpoint commit** после фазы 3–4:
> `feat(frontend): модуль профиля + подписки (светлый Hero, общий SubscriptionCard, меню сайдбара)`

## Контракты API (для согласования фронт/бэк)

```
GET   /users/me                  -> { id, email, username, avatar_url, role, created_at,
                                       subscription: { plan, expires_at, ai_requests_used, ai_requests_limit } }
PATCH /users/me                  { username } -> профиль (как GET) | 409 если занят
GET   /users/me/check-username?username=  -> { available: bool }
POST  /users/me/avatar           multipart file -> { avatar_url }
GET   /subscription/status       -> { plan, expires_at, features:{ ai_requests_per_day,
                                       ai_requests_used_today, advanced_charts, export_data, priority_updates } }
POST  /subscription/upgrade      -> status | 400 если уже premium
POST  /subscription/cancel       -> status (free)
```

Лимиты/фича-флаги выводятся из `plan` в коде (free: 5 / всё false; premium: 9999 / всё true), в БД не хранятся.

## Проверка (demo-сценарий)

1. Регистрация → `/profile`.
2. Аватар: загрузить фото → появляется в профиле и в сайдбаре.
3. Ник: сменить → проверка уникальности в реальном времени.
4. Подписка Free → вкладка Premium → «Перейти» → карточка трансформируется в Premium-статус.
5. После refresh — всё сохраняется (бэкенд, не localStorage).
6. `pytest -q` в `backend/` — зелёный.
