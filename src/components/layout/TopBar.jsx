import { Search, AlignLeft, Plus } from 'lucide-react'
import { t } from '../../i18n'
import './TopBar.css'

export default function TopBar() {
  return (
    <header className="tb">
      <div className="tb-search">
        <Search size={14} strokeWidth={2} color="#9A9A9A"/>
        <input placeholder={t.searchPlaceholder}/>
      </div>
      <div className="tb-right">
        <button className="tb-iconbtn" aria-label="menu">
          <AlignLeft size={16} strokeWidth={2}/>
        </button>
        <div className="tb-avatar"/>
        <button className="tb-plus" aria-label="add">
          <Plus size={16} strokeWidth={2.5}/>
        </button>
      </div>
    </header>
  )
}
