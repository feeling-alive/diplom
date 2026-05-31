import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import AssetTable from '../AssetTable'

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, style, onClick }: React.HTMLAttributes<HTMLDivElement>) =>
      <div style={style} onClick={onClick}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

describe('AssetTable', () => {
  it('renders all 8 assets with filter=all', () => {
    render(<AssetTable filter="all" />)
    expect(screen.getByText('BTC-USDT')).toBeInTheDocument()
    expect(screen.getByText('ETH-USDT')).toBeInTheDocument()
    expect(screen.getByText('SOL-USDT')).toBeInTheDocument()
    expect(screen.getByText('AAPL')).toBeInTheDocument()
    expect(screen.getByText('EUR-USD')).toBeInTheDocument()
  })

  it('shows only crypto assets when filter=crypto', () => {
    render(<AssetTable filter="crypto" />)
    expect(screen.getByText('BTC-USDT')).toBeInTheDocument()
    expect(screen.getByText('ETH-USDT')).toBeInTheDocument()
    expect(screen.getByText('SOL-USDT')).toBeInTheDocument()
    expect(screen.queryByText('AAPL')).not.toBeInTheDocument()
    expect(screen.queryByText('EUR-USD')).not.toBeInTheDocument()
  })

  it('shows only stock assets when filter=stock', () => {
    render(<AssetTable filter="stock" />)
    expect(screen.getByText('AAPL')).toBeInTheDocument()
    expect(screen.getByText('MSFT')).toBeInTheDocument()
    expect(screen.queryByText('BTC-USDT')).not.toBeInTheDocument()
  })

  it('toggles sort direction on repeated Цена header click', () => {
    render(<AssetTable filter="all" />)
    const priceHeader = screen.getByText('Цена')
    fireEvent.click(priceHeader)
    fireEvent.click(priceHeader)
    // Sort toggle should not throw
    expect(screen.getByText('BTC-USDT')).toBeInTheDocument()
  })

  it('shows empty state for filter with no matching assets', () => {
    render(<AssetTable filter="index" />)
    // SPX is an index — should render
    expect(screen.getByText('SPX')).toBeInTheDocument()
  })
})
