import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShieldCheck, Users, Newspaper, Star, MessageSquare,
  Key, FileText, Search, Ban, CheckCircle, Trash2, Play,
  RefreshCw, ChevronLeft, ChevronRight, Plus, Eye, EyeOff,
  Activity, Bot, ThumbsUp,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAdminStats } from '../hooks/useAdminStats'
import { useAdminUsers, type UseAdminUsersFilters } from '../hooks/useAdminUsers'
import { useAdminComments } from '../hooks/useAdminComments'
import { useAdminApiKeys } from '../hooks/useAdminApiKeys'
import { useAdminLogs } from '../hooks/useAdminLogs'

// ---------------------------------------------------------------------------
// Section nav tabs
// ---------------------------------------------------------------------------

type Tab = 'stats' | 'users' | 'create-admin' | 'comments' | 'api-keys' | 'logs'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'stats', label: 'Обзор', icon: <Activity size={15} /> },
  { id: 'users', label: 'Пользователи', icon: <Users size={15} /> },
  { id: 'create-admin', label: 'Создать Admin', icon: <Plus size={15} /> },
  { id: 'comments', label: 'Комментарии', icon: <MessageSquare size={15} /> },
  { id: 'api-keys', label: 'API Ключи', icon: <Key size={15} /> },
  { id: 'logs', label: 'Журнал', icon: <FileText size={15} /> },
]

// ---------------------------------------------------------------------------
// Shared micro-components
// ---------------------------------------------------------------------------

function SpinnerIcon() {
  return (
    <span
      style={{
        display: 'inline-block', width: 14, height: 14,
        border: '2px solid var(--border)',
        borderTopColor: 'var(--accent)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
        flexShrink: 0,
      }}
    />
  )
}

function Badge({ children, color = 'var(--muted)', bg = 'var(--bg)' }: { children: React.ReactNode; color?: string; bg?: string }) {
  return (
    <span style={{ padding: '2px 9px', borderRadius: 'var(--r-pill)', fontSize: 11, fontWeight: 600, background: bg, color }}>
      {children}
    </span>
  )
}

function Pager({ page, total, limit, onPage }: { page: number; total: number; limit: number; onPage: (p: number) => void }) {
  const pages = Math.ceil(total / limit) || 1
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
      <span style={{ fontSize: 12, color: 'var(--muted)' }}>{total} записей</span>
      <button
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '4px 8px', cursor: page > 1 ? 'pointer' : 'default', opacity: page <= 1 ? 0.4 : 1 }}
      >
        <ChevronLeft size={13} />
      </button>
      <span style={{ fontSize: 12, color: 'var(--text)' }}>{page} / {pages}</span>
      <button
        disabled={page >= pages}
        onClick={() => onPage(page + 1)}
        style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '4px 8px', cursor: page < pages ? 'pointer' : 'default', opacity: page >= pages ? 0.4 : 1 }}
      >
        <ChevronRight size={13} />
      </button>
    </div>
  )
}

function ErrorMsg({ msg }: { msg: string }) {
  return <div style={{ color: 'var(--red)', fontSize: 13, padding: '12px 0' }}>{msg}</div>
}

const TH_STYLE: React.CSSProperties = {
  padding: '10px 12px', color: 'var(--muted)', fontWeight: 600,
  fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5,
  textAlign: 'left', whiteSpace: 'nowrap',
}
const TD_STYLE: React.CSSProperties = { padding: '10px 12px', verticalAlign: 'middle' }

// ---------------------------------------------------------------------------
// 1. Stats section
// ---------------------------------------------------------------------------

function StatsSection() {
  const { data, isLoading, error, refetch } = useAdminStats()

  const cards = data ? [
    { label: 'Пользователей', value: data.total_users, icon: <Users size={18} />, color: 'var(--accent)' },
    { label: 'Активных', value: data.active_users, icon: <CheckCircle size={18} />, color: '#16a34a' },
    { label: 'Заблокировано', value: data.blocked_users, icon: <Ban size={18} />, color: '#dc2626' },
    { label: 'Новых за 7 дней', value: data.new_users_7d, icon: <Star size={18} />, color: '#8b5cf6' },
    { label: 'Новостей', value: data.total_news, icon: <Newspaper size={18} />, color: '#0ea5e9' },
    { label: 'Комментариев', value: data.total_comments, icon: <MessageSquare size={18} />, color: '#0891b2' },
    { label: 'Реакций', value: data.total_reactions, icon: <ThumbsUp size={18} />, color: '#f59e0b' },
    { label: 'Обращений к ИИ', value: data.ai_chat_sessions, icon: <Bot size={18} />, color: '#7c3aed' },
  ] : []

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>Обзор платформы</h2>
        <button
          onClick={() => void refetch()}
          style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '5px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--muted)' }}
        >
          <RefreshCw size={12} /> Обновить
        </button>
      </div>

      {error && <ErrorMsg msg={error.message} />}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{ background: 'var(--bg)', borderRadius: 'var(--r-md)', padding: '18px 20px', border: '1px solid var(--border)', minHeight: 80 }} />
          ))
          : cards.map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              style={{ background: 'var(--bg)', borderRadius: 'var(--r-md)', padding: '16px 20px', border: '1px solid var(--border)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: card.color }}>
                {card.icon}
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{card.label}</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: card.color, lineHeight: 1 }}>{card.value.toLocaleString('ru-RU')}</div>
            </motion.div>
          ))
        }
      </div>

      {data?.last_news_fetch && (
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--muted)' }}>
          Последнее обновление новостей: {new Date(data.last_news_fetch).toLocaleString('ru-RU')}
        </div>
      )}
      {data?.last_activity && (
        <div style={{ marginTop: 4, fontSize: 12, color: 'var(--muted)' }}>
          Последняя активность (комментарий): {new Date(data.last_activity).toLocaleString('ru-RU')}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 2. Users section
// ---------------------------------------------------------------------------

function UsersSection() {
  const [filters, setFilters] = useState<UseAdminUsersFilters>({})
  const [page, setPage] = useState(1)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const { data, isLoading, error, patchUser, deleteUser } = useAdminUsers(filters, page)

  async function handleBlock(id: string, currentlyActive: boolean) {
    setActionError(null)
    try {
      await patchUser(id, { is_blocked: currentlyActive })
    } catch (e) {
      setActionError((e as Error).message)
    }
  }

  async function handleDelete(id: string) {
    setActionError(null)
    setConfirmDelete(null)
    try {
      await deleteUser(id)
    } catch (e) {
      setActionError((e as Error).message)
    }
  }

  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 14 }}>Пользователи</h2>

      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 180, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg)', borderRadius: 'var(--r-pill)', padding: '8px 14px', border: '1px solid var(--border)' }}>
          <Search size={14} color="var(--muted)" />
          <input
            placeholder="Поиск..."
            value={filters.search ?? ''}
            onChange={(e) => { setFilters((p) => ({ ...p, search: e.target.value || undefined })); setPage(1) }}
            style={{ background: 'none', border: 'none', outline: 'none', fontSize: 13, color: 'var(--text)', width: '100%', fontFamily: 'var(--font)' }}
          />
        </div>
        <select
          value={filters.role ?? ''}
          onChange={(e) => { setFilters((p) => ({ ...p, role: e.target.value || undefined })); setPage(1) }}
          style={{ padding: '8px 12px', borderRadius: 'var(--r-pill)', border: '1px solid var(--border)', fontSize: 12, color: 'var(--text)', background: 'var(--white)', fontFamily: 'var(--font)', cursor: 'pointer' }}
        >
          <option value="">Все роли</option>
          <option value="user">Пользователи</option>
          <option value="admin">Администраторы</option>
        </select>
      </div>

      {(error || actionError) && <ErrorMsg msg={(error?.message ?? actionError) as string} />}

      {isLoading
        ? <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}><SpinnerIcon /></div>
        : (
          <>
            <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                    <th style={TH_STYLE}>Пользователь</th>
                    <th style={TH_STYLE}>Email</th>
                    <th style={TH_STYLE}>Роль</th>
                    <th style={TH_STYLE}>Регистрация</th>
                    <th style={TH_STYLE}>Статус</th>
                    <th style={TH_STYLE}>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.items.map((user) => (
                    <tr key={user.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={TD_STYLE}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                          <div style={{ width: 30, height: 30, borderRadius: '50%', background: user.role === 'admin' ? 'var(--accent)' : 'var(--bg)', color: user.role === 'admin' ? '#fff' : 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0, border: '1px solid var(--border)' }}>
                            {user.avatar_url
                              ? <img src={user.avatar_url} alt="" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover' }} />
                              : user.username[0].toUpperCase()
                            }
                          </div>
                          <span style={{ fontWeight: 500, color: 'var(--text)' }}>{user.username}</span>
                        </div>
                      </td>
                      <td style={{ ...TD_STYLE, color: 'var(--muted)' }}>{user.email}</td>
                      <td style={TD_STYLE}>
                        <Badge color={user.role === 'admin' ? 'var(--accent)' : 'var(--muted)'} bg={user.role === 'admin' ? 'rgba(225,29,72,0.08)' : 'var(--bg)'}>
                          {user.role === 'admin' ? 'Admin' : 'User'}
                        </Badge>
                      </td>
                      <td style={{ ...TD_STYLE, color: 'var(--muted)', fontSize: 12 }}>
                        {new Date(user.created_at).toLocaleDateString('ru-RU')}
                      </td>
                      <td style={TD_STYLE}>
                        {user.is_active
                          ? <Badge color="var(--green)" bg="rgba(34,197,94,0.08)"><CheckCircle size={10} style={{ display: 'inline', marginRight: 3 }} />Активен</Badge>
                          : <Badge color="var(--red)" bg="rgba(225,29,72,0.08)"><Ban size={10} style={{ display: 'inline', marginRight: 3 }} />Заблокирован</Badge>
                        }
                      </td>
                      <td style={TD_STYLE}>
                        <div style={{ display: 'flex', gap: 5 }}>
                          <button
                            onClick={() => void handleBlock(user.id, user.is_active)}
                            aria-label={user.is_active ? 'Заблокировать' : 'Разблокировать'}
                            style={{ padding: '4px 8px', borderRadius: 'var(--r-sm)', border: `1px solid ${user.is_active ? 'var(--red)' : 'var(--green)'}`, background: 'transparent', color: user.is_active ? 'var(--red)' : 'var(--green)', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 3 }}
                          >
                            {user.is_active ? <Ban size={11} /> : <CheckCircle size={11} />}
                            {user.is_active ? 'Блок' : 'Разблок'}
                          </button>
                          {confirmDelete === user.id
                            ? (
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button onClick={() => void handleDelete(user.id)} style={{ padding: '4px 8px', borderRadius: 'var(--r-sm)', border: 'none', background: 'var(--red)', color: '#fff', cursor: 'pointer', fontSize: 11 }}>Да</button>
                                <button onClick={() => setConfirmDelete(null)} style={{ padding: '4px 8px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: 11 }}>Нет</button>
                              </div>
                            )
                            : (
                              <button
                                onClick={() => setConfirmDelete(user.id)}
                                aria-label="Удалить"
                                style={{ padding: '4px 8px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center' }}
                              >
                                <Trash2 size={11} />
                              </button>
                            )
                          }
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!data?.items.length && (
                    <tr>
                      <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>Пользователи не найдены</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {data && <Pager page={page} total={data.total} limit={20} onPage={setPage} />}
          </>
        )
      }
    </div>
  )
}

// ---------------------------------------------------------------------------
// 3. Create admin section
// ---------------------------------------------------------------------------

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 'var(--r-md)',
  border: '1px solid var(--border)', fontSize: 13, color: 'var(--text)',
  background: 'var(--white)', outline: 'none', fontFamily: 'var(--font)',
  boxSizing: 'border-box',
}

function CreateAdminSection() {
  const [form, setForm] = useState({ email: '', username: '', password: '' })
  const [showPass, setShowPass] = useState(false)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [msg, setMsg] = useState('')

  const { createAdmin } = useAdminUsers({}, 1)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    setMsg('')
    try {
      const created = await createAdmin(form)
      setStatus('ok')
      setMsg(`Администратор создан: ${created.username} (${created.email})`)
      setForm({ email: '', username: '', password: '' })
    } catch (err) {
      setStatus('error')
      setMsg((err as Error).message)
    }
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 14 }}>Создать Администратора</h2>
      <form onSubmit={(e) => void handleSubmit(e)} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: 5 }}>Email</label>
          <input type="email" required value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} style={inputStyle} placeholder="admin@example.com" />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: 5 }}>Username</label>
          <input type="text" required minLength={3} value={form.username} onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))} style={inputStyle} placeholder="superadmin" />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: 5 }}>Пароль</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showPass ? 'text' : 'password'}
              required
              minLength={8}
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              style={{ ...inputStyle, paddingRight: 40 }}
              placeholder="Минимум 8 символов"
            />
            <button type="button" onClick={() => setShowPass((v) => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center' }}>
              {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {msg && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{ fontSize: 13, color: status === 'ok' ? 'var(--green)' : 'var(--red)', padding: '8px 12px', background: status === 'ok' ? 'rgba(34,197,94,0.08)' : 'rgba(225,29,72,0.08)', borderRadius: 'var(--r-sm)' }}
            >
              {msg}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          type="submit"
          disabled={status === 'loading'}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          style={{ padding: '11px 24px', borderRadius: 'var(--r-pill)', background: 'var(--accent)', color: '#fff', border: 'none', cursor: status === 'loading' ? 'wait' : 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: 'fit-content' }}
        >
          {status === 'loading' ? <SpinnerIcon /> : <Plus size={15} />}
          Создать администратора
        </motion.button>
      </form>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 4. Comments moderation section
// ---------------------------------------------------------------------------

function CommentsSection() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const { data, isLoading, error, deleteComment } = useAdminComments(page, debouncedQ)

  // Debounce search: reset to page 1 and apply query 400ms after typing stops
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(searchInput.trim())
      setPage(1)
    }, 400)
    return () => clearTimeout(t)
  }, [searchInput])

  async function handleDelete(id: string) {
    setConfirmDelete(null)
    try {
      await deleteComment(id)
    } catch (e) {
      console.warn('[CommentsSection] delete failed', e)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          Комментарии
          {data && (
            <Badge color="var(--accent)" bg="rgba(225,29,72,0.08)">{data.total}</Badge>
          )}
        </h2>
        <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 340 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }} />
          <input
            type="search"
            placeholder="Поиск по тексту…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{ ...inputStyle, paddingLeft: 30, width: '100%' }}
          />
        </div>
      </div>

      {error && <ErrorMsg msg={error.message} />}

      {isLoading
        ? <div style={{ padding: 32, textAlign: 'center' }}><SpinnerIcon /></div>
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data?.items.map((comment) => (
              <motion.div
                key={comment.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px', background: 'var(--white)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}
              >
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg)', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0, border: '1px solid var(--border)' }}>
                  {comment.author.avatar_url
                    ? <img src={comment.author.avatar_url} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                    : comment.author.username[0].toUpperCase()
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{comment.author.username}</span>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>{new Date(comment.created_at).toLocaleString('ru-RU')}</span>
                  </div>
                  {/* Клик по тексту комментария → deep-link к статье и якорю
                      #comment-<id> (если статья найдена в БД); иначе обычный текст. */}
                  {comment.article_id ? (
                    <p
                      onClick={() => {
                        console.debug('[CommentsSection] open /news/%s#comment-%s', comment.article_id, comment.id)
                        navigate(`/news/${comment.article_id}#comment-${comment.id}`)
                      }}
                      style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5, marginBottom: 6, cursor: 'pointer' }}
                      title="Открыть статью и перейти к комментарию"
                    >
                      {comment.text}
                    </p>
                  ) : (
                    <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5, marginBottom: 6 }}>{comment.text}</p>
                  )}
                  {comment.article_id ? (
                    <button
                      onClick={() => navigate(`/news/${comment.article_id}#comment-${comment.id}`)}
                      style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'var(--font)', fontWeight: 600 }}
                    >
                      Перейти к комментарию →
                    </button>
                  ) : (
                    <a href={comment.article_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--muted)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: 400 }}>
                      {comment.article_url}
                    </a>
                  )}

                  {/* Ответы на комментарий (depth 1) — вложенно, с отступом и левой линией */}
                  {comment.replies?.length > 0 && (
                    <div style={{ marginTop: 10, paddingLeft: 12, borderLeft: '2px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {comment.replies.map((reply) => (
                        <div key={reply.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                          <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--bg)', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0, border: '1px solid var(--border)' }}>
                            {reply.author.avatar_url
                              ? <img src={reply.author.avatar_url} alt="" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
                              : reply.author.username[0].toUpperCase()
                            }
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{reply.author.username}</span>
                              <span style={{ fontSize: 10, color: 'var(--muted)' }}>{new Date(reply.created_at).toLocaleString('ru-RU')}</span>
                            </div>
                            <p style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5, margin: 0 }}>{reply.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  {confirmDelete === comment.id
                    ? (
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <button onClick={() => void handleDelete(comment.id)} style={{ padding: '4px 8px', borderRadius: 'var(--r-sm)', border: 'none', background: 'var(--red)', color: '#fff', cursor: 'pointer', fontSize: 11 }}>Да</button>
                        <button onClick={() => setConfirmDelete(null)} style={{ padding: '4px 8px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: 11 }}>Нет</button>
                      </div>
                    )
                    : (
                      <button onClick={() => setConfirmDelete(comment.id)} style={{ padding: '5px 9px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                        <Trash2 size={13} />
                      </button>
                    )
                  }
                </div>
              </motion.div>
            ))}
            {!data?.items.length && (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>Комментарии не найдены</div>
            )}
            {data && <Pager page={page} total={data.total} limit={20} onPage={setPage} />}
          </div>
        )
      }
    </div>
  )
}

// ---------------------------------------------------------------------------
// 5. API Keys section
// ---------------------------------------------------------------------------

const API_SERVICES = [
  { key: 'finnhub', label: 'Finnhub', description: 'Котировки акций и форекс' },
  { key: 'newsapi', label: 'NewsAPI', description: 'Финансовые новости' },
  { key: 'openrouter', label: 'OpenRouter', description: 'AI-модели (новости)' },
  { key: 'groq', label: 'Groq', description: 'AI-чат помощник' },
]

function ApiKeysSection() {
  const { keys, isLoading, error, saveKeys, testKey, testingService } = useAdminApiKeys()
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({})
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  async function handleSave() {
    setSaving(true)
    setSaveMsg('')
    try {
      await saveKeys(draft)
      setDraft({})
      setSaveMsg('Ключи сохранены')
    } catch (e) {
      setSaveMsg((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleTest(service: string) {
    // Pass the typed draft value (if any); otherwise the backend tests the
    // resolved key (DB→.env). `saved` is a masked placeholder, never sent.
    const typed = draft[service]
    const result = await testKey(service, typed)
    setTestResults((p) => ({ ...p, [service]: result }))
  }

  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 14 }}>API Ключи</h2>

      {error && <ErrorMsg msg={error.message} />}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 560 }}>
        {isLoading
          ? <div style={{ padding: 24, textAlign: 'center' }}><SpinnerIcon /></div>
          : API_SERVICES.map((svc) => {
            // `saved` — маскированный ключ из БД (напр. «••••1f1»). Показываем его
            // ТОЛЬКО как placeholder, а value поля = введённый черновик. Пустой ввод
            // = не менять; ввод нового значения = перезапись. (Задача 5.1)
            const saved = keys[svc.key] ?? ''
            const draftVal = draft[svc.key] ?? ''
            const testResult = testResults[svc.key]

            return (
              <div key={svc.key} style={{ background: 'var(--bg)', borderRadius: 'var(--r-md)', padding: '16px 18px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{svc.label}</span>
                    <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 8 }}>{svc.description}</span>
                  </div>
                  {saved && <Badge color="var(--green)" bg="rgba(34,197,94,0.08)"><CheckCircle size={10} style={{ display: 'inline', marginRight: 3 }} />Сохранён</Badge>}
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <input
                      type={showKeys[svc.key] ? 'text' : 'password'}
                      value={draftVal}
                      onChange={(e) => setDraft((p) => ({ ...p, [svc.key]: e.target.value }))}
                      placeholder={saved ? `Сохранён: ${saved} — введите новый, чтобы заменить` : 'Вставьте API ключ...'}
                      style={{ width: '100%', padding: '9px 36px 9px 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', fontSize: 12, color: 'var(--text)', background: 'var(--white)', outline: 'none', fontFamily: 'monospace', boxSizing: 'border-box' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowKeys((p) => ({ ...p, [svc.key]: !p[svc.key] }))}
                      style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center' }}
                    >
                      {showKeys[svc.key] ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                  <button
                    onClick={() => void handleTest(svc.key)}
                    disabled={testingService === svc.key}
                    aria-label="Проверить ключ"
                    style={{ padding: '9px 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'var(--white)', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 500, flexShrink: 0 }}
                  >
                    {testingService === svc.key ? <SpinnerIcon /> : <Play size={12} />}
                    Тест
                  </button>
                </div>

                {testResult && (
                  <div style={{ marginTop: 8, fontSize: 12, color: testResult.success ? 'var(--green)' : 'var(--red)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    {testResult.success ? <CheckCircle size={12} /> : <Ban size={12} />}
                    {testResult.message}
                  </div>
                )}
              </div>
            )
          })
        }

        {!isLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <motion.button
              onClick={() => void handleSave()}
              disabled={saving || Object.keys(draft).length === 0}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              style={{ padding: '10px 22px', borderRadius: 'var(--r-pill)', background: Object.keys(draft).length ? 'var(--accent)' : 'var(--border)', color: '#fff', border: 'none', cursor: Object.keys(draft).length ? 'pointer' : 'default', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: 7 }}
            >
              {saving ? <SpinnerIcon /> : null}
              Сохранить изменения
            </motion.button>
            {saveMsg && <span style={{ fontSize: 13, color: 'var(--green)' }}>{saveMsg}</span>}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 6. Logs section
// ---------------------------------------------------------------------------

function LogsSection() {
  const [page, setPage] = useState(1)
  const { data, isLoading, error, refetch } = useAdminLogs(page)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>Журнал действий</h2>
        <button
          onClick={() => void refetch()}
          style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '5px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--muted)' }}
        >
          <RefreshCw size={12} /> Обновить
        </button>
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12 }}>Авто-обновление каждые 60 секунд</div>

      {error && <ErrorMsg msg={error.message} />}

      {isLoading
        ? <div style={{ padding: 32, textAlign: 'center' }}><SpinnerIcon /></div>
        : (
          <>
            <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                    <th style={TH_STYLE}>Время</th>
                    <th style={TH_STYLE}>Администратор</th>
                    <th style={TH_STYLE}>Действие</th>
                    <th style={TH_STYLE}>Тип</th>
                    <th style={TH_STYLE}>Цель</th>
                    <th style={TH_STYLE}>Детали</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.items.map((log) => (
                    <tr key={log.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ ...TD_STYLE, color: 'var(--muted)', fontSize: 12, whiteSpace: 'nowrap' }}>
                        {new Date(log.created_at).toLocaleString('ru-RU')}
                      </td>
                      <td style={{ ...TD_STYLE, fontWeight: 500 }}>{log.admin_username}</td>
                      <td style={TD_STYLE}>
                        <Badge color="var(--accent)" bg="rgba(225,29,72,0.06)">{log.action}</Badge>
                      </td>
                      <td style={{ ...TD_STYLE, color: 'var(--muted)', fontSize: 12 }}>{log.target_type}</td>
                      <td style={{ ...TD_STYLE, color: 'var(--muted)', fontSize: 11, fontFamily: 'monospace', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.target_id}</td>
                      <td style={{ ...TD_STYLE, color: 'var(--muted)', fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.details ?? '—'}</td>
                    </tr>
                  ))}
                  {!data?.items.length && (
                    <tr>
                      <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>Записи отсутствуют</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {data && <Pager page={page} total={data.total} limit={20} onPage={setPage} />}
          </>
        )
      }
    </div>
  )
}

// ---------------------------------------------------------------------------
// Root page
// ---------------------------------------------------------------------------

export default function AdminPanelPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('stats')

  return (
    <div style={{ padding: 16, height: '100%', boxSizing: 'border-box', overflowY: 'auto' }}>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        style={{ maxWidth: 1200, margin: 'auto', paddingBottom: 32 }}
      >
        <button
          onClick={() => navigate(-1)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font)', marginBottom: 16, padding: 4 }}
        >
          <ChevronLeft size={16} /> Назад
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <ShieldCheck size={24} color="var(--accent)" />
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.1 }}>Панель администратора</h1>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Управление пользователями, API и контентом</div>
          </div>
        </div>

        {/* Tab nav */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 'var(--r-pill)',
                border: '1px solid ' + (tab === t.id ? 'var(--accent)' : 'var(--border)'),
                background: tab === t.id ? 'var(--accent)' : 'var(--white)',
                color: tab === t.id ? '#fff' : 'var(--muted)',
                cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: 'var(--font)',
                transition: 'all 0.15s',
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            style={{ background: 'var(--white)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', padding: '24px 28px', boxShadow: 'var(--shadow-sm)' }}
          >
            {tab === 'stats' && <StatsSection />}
            {tab === 'users' && <UsersSection />}
            {tab === 'create-admin' && <CreateAdminSection />}
            {tab === 'comments' && <CommentsSection />}
            {tab === 'api-keys' && <ApiKeysSection />}
            {tab === 'logs' && <LogsSection />}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
