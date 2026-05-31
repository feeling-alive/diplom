import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, X } from 'lucide-react'
import type { WidgetType, WidgetSize } from '../../types/widgets.types'
import { WIDGET_REGISTRY } from '../../constants/widgets.registry'

interface WidgetPickerProps {
  onClose: () => void
  onAdd: (type: WidgetType, size: WidgetSize) => void
  triggerRef: React.RefObject<HTMLButtonElement>
}

export default function WidgetPicker({
  onClose, onAdd,
}: WidgetPickerProps) {
  const [selectedSizes, setSelectedSizes] = useState<Record<WidgetType, WidgetSize>>(
    Object.fromEntries(
      WIDGET_REGISTRY.map((w) => [w.type, w.defaultSize])
    ) as Record<WidgetType, WidgetSize>
  )

  const handleAdd = useCallback((type: WidgetType, size: WidgetSize) => {
    onAdd(type, size)
  }, [onAdd])

  return (
    <>
      <motion.div
        className="widget-picker-panel"
        initial={{
          opacity: 0,
          scale: 0.85,
          y: -12,
          transformOrigin: 'top right',
        }}
        animate={{
          opacity: 1,
          scale: 1,
          y: 0,
        }}
        exit={{
          opacity: 0,
          scale: 0.85,
          y: -8,
        }}
        transition={{
          type: 'spring',
          stiffness: 380,
          damping: 26,
          mass: 0.7,
        }}
        style={{ transformOrigin: 'top right' }}
      >
        <div className="picker-header">
          <span className="picker-title">Виджеты</span>
          <button className="picker-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="picker-scroll">
          {WIDGET_REGISTRY.map((def, index) => (
            <motion.div
              key={def.type}
              className="picker-widget-card"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.04, type: 'spring', stiffness: 300 }}
            >
              <div
                className="picker-widget-preview"
                style={{
                  width: selectedSizes[def.type].w * 40,
                  height: selectedSizes[def.type].h * 32,
                  background: `${def.color}10`,
                  border: `1px solid ${def.color}30`,
                }}
              >
                <def.icon size={22} strokeWidth={1.5} color={def.color} />
              </div>

              <div className="picker-widget-info">
                <span className="picker-widget-name">{def.title}</span>
                <span className="picker-widget-desc">{def.description}</span>
              </div>

              <div className="picker-sizes">
                {def.availableSizes.map((size) => (
                  <motion.button
                    key={size.label}
                    className={`picker-size-btn ${
                      selectedSizes[def.type].label === size.label ? 'active' : ''
                    }`}
                    onClick={() => setSelectedSizes((prev) => ({
                      ...prev,
                      [def.type]: size,
                    }))}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {size.label}
                  </motion.button>
                ))}
              </div>

              <motion.button
                className="picker-add-btn"
                onClick={() => handleAdd(def.type, selectedSizes[def.type])}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
              >
                <Plus size={14} /> Добавить
              </motion.button>
            </motion.div>
          ))}
        </div>
      </motion.div>

      <motion.div
        className="picker-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
    </>
  )
}