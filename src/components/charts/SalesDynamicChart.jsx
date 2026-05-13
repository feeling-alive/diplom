import { LineChart, Line, XAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { ArrowUpRight } from 'lucide-react'
import { motion } from 'framer-motion'

import { salesDynamicData, users } from '../../data/mock'
import { t } from '../../i18n'
import './SalesDynamicChart.css'

function AvatarDot({ cx, cy, value, userId }) {
  if (cx == null || cy == null) return null
  const u = users[userId]
  return (
    <g transform={`translate(${cx - 10}, ${cy - 10})`}>
      <circle cx="10" cy="10" r="10" fill="#fff" stroke={u.color} strokeWidth="2"/>
      <text x="10" y="13" textAnchor="middle" fill={u.color} fontSize="8" fontWeight="700"
            fontFamily="Inter">{u.initials}</text>
    </g>
  )
}

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="sdc-tip">
      <div className="sdc-tip__title">{label}</div>
      {payload.map((p, i) => (
        <div className="sdc-tip__row" key={i}>
          <span className="sdc-tip__sw" style={{ background: p.color }}/>
          <span className="sdc-tip__name">{p.dataKey}</span>
          <span className="sdc-tip__val">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function SalesDynamicChart() {
  return (
    <motion.div
      className="sdc"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.85, duration: 0.4 }}
    >
      <div className="sdc-head">
        <span className="sdc-title">{t.salesDynamic}</span>
        <button className="sdc-expand"><ArrowUpRight size={14}/></button>
      </div>

      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={salesDynamicData} margin={{ top: 14, right: 6, left: 6, bottom: 6 }}>
          <XAxis
            dataKey="week"
            axisLine={false}
            tickLine={false}
            interval={1}
            tick={{ fontSize: 9, fill: '#BDBDBD', fontFamily: 'Inter' }}
          />
          <Tooltip content={<ChartTip/>} cursor={{ stroke: '#E0E0E0', strokeDasharray: '3 3' }}/>
          <Line type="monotone" dataKey="armin"
                stroke="rgba(232,40,76,0.35)" strokeWidth={1.5}
                dot={false} activeDot={(p) => <AvatarDot {...p} userId="armin"/>}/>
          <Line type="monotone" dataKey="mikasa"
                stroke="var(--c-accent)" strokeWidth={2}
                dot={false} activeDot={(p) => <AvatarDot {...p} userId="mikasa"/>}/>
          <Line type="monotone" dataKey="base"
                stroke="var(--c-success)" strokeWidth={1.2} dot={false} activeDot={false}/>
        </LineChart>
      </ResponsiveContainer>
    </motion.div>
  )
}
