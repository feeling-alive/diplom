import { useState } from 'react'
import './App.css'

import IconRail from './components/layout/IconRail'
import Sidebar from './components/layout/Sidebar'
import TopBar from './components/layout/TopBar'
import UserChipsBar, { PageHeader } from './components/layout/UserChipsBar'

import RevenueSection from './components/revenue/RevenueSection'

import PlatformList from './components/charts/PlatformList'
import BubbleChart from './components/charts/BubbleChart'
import MonthlyBarChart from './components/charts/MonthlyBarChart'
import SalesDynamicChart from './components/charts/SalesDynamicChart'
import WorkWithPlatforms from './components/charts/WorkWithPlatforms'

import SalesTable from './components/analytics/SalesTable'
import { managers } from './data/mock'

export default function App() {
  const [timeframeOn, setTimeframeOn] = useState(true)

  const topTwo = managers.filter(m => m.userId === 'armin' || m.userId === 'mikasa')
  const eren = managers.filter(m => m.userId === 'eren')

  return (
    <div className="app-page">
      <div className="app-shell">
        <IconRail/>
        <Sidebar/>

        <main className="main-content">
          <TopBar/>

          <div className="main-scroll">
            <UserChipsBar/>
            <PageHeader tab={timeframeOn} onTabChange={setTimeframeOn}/>

            <div className="layout-grid">
              <div className="layout-left">
                <RevenueSection/>

                <div className="layout-cards2">
                  <PlatformList/>
                  <BubbleChart/>
                </div>

                <MonthlyBarChart/>
              </div>

              <aside className="layout-right card">
                <SalesTable rows={topTwo} showHeaders showTags/>
                <div className="layout-divider"/>
                <WorkWithPlatforms/>
                <div className="layout-divider"/>
                <SalesDynamicChart/>
                <div className="layout-divider"/>
                <SalesTable rows={eren}/>
              </aside>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
