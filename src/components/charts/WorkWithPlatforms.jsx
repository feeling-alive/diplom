import { motion } from 'framer-motion'
import { PlatformIcon } from '../../icons/PlatformIcons'
import { platformColors, managers } from '../../data/mock'
import CountUp from '../../ui/CountUp'
import { t } from '../../i18n'
import './WorkWithPlatforms.css'

export default function WorkWithPlatforms() {
  const mikasa = managers.find(m => m.userId === 'mikasa')
  const wp = mikasa?.workPlatforms
  if (!wp) return null

  return (
    <motion.div
      className="wwp"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.75, duration: 0.4 }}
    >
      <div className="wwp-head">
        <span className="wwp-title">{t.workWithPlatforms}</span>
        <span className="wwp-plus">+{wp.new}</span>
        <span className="wwp-total">{wp.total}</span>
      </div>

      <div className="wwp-grid">
        {wp.items.map((p, i) => (
          <motion.div
            className="wwp-tile"
            key={p.id}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.8 + i * 0.07 }}
          >
            <div className="wwp-tile__row">
              <PlatformIcon id={p.id} size={14}/>
              <span className="wwp-tile__name">
                {p.id === 'other' ? t.other : p.id.charAt(0).toUpperCase() + p.id.slice(1)}
              </span>
            </div>
            <div className="wwp-tile__nums">
              <span className="wwp-tile__percent">{p.percent}%</span>
              <span className="wwp-tile__amount">{p.amount}</span>
            </div>
            <div className="wwp-tile__bar">
              <motion.div
                className="wwp-tile__bar-fill"
                style={{ background: platformColors[p.id] || platformColors.other }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(p.percent * 2, 100)}%` }}
                transition={{ delay: 0.85 + i * 0.07, duration: 0.7 }}
              />
            </div>
          </motion.div>
        ))}
      </div>

      <div className="wwp-overall">
        <span className="wwp-overall__percent">
          <CountUp to={wp.overall.percent} duration={1.4} decimals={1}/>%
        </span>
        <span className="wwp-overall__amount">{wp.overall.amount}</span>
      </div>
    </motion.div>
  )
}
