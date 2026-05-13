import { BarChart3, ChevronDown } from 'lucide-react'
import { motion } from 'framer-motion'
import { PlatformIcon } from '../../icons/PlatformIcons'
import { referrerBubbles } from '../../data/mock'
import { t } from '../../i18n'
import './BubbleChart.css'

export default function BubbleChart() {
  return (
    <motion.div
      className="bc card"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.55, duration: 0.4 }}
    >
      <div className="bc-head">
        <button className="bc-iconbtn"><BarChart3 size={14}/><ChevronDown size={11}/></button>
        <button className="bc-filter">
          <span>{t.filters}</span>
          <ChevronDown size={11}/>
        </button>
      </div>

      <div className="bc-canvas">
        {referrerBubbles.map((b, i) => (
          <motion.div
            key={b.id}
            className="bc-bubble"
            style={{ top: b.top, left: b.left, width: b.size, height: b.size }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{
              delay: 0.7 + i * 0.1,
              type: 'spring',
              stiffness: 200,
              damping: 16,
            }}
            whileHover={{ scale: 1.12 }}
          >
            <PlatformIcon id={b.id} size={Math.round(b.size * 0.85)}/>
          </motion.div>
        ))}

        <div className="bc-label">
          {t.dealsAmountByReferrer} <ChevronDown size={10} strokeWidth={2}/>
        </div>
      </div>
    </motion.div>
  )
}
