import { useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import WidgetPreview from './WidgetPreview'
import type { WidgetType, WidgetSize } from '../../types/widgets.types'
import { WIDGET_REGISTRY } from '../../constants/widgets.registry'

const PER_PAGE = 4

interface Props {
  open: boolean
  onClose: () => void
  onAdd: (type: WidgetType, size: WidgetSize) => void
  onDragStart?: (type: WidgetType, size: WidgetSize) => void
}

export default function AddWidgetModal({ open, onClose, onAdd, onDragStart }: Props) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSizes, setSelectedSizes] = useState<Record<WidgetType, WidgetSize>>(
    Object.fromEntries(
      WIDGET_REGISTRY.map((w) => [w.type, w.defaultSize])
    ) as Record<WidgetType, WidgetSize>
  )
  const [page, setPage] = useState(0)

  const filtered = useMemo(
    () => WIDGET_REGISTRY.filter((w) =>
      w.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.description.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    [searchQuery]
  )

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const safePage = Math.min(page, totalPages - 1)
  const pageWidgets = filtered.slice(safePage * PER_PAGE, (safePage + 1) * PER_PAGE)

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
                width: 600,
                maxWidth: 'calc(100vw - 32px)',
                height: 'min(85vh, 760px)',
                maxHeight: 'calc(100vh - 40px)',
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
                <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)' }}>
                  Добавить виджет
                </span>
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
                  background: 'var(--bg)', borderRadius: 999,
                  padding: '8px 14px',
                  border: '1px solid var(--border)',
                }}>
                  <Search size={14} strokeWidth={2} color="var(--muted)" />
                  <input
                    placeholder="Поиск виджетов..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      setPage(0)
                    }}
                    style={{
                      flex: 1, background: 'none', border: 'none',
                      outline: 'none', fontSize: 13, color: 'var(--text)',
                      fontFamily: 'var(--font)',
                    }}
                  />
                </div>
              </div>

              {/* Widget grid */}
              <div style={{
                flex: 1, overflowY: 'auto', overflowX: 'hidden',
                padding: '20px 24px 12px',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 16,
                alignContent: 'start',
              }}>
                {filtered.length === 0 ? (
                  <div style={{
                    gridColumn: '1 / -1',
                    textAlign: 'center', padding: '60px 0',
                    color: 'var(--muted)', fontSize: 13,
                  }}>
                    Ничего не найдено
                  </div>
                ) : (
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={safePage}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                      style={{
                        gridColumn: '1 / -1',
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 16,
                      }}
                    >
                      {pageWidgets.map((def) => {
                        const selected = selectedSizes[def.type]

                        return (
                          <div
                            key={def.type}
                            draggable
                            onDragStart={(e) => handleDragStart(e, def.type)}
                            onDragEnd={handleDragEnd}
                            onClick={() => handleAdd(def.type, selected)}
                            style={{
                              background: 'var(--white)',
                              border: '1px solid var(--border)',
                              borderRadius: 14,
                              overflow: 'hidden',
                              cursor: 'pointer',
                              userSelect: 'none',
                              transition: 'border-color 0.2s',
                            }}
                          >
                            {/* Preview — widget в натуральную величину */}
                            <motion.div
                              key={selected.label}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ duration: 0.2 }}
                            >
                              <WidgetPreview type={def.type} />
                            </motion.div>

                            {/* Bottom bar: название + размеры */}
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '10px 14px',
                              gap: 8,
                            }}>
                              <span style={{
                                fontSize: 12, fontWeight: 600, color: 'var(--ink)',
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                              }}>
                                {def.title}
                              </span>
                              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                                {def.availableSizes.map((size) => (
                                  <button
                                    key={size.label}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setSelectedSizes((prev) => ({ ...prev, [def.type]: size }))
                                    }}
                                    style={{
                                      padding: '2px 7px',
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
                                    }}
                                  >
                                    {size.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </motion.div>
                  </AnimatePresence>
                )}
              </div>

              {/* Page navigation */}
              {totalPages > 0 && filtered.length > 0 && (
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 12,
                  padding: '0 24px 16px',
                }}>
                  {totalPages > 1 && (
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={safePage === 0}
                      style={{
                        opacity: safePage > 0 ? 1 : 0.3,
                        cursor: safePage > 0 ? 'pointer' : 'default',
                        border: '1px solid var(--border)',
                        borderRadius: '50%',
                        width: 26, height: 26,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'var(--white)',
                        color: 'var(--muted)',
                      }}
                    >
                      <ChevronLeft size={13} />
                    </motion.button>
                  )}

                  {Array.from({ length: totalPages }).map((_, i) => (
                    <motion.div
                      key={i}
                      animate={{
                        scale: i === safePage ? 1.3 : 1,
                        background: i === safePage ? 'var(--accent)' : 'var(--border)',
                      }}
                      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                      style={{
                        width: 6, height: 6,
                        borderRadius: '50%',
                        cursor: 'pointer',
                      }}
                      onClick={() => setPage(i)}
                    />
                  ))}

                  {totalPages > 1 && (
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={safePage >= totalPages - 1}
                      style={{
                        opacity: safePage < totalPages - 1 ? 1 : 0.3,
                        cursor: safePage < totalPages - 1 ? 'pointer' : 'default',
                        border: '1px solid var(--border)',
                        borderRadius: '50%',
                        width: 26, height: 26,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'var(--white)',
                        color: 'var(--muted)',
                      }}
                    >
                      <ChevronRight size={13} />
                    </motion.button>
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
