import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import SimpleChart from '../SimpleChart'
import type { PricePoint } from '../../../types/market.types'

// Mock the data hook so the chart is driven by deterministic fixtures and never
// touches the network.
const useOHLCVMock = vi.fn()
vi.mock('../../../hooks/useOHLCV', () => ({
  useOHLCV: (symbol: string, tf: string) => useOHLCVMock(symbol, tf),
}))

function makePoints(n: number): PricePoint[] {
  return Array.from({ length: n }, (_, i) => ({
    timestamp: 1_700_000_000_000 + i * 86_400_000,
    open: 100 + i,
    high: 105 + i,
    low: 95 + i,
    close: 100 + i,
    volume: 1000 + i,
  }))
}

describe('SimpleChart', () => {
  beforeEach(() => {
    useOHLCVMock.mockReset()
  })

  it('renders all 8 timeframe buttons', () => {
    useOHLCVMock.mockReturnValue({ data: makePoints(30), isLoading: false, error: null })
    render(<SimpleChart symbol="BTC-USDT" change24h={2.5} assetType="crypto" />)
    for (const label of ['1м', '5м', '15м', '1Ч', '4Ч', '1Д', '1Н', '1М']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it('shows an empty state when there is no data and not loading', () => {
    useOHLCVMock.mockReturnValue({ data: [], isLoading: false, error: null })
    render(<SimpleChart symbol="BTC-USDT" change24h={-1} assetType="crypto" />)
    expect(screen.getByText('Нет данных для графика')).toBeInTheDocument()
  })

  it('does not show the empty state when data is present', () => {
    useOHLCVMock.mockReturnValue({ data: makePoints(10), isLoading: false, error: null })
    render(<SimpleChart symbol="ETH-USDT" change24h={0.5} assetType="crypto" />)
    expect(screen.queryByText('Нет данных для графика')).not.toBeInTheDocument()
  })

  it('requests new candles when a timeframe is clicked', () => {
    useOHLCVMock.mockReturnValue({ data: makePoints(10), isLoading: false, error: null })
    render(<SimpleChart symbol="BTC-USDT" change24h={1} assetType="crypto" />)
    // Default timeframe is 1D; clicking 1м should re-query with '1m'.
    fireEvent.click(screen.getByText('1м'))
    expect(useOHLCVMock).toHaveBeenCalledWith('BTC-USDT', '1m')
  })
})
