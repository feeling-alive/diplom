import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Star, BarChart2, PieChart, Newspaper,
  Grid3x3, Bot, Activity, TrendingUp, Gauge,
  Calendar, Briefcase, X, ChevronLeft, ChevronRight,
  LayoutDashboard
} from 'lucide-react'

export type WidgetId =
  | 'watchlist' | 'priceChart' | 'allocation'
  | 'news' | 'heatmap' | 'aiChat' | 'ticker'
  | 'topMovers' | 'fearGreed' | 'calendar' | 'portfolio'

export type WidgetSize = 'S' | 'M' | 'L' | 'XL'

const WIDGETS = [
  { id: 'watchlist' as WidgetId, label: 'Вотч-лист', icon: Star, description: 'Отслеживаемые активы', sizes: ['S', 'M', 'L'] as WidgetSize[] },
  { id: 'priceChart' as WidgetId, label: 'График цены', icon: BarChart2, description: 'Динамика с таймфреймами', sizes: ['M', 'L', 'XL'] as WidgetSize[] },
  { id: 'allocation' as WidgetId, label: 'Распределение', icon: PieChart, description: 'Доли портфеля по активам', sizes: ['S', 'M'] as WidgetSize[] },
  { id: 'news' as WidgetId, label: 'Новости рынка', icon: Newspaper, description: 'Лента новостей', sizes: ['M', 'L'] as WidgetSize[] },
  { id: 'heatmap' as WidgetId, label: 'Тепловая карта', icon: Grid3x3, description: 'Изменения по секторам', sizes: ['M', 'L'] as WidgetSize[] },
  { id: 'aiChat' as WidgetId, label: 'ИИ-ассистент', icon: Bot, description: 'Чат с ИИ-аналитиком', sizes: ['M', 'L'] as WidgetSize[] },
  { id: 'ticker' as WidgetId, label: 'Тикер цен', icon: Activity, description: 'Бегущая строка цен', sizes: ['S'] as WidgetSize[] },
  { id: 'topMovers' as WidgetId, label: 'Топ движений', icon: TrendingUp, description: 'Лучшие и худшие за день', sizes: ['S', 'M'] as WidgetSize[] },
  { id: 'fearGreed' as WidgetId, label: 'Индекс страха', icon: Gauge, description: 'Fear & Greed index', sizes: ['S'] as WidgetSize[] },
  { id: 'calendar' as WidgetId, label: 'Календарь', icon: Calendar, description: 'Экономические события', sizes: ['M', 'L'] as WidgetSize[] },
  { id: 'portfolio' as WidgetId, label: 'Мой портфель', icon: Briefcase, description: 'Ручной ввод позиций', sizes: ['M', 'L'] as WidgetSize[] },
]

interface WidgetCardProps {
  widget: typeof WIDGETS[0]
  isAdded: boolean
  selectedSize: WidgetSize
  onSelectSize: (size: WidgetSize) => void
  onToggle: () => void
}

function WidgetCard({ widget, isAdded, selectedSize, onSelectSize, onToggle }: WidgetCardProps) {
  const Icon = widget.icon

  return (
    <motion.div
      whileHover={{ scale: 1.03, y: -2 }}
      whileTap={{ scale: 0.97 }}
      style={{
        width: 160,
        minHeight: 140,
        borderRadius: 12,
        border: isAdded ? '1.5px solid var(--accent)' : '1px solid var(--border)',
        background: isAdded ? 'var(--accent-bg)' : 'var(--white)',
        padding: '12px 12px 10px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        position: 'relative',
        flexShrink: 0,
        transition: 'all 0.2s',
      }}
      onClick={onToggle}
    >
      {/* Checkmark badge */}
      {isAdded && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: 'var(--accent)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            fontWeight: 700,
            boxShadow: '0 1px 4px rgba(225,29,72,0.3)',
          }}
        >
          ✓
        </motion.div>
      )}

      {/* Icon */}
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: isAdded ? 'var(--accent)' : 'var(--bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={20} strokeWidth={2} color={isAdded ? '#fff' : 'var(--accent)'} />
      </div>

      {/* Label */}
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', textAlign: 'center' }}>
        {widget.label}
      </span>

      {/* Description */}
      <span style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'center', lineHeight: 1.3 }}>
        {widget.description}
      </span>

      {/* Size selector */}
      <div style={{ display: 'flex', gap: 3, marginTop: 'auto' }}>
        {widget.sizes.map((size) => (
          <button
            key={size}
            onClick={(e) => {
              e.stopPropagation()
              onSelectSize(size)
            }}
            style={{
              width: 22,
              height: 22,
              borderRadius: 4,
              border: selectedSize === size ? '1px solid var(--accent)' : '1px solid var(--border)',
              background: selectedSize === size ? 'var(--accent)' : 'transparent',
              color: selectedSize === size ? '#fff' : 'var(--muted)',
              fontSize: 10,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'var(--font)',
              transition: 'all 0.15s',
            }}
          >
            {size}
          </button>
        ))}
      </div>
    </motion.div>
  )
}

interface Props {
  open: boolean
  onClose: () => void
  triggerRef: React.RefObject<HTMLButtonElement>
  enabledWidgets: WidgetId[]
  widgetSizes: Record<WidgetId, WidgetSize>
  onToggleWidget: (id: WidgetId) => void
  onSelectSize: (id: WidgetId, size: WidgetSize) => void
  isAdded: (id: WidgetId) => boolean
}

export default function WidgetMenu({
  open,
  onClose,
  triggerRef,
  enabledWidgets,
  widgetSizes,
  onToggleWidget,
  onSelectSize,
  isAdded,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Calculate position relative to trigger button
  const getPosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      return {
        x: rect.left,
        y: rect.bottom + 8,
      }
    }
    return { x: window.innerWidth - 200, y: 100 }
  }

  const pos = getPosition()

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.3)',
              zIndex: 999,
            }}
          />
        )}
      </AnimatePresence>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            ref={containerRef}
            initial={{
              opacity: 0,
              scale: 0.85,
              y: -10,
            }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
            }}
            exit={{
              opacity: 0,
              scale: 0.85,
              y: -10,
            }}
            transition={{
              type: 'spring',
              damping: 25,
              stiffness: 300,
              duration: 0.3,
            }}
            style={{
              position: 'fixed',
              top: pos.y,
              right: Math.max(pos.x - 580, 16),
              zIndex: 1000,
              background: 'var(--white)',
              borderRadius: 16,
              boxShadow: '0 20px 60px rgba(0,0,0,0.15), 0 0 0 1px var(--border)',
              padding: '20px 24px',
              width: 580,
              maxWidth: 'calc(100vw - 32px)',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 12,
              }}
            >
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>
                Виджеты
              </span>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--bg)',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--muted)',
                }}
              >
                <X size={14} strokeWidth={2} />
              </motion.button>
            </div>

            {/* Horizontal scroll */}
            <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
              {WIDGETS.map((widget) => (
                <WidgetCard
                  key={widget.id}
                  widget={widget}
                  isAdded={isAdded(widget.id)}
                  selectedSize={widgetSizes[widget.id] || 'M'}
                  onSelectSize={(size) => onSelectSize(widget.id, size)}
                  onToggle={() => onToggleWidget(widget.id)}
                />
              ))}
            </div>

            {/* Footer */}
            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                {enabledWidgets.length} из {WIDGETS.length} активно
              </span>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onClose}
                style={{
                  padding: '8px 20px',
                  borderRadius: 'var(--r-pill)',
                  background: 'var(--accent)',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: 'var(--font)',
                }}
              >
                Применить
              </motion.button>
            </div>

            {/* Tether line from button to panel (decorative SVG) */}
            <svg
              width="0"
              height="0"
              style={{ position: 'absolute', overflow: 'visible', pointerEvents: 'none' }}
            >
              <defs>
                <linearGradient id="tetherGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}