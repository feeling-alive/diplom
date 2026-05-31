import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Shield, ChevronLeft, Search, Ban, CheckCircle, XCircle, Filter, Download, RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

type UserRole = 'user' | 'admin'
type Status = 'active' | 'banned'

interface PlatformUser {
  id: string
  nickname: string
  email: string
  role: UserRole
  status: Status
  registeredAt: string
  lastActive: string
}

const MOCK_USERS: PlatformUser[] = [
  { id: 'u1', nickname: 'CryptoKing', email: 'crypto@mail.com', role: 'admin', status: 'active', registeredAt: '2024-01-15', lastActive: '2026-05-13' },
  { id: 'u2', nickname: 'TraderPro', email: 'trader@mail.com', role: 'user', status: 'active', registeredAt: '2024-03-22', lastActive: '2026-05-12' },
  { id: 'u3', nickname: 'Investor_42', email: 'invest@mail.com', role: 'user', status: 'active', registeredAt: '2024-06-10', lastActive: '2026-05-10' },
  { id: 'u4', nickname: 'DeFiQueen', email: 'defi@mail.com', role: 'user', status: 'banned', registeredAt: '2024-02-28', lastActive: '2026-04-15' },
  { id: 'u5', nickname: 'NeuralTrader', email: 'neural@mail.com', role: 'user', status: 'active', registeredAt: '2024-08-05', lastActive: '2026-05-13' },
  { id: 'u6', nickname: 'BearMarket', email: 'bear@mail.com', role: 'user', status: 'active', registeredAt: '2024-11-20', lastActive: '2026-05-09' },
  { id: 'u7', nickname: 'MoonShot', email: 'moon@mail.com', role: 'user', status: 'banned', registeredAt: '2025-01-03', lastActive: '2026-03-28' },
]

type FilterState = {
  search: string
  role: 'all' | UserRole
  status: 'all' | Status
}

function UsersTable({ filters }: { filters: FilterState }) {
  const filtered = useMemo(() => {
    let result = MOCK_USERS
    if (filters.search) {
      const q = filters.search.toLowerCase()
      result = result.filter(
        (u) => u.nickname.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
      )
    }
    if (filters.role !== 'all') result = result.filter((u) => u.role === filters.role)
    if (filters.status !== 'all') result = result.filter((u) => u.status === filters.status)
    return result
  }, [filters])

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
            <th style={{ padding: '10px 12px', color: 'var(--muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Пользователь</th>
            <th style={{ padding: '10px 12px', color: 'var(--muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Email</th>
            <th style={{ padding: '10px 12px', color: 'var(--muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Роль</th>
            <th style={{ padding: '10px 12px', color: 'var(--muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Статус</th>
            <th style={{ padding: '10px 12px', color: 'var(--muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Регистрация</th>
            <th style={{ padding: '10px 12px', color: 'var(--muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Последнее действие</th>
            <th style={{ padding: '10px 12px', color: 'var(--muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Действия</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((user) => (
            <motion.tr
              key={user.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
              style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}
              whileHover={{ background: 'rgba(0,0,0,0.02)' }}
            >
              <td style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: user.role === 'admin' ? 'var(--accent)' : 'var(--bg)',
                    color: user.role === 'admin' ? '#fff' : 'var(--text)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, flexShrink: 0,
                  }}
                >
                  {user.nickname[0].toUpperCase()}
                </div>
                <span style={{ fontWeight: 500, color: 'var(--text)' }}>{user.nickname}</span>
              </td>
              <td style={{ padding: '12px', color: 'var(--muted)' }}>{user.email}</td>
              <td style={{ padding: '12px' }}>
                <span
                  style={{
                    padding: '3px 10px',
                    borderRadius: 'var(--r-pill)',
                    fontSize: 11,
                    fontWeight: 600,
                    background: user.role === 'admin' ? 'rgba(232,38,74,0.1)' : 'var(--bg)',
                    color: user.role === 'admin' ? 'var(--accent)' : 'var(--muted)',
                  }}
                >
                  {user.role === 'admin' ? 'Admin' : 'User'}
                </span>
              </td>
              <td style={{ padding: '12px' }}>
                <span
                  style={{
                    padding: '3px 10px',
                    borderRadius: 'var(--r-pill)',
                    fontSize: 11,
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    background: user.status === 'active' ? 'rgba(34,197,94,0.1)' : 'rgba(232,38,74,0.1)',
                    color: user.status === 'active' ? 'var(--green)' : 'var(--red)',
                  }}
                >
                  {user.status === 'active' ? <CheckCircle size={11} /> : <XCircle size={11} />}
                  {user.status === 'active' ? 'Активен' : 'Заблокирован'}
                </span>
              </td>
              <td style={{ padding: '12px', color: 'var(--muted)', fontSize: 12 }}>{user.registeredAt}</td>
              <td style={{ padding: '12px', color: 'var(--muted)', fontSize: 12 }}>{user.lastActive}</td>
              <td style={{ padding: '12px' }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  {user.status === 'active' ? (
                    <button
                      style={{
                        padding: '5px 10px',
                        borderRadius: 'var(--r-sm)',
                        border: '1px solid var(--red)',
                        background: 'transparent',
                        color: 'var(--red)',
                        cursor: 'pointer',
                        fontSize: 11,
                        fontWeight: 500,
                        transition: 'all 0.15s',
                      }}
                      onClick={() => {
                        alert(`Заблокировать ${user.nickname}?`)
                      }}
                    >
                      <Ban size={12} style={{ display: 'inline', marginRight: 3 }} />
                      Блок
                    </button>
                  ) : (
                    <button
                      style={{
                        padding: '5px 10px',
                        borderRadius: 'var(--r-sm)',
                        border: '1px solid var(--green)',
                        background: 'transparent',
                        color: 'var(--green)',
                        cursor: 'pointer',
                        fontSize: 11,
                        fontWeight: 500,
                      }}
                      onClick={() => {
                        alert(`Разблокировать ${user.nickname}?`)
                      }}
                    >
                      <CheckCircle size={12} style={{ display: 'inline', marginRight: 3 }} />
                      Разблок
                    </button>
                  )}
                </div>
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
          Пользователи не найдены
        </div>
      )}
    </div>
  )
}

function IntegrationSection() {
  const [apiKey, setApiKey] = useState('')
  const [tested, setTested] = useState(false)
  const [testing, setTesting] = useState(false)

  function handleTestConnection() {
    setTesting(true)
    setTimeout(() => {
      setTesting(false)
      setTested(true)
    }, 1500)
  }

  return (
    <div style={{ marginTop: 32 }}>
      <h3
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: 'var(--ink)',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Shield size={20} />
        API-интеграции
      </h3>

      <div
        style={{
          background: 'var(--bg)',
          borderRadius: 'var(--r-md)',
          padding: 20,
          border: '1px solid var(--border)',
        }}
      >
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: 6 }}>
            API ключ
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => { setApiKey(e.target.value); setTested(false) }}
            placeholder="Введите API ключ..."
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: 'var(--r-md)',
              border: '1px solid var(--border)',
              fontSize: 13,
              color: 'var(--text)',
              background: 'var(--white)',
              outline: 'none',
              fontFamily: 'var(--font)',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleTestConnection}
            disabled={testing || !apiKey.trim()}
            style={{
              padding: '10px 20px',
              borderRadius: 'var(--r-pill)',
              background: apiKey ? 'var(--accent)' : 'var(--border)',
              color: '#fff',
              border: 'none',
              cursor: apiKey ? 'pointer' : 'default',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'var(--font)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <RefreshCw size={14} style={{ animation: testing ? 'spin 1s linear infinite' : 'none' }} />
            {testing ? 'Проверка...' : 'Тест подключения'}
          </motion.button>

          {tested && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ fontSize: 13, color: 'var(--green)', fontWeight: 500 }}
            >
              ✓ Соединение успешно!
            </motion.span>
          )}
        </div>
      </div>
    </div>
  )
}

function ModerationSection() {
  const [flagged, setFlagged] = useState([
    { id: 'fc1', author: 'SpamBot99', text: 'Купить дешевые акции!!! Выгодное предложение!!!', flagged: true, reason: 'Спам' },
    { id: 'fc2', author: 'AngryTrader', text: 'Эта платформа обманывает пользователей, заберите мои деньги!', flagged: true, reason: 'Нецензурная лексика' },
    { id: 'fc3', author: 'NewsBot', text: 'Автоматический пост: курс BTC упал на 5% за последний час.', flagged: true, reason: 'Флаг сообщества' },
  ])

  function handleAction(id: string, action: 'delete' | 'approve') {
    setFlagged((prev) =>
      action === 'delete' ? prev.filter((c) => c.id !== id) : prev.map((c) => (c.id === id ? { ...c, flagged: false } : c)),
    )
  }

  return (
    <div style={{ marginTop: 32 }}>
      <h3
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: 'var(--ink)',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Filter size={20} />
        Модерация комментариев
        <span
          style={{
            background: 'var(--accent)',
            color: '#fff',
            padding: '2px 10px',
            borderRadius: 'var(--r-pill)',
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {flagged.filter((c) => c.flagged).length} отмеченных
        </span>
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {flagged.filter((c) => c.flagged).map((comment) => (
          <motion.div
            key={comment.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: '14px 16px',
              background: 'var(--white)',
              borderRadius: 'var(--r-md)',
              boxShadow: 'var(--shadow-sm)',
              border: '1px solid var(--border)',
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'var(--bg)',
                color: 'var(--muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {comment.author[0]}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{comment.author}</span>
                <span
                  style={{
                    fontSize: 10,
                    padding: '2px 8px',
                    borderRadius: 'var(--r-pill)',
                    background: 'rgba(232,38,74,0.1)',
                    color: 'var(--red)',
                    fontWeight: 600,
                  }}
                >
                  {comment.reason}
                </span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5, marginBottom: 8 }}>{comment.text}</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => handleAction(comment.id, 'approve')}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 'var(--r-sm)',
                    border: '1px solid var(--green)',
                    background: 'rgba(34,197,94,0.1)',
                    color: 'var(--green)',
                    cursor: 'pointer',
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  <CheckCircle size={12} style={{ display: 'inline', marginRight: 4 }} />
                  Одобрить
                </button>
                <button
                  onClick={() => handleAction(comment.id, 'delete')}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 'var(--r-sm)',
                    border: '1px solid var(--red)',
                    background: 'rgba(232,38,74,0.1)',
                    color: 'var(--red)',
                    cursor: 'pointer',
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  <XCircle size={12} style={{ display: 'inline', marginRight: 4 }} />
                  Удалить
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

export default function AdminPanelPage() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    role: 'all',
    status: 'all',
  })

  return (
    <div style={{ padding: 16, height: '100%', boxSizing: 'border-box' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{
          maxWidth: 1200,
          margin: 'auto',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          padding: '24px 0',
        }}
      >
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', color: 'var(--muted)',
            cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font)', marginBottom: 16, padding: 4,
          }}
        >
          <ChevronLeft size={16} />
          Назад
        </button>

        <div
          style={{
            background: 'var(--white)',
            borderRadius: 22,
            boxShadow: 'var(--shadow-lg)',
            padding: 32,
            flex: 1,
            overflowY: 'auto',
          }}
        >
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--ink)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Shield size={24} />
            Панель администратора
          </h1>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 28 }}>
            Управление пользователями, API-интеграциями и модерацией контента
          </p>

          {/* Stats bar */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 12,
              marginBottom: 28,
            }}
          >
            {[
              { label: 'Пользователи', value: MOCK_USERS.length, color: 'var(--accent)' },
              { label: 'Активные', value: MOCK_USERS.filter((u) => u.status === 'active').length, color: 'var(--green)' },
              { label: 'Заблокированы', value: MOCK_USERS.filter((u) => u.status === 'banned').length, color: 'var(--red)' },
              { label: 'Модерация', value: MOCK_USERS.length, color: 'var(--soft)' },
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                style={{
                  background: 'var(--bg)',
                  borderRadius: 'var(--r-md)',
                  padding: '16px 20px',
                  border: '1px solid var(--border)',
                }}
              >
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>{stat.label}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: stat.color, lineHeight: 1 }}>
                  {stat.value}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Users table */}
          <div style={{ marginBottom: 40 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 12 }}>Пользователи</h3>

            {/* Filters */}
            <div
              style={{
                display: 'flex',
                gap: 10,
                marginBottom: 12,
                flexWrap: 'wrap',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  flex: 1,
                  minWidth: 200,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'var(--bg)',
                  borderRadius: 'var(--r-pill)',
                  padding: '8px 14px',
                }}
              >
                <Search size={14} strokeWidth={2} color="var(--muted)" />
                <input
                  placeholder="Поиск..."
                  value={filters.search}
                  onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
                  style={{
                    background: 'none',
                    border: 'none',
                    outline: 'none',
                    fontSize: 13,
                    color: 'var(--text)',
                    width: '100%',
                    fontFamily: 'var(--font)',
                  }}
                />
              </div>
              <select
                value={filters.role}
                onChange={(e) => setFilters((p) => ({ ...p, role: e.target.value as FilterState['role'] }))}
                style={{
                  padding: '8px 14px',
                  borderRadius: 'var(--r-pill)',
                  border: '1px solid var(--border)',
                  fontSize: 12,
                  color: 'var(--muted)',
                  background: 'var(--white)',
                  fontFamily: 'var(--font)',
                  cursor: 'pointer',
                }}
              >
                <option value="all">Все роли</option>
                <option value="user">Пользователи</option>
                <option value="admin">Администраторы</option>
              </select>
              <select
                value={filters.status}
                onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value as FilterState['status'] }))}
                style={{
                  padding: '8px 14px',
                  borderRadius: 'var(--r-pill)',
                  border: '1px solid var(--border)',
                  fontSize: 12,
                  color: 'var(--muted)',
                  background: 'var(--white)',
                  fontFamily: 'var(--font)',
                  cursor: 'pointer',
                }}
              >
                <option value="all">Все статусы</option>
                <option value="active">Активные</option>
                <option value="banned">Заблокированные</option>
              </select>
            </div>

            <UsersTable filters={filters} />
          </div>

          <IntegrationSection />
          <ModerationSection />
        </div>
      </motion.div>
    </div>
  )
}