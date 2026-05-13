import type { WidgetType } from '../../types/widgets.types'
import { renderWidgetContent } from './WidgetCard'

interface Props {
  type: WidgetType
}

export default function WidgetPreview({ type }: Props) {
  return (
    <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--white)' }}>
      {renderWidgetContent(type)}
    </div>
  )
}
