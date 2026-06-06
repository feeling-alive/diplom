import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import TradingViewModal from '../TradingViewModal'
import type { Asset } from '../../../types/market.types'

// Mock the chat hook so the modal never touches the network.
vi.mock('../../../hooks/useGroqChat', () => ({
  useGroqChat: () => ({
    messages: [],
    loading: false,
    error: null,
    prediction: null,
    send: vi.fn(),
    clear: vi.fn(),
  }),
}))

const ASSET: Asset = {
  symbol: 'BTC-USDT',
  name: 'Bitcoin',
  type: 'crypto',
  price: 68000,
  change24h: 2.5,
  volume24h: 1_000_000,
  high24h: 69000,
  low24h: 67000,
  color: '#F7931A',
}

describe('TradingViewModal', () => {
  it('defaults the TradingView chart to the 1H (interval=60) timeframe', () => {
    render(<TradingViewModal open onClose={() => {}} asset={ASSET} />)
    const src = screen.getByTitle(/TradingView chart/i).getAttribute('src') ?? ''
    expect(src).toContain('interval=60')
    expect(src).not.toContain('interval=D')
  })

  it('still uses interval=60 after the modal is reopened', () => {
    const { rerender } = render(
      <TradingViewModal open={false} onClose={() => {}} asset={ASSET} />,
    )
    // Closed: the iframe is unmounted.
    expect(screen.queryByTitle(/TradingView chart/i)).not.toBeInTheDocument()

    // Reopen: the iframe remounts and the 1H default applies again.
    rerender(<TradingViewModal open onClose={() => {}} asset={ASSET} />)
    const src = screen.getByTitle(/TradingView chart/i).getAttribute('src') ?? ''
    expect(src).toContain('interval=60')
  })
})
