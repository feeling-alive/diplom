import { useState } from 'react'
import { ChevronDown, ChevronRight, Star, Clock, Plus, Folder } from 'lucide-react'
import { sidebarFolders } from '../../data/mock'
import { t } from '../../i18n'
import './Sidebar.css'

export default function Sidebar() {
  const [openDashboard, setOpenDashboard] = useState(true)
  const [openShared, setOpenShared] = useState(true)
  const [openReportsShared, setOpenReportsShared] = useState(true)
  const [openMyReports, setOpenMyReports] = useState(true)

  return (
    <aside className="sb sidebar-scroll">
      <div className="sb-header">
        <div className="sb-logo">C</div>
        <div className="sb-brand">
          <span className="sb-brand__name">Codename.com</span>
          <ChevronDown size={12} strokeWidth={2}/>
        </div>
      </div>

      <ul className="sb-section">
        <li className="sb-mini">
          <Star size={11} strokeWidth={2}/>
          <span>{t.starred}</span>
        </li>
        <li className="sb-mini">
          <Clock size={11} strokeWidth={2}/>
          <span>{t.recent}</span>
        </li>
      </ul>

      <ul className="sb-section">
        <li className="sb-item">{t.salesList}</li>
        <li className="sb-item">{t.goals}</li>
        <li className="sb-item">
          <button className="sb-row" onClick={() => setOpenDashboard(v => !v)}>
            <span>{t.dashboard}</span>
            <Plus size={12} strokeWidth={2}/>
          </button>
        </li>

        {openDashboard && (
          <ul className="sb-sub">
            <li className="sb-item sb-item--soft">Codename</li>
            <li>
              <button className="sb-row sb-row--soft" onClick={() => setOpenShared(v => !v)}>
                <span>{t.sharedWithMe}</span>
                {openShared ? <ChevronDown size={11}/> : <ChevronRight size={11}/>}
              </button>
              {openShared && (
                <ul className="sb-sub2">
                  {sidebarFolders.map(f => (
                    <li className="sb-folder" key={f.name}>
                      <span>{f.name}</span>
                      {f.badge != null && <span className="sb-badge">{f.badge}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          </ul>
        )}
      </ul>

      <ul className="sb-section">
        <li className="sb-row sb-row--head">
          <span>{t.reports}</span>
          <Plus size={12} strokeWidth={2}/>
        </li>

        <li>
          <button className="sb-row sb-row--soft" onClick={() => setOpenReportsShared(v => !v)}>
            <span>{t.shareWithMe}</span>
            {openReportsShared ? <ChevronDown size={11}/> : <ChevronRight size={11}/>}
          </button>
          {openReportsShared && (
            <ul className="sb-sub2">
              <li className="sb-folder">{t.dealsByUser}</li>
              <li className="sb-folder">{t.dealDuration}</li>
            </ul>
          )}
        </li>

        <li>
          <button className="sb-row sb-row--soft" onClick={() => setOpenMyReports(v => !v)}>
            <span>{t.myReports}</span>
            {openMyReports ? <ChevronDown size={11}/> : <ChevronRight size={11}/>}
          </button>
          {openMyReports && (
            <ul className="sb-sub2">
              <li className="sb-folder">{t.emailsReceived}</li>
              <li className="sb-folder">{t.dealDuration}</li>
              <li className="sb-folder sb-folder--active">{t.newReport}</li>
              <li className="sb-folder">
                <span>{t.analytics}</span>
                <span className="sb-badge">7</span>
              </li>
            </ul>
          )}
        </li>
      </ul>

      <button className="sb-manage">
        <Folder size={11} strokeWidth={2}/>
        <span>{t.manageFolders}</span>
      </button>
    </aside>
  )
}
