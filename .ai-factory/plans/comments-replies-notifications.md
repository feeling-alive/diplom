# Implementation Plan: Ответы на комментарии + Система уведомлений

Branch: master (create_branches: false)
Created: 2026-06-11

## Settings
- Testing: no
- Logging: verbose
- Docs: yes — обязательный чекпойнт в /aif-implement

## Roadmap Linkage
Milestone: "none"
Rationale: Roadmap не найден (.ai-factory/ROADMAP.md отсутствует)

---

## Контекст и ключевые решения

### Существующая архитектура комментариев
- Модель `Comment` в `backend/app/models.py` — поля: id, user_id, **article_url** (String, не FK на NewsArticle.id), text, likes (int), created_at
- GET /api/news/{article_id}/comments — выборка по `Comment.article_url == article.url`
- POST /api/news/{article_id}/comments — `CommentIn(text)`, без parent_id
- Фронт: `NewsArticlePage.tsx` — локальный интерфейс `Comment`, инлайн-хук `useComments`

### Реакции на комментарии
- Текущее поле `likes: int = 0` на модели Comment — задел под лайки
- Добавляем POST /api/news/comments/{comment_id}/like (toggle: +1/-1), возвращает `{ liked: bool, likes: int }`
- Уведомление type='reaction' создаётся при лайке чужого комментария

### Уведомления — sender_id
- Notification хранит `sender_id` (nullable FK → users.id) для отображения аватара отправителя

### MUI — НЕ установлен
Проект использует lucide-react. "BellIcon из MUI" в задаче = визуальный стиль.
Используем `Bell` из lucide-react, дизайн через CSS-переменные проекта.

### Vite proxy
`/api/news` уже проксируется на `:8000` — всё под этим префиксом работает.
Нужно добавить `/api/notifications → :8000`.

---

## Commit Plan

- **Commit 1** (задачи 1–4): `feat(backend): comment parent_id migration + notification model and endpoints`
- **Commit 2** (задачи 5–6): `feat(frontend): threaded comments UI — reply form and nested display`
- **Commit 3** (задачи 7–8): `feat(frontend): notifications — bell icon, badge, and dropdown in header`

---

## Tasks

### Phase 1: Backend

- [x] **Задача 1**: Alembic-миграция — `parent_id` в таблице comments
  - Создать `backend/alembic/versions/<rev>_add_parent_id_to_comments.py`
  - `op.add_column('comments', sa.Column('parent_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('comments.id', ondelete='SET NULL'), nullable=True, index=True))`
  - Команда для генерации: `alembic revision -m "add_parent_id_to_comments"`, затем заполнить вручную
  - Logging: нет (миграция — DDL)

- [x] **Задача 2**: Обновить модель Comment и схемы для вложенных ответов
  - Файл: `backend/app/models.py`
    - Добавить `parent_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("comments.id", ondelete="SET NULL"), nullable=True, index=True)`
    - Добавить `replies: Mapped[list["Comment"]] = relationship("Comment", foreign_keys=[parent_id], back_populates="parent", lazy="selectin")`
    - Добавить `parent: Mapped["Comment | None"] = relationship("Comment", foreign_keys=[parent_id], back_populates="replies", remote_side="Comment.id")`
  - Файл: `backend/app/routes/news.py`
    - `CommentOut`: добавить поля `parent_id: str | None = None`, `replies: list["CommentOut"] = []`, `likes: int = 0`
    - `CommentIn`: добавить `parent_id: str | None = None`
    - GET `/{article_id}/comments`: фильтровать только top-level (`Comment.parent_id == None`), ответы придут через `replies` (selectin уже загружает)
    - POST `/{article_id}/comments`: передавать `parent_id` при создании; если parent_id задан — валидировать существование родителя
  - Logging: `logger.debug("[news] comment added article=%s user=%s parent=%s", ...)`

- [x] **Задача 3**: Alembic-миграция + модель Notification (зависит от задачи 1)
  - Файл: `backend/app/models.py`
    - Добавить `Notification(Base)`:
      ```python
      class Notification(Base):
          __tablename__ = "notifications"
          id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
          user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
          sender_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
          type: Mapped[str] = mapped_column(String(32), nullable=False)
          message: Mapped[str] = mapped_column(String(512), nullable=False)
          link: Mapped[str] = mapped_column(String(2048), nullable=False)
          is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
          created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
          user: Mapped["User"] = relationship(foreign_keys=[user_id], back_populates="notifications")
          sender: Mapped["User | None"] = relationship(foreign_keys=[sender_id])
      ```
    - Добавить `notifications: Mapped[list["Notification"]] = relationship(foreign_keys="[Notification.user_id]", back_populates="user")` в модель User
  - Создать `backend/alembic/versions/<rev>_add_notifications_table.py`
  - Logging: нет (миграция — DDL)

- [x] **Задача 4**: Эндпоинты уведомлений + лайк комментария + хелпер create_notification (зависит от задач 2, 3)
  - Создать `backend/app/routes/notifications.py`:
    ```
    GET  /api/notifications           — список уведомлений текущего пользователя (order by created_at desc, limit 50)
    POST /api/notifications/read-all  — is_read=True для всех непрочитанных
    POST /api/notifications/{id}/read — is_read=True для одного
    ```
    - `NotificationOut`: id, type, message, link, is_read, created_at, sender_username (str|None), sender_avatar_url (str|None)
  - Добавить в `backend/app/routes/news.py`:
    - POST `/comments/{comment_id}/like` — toggle лайка: если current user уже лайкнул (check по user_liked_comments set в Redis? нет, простой подход: хранить лайкнувших в отдельном ключе или просто increment без toggle) — УПРОЩЕНИЕ: incrementing, no toggle (no deduplication needed for MVP)
    - При лайке вызвать `await _create_notification(session, recipient_id=comment.user_id, sender_id=user.id, type='reaction', message=f'{user.username} поставил реакцию на ваш комментарий', link=f'/news/{article_id}#comments')`
    - **Гвард самоуведомлений**: `if comment.user_id == user.id: return` (не создавать уведомление)
  - Добавить хелпер `_create_notification` в `backend/app/routes/news.py` (или `backend/app/utils/notifications.py`):
    - Принимает session, recipient_id, sender_id, type, message, link
    - Гвард: `if recipient_id == sender_id: return` — не уведомлять себя
    - Создаёт `Notification(...)`, session.add, await session.commit()
  - Вызов хелпера при ответе на комментарий в `add_comment` (когда parent_id задан):
    - `await _create_notification(session, recipient_id=parent.user_id, sender_id=user.id, type='comment_reply', message=f'{user.username} ответил на ваш комментарий', link=f'/news/{article_id}#comments')`
  - Зарегистрировать в `backend/app/main.py`: `from app.routes import notifications; app.include_router(notifications.router)`
  - Добавить в `frontend/vite.config.ts`: `'/api/notifications': { target: 'http://localhost:8000', changeOrigin: true }`
  - Logging: `logger.debug("[notifications] created type=%s recipient=%s sender=%s", ...)`

<!-- Commit checkpoint 1: задачи 1–4 -->

### Phase 2: Frontend — Ответы на комментарии

- [x] **Задача 5**: Обновить интерфейс Comment и хук useComments (зависит от задачи 2)
  - Файл: `frontend/src/pages/NewsArticlePage.tsx`
  - Интерфейс `Comment`:
    ```typescript
    interface Comment {
      id: string
      username: string
      avatar_url: string | null
      text: string
      created_at: string
      parent_id: string | null
      likes: number
      replies: Comment[]
    }
    ```
  - Обновить `submitComment` mutation: принимает `{ text: string, parent_id?: string | null }`
  - State `replyingTo: string | null` — id комментария, на который отвечают
  - State `replyText: string`
  - Функция `handleLike(commentId: string)` — POST /api/news/comments/{commentId}/like, инвалидировать queryKey
  - Logging: `console.debug('[NewsArticlePage] reply to comment=%s', replyingTo)`

- [x] **Задача 6**: UI вложенных ответов + кнопка Reply + кнопка Like (зависит от задачи 5)
  - Файл: `frontend/src/pages/NewsArticlePage.tsx`
  - Кнопки под каждым комментарием (flex row, gap 8):
    - `Reply` (lucide, 13px) — «Ответить», click → `setReplyingTo(c.id)`, toggle если уже открыт
    - `ThumbsUp` (lucide, 13px) — лайк, count из `c.likes`
  - При `replyingTo === c.id`: inline форма с textarea (rows=2) + кнопки «Отправить» / «Отмена» под кнопками комментария, motion.div `initial={{ opacity: 0, height: 0 }}` animate `{{ opacity: 1, height: 'auto' }}`
  - Вложенные ответы (`c.replies`): рендерятся под формой в `div` с `marginLeft: 24, borderLeft: '2px solid var(--border)', paddingLeft: 12`
  - Каждый reply — такая же карточка что и родительский, но без кнопки Reply (глубина 1)
  - Framer Motion stagger для replies: `delay: i * 0.04`
  - Logging: `console.debug('[NewsArticlePage] render comment=%s replies=%d', c.id, c.replies.length)`

<!-- Commit checkpoint 2: задачи 5–6 -->

### Phase 3: Frontend — Система уведомлений

- [x] **Задача 7**: Хук useNotifications (зависит от задачи 4)
  - Создать `frontend/src/hooks/useNotifications.ts`
  - Интерфейс:
    ```typescript
    export interface AppNotification {
      id: string
      type: 'comment_reply' | 'reaction'
      message: string
      link: string
      is_read: boolean
      created_at: string
      sender_username: string | null
      sender_avatar_url: string | null
    }
    ```
  - Хук:
    ```typescript
    export function useNotifications() {
      const { user } = useAuth()
      const qc = useQueryClient()
      const query = useQuery<AppNotification[]>({
        queryKey: ['notifications'],
        queryFn: async () => { const res = await fetch('/api/notifications'); ... },
        enabled: !!user,
        refetchInterval: 30_000,
        staleTime: 0,
      })
      const unreadCount = query.data?.filter(n => !n.is_read).length ?? 0
      async function markAllRead() { await fetch('/api/notifications/read-all', { method: 'POST' }); qc.invalidateQueries({ queryKey: ['notifications'] }) }
      async function markRead(id: string) { await fetch(`/api/notifications/${id}/read`, { method: 'POST' }); qc.invalidateQueries({ queryKey: ['notifications'] }) }
      return { ...query, unreadCount, markAllRead, markRead }
    }
    ```
  - Logging: `console.debug('[useNotifications] fetched count=%d unread=%d', data.length, unreadCount)`

- [x] **Задача 8**: Bell + badge + Popover в DashboardHeader (зависит от задачи 7)
  - Файл: `frontend/src/components/dashboard/DashboardHeader.tsx`
  - Импорты: добавить `Bell, BellOff` из lucide-react; `useNotifications` из хука; убрать `AlignLeft`
  - Заменить кнопку `AlignLeft` на `Bell` (кнопка 32×32px, border, white bg):
    - Position relative (на кнопке)
    - При `unreadCount > 0`: абсолютный бейдж (top: -4, right: -4), круглый, background `var(--accent)`, color `#fff`, fontSize 9, fontWeight 700, min-width 16, height 16, text — unreadCount > 99 ? '99+' : unreadCount
  - State `notifOpen: boolean`
  - При клике → toggle `notifOpen`, при открытии пометить прочитанными (опц.) или оставить явную кнопку
  - Dropdown (AnimatePresence, motion.div):
    - position absolute, top 40, right 0, width 320, borderRadius 16, background var(--white), border, boxShadow
    - initial `{{ opacity: 0, y: -8, scale: 0.96 }}` → animate `{{ opacity: 1, y: 0, scale: 1 }}`
    - Закрытие по клику снаружи (useRef + mousedown) + Escape
    - Заголовок: «Уведомления» (fontWeight 700) + кнопка «Отметить все прочитанными» (справа, fontSize 11, accent color, onClick markAllRead)
    - Список уведомлений (max-height 360, overflowY auto):
      - Каждое уведомление: `padding 10 12`, background `is_read ? var(--white) : var(--bg)`, cursor pointer, onClick → navigate(n.link) + markRead(n.id)
      - Аватар (28×28, круглый, инициал если нет avatar_url)
      - Текст (fontSize 12, fontWeight is_read ? 400 : 600, color var(--ink))
      - Время в относительном формате (функция `formatRelativeTime(date)` через `Intl.RelativeTimeFormat('ru')`, fontSize 10, color var(--muted))
      - motion.div с stagger delay i * 0.03
    - Empty state (нет уведомлений): `BellOff` (32px, var(--soft)) + «Уведомлений нет» (fontSize 13, var(--muted)), Framer Motion scale
  - Logging: `console.debug('[DashboardHeader] notifications open=%s unread=%d', notifOpen, unreadCount)`

<!-- Commit checkpoint 3: задачи 7–8 -->

### Phase 4: Документация

- [ ] **Задача Docs**: обязательный чекпойнт `/aif-docs` после завершения всех задач
  - Обновить `docs/` с описанием системы уведомлений и ответов на комментарии
  - Задокументировать новые эндпоинты и хук `useNotifications`
