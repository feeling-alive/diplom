import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Avatar from '../../ui/Avatar'
import { managerShares } from '../../data/mock'
import { t } from '../../i18n'
import './StackedManagerBar.css'

export default function StackedManagerBar() {
  const top3 = managerShares.slice(0, 3)
  const totalPct = top3.reduce((s, x) => s + x.percent, 0)

  return (
    <motion.div
      className="smb"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.45, duration: 0.4 }}
    >
      <button className="smb-arrow" aria-label="prev"><ChevronLeft size={14}/></button>

      <div className="smb-track">
        {top3.map((s, i) => (
          <motion.div
            className="smb-seg"
            key={s.userId}
            style={{ flex: s.percent / totalPct }}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 + i * 0.08 }}
          >
            <Avatar userId={s.userId} size={20}/>
            <span className="smb-amount">{s.amount}</span>
            <span className="smb-percent">{s.percent}%</span>
          </motion.div>
        ))}
      </div>

      <button className="smb-arrow" aria-label="next"><ChevronRight size={14}/></button>

      <button className="smb-details">{t.details}</button>
    </motion.div>
  )
}
