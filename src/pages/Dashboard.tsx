import React, { useState, useCallback, useRef, useMemo } from 'react'
import GridLayout from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import DashboardHeader from '../components/dashboard/DashboardHeader'
import WidgetCard from '../components/dashboard/WidgetCard'
import EmptyDashboard from '../components/dashboard/EmptyDashboard'
import AddWidgetModal from '../components/dashboard/AddWidgetModal'
import SizeIndicator from '../components/dashboard/SizeIndicator'

import { WIDGET_REGISTRY } from '../constants/widgets.registry'
import type { DashboardWidget, WidgetType, WidgetSize } from '../types/widgets.types'

const COLS = 4
const ROW_HEIGHT = 160
const GRID_MARGIN = 16

const STORAGE_KEY = 'fintrack_widgets'

interface GridItem {
  i: string; x: number; y: number; w: number; h: number
}

function generateId(): string {
  return 'w_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

function buildGridLayout(widgets: DashboardWidget[]): GridItem[] {
  return widgets.map((w) => ({
    i: w.id, x: w.x, y: w.y, w: w.w, h: w.h,
  }))
}

function loadWidgets(): DashboardWidget[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed)) return parsed
    }
  } catch { /* ignore */ }
  return []
}

function saveWidgets(widgets: DashboardWidget[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets))
}

function findEmptySlot(
  existing: DashboardWidget[], cols: number, w: number, h: number,
): { x: number; y: number } {
  if (existing.length === 0) return { x: 0, y: 0 }

  const occupied = new Set<string>()
  for (const ew of existing) {
    for (let cy = ew.y; cy < ew.y + ew.h; cy++) {
      for (let cx = ew.x; cx < ew.x + ew.w; cx++) {
        occupied.add(`${cx},${cy}`)
      }
    }
  }

  const maxY = existing.reduce((m, ew) => Math.max(m, ew.y + ew.h), 0) + h
  for (let row = 0; row <= maxY; row++) {
    for (let col = 0; col <= cols - w; col++) {
      let free = true
      for (let dy = 0; dy < h && free; dy++) {
        for (let dx = 0; dx < w && free; dx++) {
          if (occupied.has(`${col + dx},${row + dy}`)) free = false
        }
      }
      if (free) return { x: col, y: row }
    }
  }

  return { x: 0, y: maxY }
}

function createDefaultWidgets(): DashboardWidget[] {
  const defaults: { type: WidgetType; size: WidgetSize }[] = [
    { type: 'kpi_portfolio', size: { w: 4, h: 1, label: '4×1' } },
    { type: 'watchlist', size: { w: 2, h: 2, label: '2×2' } },
    { type: 'allocation', size: { w: 1, h: 2, label: '1×2' } },
    { type: 'price_chart', size: { w: 2, h: 2, label: '2×2' } },
  ]
  const result: DashboardWidget[] = []
  for (const d of defaults) {
    const pos = findEmptySlot(result, COLS, d.size.w, d.size.h)
    result.push({
      id: generateId(),
      type: d.type,
      size: d.size,
      x: pos.x, y: pos.y,
      w: d.size.w, h: d.size.h,
    })
  }
  return result
}

export default function Dashboard() {
  const [isEditMode, setIsEditMode] = useState(false)
  const [widgets, setWidgets] = useState<DashboardWidget[]>(() => {
    const saved = loadWidgets()
    if (saved.length > 0) return saved
    const defaults = createDefaultWidgets()
    saveWidgets(defaults)
    return defaults
  })
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [isResizing, setIsResizing] = useState<string | null>(null)
  const [resizeSize, setResizeSize] = useState<{ w: number; h: number } | null>(null)
  const [currentPage, setCurrentPage] = useState(0)

  const gridContainerRef = useRef<HTMLDivElement>(null!)
  const addButtonRef = useRef<HTMLButtonElement>(null!)
  const preDragLayoutRef = useRef<Map<string, { x: number; y: number }>>(new Map())

  const isEmpty = widgets.length === 0
  const pageBoundary = 4

  const { paginatedWidgets, totalPages } = useMemo(() => {
    if (widgets.length === 0 || pageBoundary <= 0) {
      return { paginatedWidgets: [widgets], totalPages: 1 }
    }

    const maxPage = Math.max(0, ...widgets.map((w) => Math.floor(w.y / pageBoundary)))
    const pages: DashboardWidget[][] = Array.from({ length: maxPage + 1 }, () => [])

    for (const w of widgets) {
      const page = Math.min(Math.floor(w.y / pageBoundary), maxPage)
      pages[page].push({
        ...w,
        y: w.y - page * pageBoundary,
      })
    }

    return { paginatedWidgets: pages, totalPages: pages.length }
  }, [widgets, pageBoundary])

  const safePage = Math.min(currentPage, Math.max(0, totalPages - 1))
  const visibleWidgets = paginatedWidgets[safePage] ?? []
  const hasPrev = safePage > 0
  const hasNext = safePage < totalPages - 1

  const updateWidgets = useCallback((fn: (prev: DashboardWidget[]) => DashboardWidget[]) => {
    setWidgets((prev) => {
      const next = fn(prev)
      saveWidgets(next)
      return next
    })
  }, [])

  const handleAddWidget = useCallback((type: WidgetType, size: WidgetSize) => {
    updateWidgets((prev) => {
      const pos = findEmptySlot(prev, COLS, size.w, size.h)
      const newWidget: DashboardWidget = {
        id: generateId(), type, size,
        x: pos.x, y: pos.y,
        w: size.w, h: size.h,
      }
      return [...prev, newWidget]
    })
    setIsPickerOpen(false)
  }, [updateWidgets])

  const handleRemoveWidget = useCallback((id: string) => {
    updateWidgets((prev) => prev.filter((w) => w.id !== id))
  }, [updateWidgets])

  const handleResizeStop = useCallback(
    (_layout: GridItem[], _oldItem: GridItem, newItem: GridItem) => {
      updateWidgets((prev) => {
        const next = prev.map((w) => {
          if (w.id === newItem.i) {
            const def = WIDGET_REGISTRY.find((r) => r.type === w.type)
            const newW = Math.min(Math.max(def?.minW ?? 1, Math.round(newItem.w)), def?.maxW ?? 4)
            const newH = Math.min(Math.max(def?.minH ?? 1, Math.round(newItem.h)), def?.maxH ?? 4)
            const size = def?.availableSizes.find((s) => s.w === newW && s.h >= newH)
              ?? def?.defaultSize ?? w.size
            return { ...w, w: newW, h: newH, size, x: newItem.x, y: newItem.y }
          }
          return w
        })
        return next
      })
      setIsResizing(null)
      setResizeSize(null)
    },
    [updateWidgets],
  )

  const handleResizeStart = useCallback((_layout: GridItem[], _oldItem: GridItem, newItem: GridItem) => {
    setIsResizing(newItem.i)
    setResizeSize({ w: newItem.w, h: newItem.h })
  }, [])

  const handleResize = useCallback((_layout: GridItem[], _oldItem: GridItem, newItem: GridItem) => {
    setResizeSize({
      w: Math.round(newItem.w),
      h: Math.round(newItem.h),
    })
  }, [])

  const handleLayoutChange = useCallback((layout: GridItem[]) => {
    updateWidgets((prev) => {
      let next = prev.map((w) => {
        const l = layout.find((li) => li.i === w.id)
        if (l) return { ...w, x: l.x, y: l.y, w: l.w, h: l.h }
        return w
      })

      const movedId = next.find((w, i) =>
        prev[i] && (w.x !== prev[i].x || w.y !== prev[i].y)
      )?.id

      if (movedId) {
        const moved = next.find((w) => w.id === movedId)
        const preDrag = preDragLayoutRef.current
        if (moved && preDrag.has(movedId)) {
          const oldPos = preDrag.get(movedId)!
          const displacedId = [...preDrag.entries()].find(
            ([id, pos]) => id !== movedId && pos.x === moved.x && pos.y === moved.y
          )?.[0]

          if (displacedId) {
            const displaced = next.find((w) => w.id === displacedId)
            if (displaced) {
              next = next.map((w) => {
                if (w.id === movedId) return { ...w, x: displaced.x, y: displaced.y }
                if (w.id === displacedId) return { ...w, x: oldPos.x, y: oldPos.y }
                return w
              })
            }
          }
        }
      }

      return next
    })
  }, [updateWidgets])

  const handleDrop = useCallback((_layout: GridItem[], item: GridItem, _e: Event) => {
    try {
      const data = JSON.parse(
        (_e as unknown as DragEvent).dataTransfer?.getData('text/plain') ?? '{}',
      ) as { type: WidgetType; w: number; h: number }

      updateWidgets((prev) => {
        const def = WIDGET_REGISTRY.find((r) => r.type === data.type)
        if (!def) return prev
        const size = def.availableSizes.find((s) => s.w === data.w && s.h === data.h)
          ?? def.defaultSize
        const newWidget: DashboardWidget = {
          id: generateId(), type: data.type, size,
          x: item.x, y: item.y,
          w: size.w, h: size.h,
        }
        return [...prev, newWidget]
      })
    } catch { /* ignore invalid drop data */ }
  }, [updateWidgets])

  const handleDragStart = useCallback((layout: GridItem[]) => {
    preDragLayoutRef.current = new Map(layout.map((i) => [i.i, { x: i.x, y: i.y }]))
  }, [])

  return (
    <div className={`main-content ${isEditMode ? 'dashboard-edit-mode' : ''}`} style={{ flex: 1 }}>
      <DashboardHeader
        isEditing={isEditMode}
        onToggleEdit={() => setIsEditMode((v) => !v)}
        onOpenPicker={() => setIsPickerOpen(true)}
        addButtonRef={addButtonRef}
      />

      <div className="main-scroll" style={{ position: 'relative' }}>
        <div ref={gridContainerRef} style={{ minHeight: '100%' }}>
          <AnimatePresence mode="wait">
            {isEmpty ? (
              <EmptyDashboard key="empty" onOpenPicker={() => setIsPickerOpen(true)} />
            ) : (
              <motion.div
                key="grid"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {totalPages > 1 && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 14,
                    marginBottom: 12,
                  }}>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                      disabled={!hasPrev}
                      style={{
                        opacity: hasPrev ? 1 : 0.3,
                        cursor: hasPrev ? 'pointer' : 'default',
                        border: '1px solid var(--border)',
                        borderRadius: '50%',
                        width: 28, height: 28,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'var(--white)',
                        color: 'var(--muted)',
                      }}
                    >
                      <ChevronLeft size={14} />
                    </motion.button>

                    {Array.from({ length: totalPages }).map((_, i) => (
                      <motion.div
                        key={i}
                        animate={{
                          scale: i === safePage ? 1.3 : 1,
                          background: i === safePage ? 'var(--accent)' : 'var(--border)',
                        }}
                        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                        style={{ width: 6, height: 6, borderRadius: '50%', cursor: 'pointer' }}
                        onClick={() => setCurrentPage(i)}
                      />
                    ))}

                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={!hasNext}
                      style={{
                        opacity: hasNext ? 1 : 0.3,
                        cursor: hasNext ? 'pointer' : 'default',
                        border: '1px solid var(--border)',
                        borderRadius: '50%',
                        width: 28, height: 28,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'var(--white)',
                        color: 'var(--muted)',
                      }}
                    >
                      <ChevronRight size={14} />
                    </motion.button>
                  </div>
                )}

                <AnimatePresence mode="wait">
                  <motion.div
                    key={safePage}
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -30 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                  >
                    <GridLayout
                      className="dashboard-grid"
                      layout={buildGridLayout(visibleWidgets)}
                      cols={COLS}
                      rowHeight={ROW_HEIGHT}
                      isDraggable={isEditMode}
                      isResizable={isEditMode}
                      useCSSTransforms={true}
                      compactType="vertical"
                      preventCollision={true}
                      isDroppable={true}
                      margin={[GRID_MARGIN, GRID_MARGIN]}
                      containerPadding={[0, 0]}
                      // @ts-expect-error react-grid-layout types are limited
                      onLayoutChange={handleLayoutChange}
                      // @ts-expect-error react-grid-layout types are limited
                      onResizeStop={handleResizeStop}
                      // @ts-expect-error react-grid-layout types are limited
                      onResizeStart={handleResizeStart}
                      // @ts-expect-error react-grid-layout types are limited
                      onResize={handleResize}
                      // @ts-expect-error react-grid-layout types are limited
                      onDrop={handleDrop}
                      // @ts-expect-error react-grid-layout types are limited
                      onDragStart={handleDragStart}
                    >
                      {visibleWidgets.map((widget) => (
                        <div key={widget.id} style={{ position: 'relative' }}>
                          <WidgetCard
                            widget={widget}
                            isEditMode={isEditMode}
                            onRemove={() => handleRemoveWidget(widget.id)}
                          />

                          {isResizing === widget.id && resizeSize && (
                            <SizeIndicator w={resizeSize.w} h={resizeSize.h} />
                          )}
                        </div>
                      ))}
                    </GridLayout>
                  </motion.div>
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {isPickerOpen && (
          <AddWidgetModal
            open={isPickerOpen}
            onClose={() => setIsPickerOpen(false)}
            onAdd={handleAddWidget}
            onDragStart={() => setIsPickerOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
