import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import AIPanel from '../AIPanel'

vi.mock('../../../hooks/useGroqChat', () => ({
  useGroqChat: () => ({
    messages: [],
    loading: false,
    error: null,
    prediction: {
      direction: 'UP',
      probability: 0.51,
      source: 'huggingface',
      low_confidence: true,
    },
    send: vi.fn(),
    clear: vi.fn(),
  }),
}))

describe('AIPanel prediction badge', () => {
  it('renders a low-confidence signal as a neutral weak sideways badge', () => {
    render(<AIPanel symbol="BTC-USDT" />)
    expect(screen.getByText(/Боковик/)).toBeInTheDocument()
    expect(screen.getByText(/слабый сигнал/)).toBeInTheDocument()
  })
})
