# Административная панель (Admin Panel)

**Дата:** 2026-06-11  
**Режим:** full (no branch, create_branches=false)  
**Файл плана:** `.ai-factory/plans/feature-admin-panel.md`

---

## Settings

| Параметр       | Значение  |
|----------------|-----------|
| **Testing**    | yes       |
| **Logging**    | verbose — `logger.debug("[admin] ...")` бэкенд, `console.debug('[AdminPage] ...')` фронтенд |
| **Docs**       | yes — обязательный `/aif-docs` чекпойнт после завершения |

---

## Контекст разведки

### Ключевые факты по бэкенду
- **Текущая HEAD-миграция:** `b2c3d4e5f6a7_add_notifications_table`
- **User.is_active** уже существует и уже проверяется в `get_current_user` / login. Вместо нового поля `is_blocked` используем существующий `is_active` (инвертируем: `is_blocked=true` → `is_active=false`). Миграция не нужна для блокировки — нужна только для `api_keys` и `admin_logs`.
- **User.last_login** — поля нет в модели. `GET /admin/users` возвращает `last_login: null` без новой миграции (промт говорит «если есть»).
- **Comment.parent_id** — `ondelete="SET NULL"`, NOT CASCADE. Удаление реплик нужно делать **вручную** до удаления родителя: `DELETE FROM comments WHERE parent_id = :id`.
- **Subscription.ai_requests_used** — поле существует (не `ai_requests_today`). Для `/admin/stats` возвращаем `SUM(ai_requests_used)` как `ai_requests_today` (нет date-based reset в демо).
- **require_admin** в `auth/dependencies.py` уже реализован и проверяет `is_active`.
- **Text** тип нужно добавить в импорты `models.py` (сейчас отсутствует).

### Ключевые факты по фронтенду
- **AdminPanelPage.tsx** уже существует: custom CSS + Framer Motion + lucide-react. Нужно полностью перезаписать с сохранением того же дизайн-подхода.
- **MUI НЕ установлен** (`@mui/material` отсутствует в `package.json`). Использовать **только**: CSS-переменные (`var(--accent)`, `var(--muted)` и др.), Framer Motion, lucide-react. Никаких MUI-компонент.
- **AdminRoute** уже реализован в `RoutesGuard.tsx` как named export. В App.tsx текущий импорт: `import PrivateRoute from '...RoutesGuard'`. Нужно: `import PrivateRoute, { AdminRoute } from '...RoutesGuard'`.
- **Паттерн API:** native fetch + `credentials: 'include'`, функция `parseError()`, ручные хуки (useState + useEffect). **Без TanStack Query, без axios.**
- **Proxy:** нужно добавить `/admin` → `http://localhost:8000` в `vite.config.ts`.
- **Иконки lucide-react** (замена MUI): Users, Star, Newspaper, Bot, ShieldCheck, Ban, CheckCircle, StarOff, Trash2, Play. Спиннер — кастомный CSS div (как в RoutesGuard.tsx).

---

## Задачи

### Фаза 1 — База данных

#### Задача 1: Alembic-миграция — api_keys + admin_logs + Fernet
**Файлы:**
- `backend/alembic/versions/<hash>_add_admin_tables.py` (сгенерировать через autogenerate)
- `backend/app/models.py` (добавить модели до генерации)

**КРИТИЧНО:** добавить `Text` в импорты `models.py` (сейчас отсутствует):
```python
from sqlalchemy import (
    JSON, Boolean, DateTime, Enum, ForeignKey, Integer, String, Text,
    UniqueConstraint, Uuid, func,
)
```

**Что сделать:**
1. В `models.py` добавить два класса:

```python
class ApiKey(Base):
    __tablename__ = "api_keys"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    service: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    encrypted_value: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

class AdminLog(Base):
    __tablename__ = "admin_logs"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    admin_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    admin_username: Mapped[str] = mapped_column(String(64), nullable=False)
    action: Mapped[str] = mapped_column(String(128), nullable=False)
    target_type: Mapped[str] = mapped_column(String(64), nullable=False)
    target_id: Mapped[str] = mapped_column(String(255), nullable=False)
    details: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
```

2. Добавить `api_keys` и `admin_logs` импорты в `alembic/env.py` (если нужно).
3. Сгенерировать миграцию:
   ```
   alembic revision --autogenerate -m "add_admin_tables"
   ```
4. Проверить сгенерированный файл, применить: `alembic upgrade head`

**Логирование:** `logger.debug("[migration] api_keys + admin_logs applied")`

---

#### Задача 2: Добавить Fernet-шифрование + конфиг
**Файлы:**
- `backend/requirements.txt` — добавить `cryptography>=42.0`
- `backend/app/config.py` — добавить поле `encryption_key: str = ""`
- `backend/.env.example` — добавить `ENCRYPTION_KEY=<base64-32-bytes>`

**Что сделать:**
1. В `requirements.txt` добавить `cryptography>=42.0` (если нет).
2. В `config.py` добавить `encryption_key: str = Field(default="", env="ENCRYPTION_KEY")`.
3. Создать хелпер `backend/app/utils_crypto.py`:
   ```python
   from cryptography.fernet import Fernet
   from app.config import settings
   
   def get_fernet() -> Fernet:
       key = settings.encryption_key.encode()
       return Fernet(key)
   
   def encrypt_value(value: str) -> str:
       return get_fernet().encrypt(value.encode()).decode()
   
   def decrypt_value(encrypted: str) -> str:
       return get_fernet().decrypt(encrypted.encode()).decode()
   
   def mask_value(value: str) -> str:
       """Show only last 4 chars, mask rest with asterisks."""
       if len(value) <= 4:
           return value
       return "*" * (len(value) - 4) + value[-4:]
   ```
4. В `.env.example` задокументировать генерацию ключа: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`.

**Логирование:** `logger.debug("[crypto] Fernet helper initialised")`

---

### Фаза 2 — Бэкенд роутер

#### Задача 3: Admin stats + user management endpoints
**Файл:** `backend/app/routes/admin.py` (новый)

**Что реализовать:**

```
GET  /admin/stats
GET  /admin/users?search=&role=&subscription=&page=&limit=
PATCH /admin/users/{id}
DELETE /admin/users/{id}
POST /admin/users/create-admin
```

**GET /admin/stats** — один SELECT на каждый показатель:
- `total_users` — COUNT(users)
- `new_users_7d` — COUNT(users WHERE created_at >= now()-7days)
- `active_premium` — COUNT(subscriptions WHERE plan='premium' AND (expires_at IS NULL OR expires_at > now()))
- `expiring_soon` — COUNT(subscriptions WHERE plan='premium' AND expires_at BETWEEN now() AND now()+7days)
- `total_news` — COUNT(news_articles)
- `last_news_fetch` — MAX(news_articles.created_at) — приближение времени последнего фетча
- `ai_requests_today` — SUM(subscriptions.ai_requests_used) — суммарный счётчик (нет date-reset в демо)

**GET /admin/users** — ILIKE поиск по email+username, фильтр role/subscription, paginate (offset/limit), JOIN с subscriptions для плана. Возвращать: id, username, email, role, subscription_plan, avatar_url, created_at, is_active, `last_login: None` (поле отсутствует в User модели, всегда null).

**PATCH /admin/users/{id}** — тело `{ role?, is_blocked?, subscription_plan? }`:
- `is_blocked` → инвертируем в `user.is_active` (True если не заблокирован)
- `subscription_plan` → обновляем `subscription.plan`
- Нельзя изменить самого себя (400)
- Писать в admin_logs: action="update_user", target_type="user"

**DELETE /admin/users/{id}** — нельзя себя (400), cascade (все FK уже CASCADE), писать в admin_logs.

**POST /admin/users/create-admin** — тело `{email, username, password}`, проверка уникальности, bcrypt, role=admin, создать subscription(free), писать в admin_logs.

**Логирование:**
```python
logger.debug("[admin] stats requested by admin_id=%s", current_user.id)
logger.debug("[admin] users list: search=%s role=%s sub=%s page=%s", search, role, subscription, page)
logger.debug("[admin] patch user id=%s body=%s by=%s", user_id, body, current_user.id)
logger.debug("[admin] delete user id=%s by=%s", user_id, current_user.id)
logger.debug("[admin] create-admin email=%s by=%s", email, current_user.id)
```

---

#### Задача 4: Comments + API keys endpoints
**Файл:** `backend/app/routes/admin.py` (продолжение)

**Что реализовать:**

```
GET    /admin/comments?page=&limit=
DELETE /admin/comments/{id}
GET    /admin/api-keys
POST   /admin/api-keys
POST   /admin/api-keys/test/{service}
```

**GET /admin/comments** — JOIN с users (author) и news_articles по article_url. Сортировка created_at DESC, пагинация. Возвращать: id, text, author {username, avatar_url}, article_url, created_at.

**DELETE /admin/comments/{id}** — ВАЖНО: `parent_id` имеет `ondelete="SET NULL"`, реплики НЕ удаляются автоматически. Вручную:
```python
await db.execute(delete(Comment).where(Comment.parent_id == comment_id))
await db.execute(delete(Comment).where(Comment.id == comment_id))
await db.commit()
```
Писать в admin_logs.

**GET /admin/api-keys** — SELECT из api_keys, decrypt через Fernet, затем `mask_value()`. Если ключа нет — пустая строка. Возвращать `{service: masked_value}` для всех 5 сервисов.

**POST /admin/api-keys** — тело `{newsapi_key?, okx_key?, okx_secret?, finnhub_key?, groq_key?}`. Маппинг → service: `newsapi_key→"newsapi"`, `okx_key→"okx"`, `okx_secret→"okx_secret"`, `finnhub_key→"finnhub"`, `groq_key→"groq"`. PostgreSQL upsert:
```python
from sqlalchemy.dialects.postgresql import insert as pg_insert
stmt = pg_insert(ApiKey).values(service=svc, encrypted_value=enc).on_conflict_do_update(
    index_elements=["service"],
    set_={"encrypted_value": enc, "updated_at": func.now()}
)
await db.execute(stmt)
```
Писать в admin_logs: action="update_api_keys".

**POST /admin/api-keys/test/{service}** — минимальные тестовые запросы:
- `newsapi`: GET `https://newsapi.org/v2/top-headlines?pageSize=1&apiKey=<key>`
- `finnhub`: GET `https://finnhub.io/api/v1/quote?symbol=AAPL&token=<key>`
- `okx`: GET `https://www.okx.com/api/v5/market/ticker?instId=BTC-USDT` (публичный, проверяем доступность)
- `groq`: POST `https://api.groq.com/openai/v1/chat/completions` с минимальным телом + Authorization Bearer
- Возвращать `{success: bool, message: str}`

**Логирование:**
```python
logger.debug("[admin] comments page=%s", page)
logger.debug("[admin] delete comment id=%s by=%s", comment_id, current_user.id)
logger.debug("[admin] api-keys requested by=%s", current_user.id)
logger.debug("[admin] api-keys update by=%s services=%s", current_user.id, list(body.keys()))
logger.debug("[admin] test api key service=%s by=%s", service, current_user.id)
```

---

#### Задача 5: Logs endpoint + регистрация роутера + seed-скрипт
**Файлы:**
- `backend/app/routes/admin.py` (финал — endpoint + helper)
- `backend/app/main.py` (include_router)
- `backend/scripts/seed_admin.py` (новый)

**GET /admin/logs** — SELECT из admin_logs ORDER BY created_at DESC, пагинация. Возвращать все поля.

**Helper `_write_log`** (async def внутри модуля):
```python
async def _write_log(
    db: AsyncSession,
    admin: User,
    action: str,
    target_type: str,
    target_id: str,
    details: str | None = None
) -> None:
    log = AdminLog(
        admin_id=admin.id,
        admin_username=admin.username,
        action=action,
        target_type=target_type,
        target_id=str(target_id),
        details=details,
    )
    db.add(log)
    # commit вызывается в той же транзакции что и основная операция
```

**Регистрация в main.py:**
```python
from app.routes import admin as admin_router
app.include_router(admin_router.router, prefix="/admin", tags=["admin"])
```

**seed_admin.py:**
```python
# python -m scripts.seed_admin
import asyncio
import bcrypt
from app.database import AsyncSessionLocal
from app.models import User, Subscription, UserRole, SubscriptionPlan
import uuid

async def seed():
    async with AsyncSessionLocal() as db:
        existing = await db.execute(select(User).where(User.email == "admin@admin.ru"))
        if existing.scalar_one_or_none():
            print("Admin already exists, skipping.")
            return
        user = User(
            id=uuid.uuid4(),
            email="admin@admin.ru",
            username="admin",
            password_hash=bcrypt.hashpw(b"admin", bcrypt.gensalt()).decode(),
            role=UserRole.admin,
            is_active=True,
        )
        db.add(user)
        await db.flush()
        sub = Subscription(user_id=user.id, plan=SubscriptionPlan.premium)
        db.add(sub)
        await db.commit()
        print("Admin created: admin@admin.ru / admin")

if __name__ == "__main__":
    asyncio.run(seed())
```

**Логирование:** `logger.debug("[admin] logs page=%s", page)`

---

### Commit checkpoint 1 (после задачи 5)

```
feat(backend): admin panel API — stats, users, comments, api-keys, logs, seed
```

---

### Фаза 3 — Фронтенд

#### Задача 6: adminApi.ts + vite proxy + AdminRoute в App.tsx
**Файлы:**
- `frontend/src/lib/adminApi.ts` (новый)
- `frontend/vite.config.ts` (добавить proxy)
- `frontend/src/App.tsx` (обернуть `/admin` в AdminRoute)

**НЕ УСТАНАВЛИВАТЬ @mui/material** — не нужен, проект использует custom design system.

**adminApi.ts** — следовать паттерну `profileApi.ts`:
```typescript
const BASE = '/admin';

// parseError импортировать из существующего файла или дублировать паттерн

export interface AdminStats { ... }
export interface AdminUser { id: string; username: string; email: string; role: string; subscription_plan: string; avatar_url: string | null; created_at: string; is_active: boolean; }
export interface AdminComment { id: string; text: string; author: { username: string; avatar_url: string | null }; article_url: string; created_at: string; }
export interface AdminLog { id: string; admin_username: string; action: string; target_type: string; target_id: string; details: string | null; created_at: string; }
export interface ApiKeyStatus { [service: string]: string; }  // masked values

export async function getAdminStats(): Promise<AdminStats>
export async function getAdminUsers(params: { search?: string; role?: string; subscription?: string; page?: number; limit?: number }): Promise<{ items: AdminUser[]; total: number }>
export async function patchAdminUser(id: string, body: { role?: string; is_blocked?: boolean; subscription_plan?: string }): Promise<AdminUser>
export async function deleteAdminUser(id: string): Promise<void>
export async function createAdminUser(body: { email: string; username: string; password: string }): Promise<AdminUser>
export async function getAdminComments(params: { page?: number; limit?: number }): Promise<{ items: AdminComment[]; total: number }>
export async function deleteAdminComment(id: string): Promise<void>
export async function getAdminApiKeys(): Promise<ApiKeyStatus>
export async function saveAdminApiKeys(body: Record<string, string>): Promise<void>
export async function testAdminApiKey(service: string): Promise<{ success: boolean; message: string }>
export async function getAdminLogs(params: { page?: number; limit?: number }): Promise<{ items: AdminLog[]; total: number }>
```

**vite.config.ts** — добавить перед `/auth`:
```typescript
'/admin': { target: 'http://localhost:8000', changeOrigin: true },
```

**App.tsx** — AdminRoute — named export из RoutesGuard.tsx. Текущий импорт только `PrivateRoute` (default). Изменить:
```tsx
// было:
import PrivateRoute from './components/layout/RoutesGuard'
// стало:
import PrivateRoute, { AdminRoute } from './components/layout/RoutesGuard'
```
И обернуть маршрут:
```tsx
<Route path="/admin" element={<AdminRoute><AdminPanelPage /></AdminRoute>} />
```

**Логирование:** `console.debug('[adminApi] %s %s', method, url)` перед каждым fetch.

---

#### Задача 7: Хуки для AdminPage
**Файлы (новые):**
- `frontend/src/hooks/useAdminStats.ts`
- `frontend/src/hooks/useAdminUsers.ts`
- `frontend/src/hooks/useAdminComments.ts`
- `frontend/src/hooks/useAdminApiKeys.ts`
- `frontend/src/hooks/useAdminLogs.ts`

**Паттерн** (идентичен `useProfile`/`useSubscription`):
```typescript
// useAdminStats.ts
export function useAdminStats() {
  const [data, setData] = useState<AdminStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const refetch = useCallback(async () => {
    setIsLoading(true);
    try {
      setData(await getAdminStats());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  useEffect(() => { refetch(); }, [refetch]);
  
  return { data, isLoading, error, refetch };
}
```

**useAdminUsers** — дополнительно принимает параметры поиска/фильтрации, имеет методы `patchUser`, `deleteUser`, `createAdmin`.

**useAdminComments** — имеет метод `deleteComment`.

**useAdminApiKeys** — имеет методы `save`, `testKey` (с состоянием `testing: Record<string, 'idle'|'loading'|'ok'|'error'>`).

**useAdminLogs** — имеет `refetchInterval` (передаётся из компонента, запускает setInterval в useEffect).

**Логирование:** `console.debug('[useAdmin*] ...')` в каждом хуке при fetch/action.

---

#### Задача 8: Полная реализация AdminPanelPage
**Файл:** `frontend/src/pages/AdminPanelPage.tsx` (полная перезапись)

**КРИТИЧНО — НЕ ИСПОЛЬЗОВАТЬ MUI.** Дизайн-система проекта:
- CSS-переменные: `var(--accent)`=#E11D48, `var(--muted)`, `var(--border)`, `var(--white)`, `var(--bg)`, `var(--ink)`, `var(--green)`, `var(--red)`
- Framer Motion (`motion.div`, `motion.tr`) — уже установлен
- lucide-react иконки (уже установлены): `Users`, `Star`, `Newspaper`, `Bot`, `ShieldCheck`, `Ban`, `CheckCircle`, `StarOff`, `Trash2`, `Play`, `Search`
- Inline styles как в существующем AdminPanelPage.tsx
- Кастомный спиннер (как в RoutesGuard.tsx): `div { border: 3px solid var(--border); border-top-color: var(--accent); animation spin }`
- Confirm dialog: кастомный modal через `useState<null | string>` (id для подтверждения)
- Snackbar: кастомный `position: fixed; bottom: 24px; right: 24px` через useState
- Пагинация: кастомная (кнопки prev/next + "страница X из Y")

**Структура страницы (6 секций сверху вниз):**

**1. Статистика** — CSS grid 4 колонки, gap: 12:
- 4 карточки: `div` с `var(--bg)`, `border: 1px solid var(--border)`, `borderRadius: var(--r-md)`, Framer Motion initial/animate
- Иконки: Users, Star, Newspaper, Bot (lucide-react, size=20)
- Данные из `useAdminStats`, skeleton-текст «—» пока isLoading

**2. Пользователи** (`useAdminUsers`):
- Заголовок `h2` fontSize 18, fontWeight 700
- Toolbar: input поиска (debounce 400ms через useRef/setTimeout), два нативных `select` (роль, подписка)
- Кастомная таблица: `table` + `tbody` + `tr` (аналог существующего UsersTable), колонки: аватар+ник, email, badge роль (admin=акцент/user=серый), badge подписка (premium=`#D97706`/free=серый), дата, действия
- Действия: кнопки-иконки ShieldCheck (роль), Ban/CheckCircle (блокировка), Star/StarOff (премиум), Trash2 (красный)
- Confirm modal для удаления и блокировки (через useState<string|null>)
- Кастомная пагинация prev/next
- Кастомный Snackbar fixed bottom-right

**3. Создать администратора** (`useAdminUsers.createAdmin`):
- `div` с `var(--white)`, shadow, borderRadius
- Поля: email, username, password (с show/hide кнопкой)
- Кнопка с background `#E11D48`, color `#fff`

**4. Модерация комментариев** (`useAdminComments`):
- Кастомная таблица: аватар+ник, текст (slice(0,80)+'...'), `<a href={url} target="_blank">` название, дата, Trash2
- Confirm modal, Snackbar, кастомная пагинация

**5. API-ключи** (`useAdminApiKeys`):
- `div` карточка с формой
- 5 сервисов: NewsAPI, OKX Key, OKX Secret, Finnhub, Groq
- Каждая строка: label, `input type="password"`, кнопка Play (тест), статус: кастомный спиннер | CheckCircle зелёный | XCircle красный
- Кнопка «Сохранить всё» background `#E11D48`

**6. Журнал действий** (`useAdminLogs`):
- Кастомная таблица: ник admin, действие, цель, детали, время (toLocaleString)
- Кастомная пагинация
- Auto-refresh 60s через setInterval в useAdminLogs хуке

**Логирование:**
```typescript
console.debug('[AdminPage] mounted');
console.debug('[AdminPage] user action: %s id=%s', action, id);
```

---

### Commit checkpoint 2 (после задачи 8 — Task 6)

```
feat(frontend): AdminPage — stats, users, comments, api-keys, logs wired to backend
```

---

### Фаза 4 — Тесты

#### Задача 9: Тесты бэкенда (pytest)
**Файл:** `backend/tests/test_admin.py`

**Тест-кейсы** (следовать паттерну `test_profile.py` — `pytest-asyncio`, `AsyncClient`, `AsyncSession`):

| # | Тест | Ожидание |
|---|------|----------|
| 1 | `test_admin_stats_ok` | 200, все поля присутствуют |
| 2 | `test_admin_stats_requires_admin` | 403 для обычного юзера |
| 3 | `test_admin_users_list` | 200, paged response, contains test user |
| 4 | `test_admin_users_search` | фильтрует по email substring |
| 5 | `test_admin_patch_block_user` | 200, user.is_active=False |
| 6 | `test_admin_patch_self_blocked` | 400 нельзя изменить себя |
| 7 | `test_admin_delete_user` | 204, user gone |
| 8 | `test_admin_delete_self` | 400 нельзя удалить себя |
| 9 | `test_admin_create_admin` | 201, новый user с role=admin |
| 10 | `test_admin_create_admin_duplicate_email` | 400 |
| 11 | `test_admin_comments_list` | 200, paged |
| 12 | `test_admin_delete_comment_cascades` | дочерние комментарии тоже удалены |
| 13 | `test_admin_api_keys_save_and_get` | сохранение и маскирование |
| 14 | `test_admin_logs_written` | лог записывается после patch_user |

Фикстуры: `admin_user`, `regular_user`, `admin_client` (AsyncClient с cookie admin), `user_client`.

**Логирование:** `logger.debug("[test_admin] running %s", test_name)` в setUp.

---

### Commit checkpoint 3 (после задачи 9)

```
test(backend): admin endpoint tests (14 cases)
```

---

### Финал — обязательный чекпойнт документации

После завершения всех задач запустить:
```
/aif-docs
```
Обновить `docs/backend.md` (новые эндпоинты `/admin/*`), `docs/AGENTS.md` или аналог (seed_admin.py), `README.md` (как запустить seed).

---

## Зависимости между задачами

```
Задача 1 (миграция + модели) → Задача 2, 3 (используют ApiKey/AdminLog)
Задача 1 (Fernet utils_crypto) → Задача 3 (api-keys шифрование)
Задача 2 + 3 (роутер + main.py) → Задача 7 (тесты)
Задача 4 (adminApi.ts) → Задача 5 (хуки импортируют из adminApi)
Задача 5 (хуки) → Задача 6 (AdminPage использует хуки)
```

**Установленные blockedBy в трекере:**
- Задача 5 блокируется Задачей 4
- Задача 6 блокируется Задачей 5
- Задача 7 блокируется Задачей 3

## Резюме

**7 задач** | **3 commit checkpoint** | **Logging: verbose** | **Tests: yes** | **Docs: yes**

Ключевые архитектурные решения (подтверждены анализом кода):
- **Без MUI** — используется custom CSS vars + Framer Motion + lucide-react (нет в package.json)
- **is_active как is_blocked** — поле уже существует, проверяется в auth
- **last_login = null** — поля нет в модели, возвращаем null
- **PostgreSQL upsert** через `pg_insert().on_conflict_do_update()` для api_keys
- **Ручное удаление replies** перед родительским комментарием (SET NULL, не CASCADE)
- **AdminRoute named export** — нужен отдельный импорт в App.tsx

Оценка объёма:
- Бэкенд: ~600 строк (роутер + модели + migration + seed + utils_crypto)
- Фронтенд: ~700 строк (adminApi + 5 хуков + AdminPage)
- Тесты: ~350 строк (14 кейсов)
