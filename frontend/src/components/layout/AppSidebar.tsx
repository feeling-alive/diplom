import { NavLink, useLocation, useNavigate } from 'react-router-dom'
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

  // Подписи передаём через aria-label (доступность для скринридеров) БЕЗ
  // визуального всплывающего тултипа: ни native title=, ни кастомного портала.
  return (
    <aside data-testid="app-sidebar" className="app-rail">
      {/* Nav icons */}
      <nav className="rail-nav">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.path)
          return (
            <NavLink
              key={item.path}
              to={item.path}
              aria-label={item.label}
              data-testid={`rail-link-${item.path === '/' ? 'dashboard' : item.path.replace('/', '')}`}
              className={`rail-btn ${active ? 'active' : ''}`}
            >
              <item.icon size={18} strokeWidth={active ? 2.5 : 2} />
            </NavLink>
          )
        })}
        {user?.role === 'admin' && (
          <NavLink
            to="/admin"
            aria-label="Админ панель"
            data-testid="rail-link-admin"
            className={`rail-btn ${isActive('/admin') ? 'active' : ''}`}
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
            role="button"
            aria-label="Профиль"
            onClick={() => navigate('/profile')}
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
          aria-label="Настройки"
          onClick={() => navigate('/settings')}
        >
          <Settings size={18} strokeWidth={2} />
        </button>
        <button
          className="rail-btn"
          data-testid="sidebar-logout"
          aria-label="Выйти"
          onClick={handleLogout}
        >
          <LogOut size={18} strokeWidth={2} />
        </button>
      </div>
    </aside>
  )
}
