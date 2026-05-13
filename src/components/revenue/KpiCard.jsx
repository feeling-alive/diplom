import { Star, ChevronRight } from 'lucide-react'
import { motion } from 'framer-motion'
import Avatar from '../../ui/Avatar'
import CountUp from '../../ui/CountUp'
import './KpiCard.css'

export default function KpiCard({ data, index = 0, dragHandle, isDragging }) {
  const { kind, label, value, subtitle, trend, userId } = data

  const variant =
    kind === 'bestDeal'  ? 'kpi--dark' :
    kind === 'highlight' ? 'kpi--highlight' :
    kind === 'topSales'  ? 'kpi--withuser' : 'kpi--default'

  return (
    <motion.div
      layout
      className={`kpi ${variant} ${isDragging ? 'kpi--dragging' : ''}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 + index * 0.06, duration: 0.4 }}
      {...(dragHandle || {})}
    >
      <div className="kpi-head">
        <span className="kpi-label">{label}</span>
        {kind === 'bestDeal' && <Star size={11} fill="#fff" color="#fff" strokeWidth={0}/>}
      </div>

      <div className="kpi-value">
        {kind === 'bestDeal' ? (
          <CountUp to={42300} prefix="$" duration={1.6}/>
        ) : kind === 'highlight' ? (
          value
        ) : kind === 'topSales' ? (
          <CountUp to={72} duration={1.2}/>
        ) : kind === 'metric' && /^\d+/.test(value) ? (
          <CountUp to={parseInt(value)} suffix={value.replace(/^\d+/, '')} duration={1.4}/>
        ) : value}
      </div>

      {subtitle && (
        <div className="kpi-sub">
          <span className="kpi-sub__dot"/>
          <span>{subtitle}</span>
          <button className="kpi-sub__btn"><ChevronRight size={11}/></button>
        </div>
      )}

      {userId && (
        <div className="kpi-user">
          <Avatar userId={userId} size={18}/>
          <span>{userId === 'mikasa' ? 'Микаса' : ''}</span>
          <button className="kpi-arrow"><ChevronRight size={11}/></button>
        </div>
      )}

      {trend && (
        <div className={`kpi-trend ${trend.positive ? 'pos' : 'neg'}`}>
          {trend.v}
        </div>
      )}
    </motion.div>
  )
}
