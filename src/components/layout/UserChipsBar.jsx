import { Plus, RefreshCw, Download, Share2, ChevronDown } from 'lucide-react'
import Avatar from '../../ui/Avatar'
import { t } from '../../i18n'
import './UserChipsBar.css'

export default function UserChipsBar() {
  return (
    <div className="ucb">
      <div className="ucb-left">
        <button className="ucb-add" aria-label="add user">
          <Plus size={12} strokeWidth={2.5}/>
        </button>
        <div className="ucb-chip"><Avatar userId="armin"  size={20}/><span>Армин А.</span></div>
        <div className="ucb-chip"><Avatar userId="eren"   size={20}/><span>Эрен Й.</span></div>
        <div className="ucb-chip"><Avatar userId="mikasa" size={20}/><span>Микаса А.</span></div>
        <div className="ucb-chip ucb-chip--me"><span className="ucb-me">C</span></div>
      </div>

      <div className="ucb-right">
        <button className="ucb-iconbtn"><RefreshCw size={14} strokeWidth={2}/></button>
        <button className="ucb-iconbtn"><Download size={14} strokeWidth={2}/></button>
        <button className="ucb-iconbtn"><Share2 size={14} strokeWidth={2}/></button>
      </div>
    </div>
  )
}

export function PageHeader({ tab, onTabChange }) {
  return (
    <div className="ph">
      <h1 className="ph-title">{t.newReportTitle}</h1>
      <div className="ph-timeframe">
        <span className="ph-tf-text">{t.timeframe}</span>
        <button className={`ph-tf-toggle ${tab ? 'is-on' : ''}`} onClick={() => onTabChange(!tab)}>
          <span className="ph-tf-knob"/>
        </button>
        <button className="ph-tf-date">
          {t.dateRange} <ChevronDown size={12} strokeWidth={2}/>
        </button>
      </div>
    </div>
  )
}
