import { describe, it, expect } from 'vitest'
import { fngLabel, fngColor } from '../useFearGreed'

describe('fngLabel', () => {
  it('maps value ranges to Russian labels', () => {
    expect(fngLabel(80)).toBe('Жадность')
    expect(fngLabel(75)).toBe('Жадность')
    expect(fngLabel(60)).toBe('Нейтрально')
    expect(fngLabel(50)).toBe('Нейтрально')
    expect(fngLabel(30)).toBe('Страх')
    expect(fngLabel(25)).toBe('Страх')
    expect(fngLabel(10)).toBe('Крайний страх')
    expect(fngLabel(0)).toBe('Крайний страх')
  })
})

describe('fngColor', () => {
  it('returns a distinct color per band', () => {
    expect(fngColor(80)).toBe('#22c55e')
    expect(fngColor(60)).toBe('#f97316')
    expect(fngColor(30)).toBe('#f59e0b')
    expect(fngColor(10)).toBe('#ef4444')
  })
})
