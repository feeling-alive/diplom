import { describe, it, expect, afterEach } from 'vitest'
import {
  setCurrencyState,
  convertFromUsd,
  formatPrice,
  formatVolume,
  type Currency,
} from './format'

const RATES: Record<Currency, number> = { USD: 1, EUR: 0.9, RUB: 90, BTC: 1 / 50000 }

function use(currency: Currency) {
  setCurrencyState({ currency, rates: RATES })
}

describe('format — пересчёт валют (Задача 6)', () => {
  afterEach(() => setCurrencyState({ currency: 'USD', rates: RATES }))

  it('convertFromUsd умножает на курс активной валюты', () => {
    use('RUB')
    expect(convertFromUsd(100)).toBe(9000)
    use('EUR')
    expect(convertFromUsd(100)).toBe(90)
    use('USD')
    expect(convertFromUsd(100)).toBe(100)
  })

  it('formatPrice показывает символ и пересчитанное значение', () => {
    use('USD')
    expect(formatPrice(2000)).toBe('$2,000')
    use('EUR')
    expect(formatPrice(2000)).toBe('€1,800')
    use('RUB')
    expect(formatPrice(2000)).toBe('180,000 ₽')
  })

  it('forex-пары не пересчитываются (это не USD-сумма)', () => {
    use('RUB')
    expect(formatPrice(1.08, 'forex')).toBe('1.0800')
  })

  it('BTC показывает повышенную точность', () => {
    use('BTC')
    // 50000 USD = 1 BTC
    expect(formatPrice(50000)).toBe('₿1.0000')
  })

  it('formatVolume пересчитывает агрегаты и меняет символ', () => {
    use('EUR')
    expect(formatVolume(2_000_000_000)).toBe('€1.8B')
  })
})
