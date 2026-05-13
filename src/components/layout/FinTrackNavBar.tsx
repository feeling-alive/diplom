import { NavLink } from 'react-router-dom'
import { LayoutDashboard, BarChart2, Newspaper, TrendingUp } from 'lucide-react'

interface NavItem {
  to: string
  label: string
  Icon: React.FC<{ size: number; strokeWidth: number }>
  disabled?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { to: '/',       label: 'Дашборд',     Icon: LayoutDashboard },
  { to: '/market', label: 'Обзор рынка', Icon: BarChart2 },
  { to: '/news',   label: 'Новости',     Icon: Newspaper,  disabled: true },
  { to: '/asset',  label: 'Активы',      Icon: TrendingUp, disabled: true },
]

export default function FinTrackNavBar() {
  console.debug('[FinTrackNavBar] rendered')

  return (
    <nav
      style={{
        display: 'flex',
        gap: 4,
        alignItems: 'center',
        padding: '6px 0 10px',
      }}
    >
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          onClick={item.disabled ? (e) => e.preventDefault() : undefined}
          style={({ isActive }) => ({
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 12px',
            borderRadius: 'var(--r-pill)',
            fontSize: 12,
            fontWeight: 500,
            background: isActive ? 'var(--ink)' : 'transparent',
            color: isActive ? '#fff' : item.disabled ? 'var(--soft)' : 'var(--muted)',
            cursor: item.disabled ? 'not-allowed' : 'pointer',
            textDecoration: 'none',
            opacity: item.disabled ? 0.45 : 1,
            transition: 'background 0.15s, color 0.15s',
          })}
        >
          <item.Icon size={12} strokeWidth={2} />
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}
