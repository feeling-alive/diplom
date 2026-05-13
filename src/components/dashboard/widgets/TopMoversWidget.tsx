import { motion } from 'framer-motion'

export default function TopMoversWidget() {
  const stocks = [
    { name: 'Tesla', symbol: 'TSLA', change: 8.2, color: '#ef4444' },
    { name: 'NVIDIA', symbol: 'NVDA', change: 6.5, color: '#3b82f6' },
    { name: 'AMD', symbol: 'AMD', change: 5.1, color: '#8b5cf6' },
    { name: 'Meta', symbol: 'META', change: -3.4, color: '#22c55e' },
    { name: 'Google', symbol: 'GOOGL', change: -2.1, color: '#f97316' },
    { name: 'Amazon', symbol: 'AMZN', change: -1.8, color: '#0ea5e9' },
  ]

  const gainers = stocks.filter((s) => s.change > 0)
  const losers = stocks.filter((s) => s.change < 0)

  return (
    <div
      style={{
        background: 'var(--white)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 16,
        minHeight: 320,
      }}
    >
      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>▲ Рост</span>
          {gainers.map((s) => (
            <div key={s.symbol} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{s.name}</span>
              <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600 }}>+{s.change}%</span>
            </div>
          ))}
        </div>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>▼ Падение</span>
          {losers.map((s) => (
            <div key={s.symbol} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{s.name}</span>
              <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>{s.change}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}