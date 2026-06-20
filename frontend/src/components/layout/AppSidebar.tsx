import { useState, useCallback, useEffect, useRef } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../context/AuthContext'
import { hashToHsl, initial } from '../../utils/avatarColor'
import {
  LayoutDashboard,
  BarChart2,
  Newspaper,
  Settings,
  LogOut,
  Sparkles,
  ShieldCheck,
} from 'lucide-react'

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Дашборд', path: '/' },
  { icon: BarChart2, label: 'Рынок', path: '/market' },
  { icon: Newspaper, label: 'Новости', path: '/news' },
  { icon: Sparkles, label: 'AI Чат', path: '/chat' },
]

export default function AppSidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [activeTooltip, setActiveTooltip] = useState<{ label: string; x: number; y: number } | null>(null)
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

  async function handleLogout() {
    console.debug('[AppSidebar] logout')
    // Server-side logout (clears the HttpOnly cookie) + context/localStorage reset.
    await logout()
    // Full reload guarantees a clean unauthenticated app state.
    window.location.href = '/login'
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
          {user?.role === 'admin' && (
            <NavLink
              to="/admin"
              data-testid="rail-link-admin"
              className={`rail-btn ${isActive('/admin') ? 'active' : ''}`}
              onMouseEnter={(e) => showTooltip(e, 'Админ панель')}
              onMouseLeave={hideTooltip}
              style={{ color: 'var(--accent)' }}
            >
              <ShieldCheck size={18} strokeWidth={isActive('/admin') ? 2.5 : 2} />
            </NavLink>
          )}
        </nav>

        {/* Bottom */}
        <div className="rail-bottom">
          <div style={{ position: 'relative' }}>
            <div
              data-testid="user-avatar"
              className="rail-avatar"
              title="Профиль"
              onClick={() => navigate('/profile')}
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
          </div>
          <button
            className="rail-btn"
            data-testid="rail-settings"
            title="Настройки"
            onClick={() => navigate('/settings')}
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

      {/* Tooltip portal */}
      <AnimatePresence>
        {activeTooltip && (
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

