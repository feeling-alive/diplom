import { useRef } from 'react'
import { Search, X } from 'lucide-react'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  fullWidth?: boolean
  className?: string
  style?: React.CSSProperties
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Поиск...',
  fullWidth = false,
  className,
  style: externalStyle,
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        width: fullWidth ? '100%' : 220,
        ...externalStyle,
      }}
    >
      <Search
        size={16}
        style={{
          position: 'absolute',
          left: 12,
          color: 'var(--muted)',
          pointerEvents: 'none',
          flexShrink: 0,
        }}
      />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => {
          console.debug('[SearchInput] focused value=%s', value)
          e.currentTarget.style.borderColor = 'var(--accent)'
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = 'var(--border)'
        }}
        placeholder={placeholder}
        style={{
          width: '100%',
          height: 40,
          paddingLeft: 40,
          paddingRight: value ? 36 : 16,
          border: '1px solid var(--border)',
          borderRadius: 12,
          backgroundColor: 'var(--white)',
          color: 'var(--ink)',
          fontSize: 13,
          outline: 'none',
          transition: 'border-color 0.15s',
          fontFamily: 'inherit',
        }}
      />
      {value && (
        <button
          onClick={() => {
            onChange('')
            inputRef.current?.focus()
          }}
          style={{
            position: 'absolute',
            right: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--muted)',
            padding: 2,
            borderRadius: 4,
          }}
          aria-label="Очистить поиск"
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}
