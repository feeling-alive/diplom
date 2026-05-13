import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'

import { monthlyBarData, users } from '../../data/mock'
import { t } from '../../i18n'
import './MonthlyBarChart.css'

const TABS = [
  { key: 'revenue', label: t.revenue },
  { key: 'leads',   label: t.leadsShort },
  { key: 'winLoss', label: t.winLossShort },
]

const monthUserMap = { 'Сен': 'mikasa', 'Окт': 'armin', 'Ноя': 'eren' }

const stackContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
}

const stackItem = {
  hidden: { scaleY: 0, opacity: 0.7 },
  visible: {
    scaleY: 1,
    opacity: 1,
    transition: { duration: 0.55, ease: [0.34, 1.56, 0.64, 1] },
  },
}

const tipVariant = {
  hidden: { opacity: 0, y: 8 },
  visible: (delay) => ({
    opacity: 1, y: 0,
    transition: { delay, duration: 0.35 },
  }),
}

function UserAvatarMini({ id }) {
  const u = users[id]
  return (
    <span className="mbc-avatar" style={{ background: u.color }}>
      {u.initials}
    </span>
  )
}

export default function MonthlyBarChart() {
  const [tab, setTab] = useState('revenue')
  const data = monthlyBarData[tab]

  const max = useMemo(
    () => Math.max(...data.flatMap(d => [d.a, d.b, d.c, d.d])) * 1.15,
    [data]
  )

  const yTicks = useMemo(() => {
    const top = Math.ceil(max / 1000) * 1000
    return [top * 0.95, top * 0.7, top * 0.45, top * 0.2]
      .map(v => Math.round(v / 100) * 100)
  }, [max])

  return (
    <motion.div
      className="mbc card"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.4 }}
    >
      <div className="mbc-grid">
        <motion.div
          className="mbc-legend"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <div className="mbc-legend__vlabel">{t.averageMonthly}</div>
          <div className="mbc-legend__platform">
            <div className="mbc-legend__platform-name">{t.platformValue}</div>
            <div className="mbc-legend__platform-sub">
              <span className="mbc-legend__bullet"/>
              Dribbble
              <ChevronDown size={9}/>
            </div>
          </div>
          <div className="mbc-legend__stats">
            <div>
              <div className="mbc-legend__lbl">{t.revenue}</div>
              <div className="mbc-legend__val">$18,552</div>
            </div>
            <div>
              <div className="mbc-legend__lbl">{t.leadsShort}</div>
              <div className="mbc-legend__val">373 <span className="mbc-legend__small">97/276</span></div>
            </div>
            <div>
              <div className="mbc-legend__lbl">{t.winLossShort}</div>
              <div className="mbc-legend__val">16% <span className="mbc-legend__small">51/318</span></div>
            </div>
          </div>
        </motion.div>

        <div className="mbc-chart">
          <div className="mbc-chart__head">
            <div className="mbc-tabs">
              {TABS.map(tt => (
                <button
                  key={tt.key}
                  className={`mbc-tab ${tt.key === tab ? 'is-active' : ''}`}
                  onClick={() => setTab(tt.key)}
                >
                  {tt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mbc-plot">
            <AnimatePresence mode="wait">
              <motion.div
                className="mbc-plot-inner"
                key={tab}
                variants={stackContainer}
                initial="hidden"
                animate="visible"
                exit={{ opacity: 0 }}
              >
                <div className="mbc-grid-lines">
                  {yTicks.map((v, i) => (
                    <div className="mbc-grid-line" key={i}>
                      <span className="mbc-grid-tick">${(v/1000).toFixed(0)}k</span>
                    </div>
                  ))}
                </div>

                <div className="mbc-bars">
                  {data.map((g, gi) => (
                    <div className="mbc-group" key={g.month}>
                      <div className="mbc-stack">
                        <motion.div
                          className="mbc-bar mbc-bar--dark"
                          variants={stackItem}
                          style={{ height: `${(g.a / max) * 100}%` }}
                        />
                        <motion.div
                          className="mbc-bar mbc-bar--med"
                          variants={stackItem}
                          style={{ height: `${(g.b / max) * 100}%` }}
                        />
                        <motion.div
                          className="mbc-bar mbc-bar--soft"
                          variants={stackItem}
                          style={{ height: `${(g.c / max) * 100}%` }}
                        />
                        <motion.div
                          className="mbc-bar mbc-bar--light"
                          variants={stackItem}
                          style={{ height: `${(g.d / max) * 100}%` }}
                        />

                        <motion.div
                          className="mbc-tip"
                          variants={tipVariant}
                          custom={0.55 + gi * 0.06}
                          initial="hidden"
                          animate="visible"
                          style={{ bottom: `calc(${(g.a / max) * 100}% + 10px)` }}
                        >
                          {g.label}
                        </motion.div>
                      </div>

                      <div className="mbc-xtick">
                        <UserAvatarMini id={monthUserMap[g.month] || 'mikasa'}/>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
