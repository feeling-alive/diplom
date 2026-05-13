import { motion } from 'framer-motion'
import { ArrowUp } from 'lucide-react'
import Avatar from '../../ui/Avatar'
import { users } from '../../data/mock'
import { t } from '../../i18n'
import './SalesTable.css'

const HEADERS = [t.sales, t.revenueShort, t.leadsShort, t.kpi, t.winLossShort]
const TAGS = [
  { txt: t.topSalesEmoji, emoji: '🔥' },
  { txt: t.salesStreak,   emoji: '🔥' },
  { txt: t.topReview,     emoji: '👍' },
]

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.09, delayChildren: 0.1 },
  },
}

const item = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] },
  },
}

export default function SalesTable({ rows, showHeaders = false, showTags = false }) {
  return (
    <div className="st">
      {showHeaders && (
        <div className="st-headers">
          {HEADERS.map(h => <span key={h} className="st-header">{h}</span>)}
        </div>
      )}

      <motion.div variants={container} initial="hidden" animate="show">
        {rows.map((m) => (
          <motion.div className="st-row" key={m.userId} variants={item}>
            <div className="st-cell st-person">
              <Avatar userId={m.userId} size={24}/>
              <span>{users[m.userId].name}</span>
            </div>
            <span className="st-cell st-revenue">{m.revenue}</span>
            <span className="st-cell st-badge-cell">
              <span className="badge-circle" style={{ background: m.leads.color }}>{m.leads.value}</span>
            </span>
            <span className="st-cell st-num">{m.kpi}</span>
            <span className="st-cell st-winrate">
              <span className="st-winrate__percent">{m.winRate}</span>
              <span className="badge-circle" style={{ background: m.wl.color }}>{m.wl.value}</span>
              <span className="st-winrate__other">{m.other}</span>
              <ArrowUp size={11} color="#2DC76D" strokeWidth={2.5}/>
            </span>
          </motion.div>
        ))}
      </motion.div>

      {showTags && (
        <div className="st-tags">
          {TAGS.map(tag => (
            <span className="st-tag" key={tag.txt}>
              <span>{tag.txt}</span>
              <span>{tag.emoji}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
