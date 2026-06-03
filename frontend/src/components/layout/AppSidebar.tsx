import type React from 'react'
import { useState, useCallback, useEffect, useRef } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../context/AuthContext'
import { hashToHsl, initial } from '../../utils/avatarColor'
import {
  LayoutDashboard,
  BarChart2,
  Newspaper,
  TrendingUp,
  User,
  Settings,
  LogOut,
  Sparkles,
} from 'lucide-react'

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Дашборд', path: '/' },
  { icon: BarChart2, label: 'Рынок', path: '/market' },
  { icon: Newspaper, label: 'Новости', path: '/news' },
  { icon: TrendingUp, label: 'Активы', path: '/assets' },
  { icon: Sparkles, label: 'AI Чат', path: '/chat' },
  { icon: User, label: 'Профиль', path: '/profile' },
]

export default function AppSidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [activeTooltip, setActiveTooltip] = useState<{ label: string; x: number; y: number } | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showTooltip = useCallback((e: React.MouseEvent, label: string) => {
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current)
    tooltipTimerRef.current = setTimeout(() => {
      setActiveTooltip({ label, x: e.clientX, y: e.clientY })
    }, 300)
  }, [])

  const hideTooltip = useCallback(() => {
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current)
    setActiveTooltip(null)
  }, [])

  useEffect(() => {
    return () => {
      if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current)
    }
  }, [])

  // Close the user menu on Escape.
  useEffect(() => {
    if (!menuOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  async function handleLogout() {
    console.debug('[AppSidebar] logout')
    // Server-side logout (clears the HttpOnly cookie) + context/localStorage reset.
    await logout()
    // Full reload guarantees a clean unauthenticated app state.
    window.location.href = '/login'
  }

  function goTo(path: string) {
    console.debug('[AppSidebar] navigate', path)
    setMenuOpen(false)
    navigate(path)
  }

  const isActive = (path: string) =>
    location.pathname === path || (path !== '/' && location.pathname.startsWith(path))

  const username = user?.username ?? ''
  const avatarUrl = user?.avatar_url ?? null

  return (
    <>
      <aside data-testid="app-sidebar" className="app-rail">
        {/* Nav icons */}
        <nav className="rail-nav">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.path)
            return (
              <NavLink
                key={item.path}
                to={item.path}
                data-testid={`rail-link-${item.path === '/' ? 'dashboard' : item.path.replace('/', '')}`}
                className={`rail-btn ${active ? 'active' : ''}`}
                onMouseEnter={(e) => showTooltip(e, item.label)}
                onMouseLeave={hideTooltip}
              >
                <item.icon size={18} strokeWidth={active ? 2.5 : 2} />
              </NavLink>
            )
          })}
        </nav>

        {/* Bottom */}
        <div className="rail-bottom">
          <div
            data-testid="user-avatar"
            className="rail-avatar"
            title="Профиль"
            onClick={() => setMenuOpen((v) => !v)}
            onMouseEnter={(e) => showTooltip(e, 'Профиль')}
            onMouseLeave={hideTooltip}
            style={
              avatarUrl
                ? { padding: 0, overflow: 'hidden', background: 'transparent' }
                : { background: username ? hashToHsl(username) : 'var(--accent)' }
            }
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={username}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            ) : (
              initial(username || 'Н')
            )}
          </div>
          <button
            className="rail-btn"
            data-testid="rail-settings"
            title="Настройки"
            onClick={() => goTo('/settings')}
            onMouseEnter={(e) => showTooltip(e, 'Настройки')}
            onMouseLeave={hideTooltip}
          >
            <Settings size={18} strokeWidth={2} />
          </button>
          <button
            className="rail-btn"
            data-testid="sidebar-logout"
            onClick={handleLogout}
            title="Выйти"
            onMouseEnter={(e) => showTooltip(e, 'Выйти')}
            onMouseLeave={hideTooltip}
          >
            <LogOut size={18} strokeWidth={2} />
          </button>
        </div>
      </aside>

      {/* User menu popup */}
      <AnimatePresence>
        {menuOpen && (
          <>
            {/* Backdrop closes the menu on outside click */}
            <div
              onClick={() => setMenuOpen(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'transparent' }}
            />
            <motion.div
              data-testid="sidebar-user-menu"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
              style={{
                position: 'fixed',
                left: 60,
                bottom: 16,
                zIndex: 9999,
                width: 220,
                background: 'var(--white)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-md)',
                boxShadow: 'var(--shadow-lg)',
                overflow: 'hidden',
                fontFamily: 'var(--font)',
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12 }}>
                <div
                  style={{
                    width: 34, height: 34, borderRadius: 999, overflow: 'hidden', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: username ? hashToHsl(username) : 'var(--accent)',
                    color: '#fff', fontSize: 13, fontWeight: 700,
                  }}
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    initial(username || 'Н')
                  )}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {username || 'Пользователь'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user?.email ?? ''}
                  </div>
                </div>
              </div>

              <div style={{ height: 1, background: 'var(--border)' }} />

              <MenuItem icon={<User size={16} />} label="Профиль" onClick={() => goTo('/profile')} />
              <MenuItem icon={<Settings size={16} />} label="Настройки" onClick={() => goTo('/settings')} />

              <div style={{ height: 1, background: 'var(--border)' }} />

              <MenuItem
                icon={<LogOut size={16} />}
                label="Выйти"
                color="var(--red)"
                onClick={handleLogout}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Tooltip portal */}
      <AnimatePresence>
        {activeTooltip && !menuOpen && (
          <motion.div
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            style={{
              position: 'fixed',
              left: activeTooltip.x + 16,
              top: activeTooltip.y - 8,
              zIndex: 9999,
              background: 'var(--ink)',
              color: '#fff',
              padding: '6px 12px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 500,
              whiteSpace: 'nowrap',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              pointerEvents: 'none',
              fontFamily: 'var(--font)',
              lineHeight: 1.4,
            }}
          >
            {activeTooltip.label}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

function MenuItem({
  icon,
  label,
  onClick,
  color = 'var(--text)',
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  color?: string
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
        padding: '10px 12px', background: 'transparent', border: 'none',
        cursor: 'pointer', fontSize: 13, fontWeight: 500, color,
        fontFamily: 'var(--font)', textAlign: 'left',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {icon}
      {label}
    </button>
  )
}
