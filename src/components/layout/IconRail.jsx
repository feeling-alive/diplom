import { Compass, LayoutGrid, FileText, Command, Send, User, Settings } from 'lucide-react'
import './IconRail.css'

const navItems = [
  { id: 'compass',  icon: Compass },
  { id: 'grid',     icon: LayoutGrid, active: true },
  { id: 'docs',     icon: FileText },
  { id: 'cmd',      icon: Command },
  { id: 'send',     icon: Send },
]

export default function IconRail() {
  return (
    <aside className="rail">
      <div className="rail-logo">
        <div className="rail-logo__circle">C</div>
      </div>
      <nav className="rail-nav">
        {navItems.map(item => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              className={`rail-btn ${item.active ? 'rail-btn--active' : ''}`}
              aria-label={item.id}
            >
              <Icon size={18} strokeWidth={1.8} />
            </button>
          )
        })}
      </nav>
      <div className="rail-bottom">
        <button className="rail-btn rail-user">
          <User size={16} strokeWidth={1.8} />
          <span className="rail-notif" />
        </button>
        <button className="rail-btn">
          <Settings size={18} strokeWidth={1.8} />
        </button>
      </div>
    </aside>
  )
}
