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
import { COLS, generateId, findEmptySlot } from '../lib/dashboardLayout'
import { useDashboardConfig } from '../hooks/useDashboardConfig'
import type { DashboardWidget, WidgetType, WidgetSize } from '../types/widgets.types'

const ROW_HEIGHT = 110
const GRID_MARGIN = 10

// [FIX] WidthProvider HOC ОБЯЗАТЕЛЕН — без него GridLayout использует дефолт 1200px,
// координаты drag не совпадают с реальным контейнером → drop кладёт виджет не туда,
// resize считается от чужой ширины → не работает.
const ResponsiveGrid = WidthProvider(GridLayout)

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

export default function Dashboard() {
  // Источник конфига выбирает хук: авторизован → бэкенд (/dashboard/config) с
  // fallback на localStorage; гость → только localStorage. mutate(fn) пишет в
  // активный источник (PUT дебаунсится).
  const { widgets, isLoading, mutate: updateWidgets } = useDashboardConfig()
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [isResizing, setIsResizing] = useState<string | null>(null)
  const [resizeSize, setResizeSize] = useState<{ w: number; h: number } | null>(null)

  const addButtonRef = useRef<HTMLButtonElement>(null!)
  const isDraggingRef = useRef(false)
  const [droppingItem, setDroppingItem] = useState<{ i: string; w: number; h: number; x: number; y: number }>({ i: '__dropping__', w: 1, h: 1, x: 0, y: 0 })

  const isEmpty = widgets.length === 0

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
          {isLoading ? (
            // Пока резолвится источник (бэкенд/localStorage) — не мигаем пустым
            // дашбордом, иначе сохранённая раскладка авторизованного юзера
            // «вспыхивает» как Empty перед загрузкой.
            <div key="loading" style={{ padding: 24, color: 'var(--muted)', fontSize: 13 }}>
              Загрузка дашборда…
            </div>
          ) : isEmpty ? (
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
