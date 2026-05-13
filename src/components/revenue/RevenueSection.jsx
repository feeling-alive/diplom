import { ChevronDown } from 'lucide-react'
import { motion } from 'framer-motion'

import CountUp from '../../ui/CountUp'
import KpiSummary from './KpiSummary'
import StackedManagerBar from './StackedManagerBar'
import { t } from '../../i18n'
import './RevenueSection.css'

export default function RevenueSection() {
  return (
    <section className="rev">
      <div className="rev-top">
        <div className="rev-left">
          <span className="rev-label">{t.revenue}</span>
          <motion.div
            className="rev-number"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <span className="rev-int"><CountUp to={528976} prefix="$" duration={1.8}/></span>
            <span className="rev-frac">.82</span>
          </motion.div>
          <motion.div
            className="rev-tags"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.4 }}
          >
            <span className="rev-tag rev-tag--pos">↑7.9%</span>
            <span className="rev-tag rev-tag--accent">+$27,335.09</span>
          </motion.div>
          <button className="rev-prev">
            <span className="rev-prev__label">{t.vsPrev}</span>
            <span className="rev-prev__amount">$501,641.73</span>
            <span className="rev-prev__date">{t.prevDateRange}</span>
            <ChevronDown size={11} strokeWidth={2}/>
          </button>
        </div>

        <div className="rev-right">
          <KpiSummary/>
        </div>
      </div>

      <StackedManagerBar/>
    </section>
  )
}
