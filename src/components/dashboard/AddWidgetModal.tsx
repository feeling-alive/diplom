import { useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, X, Search } from 'lucide-react'
import type { WidgetType, WidgetSize } from '../../types/widgets.types'
import { WIDGET_REGISTRY } from '../../constants/widgets.registry'

interface Props {
  open: boolean
  onClose: () => void
  onAdd: (type: WidgetType, size: WidgetSize) => void
  onDragStart?: (type: WidgetType, size: WidgetSize) => void
}

const PREVIEW_BASE = {
  borderRadius: 10,
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  gap: 6,
  overflow: 'hidden',
  transition: 'width 0.3s, height 0.3s',
}

export default function AddWidgetModal({ open, onClose, onAdd, onDragStart }: Props) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSizes, setSelectedSizes] = useState<Record<WidgetType, WidgetSize>>(
    Object.fromEntries(
      WIDGET_REGISTRY.map((w) => [w.type, w.defaultSize])
    ) as Record<WidgetType, WidgetSize>
  )

  const filteredWidgets = useMemo(
    () => WIDGET_REGISTRY.filter((w) =>
      w.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.description.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    [searchQuery]
  )

  const [isDragging, setIsDragging] = useState(false)

  const handleAdd = useCallback((type: WidgetType, size: WidgetSize) => {
    onAdd(type, size)
    onClose()
  }, [onAdd, onClose])

  const handleDragStart = useCallback((e: React.DragEvent, type: WidgetType) => {
    const size = selectedSizes[type]
    e.dataTransfer.setData('text/plain', JSON.stringify({ type, w: size.w, h: size.h }))
    e.dataTransfer.effectAllowed = 'copy'
    setIsDragging(true)
    onDragStart?.(type, size)
  }, [selectedSizes, onDragStart])

  const handleDragEnd = useCallback(() => {
    setIsDragging(false)
  }, [])

  console.debug('[AddWidgetModal] open=%s search="%s" filtered=%d drag=%s', open, searchQuery, filteredWidgets.length, isDragging)

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={isDragging ? undefined : onClose}
            style={{
              position: 'fixed', inset: 0,
              background: isDragging ? 'transparent' : 'rgba(0,0,0,0.4)',
              zIndex: 1000,
              pointerEvents: isDragging ? 'none' : 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', stiffness: 350, damping: 26, mass: 0.8 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'var(--white)',
                borderRadius: 20,
                boxShadow: '0 25px 80px rgba(0,0,0,0.2), 0 0 0 1px var(--border)',
                width: 680,
                maxWidth: 'calc(100vw - 32px)',
                maxHeight: 'calc(100vh - 60px)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              {/* Header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '20px 24px 0',
              }}>
                <div>
                  <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)' }}>
                    Добавить виджет
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 10 }}>
                    перетащите в сетку или нажмите «Добавить»
                  </span>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onClose}
                  style={{
                    width: 28, height: 28,
                    borderRadius: '50%',
                    background: 'var(--bg)',
                    border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--muted)',
                  }}
                >
                  <X size={14} strokeWidth={2} />
                </motion.button>
              </div>

              {/* Search */}
              <div style={{ padding: '14px 24px 0' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'var(--bg)', borderRadius: 10,
                  padding: '8px 14px',
                  border: '1px solid var(--border)',
                }}>
                  <Search size={14} strokeWidth={2} color="var(--muted)" />
                  <input
                    placeholder="Поиск виджетов..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      flex: 1, background: 'none', border: 'none',
                      outline: 'none', fontSize: 13, color: 'var(--text)',
                      fontFamily: 'var(--font)',
                    }}
                  />
                </div>
              </div>

              {/* Scrollable cards */}
              <div style={{
                display: 'flex', gap: 16, padding: '16px 24px 24px',
                overflowX: 'auto', overflowY: 'hidden',
                scrollbarWidth: 'thin',
                minHeight: 240,
              }}>
                {filteredWidgets.length === 0 ? (
                  <div style={{
                    flex: 1, textAlign: 'center', padding: '60px 0',
                    color: 'var(--muted)', fontSize: 13,
                  }}>
                    Ничего не найдено
                  </div>
                ) : filteredWidgets.map((def) => {
                  const Icon = def.icon
                  const selected = selectedSizes[def.type]
                  // Preview dimensions scale with grid units
                  const previewW = selected.w * 48
                  const previewH = selected.h * 40

                  return (
                    <div
                      key={def.type}
                      draggable
                      onDragStart={(e) => handleDragStart(e, def.type)}
                      onDragEnd={handleDragEnd}
                      style={{
                        flexShrink: 0,
                        width: 200,
                        background: 'var(--white)',
                        border: '1px solid var(--border)',
                        borderRadius: 14,
                        padding: '14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                        boxShadow: 'var(--shadow-sm)',
                        cursor: 'grab',
                        userSelect: 'none',
                      }}
                    >
                      {/* Animated preview */}
                      <motion.div
                        animate={{ width: previewW, height: previewH }}
                        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                        style={{
                          ...PREVIEW_BASE,
                          background: `${def.color}10`,
                          border: `1px solid ${def.color}30`,
                        }}
                      >
                        <Icon size={Math.min(previewW, previewH) * 0.4} strokeWidth={1.5} color={def.color} />
                        <span style={{ fontSize: 9, fontWeight: 600, color: def.color, textAlign: 'center', padding: '0 4px' }}>
                          {def.title}
                        </span>
                      </motion.div>

                      {/* Info */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                          {def.title}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.3 }}>
                          {def.description}
                        </span>
                      </div>

                      {/* Size selector */}
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {def.availableSizes.map((size) => (
                          <button
                            key={size.label}
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedSizes((prev) => ({ ...prev, [def.type]: size }))
                            }}
                            style={{
                              padding: '3px 8px',
                              fontSize: 9,
                              fontWeight: 700,
                              borderRadius: 6,
                              border: selected.label === size.label
                                ? '1px solid var(--accent)'
                                : '1px solid var(--border)',
                              background: selected.label === size.label
                                ? 'var(--accent)'
                                : 'var(--bg)',
                              color: selected.label === size.label ? '#fff' : 'var(--muted)',
                              cursor: 'pointer',
                              fontFamily: 'var(--font)',
                              transition: 'all 0.15s',
                            }}
                          >
                            {size.label}
                          </button>
                        ))}
                      </div>

                      {/* Add button */}
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => handleAdd(def.type, selected)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          gap: 4, marginTop: 'auto',
                          padding: '7px 12px',
                          background: 'var(--ink)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 8,
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer',
                          fontFamily: 'var(--font)',
                        }}
                      >
                        <Plus size={12} strokeWidth={2.5} /> Добавить
                      </motion.button>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
