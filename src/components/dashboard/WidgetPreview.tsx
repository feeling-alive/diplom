import { useLayoutEffect, useRef, useState } from 'react'
import type { WidgetType } from '../../types/widgets.types'
import { renderWidgetContent } from './WidgetCard'

const RENDER_W = 280
const SCALE_FALLBACK = 0.65

interface Props {
  type: WidgetType
  w: number
  h: number
}

export default function WidgetPreview({ type, w, h }: Props) {
  const ref = useRef<HTMLDivElement>(null!)
  const [scale, setScale] = useState(SCALE_FALLBACK)

  useLayoutEffect(() => {
    if (ref.current) {
      const actualW = ref.current.scrollWidth
      if (actualW > 0) {
        setScale(Math.min(1, RENDER_W / actualW))
      }
    }
  }, [type, w, h])

  const renderH = Math.max(160, h * 130)
  const containerH = Math.round(renderH * scale)

  return (
    <div
      style={{
        width: '100%',
        height: containerH,
        overflow: 'hidden',
        position: 'relative',
        borderRadius: 8,
        border: '1px solid var(--border)',
        background: 'var(--white)',
      }}
    >
      <div
        ref={ref}
        style={{
          width: RENDER_W,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          position: 'absolute',
          top: 0,
          left: 0,
        }}
      >
        {renderWidgetContent(type)}
      </div>
    </div>
  )
}
