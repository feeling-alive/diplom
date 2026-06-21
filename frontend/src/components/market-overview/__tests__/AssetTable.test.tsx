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

// AssetTable rows navigate on click (useNavigate). Provide a no-op so the hook
// doesn't throw "useNavigate() may be used only in the context of a <Router>".
vi.mock('react-router-dom', () => ({
  useNavigate: () => () => undefined,
}))

// SparklineCell uses useOHLCV (React Query). Mock it so tests don't need a
// QueryClientProvider — sparklines aren't asserted here.
vi.mock('../../../hooks/useOHLCV', () => ({
  useOHLCV: () => ({ data: [], isLoading: false, error: null }),
}))

// usePrices is async-first (isLoading=true on first render → AssetTable shows skeletons).
// Mock it with deterministic loaded data so rows render synchronously in tests.
vi.mock('../../../hooks/usePrices', () => {
  type T = 'crypto' | 'stock' | 'forex'
  const mk = (symbol: string, name: string, type: T, price: number, change24h: number) => ({
    symbol, name, type, price, change24h,
    volume24h: 1_000_000_000, marketCap: 100_000_000_000,
    high24h: price * 1.05, low24h: price * 0.95, color: '#888888', icon: symbol[0],
  })
  const cryptos = [mk('BTC-USDT', 'Bitcoin', 'crypto', 94000, 1.2), mk('ETH-USDT', 'Ethereum', 'crypto', 3200, -0.5), mk('SOL-USDT', 'Solana', 'crypto', 180, 3.1)]
  const stocks = [mk('AAPL', 'Apple', 'stock', 225, 0.8), mk('MSFT', 'Microsoft', 'stock', 430, -0.3)]
  const forex = [mk('EUR-USD', 'Euro', 'forex', 1.08, 0.1)]
  const all = [...cryptos, ...stocks, ...forex]
  const bySymbol = Object.fromEntries(all.map((a) => [a.symbol, a]))
  return { usePrices: () => ({ all, cryptos, stocks, forex, bySymbol, isLoading: false, lastUpdated: Date.now() }) }
})

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

  it('shows only forex assets when filter=forex', () => {
    render(<AssetTable filter="forex" />)
    expect(screen.getByText('EUR-USD')).toBeInTheDocument()
    expect(screen.queryByText('BTC-USDT')).not.toBeInTheDocument()
  })
})
