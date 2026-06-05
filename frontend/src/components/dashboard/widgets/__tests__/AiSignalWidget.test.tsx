import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import AiSignalWidget from '../AiSignalWidget'
import type { UsePredictionResult } from '../../../../hooks/usePrediction'

const mockUsePrediction = vi.fn<[], UsePredictionResult>()

vi.mock('../../../../hooks/usePrediction', () => ({
  usePrediction: () => mockUsePrediction(),
}))

beforeEach(() => {
  mockUsePrediction.mockReset()
})

describe('AiSignalWidget', () => {
  it('renders a confident upward signal from live data', () => {
    mockUsePrediction.mockReturnValue({
      data: { direction: 'UP', probability: 0.82, source: 'huggingface', low_confidence: false },
      isLoading: false,
      error: null,
    })
    render(<AiSignalWidget />)
    expect(screen.getByText('Восходящий')).toBeInTheDocument()
    expect(screen.getByText('AI 82%')).toBeInTheDocument()
  })

  it('shows a neutral sideways label for a weak/low-confidence signal', () => {
    mockUsePrediction.mockReturnValue({
      data: { direction: 'UP', probability: 0.51, source: 'huggingface', low_confidence: true },
      isLoading: false,
      error: null,
    })
    render(<AiSignalWidget />)
    expect(screen.getByText('Боковик')).toBeInTheDocument()
    expect(screen.getByText(/Сигнал слабый/)).toBeInTheDocument()
  })

  it('shows a loading state', () => {
    mockUsePrediction.mockReturnValue({ data: null, isLoading: true, error: null })
    render(<AiSignalWidget />)
    expect(screen.getByText('Анализирую...')).toBeInTheDocument()
  })

  it('shows an empty state when there is no data', () => {
    mockUsePrediction.mockReturnValue({ data: null, isLoading: false, error: null })
    render(<AiSignalWidget />)
    expect(screen.getByText('Нет данных')).toBeInTheDocument()
  })
})
