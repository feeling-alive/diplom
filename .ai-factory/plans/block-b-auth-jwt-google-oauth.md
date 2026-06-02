# План: Блок B — Аутентификация (JWT cookie + Google OAuth + фронт)

**Slug:** `block-b-auth-jwt-google-oauth`
**Ветка:** не создаётся (`git.create_branches=false`) — работа на `master`
**Дата создания:** 2026-06-02
**Источник требований:** `promt.md` (Блок B)

## Цель

Полноценная система аутентификации: backend (FastAPI) с регистрацией/входом/выходом
по JWT в HttpOnly-cookie, профилем `/auth/me`, Google OAuth (с graceful 501 при
ненастроенных ключах); frontend — сессия через React Context (`useAuth`),
защищённые роуты, реальные формы входа/регистрации. Поверх слоя данных Блока A
(модели `User`/`Subscription` уже есть).

## Настройки

- **Тесты:** да — backend pytest (register/login/401, по требованию промта),
  детерминированы на sqlite in-memory без живого Postgres.
- **Логирование:** verbose — INFO/DEBUG на register/login/logout/oauth (backend) и
  `console.debug('[useAuth]/[LoginPage]/...')` (frontend). **Секреты/пароли/токены
  никогда не логируются** — только present/ABSENT или маскирование.
- **Docs:** да — обязательный чекпоинт (обновить `backend/README.md`: auth-эндпоинты,
  cookie, Google OAuth, env-переменные).

## Roadmap Linkage

Milestone: "none"
Rationale: Roadmap-артефакт (`.ai-factory/ROADMAP.md`) отсутствует — линковка пропущена.

## Контекст текущего кода и ключевые отклонения от промта

Промт писался под другой стек. Реализуем суть (cookie-JWT, эндпоинты, Google OAuth,
защита роутов), но с поправками под реальный проект:

1. **Frontend без Redux.** Промт просит `src/store/authSlice.ts` (Redux Toolkit) —
   в проекте Redux НЕ установлен и ARCHITECTURE предписывает Context для auth user.
   → Реализуем `frontend/src/context/AuthContext.tsx` (`AuthProvider` + `useAuth`).
   Без новых тяжёлых зависимостей.
2. **Frontend без MUI.** Промт просит `CircularProgress`/`Alert` из MUI — MUI не
   установлен, RULES запрещают UI вне дизайн-системы. → Спиннер и «alert» — на
   дизайн-системе (CSS-переменные, lucide, framer-motion).
3. **Пути — `frontend/src/`,** а не `src/` (монорепо frontend/ + backend/).
4. **Текущая auth — mock на localStorage** (`fintrack_is_authenticated`,
   `fintrack_user`): пишется в Login/Register, читается `RoutesGuard` (`AdminRoute`)
   и `AppSidebar` (logout). Эти ключи читают компоненты, которые промт просит НЕ
   трогать → `AuthProvider` **зеркалирует** состояние в те же localStorage-ключи
   (back-compat), чтобы `AppSidebar`/`AdminRoute`/`ProfilePage` не сломались.
5. **`RoutesGuard.tsx`** (экспорт `PrivateRoute`) уже существует и используется в
   `App.tsx` — обновляем его на `useAuth` (это «router/guard», Шаг 6 промта), сохраняя
   имена экспортов, чтобы импорты в `App.tsx` не менялись. Отдельный
   `components/ProtectedRoute.tsx` не плодим.
6. **Обоснованное исключение из «не трогай компоненты»:** logout в `AppSidebar.tsx`
   сейчас лишь чистит localStorage и не завершает серверную сессию (cookie остаётся).
   Делаем точечную правку ОДНОГО обработчика на `useAuth().logout()`. Если не трогать —
   серверный logout будет неполным (зафиксировано как риск).
7. **Конфиг — pydantic-settings** (как в Блоке A): новые поля идут в класс `Settings`.
   JWT-поля (`secret_key`/`algorithm`/`access_token_expire_minutes`) уже есть из Блока A.
8. **CORS:** в `main.py` сейчас `allow_methods=["GET"]` → добавляем `POST`
   (`allow_credentials=True` уже стоит — нужно для cookie). Через vite-proxy `/auth`
   запросы идут same-origin (localhost:5173), что снимает cross-site-cookie проблемы.
9. **`email-validator`** добавляется в requirements (нужен для `EmailStr`).
10. **PostgreSQL слушает на host-порту 5433** (нативный PG занимает 5432) — backend
    запускать с `DATABASE_URL=...@localhost:5433/...`.

**Не трогать:** `/api/quotes/*` и `backend/app/routes/*`, хуки котировок
(`useAssetPrice/usePrices/useStockPrice/useForexRate/useOHLCV/...`), компоненты фронта
кроме `LoginPage`, `RegisterPage`, `App.tsx`/router, `RoutesGuard`, `main.tsx`,
`AppSidebar` (только обработчик logout), `vite.config.ts` (только +правило `/auth`).

## Архитектурные рамки

- Backend: новый модуль `backend/app/auth/` (`utils`, `schemas`, `dependencies`,
  `router`) — отдельный вертикальный срез, в БД ходит только через `get_db`/модели.
- Frontend: `context/AuthContext.tsx` (кросс-срезовый auth user — единственный
  оправданный Context по ARCHITECTURE), `lib/authApi.ts` (мост к `/auth/*`),
  guard в `components/layout/`. Цвета/типографика — только дизайн-система (RULES).

## Задачи по фазам

### Фаза 1 — Backend: конфиг и зависимости
- [x] **Task 10** — requirements: `email-validator`; `Settings`: `google_client_id`,
  `google_client_secret`, `backend_url`, `frontend_url`; маскирующее логирование; `.env.example`.

### Фаза 2 — Backend: ядро auth
- [x] **Task 11** — `auth/utils.py`: bcrypt hash/verify, JWT create/decode (прямой bcrypt вместо passlib). _blocked: 10_
- [x] **Task 12** — `auth/schemas.py`: Register/Login/User/Token (UUID/Enum→str). _blocked: 10_
- [x] **Task 13** — `auth/dependencies.py`: `get_current_user` (cookie→JWT→User), `require_admin`. _blocked: 11_

### Фаза 3 — Backend: роуты
- [x] **Task 14** — `auth/router.py`: register/login/logout/me + cookie. _blocked: 11,12,13_
- [x] **Task 15** — Google OAuth `/auth/google` + `/auth/google/callback` (501 если не настроено). _blocked: 14,10_
- [x] **Task 16** — подключить роутер в `main.py` + CORS `GET`→`GET,POST`. _blocked: 14,15_

### Фаза 4 — Frontend: auth-слой
- [x] **Task 17** — `lib/authApi.ts` + `context/AuthContext.tsx` (`useAuth`, /auth/me на mount, зеркало localStorage). _blocked: 16_
- [x] **Task 18** — смонтировать `AuthProvider` в `main.tsx`. _blocked: 17_

### Фаза 5 — Frontend: guard, страницы, proxy
- [x] **Task 19** — обновить `RoutesGuard` (PrivateRoute/AdminRoute) на `useAuth` + спиннер дизайн-системы. _blocked: 17,18_
- [x] **Task 20** — `LoginPage`: реальный логин, Google-кнопка, alert, редирект залогиненного. _blocked: 17_
- [x] **Task 21** — `RegisterPage`: реальная регистрация, валидация, alert, редирект. _blocked: 17_
- [x] **Task 22** — `AppSidebar` logout → `useAuth().logout()` (точечная правка). _blocked: 17_
- [x] **Task 23** — `vite.config.ts`: proxy `/auth → :8000`. _независима_

### Фаза 6 — Тесты и проверка
- [x] **Task 24** — backend pytest: register/login/login-401/me-401 на sqlite (conftest + override `get_db`). _blocked: 16_
- [x] **Task 25** — финальная сквозная проверка (Шаг 9 промта). _blocked: 16,19,20,21,22,23,24_

## Граф зависимостей (упрощённо)

```
10 ─┬─> 11 ─> 13 ─┐
    └─> 12 ───────┼─> 14 ─> 15 ─> 16 ─┬─> 17 ─┬─> 18 ─> 19 ─┐
                  │                    │       ├─> 20 ──────┤
                  │                    │       ├─> 21 ──────┤
                  │                    │       └─> 22 ──────┤
                  │                    └─> 24 ──────────────┤
23 ─────────────────────────────────────────────────────────┴─> 25
```

## Commit Plan (чекпоинты)

> 16 задач → чекпоинты по фазам. Conventional Commits.

1. **После Task 10–13** — backend core:
   `feat(backend): auth core — JWT/bcrypt utils, Pydantic-схемы, get_current_user`
2. **После Task 14–16** — backend routes:
   `feat(backend): /auth роуты (register/login/logout/me) + Google OAuth + CORS`
3. **После Task 17–19** — frontend session+guard:
   `feat(frontend): AuthContext/useAuth + защита роутов (адаптация без Redux/MUI)`
4. **После Task 20–23** — frontend pages+proxy:
   `feat(frontend): реальные формы Login/Register, logout, vite proxy /auth`
5. **После Task 24–25** — tests+verify:
   `test(backend): pytest для register/login (+401)`

## Критерии готовности (DoD)

- `POST /auth/register` создаёт User+Subscription, ставит HttpOnly cookie, → UserResponse.
- `POST /auth/login` валидирует пароль (401 при неверном), 403 при `is_active=False`.
- `GET /auth/me` по cookie возвращает пользователя; без cookie → 401.
- `GET /auth/google` → 501 при пустом `GOOGLE_CLIENT_ID`; callback линкует/создаёт User.
- Frontend: незалогиненный на `/` → `/login`; регистрация/логин ведут на дашборд;
  logout завершает сессию (после refresh остаёмся разлогинены).
- `pytest -q` зелёный; `tsc --noEmit`/`npm run build` без ошибок.
- Секреты/токены не утекают в логи; `/api/quotes/*` и хуки котировок не затронуты.
- `backend/README.md` обновлён (docs-чекпоинт).

## Риски

- **Cookie через прокси:** работает как same-origin; при прямом обращении фронта на
  :8000 (без прокси) HttpOnly cross-site cookie может не ставиться — поэтому правило
  vite-proxy `/auth` обязательно.
- **sqlite в тестах:** один in-memory engine на тест (StaticPool), иначе таблицы не
  видны между соединениями.
- **AppSidebar:** правка logout — единственное отступление от «не трогай компоненты»,
  явно согласовано в плане.
