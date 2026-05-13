import { Star, ChevronRight, ArrowUp, ArrowDown } from 'lucide-react'
import { motion } from 'framer-motion'
import Avatar from '../../ui/Avatar'
import CountUp from '../../ui/CountUp'
import { t } from '../../i18n'
import './KpiSummary.css'

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.2 },
  },
}

const row = {
  hidden: { opacity: 0, x: 8 },
  show: {
    opacity: 1, x: 0,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] },
  },
}

export default function KpiSummary() {
  return (
    <motion.div
      className="kpis"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
    >
      <motion.div
        className="kpis-hero"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        whileHover={{ scale: 1.01 }}
      >
        <div className="kpis-hero__lbl">
          <span className="kpis-hero__star">
            <Star size={11} fill="#fff" color="#fff" strokeWidth={0}/>
          </span>
          {t.bestDeal}
        </div>
        <div className="kpis-hero__mid">
          <span className="kpis-hero__val">
            <CountUp to={42300} prefix="$" duration={1.6}/>
          </span>
          <span className="kpis-hero__sub">Rolf Inc.</span>
        </div>
        <button className="kpis-hero__arrow"><ChevronRight size={12}/></button>
        <div className="kpis-hero__shimmer"/>
      </motion.div>

      <motion.ul className="kpis-rows" variants={container} initial="hidden" animate="show">
        <motion.li className="kpis-row" variants={row}>
          <span className="kpis-row__lbl">{t.topSales}</span>
          <span className="kpis-row__val"><CountUp to={72} duration={1.2}/></span>
          <span className="kpis-row__extra kpis-row__user">
            <Avatar userId="mikasa" size={18}/>
            <span>Микаса</span>
          </span>
        </motion.li>

        <motion.li className="kpis-row" variants={row}>
          <span className="kpis-row__lbl">{t.deals}</span>
          <span className="kpis-row__val"><CountUp to={258} duration={1.3}/></span>
          <span className="kpis-row__extra kpis-trend kpis-trend--neg">
            <ArrowDown size={10}/>
            <span>5</span>
          </span>
        </motion.li>

        <motion.li className="kpis-row kpis-row--accent" variants={row}>
          <span className="kpis-row__lbl">{t.value}</span>
          <span className="kpis-row__val kpis-row__val--accent">528k</span>
          <span className="kpis-row__extra kpis-trend kpis-trend--pos">
            <ArrowUp size={10}/>
            <span>7.9%</span>
          </span>
        </motion.li>

        <motion.li className="kpis-row" variants={row}>
          <span className="kpis-row__lbl">{t.winRate}</span>
          <span className="kpis-row__val">43%</span>
          <span className="kpis-row__extra kpis-trend kpis-trend--pos">
            <ArrowUp size={10}/>
            <span>1.2%</span>
          </span>
        </motion.li>
      </motion.ul>
    </motion.div>
  )
}
