import { useState, useCallback, useRef } from 'react'
import GridLayout, { WidthProvider, type Layout, type LayoutItem } from 'react-grid-layout/legacy'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { motion, AnimatePresence } from 'framer-motion'

import DashboardHeader from '../components/dashboard/DashboardHeader'
import WidgetCard from '../components/dashboard/WidgetCard'
import EmptyDashboard from '../components/dashboard/EmptyDashboard'
import AddWidgetModal from '../components/dashboard/AddWidgetModal'
import SizeIndicator from '../components/dashboard/SizeIndicator'

import { WIDGET_REGISTRY } from '../constants/widgets.registry'
import type { DashboardWidget, WidgetType, WidgetSize } from '../types/widgets.types'

const COLS = 4
const ROW_HEIGHT = 110
const GRID_MARGIN = 10
const STORAGE_KEY = 'fintrack_widgets_v4'
const LEGACY_STORAGE_KEYS = ['fintrack_widgets_v2', 'fintrack_widgets']
// v3 is migrated (not purged) below: kpi_portfolio -> market_ticker.
const V3_MIGRATION_KEY = 'fintrack_widgets_v3'

// [FIX] WidthProvider HOC ОБЯЗАТЕЛЕН — без него GridLayout использует дефолт 1200px,
// координаты drag не совпадают с реальным контейнером → drop кладёт виджет не туда,
// resize считается от чужой ширины → не работает.
const ResponsiveGrid = WidthProvider(GridLayout)

function generateId(): string {
  return 'w_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

function buildGridLayout(widgets: DashboardWidget[]): LayoutItem[] {
  return widgets.map((w) => {
    const def = WIDGET_REGISTRY.find((r) => r.type === w.type)
    return {
      i: w.id, x: w.x, y: w.y, w: w.w, h: w.h,
      minW: def?.minW, maxW: def?.maxW,
      minH: def?.minH, maxH: def?.maxH,
    }
  })
}

function loadWidgets(): DashboardWidget[] | null {
  try {
    for (const k of LEGACY_STORAGE_KEYS) {
      if (localStorage.getItem(k)) {
        console.debug('[FIX] purging legacy localStorage key %s', k)
        localStorage.removeItem(k)
      }
    }
  } catch { /* ignore */ }

  // [FIX] one-time v3 -> v4 migration: rename kpi_portfolio to market_ticker.
  try {
    if (!localStorage.getItem(STORAGE_KEY) && localStorage.getItem(V3_MIGRATION_KEY)) {
      const v3raw = localStorage.getItem(V3_MIGRATION_KEY)
      if (v3raw) {
        const v3 = JSON.parse(v3raw) as DashboardWidget[]
        if (Array.isArray(v3)) {
          const migrated = v3.map((w) => {
            if ((w.type as unknown) === 'kpi_portfolio') {
              console.debug('[FIX] migrating kpi_portfolio -> market_ticker (v3 -> v4)')
              return { ...w, type: 'market_ticker' as WidgetType }
            }
            return w
          })
          localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated))
        }
      }
      localStorage.removeItem(V3_MIGRATION_KEY)
    }
  } catch (err) {
    console.warn('[Dashboard] v3 -> v4 migration failed:', err)
  }

  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as DashboardWidget[]
      if (Array.isArray(parsed)) {
        return parsed.map((w) => {
          const def = WIDGET_REGISTRY.find((r) => r.type === w.type)
          if (!def) return w
          const cw = Math.min(Math.max(def.minW, w.w), def.maxW)
          const ch = Math.min(Math.max(def.minH, w.h), def.maxH)
          if (cw !== w.w || ch !== w.h) {
            console.debug('[FIX] clamp loaded widget %s %dx%d -> %dx%d', w.type, w.w, w.h, cw, ch)
          }
          return { ...w, w: cw, h: ch }
        })
      }
    }
  } catch { /* ignore */ }
  // [FIX] null = нет сохранённого конфига (засеять дефолты); [] = пользователь
  // очистил все виджеты (уважать пустоту, не пересоздавать — иначе «очистить всё»
  // откатывается к дефолтам при перезагрузке).
  return null
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
    { type: 'market_ticker', size: { w: 3, h: 1, label: '3×1' } },
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
  const [widgets, setWidgets] = useState<DashboardWidget[]>(() => {
    const saved = loadWidgets()
    // saved === null → первый вход (засеять дефолты); saved === [] → очищено (уважать)
    if (saved !== null) return saved
    const defaults = createDefaultWidgets()
    saveWidgets(defaults)
    return defaults
  })
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [isResizing, setIsResizing] = useState<string | null>(null)
  const [resizeSize, setResizeSize] = useState<{ w: number; h: number } | null>(null)

  const addButtonRef = useRef<HTMLButtonElement>(null!)
  const isDraggingRef = useRef(false)
  const [droppingItem, setDroppingItem] = useState<{ i: string; w: number; h: number; x: number; y: number }>({ i: '__dropping__', w: 1, h: 1, x: 0, y: 0 })

  const isEmpty = widgets.length === 0

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

  const handleResetLayout = useCallback(() => {
    // Задача 8: сброс теперь ОЧИЩАЕТ все виджеты (пустой дашборд), а не восстанавливает
    // дефолты. EmptyDashboard рендерит CTA «добавить виджет» — пользователь не застревает.
    console.debug('[Dashboard] clearing all widgets -> empty dashboard')
    updateWidgets(() => [])
  }, [updateWidgets])

  const handleResizeStop = useCallback(
    (_layout: Layout, _oldItem: LayoutItem | null, newItem: LayoutItem | null) => {
      if (!newItem) return
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

  const handleResizeStart = useCallback((_layout: Layout, _oldItem: LayoutItem | null, newItem: LayoutItem | null) => {
    if (!newItem) return
    setIsResizing(newItem.i)
    setResizeSize({ w: newItem.w, h: newItem.h })
  }, [])

  const handleResize = useCallback((_layout: Layout, _oldItem: LayoutItem | null, newItem: LayoutItem | null) => {
    if (!newItem) return
    setResizeSize({
      w: Math.round(newItem.w),
      h: Math.round(newItem.h),
    })
  }, [])

  const handleLayoutChange = useCallback((layout: Layout) => {
    if (isDraggingRef.current) return
    updateWidgets((prev) => {
      const next = prev.map((w) => {
        const l = layout.find((li) => li.i === w.id)
        if (l) return { ...w, x: l.x, y: l.y, w: l.w, h: l.h }
        return w
      })
      return next
    })
  }, [updateWidgets])

  const handleDragStart = useCallback((layout: Layout) => {
    isDraggingRef.current = true
    console.debug('[FIX] drag start — items=%d', layout.length)
  }, [])

  const handleDragStop = useCallback((layout: Layout) => {
    isDraggingRef.current = false
    updateWidgets((prev) => prev.map((w) => {
      const l = layout.find((li) => li.i === w.id)
      if (l) return { ...w, x: l.x, y: l.y }
      return w
    }))
  }, [updateWidgets])

  const handleDrop = useCallback((_layout: Layout, item: LayoutItem | undefined, _e: Event) => {
    setDroppingItem({ i: '__dropping__', w: 1, h: 1, x: 0, y: 0 })
    if (!item) return
    try {
      const data = JSON.parse(
        (_e as unknown as DragEvent).dataTransfer?.getData('text/plain') ?? '{}',
      ) as { type: WidgetType; w: number; h: number }

      if (!data.type) return
      console.info('[Dashboard] external drop type=%s at (%d,%d) size=%dx%d', data.type, item.x, item.y, data.w, data.h)

      updateWidgets((prev) => {
        const def = WIDGET_REGISTRY.find((r) => r.type === data.type)
        if (!def) return prev
        const size = def.availableSizes.find((s) => s.w === data.w && s.h === data.h)
          ?? def.defaultSize
        const newWidget: DashboardWidget = {
          id: generateId(), type: data.type, size,
          x: Math.max(0, Math.min(item.x, COLS - size.w)),
          y: Math.max(0, item.y),
          w: size.w, h: size.h,
        }
        return [...prev, newWidget]
      })
      setIsPickerOpen(false)
    } catch (err) {
      console.warn('[Dashboard] drop parse error:', err)
    }
  }, [updateWidgets])

  const handleModalDragStart = useCallback((type: WidgetType, size: WidgetSize) => {
    setDroppingItem({ i: `dropping-${type}`, w: size.w, h: size.h, x: 0, y: 0 })
    console.debug('[Dashboard] modal drag start — droppingItem set to %dx%d', size.w, size.h)
  }, [])

  console.debug('[Dashboard] render widgets=%d', widgets.length)

  return (
    <div className="main-content" style={{ flex: 1 }}>
      <DashboardHeader
        onOpenPicker={() => setIsPickerOpen(true)}
        onResetLayout={handleResetLayout}
        addButtonRef={addButtonRef}
      />

      <div className="main-scroll">
        <AnimatePresence mode="wait">
          {isEmpty ? (
            <EmptyDashboard key="empty" onOpenPicker={() => setIsPickerOpen(true)} />
          ) : (
            <motion.div
              key="grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <ResponsiveGrid
                className="dashboard-grid"
                layout={buildGridLayout(widgets)}
                cols={COLS}
                rowHeight={ROW_HEIGHT}
                isDraggable={true}
                isResizable={true}
                draggableHandle=".widget-drag-handle"
                resizeHandles={['se', 'sw', 'ne', 'nw', 's', 'e']}
                useCSSTransforms={true}
                compactType="vertical"
                preventCollision={false}
                isDroppable={true}
                droppingItem={droppingItem}
                margin={[GRID_MARGIN, GRID_MARGIN]}
                containerPadding={[0, 0]}
                measureBeforeMount={false}
                onLayoutChange={handleLayoutChange}
                onResizeStop={handleResizeStop}
                onResizeStart={handleResizeStart}
                onResize={handleResize}
                onDrop={handleDrop}
                onDragStart={handleDragStart}
                onDragStop={handleDragStop}
              >
                {widgets.map((widget) => (
                  <div key={widget.id} style={{ height: '100%', width: '100%' }}>
                    <WidgetCard
                      widget={widget}
                      onRemove={() => handleRemoveWidget(widget.id)}
                    />

                    {isResizing === widget.id && resizeSize && (
                      <SizeIndicator w={resizeSize.w} h={resizeSize.h} />
                    )}
                  </div>
                ))}
              </ResponsiveGrid>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {isPickerOpen && (
          <AddWidgetModal
            open={isPickerOpen}
            onClose={() => setIsPickerOpen(false)}
            onAdd={handleAddWidget}
            onDragStart={handleModalDragStart}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
