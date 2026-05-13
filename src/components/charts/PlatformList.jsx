import { AlignLeft, ChevronDown, Settings2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { PlatformIcon } from '../../icons/PlatformIcons'
import { platformList } from '../../data/mock'
import { t } from '../../i18n'
import './PlatformList.css'

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.09, delayChildren: 0.15 },
  },
}

const item = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] },
  },
}

export default function PlatformList() {
  return (
    <motion.div
      className="pl card"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="pl-head">
        <button className="pl-iconbtn">
          <AlignLeft size={14}/>
          <ChevronDown size={11}/>
        </button>
        <button className="pl-filter">
          <Settings2 size={11}/>
          <span>{t.filters}</span>
        </button>
      </div>

      <motion.ul className="pl-list" variants={container} initial="hidden" animate="show">
        {platformList.map((p) => (
          <motion.li className="pl-row" key={p.id} variants={item}>
            <PlatformIcon id={p.id} size={18}/>
            <span className="pl-name">{p.name}</span>
            <span className="pl-amount">{p.amount}</span>
            <span className="pl-percent">{p.percent}%</span>
          </motion.li>
        ))}
      </motion.ul>
    </motion.div>
  )
}
