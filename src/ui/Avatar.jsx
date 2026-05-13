// Аватар на инициалах с цветным фоном
import { users } from '../data/mock'

export default function Avatar({ userId, size = 24, ring = false, style }) {
  const u = users[userId] || users.current
  return (
    <span
      style={{
        width: size,
        height: size,
        background: u.color,
        color: '#fff',
        borderRadius: '50%',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.round(size * 0.4),
        fontWeight: 700,
        boxShadow: ring ? '0 0 0 2px #fff, 0 0 0 3px var(--c-accent)' : 'none',
        flexShrink: 0,
        ...style,
      }}
    >
      {u.initials}
    </span>
  )
}
