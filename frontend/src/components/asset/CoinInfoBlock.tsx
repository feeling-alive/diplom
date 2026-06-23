import { useState } from 'react'
import { motion } from 'framer-motion'
import { Globe, Code, MessageCircle, Info, TrendingUp, TrendingDown, Calendar, Cpu, Award } from 'lucide-react'
import { useCoinInfo } from '../../hooks/useCoinInfo'
import { formatPrice } from '../../utils/format'

interface Props {
  symbol: string
}

function formatLargeNumber(n: number | null): string {
  if (n === null) return '–'
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`
  if (n >= 1e9)  return `${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6)  return `${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3)  return `${(n / 1e3).toFixed(2)}K`
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

function formatDate(iso: string | null): string {
  if (!iso) return '–'
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, '').trim()
}

function LinkPill({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        borderRadius: 999,
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        textDecoration: 'none',
        color: 'var(--ink)',
        fontSize: 12,
        fontWeight: 500,
        transition: 'background 0.15s, border-color 0.15s',
      }}
    >
      {icon}
      <span>{label}</span>
    </a>
  )
}

function StatCell({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ minWidth: 120 }}>
      <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 700 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function Skeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ height: 14, width: '40%', background: 'var(--border)', borderRadius: 6, opacity: 0.5 }} />
      <div style={{ height: 64, background: 'var(--border)', borderRadius: 8, opacity: 0.4 }} />
      <div style={{ display: 'flex', gap: 12 }}>
        {[1,2,3].map((i) => (
          <div key={i} style={{ flex: 1, height: 60, background: 'var(--border)', borderRadius: 10, opacity: 0.4 }} />
        ))}
      </div>
    </div>
  )
}

export default function CoinInfoBlock({ symbol }: Props) {
  const { data, isLoading, error, isUnsupported } = useCoinInfo(symbol)
  const [expanded, setExpanded] = useState(false)

  console.debug('[CoinInfoBlock] symbol=%s unsupported=%s loaded=%s err=%s', symbol, isUnsupported, !!data, error?.message)

  if (isUnsupported) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          padding: '40px 24px',
          textAlign: 'center',
          borderRadius: 14,
          background: 'var(--bg)',
          border: '1px dashed var(--border)',
        }}
      >
        <Info size={32} strokeWidth={1.5} color="var(--muted)" style={{ marginBottom: 12 }} />
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>
          Информация недоступна
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
          Расширенная информация доступна только для криптоактивов
        </div>
      </motion.div>
    )
  }

  if (isLoading) return <Skeleton />

  if (error || !data) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', fontSize: 12, color: 'var(--muted)' }}>
        Не удалось загрузить информацию о монете
      </div>
    )
  }

  const desc = stripHtml(data.description)
  const showFull = expanded || desc.length <= 400
  const visibleDesc = showFull ? desc : desc.slice(0, 400) + '…'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
    >
      {/* Description */}
      {desc && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            О проекте
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text)', margin: 0 }}>
            {visibleDesc}
            {desc.length > 400 && (
              <button
                onClick={() => setExpanded((v) => !v)}
                style={{
                  marginLeft: 6,
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                {expanded ? 'Свернуть' : 'Читать далее'}
              </button>
            )}
          </p>
        </div>
      )}

      {/* Links */}
      {(data.homepage || data.github || data.twitter) && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {data.homepage && <LinkPill href={data.homepage} icon={<Globe size={13} />} label="Сайт" />}
          {data.github && <LinkPill href={data.github} icon={<Code size={13} />} label="GitHub" />}
          {data.twitter && <LinkPill href={data.twitter} icon={<MessageCircle size={13} />} label="Twitter" />}
        </div>
      )}

      {/* Metadata row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: 14,
        padding: '14px 16px',
        background: 'var(--bg)',
        borderRadius: 12,
      }}>
        {data.genesisDate && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <Calendar size={14} color="var(--muted)" style={{ marginTop: 2 }} />
            <StatCell label="Запуск" value={formatDate(data.genesisDate)} />
          </div>
        )}
        {data.hashingAlgorithm && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <Cpu size={14} color="var(--muted)" style={{ marginTop: 2 }} />
            <StatCell label="Алгоритм" value={data.hashingAlgorithm} />
          </div>
        )}
        {data.marketCapRank !== null && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <Award size={14} color="var(--muted)" style={{ marginTop: 2 }} />
            <StatCell label="Рейтинг" value={`#${data.marketCapRank}`} />
          </div>
        )}
      </div>

      {/* Price extremes */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 12,
      }}>
        {data.ath !== null && (
          <div style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <TrendingUp size={13} color="var(--green)" />
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>ATH</span>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>
              {formatPrice(data.ath)}
            </div>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
              {formatDate(data.athDate)}
            </div>
          </div>
        )}
        {data.atl !== null && (
          <div style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <TrendingDown size={13} color="var(--accent)" />
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>ATL</span>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>
              {formatPrice(data.atl)}
            </div>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
              {formatDate(data.atlDate)}
            </div>
          </div>
        )}
      </div>

      {/* Supply info */}
      {(data.totalSupply !== null || data.circulatingSupply !== null) && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 12,
          padding: '14px 16px',
          background: 'var(--bg)',
          borderRadius: 12,
        }}>
          {data.circulatingSupply !== null && (
            <StatCell label="В обращении" value={formatLargeNumber(data.circulatingSupply)} sub={data.symbol.toUpperCase()} />
          )}
          {data.totalSupply !== null && (
            <StatCell label="Всего" value={formatLargeNumber(data.totalSupply)} sub={data.symbol.toUpperCase()} />
          )}
          {data.maxSupply !== null && (
            <StatCell label="Максимум" value={formatLargeNumber(data.maxSupply)} sub={data.symbol.toUpperCase()} />
          )}
        </div>
      )}
    </motion.div>
  )
}
