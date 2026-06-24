import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react'

interface Props {
  /** Текущий код (0–6 цифр). */
  value: string
  /** Колбэк нового значения (только цифры, максимум 6). */
  onChange: (next: string) => void
  /** Подсветить поля как ошибочные. */
  hasError?: boolean
  /** Сабмит формы при заполнении всех 6 цифр (Enter в последнем поле/после вставки). */
  onComplete?: () => void
}

const LENGTH = 6

/**
 * H1: ввод 6-значного кода в 6 квадратных полей (стиль референса).
 * Авто-переход к следующему полю, backspace-навигация назад, поддержка вставки
 * (paste) всего кода целиком. Состояние хранится как одна строка в родителе.
 */
export default function CodeInput({ value, onChange, hasError = false, onComplete }: Props) {
  const refs = useRef<(HTMLInputElement | null)[]>([])

  const digits = value.split('').slice(0, LENGTH)
  while (digits.length < LENGTH) digits.push('')

  function focusAt(index: number) {
    const clamped = Math.max(0, Math.min(LENGTH - 1, index))
    refs.current[clamped]?.focus()
    refs.current[clamped]?.select()
  }

  function setDigit(index: number, digit: string) {
    const next = digits.slice()
    next[index] = digit
    const joined = next.join('').replace(/\D/g, '').slice(0, LENGTH)
    console.debug('[ResetPasswordPage] code entered len=%d', joined.length)
    onChange(joined)
    return joined
  }

  function handleChange(index: number, raw: string) {
    const digit = raw.replace(/\D/g, '').slice(-1) // последняя введённая цифра
    if (!digit) return
    const joined = setDigit(index, digit)
    if (index < LENGTH - 1) {
      focusAt(index + 1)
    } else if (joined.length === LENGTH) {
      onComplete?.()
    }
  }

  function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      e.preventDefault()
      if (digits[index]) {
        setDigit(index, '')
      } else if (index > 0) {
        setDigit(index - 1, '')
        focusAt(index - 1)
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      focusAt(index - 1)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      focusAt(index + 1)
    } else if (e.key === 'Enter' && value.length === LENGTH) {
      onComplete?.()
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, LENGTH)
    if (!pasted) return
    console.debug('[ResetPasswordPage] code entered len=%d', pasted.length)
    onChange(pasted)
    focusAt(pasted.length >= LENGTH ? LENGTH - 1 : pasted.length)
    if (pasted.length === LENGTH) onComplete?.()
  }

  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el }}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          value={digit}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          aria-label={`Цифра ${i + 1} из ${LENGTH}`}
          style={{
            width: '100%',
            aspectRatio: '1 / 1',
            minWidth: 0,
            textAlign: 'center',
            fontSize: 22,
            fontWeight: 700,
            color: 'var(--ink)',
            fontVariantNumeric: 'tabular-nums',
            borderRadius: 'var(--r-md)',
            border: hasError
              ? '1px solid var(--red)'
              : digit
                ? '1px solid var(--accent)'
                : '1px solid var(--border)',
            background: 'var(--white)',
            outline: 'none',
            fontFamily: 'var(--font)',
            transition: 'border-color 0.15s',
          }}
        />
      ))}
    </div>
  )
}
