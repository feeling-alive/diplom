import { useMemo } from 'react'
import { ResponsiveContainer, BarChart, Bar, ReferenceLine } from 'recharts'
import type { WidgetSizeProps } from '../../../types/widgets.types'

type Props = WidgetSizeProps

// Deterministic PRNG so the demo bars stay stable across re-renders (no flicker).
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function genBars() {
  const rand = mulberry32(0x1357)
  const data = []
  for (let i = 0; i < 24; i++) {
    data.push({
      i,
      longs: -(rand() * 8 + 2),
      shorts: rand() * 10 + 1,
    })
  }
  return data
}

export default function LiquidationsWidget({ gridW = 2, gridH = 2 }: Props) {
  const data = useMemo(() => genBars(), [])
  const totalLongs = Math.abs(data.reduce((s, d) => s + d.longs, 0)).toFixed(0)
  const totalShorts = data.reduce((s, d) => s + d.shorts, 0).toFixed(0)
  console.info('[LiquidationsWidget] gridW=%d gridH=%d demo data (no free public API)', gridW, gridH)

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>
      <span style={{
        position: 'absolute', top: 0, right: 0, zIndex: 1,
        fontSize: 8, fontWeight: 700, color: 'var(--muted)',
        background: 'var(--bg)', borderRadius: 4, padding: '1px 5px',
      }}>Demo</span>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 2 }}>
        <span style={{ color: '#ef4444', fontWeight: 700 }}>Longs ${totalLongs}M</span>
        <span style={{ color: '#16a34a', fontWeight: 700 }}>Shorts ${totalShorts}M</span>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 0 }} stackOffset="sign">
            <ReferenceLine y={0} stroke="var(--border)" />
            <Bar dataKey="longs" fill="#ef4444" />
            <Bar dataKey="shorts" fill="#16a34a" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
