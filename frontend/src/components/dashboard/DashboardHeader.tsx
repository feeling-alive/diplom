import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, BellOff, Plus, Trash2, TrendingUp, Newspaper } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import DashboardTabs from './DashboardTabs'
import { SearchInput } from '../ui/SearchInput'
import { EmptySearchState } from '../ui/EmptySearchState'
import { useGlobalSearch } from '../../hooks/useGlobalSearch'
import { useNotifications } from '../../hooks/useNotifications'
import type { AppNotification } from '../../hooks/useNotifications'

interface Props {
  onOpenWidgetMenu?: () => void
  onOpenPicker?: () => void
  onResetLayout?: () => void
  addButtonRef?: React.RefObject<HTMLButtonElement>
  dashboards?: { id: string; name: string }[]
  activeId?: string
  canAddDashboard?: boolean
  onSwitchDashboard?: (id: string) => void
  onAddDashboard?: (name: string) => void
  onRemoveDashboard?: (id: string) => void
}

function formatRelativeTime(isoString: string): string {
  const diff = (new Date(isoString).getTime() - Date.now()) / 1000
  const rtf = new Intl.RelativeTimeFormat('ru', { numeric: 'auto' })
  const abs = Math.abs(diff)
  if (abs < 60)   return rtf.format(Math.round(diff), 'second')
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour')
  return rtf.format(Math.round(diff / 86400), 'day')
}

export default function DashboardHeader({
  onOpenWidgetMenu, onOpenPicker, onResetLayout, addButtonRef,
  dashboards, activeId, canAddDashboard, onSwitchDashboard, onAddDashboard, onRemoveDashboard,
}: Props) {
  const [searchQuery, setSearchQuery] = useState('')
  const [notifOpen, setNotifOpen] = useState(false)
  const searchContainerRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { data, isLoading } = useGlobalSearch(searchQuery)
  const { data: notifications = [], unreadCount, markAllRead, markRead } = useNotifications()

  const showDropdown = searchQuery.trim().length >= 2
  const isEmpty = showDropdown && !isLoading && data !== null && data.assets.length === 0 && data.news.length === 0

  console.debug('[DashboardHeader] render searchQuery=%s notifOpen=%s unread=%d', searchQuery, notifOpen, unreadCount)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchQuery('')
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false)
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setSearchQuery('')
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  const handleAddWidget = onOpenWidgetMenu || onOpenPicker || (() => {})

  return (
    <header
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 52,
        padding: '0 4px',
        gap: 12,
        flexShrink: 0,
        borderBottom: '1px solid var(--border)',
      }}
    >
      {/* Left — search with dropdown */}
      <div
        ref={searchContainerRef}
        style={{ position: 'relative', flex: 1, maxWidth: 320 }}
      >
        <SearchInput
          value={searchQuery}
          onChange={(v) => {
            console.debug('[DashboardHeader] search query=%s', v)
            setSearchQuery(v)
          }}
          placeholder="Поиск активов и новостей..."
          fullWidth
        />

        <AnimatePresence>
          {showDropdown && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                right: 0,
                background: 'var(--white)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                boxShadow: '0 6px 18px rgba(0,0,0,0.08), 0 2px 6px -2px rgba(0,0,0,0.05)',
                zIndex: 1000,
                overflow: 'hidden',
                minWidth: 280,
              }}
            >
              {isLoading && (
                <div style={{ padding: '12px 16px', color: 'var(--muted)', fontSize: 12 }}>
                  Поиск...
                </div>
              )}

              {isEmpty && <EmptySearchState />}

              {data && data.assets.length > 0 && (
                <div>
                  <div style={{
                    padding: '8px 16px 4px',
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'var(--muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}>
                    Активы
                  </div>
                  {data.assets.map((asset, i) => (
                    <motion.button
                      key={asset.symbol}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      onClick={() => {
                        console.debug('[DashboardHeader] navigate to asset %s', asset.symbol)
                        navigate(`/asset/${asset.symbol}`)
                        setSearchQuery('')
                      }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 16px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--bg)' }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent' }}
                    >
                      <TrendingUp size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{asset.symbol}</span>
                      <span style={{ fontSize: 12, color: 'var(--muted)', flex: 1 }}>{asset.name}</span>
                      {asset.price != null && (
                        <span style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 500 }}>
                          ${asset.price.toLocaleString()}
                        </span>
                      )}
                    </motion.button>
                  ))}
                </div>
              )}

              {data && data.news.length > 0 && (
                <div>
                  <div style={{
                    padding: '8px 16px 4px',
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'var(--muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    borderTop: data?.assets.length ? '1px solid var(--border)' : 'none',
                  }}>
                    Новости
                  </div>
                  {data.news.map((item, i) => (
                    <motion.button
                      key={item.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      onClick={() => {
                        // Deep-link к конкретной статье (а не общий /news): открывает
                        // NewsArticlePage по :id. Тот же приём, что и в уведомлениях.
                        console.debug('[DashboardHeader] navigate to article id=%s', item.id)
                        navigate(`/news/${item.id}`)
                        setSearchQuery('')
                      }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                        padding: '8px 16px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--bg)' }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent' }}
                    >
                      <Newspaper size={14} style={{ color: 'var(--muted)', flexShrink: 0, marginTop: 2 }} />
                      <span style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.4 }}>
                        {item.titleRu ?? item.title}
                      </span>
                    </motion.button>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Center — dashboard carousel (absolute so it doesn't push left/right groups) */}
      {dashboards && activeId !== undefined && (
        <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
          <DashboardTabs
            dashboards={dashboards}
            activeId={activeId}
            canAdd={canAddDashboard ?? false}
            onSwitch={onSwitchDashboard ?? (() => {})}
            onAdd={onAddDashboard ?? (() => {})}
            onRemove={onRemoveDashboard ?? (() => {})}
          />
        </div>
      )}

      {/* Right — actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {onResetLayout && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              if (window.confirm('Очистить все виджеты? Дашборд станет пустым.')) {
                onResetLayout()
              }
            }}
            style={{
              width: 32, height: 32, borderRadius: '50%',
              border: '1px solid var(--border)', background: 'var(--white)',
              color: 'var(--muted)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
            }}
            aria-label="Очистить все виджеты"
          >
            <Trash2 size={14} strokeWidth={2} />
          </motion.button>
        )}

        <div ref={notifRef} style={{ position: 'relative' }}>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              console.debug('[DashboardHeader] notifOpen toggle to %s', !notifOpen)
              setNotifOpen(o => !o)
            }}
            style={{
              width: 32, height: 32, borderRadius: '50%',
              border: '1px solid var(--border)', background: 'var(--white)',
              color: unreadCount > 0 ? 'var(--accent)' : 'var(--muted)',
              display: 'flex', alignItems: 'center',
              justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
              position: 'relative',
            }}
            aria-label="Уведомления"
          >
            <Bell size={14} strokeWidth={2} />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute', top: -4, right: -4,
                background: 'var(--accent)', color: '#fff',
                borderRadius: 999, minWidth: 16, height: 16,
                fontSize: 9, fontWeight: 700, lineHeight: '16px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 3px', boxSizing: 'border-box',
              }}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </motion.button>

          <AnimatePresence>
            {notifOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                style={{
                  position: 'absolute',
                  top: 40, right: 0,
                  width: 320,
                  background: 'var(--white)',
                  border: '1px solid var(--border)',
                  borderRadius: 16,
                  boxShadow: '0 6px 18px rgba(0,0,0,0.08), 0 2px 6px -2px rgba(0,0,0,0.05)',
                  zIndex: 1001,
                  overflow: 'hidden',
                }}
              >
                {/* Header */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 14px 10px',
                  borderBottom: '1px solid var(--border)',
                }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>
                    Уведомления
                  </span>
                  {notifications.length > 0 && (
                    <button
                      onClick={() => markAllRead()}
                      style={{
                        fontSize: 11, color: 'var(--accent)', background: 'none',
                        border: 'none', cursor: 'pointer', fontFamily: 'var(--font)',
                        fontWeight: 600,
                      }}
                    >
                      Отметить все прочитанными
                    </button>
                  )}
                </div>

                {/* List */}
                <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                  {notifications.length === 0 ? (
                    <div style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      justifyContent: 'center', padding: '28px 16px', gap: 8,
                    }}>
                      <BellOff size={32} style={{ color: 'var(--soft)' }} />
                      <span style={{ fontSize: 13, color: 'var(--muted)' }}>Уведомлений нет</span>
                    </div>
                  ) : (
                    notifications.map((n: AppNotification, i) => (
                      <motion.div
                        key={n.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        onClick={() => {
                          markRead(n.id)
                          navigate(n.link)
                          setNotifOpen(false)
                        }}
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: 10,
                          padding: '10px 14px',
                          background: n.is_read ? 'var(--white)' : 'var(--bg)',
                          cursor: 'pointer',
                          borderBottom: '1px solid var(--border)',
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'var(--bg)' }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = n.is_read ? 'var(--white)' : 'var(--bg)' }}
                      >
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%',
                          background: 'var(--accent)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0,
                        }}>
                          {n.sender_username?.charAt(0).toUpperCase() ?? '?'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{
                            margin: 0, fontSize: 12,
                            fontWeight: n.is_read ? 400 : 600,
                            color: 'var(--ink)', lineHeight: 1.4,
                          }}>
                            {n.message}
                          </p>
                          <span style={{ fontSize: 10, color: 'var(--muted)' }}>
                            {formatRelativeTime(n.created_at)}
                          </span>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <motion.button
          ref={addButtonRef}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleAddWidget}
          style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'var(--accent)', color: '#fff', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0, transition: 'background 0.15s',
          }}
          aria-label="Добавить виджет"
        >
          <Plus size={14} strokeWidth={2.5} />
        </motion.button>
      </div>
    </header>
  )
}
