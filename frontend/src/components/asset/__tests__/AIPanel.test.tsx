import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import AIPanel from '../AIPanel'
import type { PredictionInfo } from '../../../hooks/useGroqChat'

// Mutable prediction the mocked hook returns; the `mock` prefix is required so
// vitest allows the factory below to close over it.
let mockPrediction: PredictionInfo | null = null

vi.mock('../../../hooks/useGroqChat', () => ({
  useGroqChat: () => ({
    messages: [],
    loading: false,
    error: null,
    prediction: mockPrediction,
    send: vi.fn(),
    clear: vi.fn(),
  }),
}))

function pred(rule_score: number | null): PredictionInfo {
  return { direction: 'UP', probability: 0.6, source: 'huggingface', rule_score }
}

describe('AIPanel PredictionBadge (rule_score-driven)', () => {
  beforeEach(() => {
    mockPrediction = null
  })

  it('shows "Загрузка..." before a prediction arrives', () => {
    mockPrediction = null
    render(<AIPanel symbol="BTC-USDT" />)
    expect(screen.getByText('Загрузка...')).toBeInTheDocument()
  })

  it('shows "Бычий сигнал" when rule_score > 0.3', () => {
    mockPrediction = pred(0.5)
    render(<AIPanel symbol="BTC-USDT" />)
    expect(screen.getByText('Бычий сигнал')).toBeInTheDocument()
  })

  it('shows "Медвежий сигнал" when rule_score < -0.3', () => {
    mockPrediction = pred(-0.5)
    render(<AIPanel symbol="BTC-USDT" />)
    expect(screen.getByText('Медвежий сигнал')).toBeInTheDocument()
  })

  it('shows "Нейтральный" when rule_score is within [-0.3, 0.3]', () => {
    mockPrediction = pred(0.0)
    render(<AIPanel symbol="BTC-USDT" />)
    expect(screen.getByText('Нейтральный')).toBeInTheDocument()
  })

  it('shows "Загрузка..." when rule_score is null', () => {
    mockPrediction = pred(null)
    render(<AIPanel symbol="BTC-USDT" />)
    expect(screen.getByText('Загрузка...')).toBeInTheDocument()
  })
})
