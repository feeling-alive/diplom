import { Bot, TrendingUp, Activity, ShieldAlert } from 'lucide-react'

interface Props {
  symbol: string
}

const SUGGESTIONS = [
  { icon: <TrendingUp size={12} />,   label: 'Проанализируй тренд' },
  { icon: <Activity size={12} />,     label: 'Найди уровни поддержки' },
  { icon: <ShieldAlert size={12} />,  label: 'Оцени риски входа' },
]

export default function AIPanel({ symbol }: Props) {
  console.debug('[AIPanel] rendered for %s', symbol)

  return (
    <div style={{
      background: 'var(--white)',
      border: '1px solid var(--border)',
      borderRadius: 16,
      padding: 16,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      boxShadow: 'var(--shadow-sm)',
      overflow: 'hidden',
    }}>
      <div style={{
        flex: 1,
        background: 'var(--bg)',
        borderRadius: 12,
        padding: '18px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        opacity: 0.6,
        position: 'relative',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: 'var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Bot size={20} color="var(--muted)" strokeWidth={1.8} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>ИИ-ассистент</div>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1, lineHeight: 1.3 }}>
              Будет доступен после подключения аналитической модели
            </div>
          </div>
        </div>

        {/* Suggestions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {SUGGESTIONS.map((s) => (
            <button
              key={s.label}
              disabled
              style={{
                padding: '8px 10px',
                borderRadius: 10,
                border: '1px solid var(--border)',
                background: 'var(--white)',
                color: 'var(--muted)',
                cursor: 'not-allowed',
                fontSize: 11,
                fontWeight: 500,
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {s.icon}
              {s.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* Disabled input */}
        <div style={{
          padding: '9px 12px',
          borderRadius: 10,
          border: '1px solid var(--border)',
          background: 'var(--white)',
          color: 'var(--soft)',
          fontSize: 11,
          cursor: 'not-allowed',
        }}>
          Задайте вопрос об активе...
        </div>
      </div>
    </div>
  )
}
