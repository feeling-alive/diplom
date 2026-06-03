import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import MarketOverview from '../MarketOverview'

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, style }: React.HTMLAttributes<HTMLDivElement>) =>
      <div style={style}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('react-router-dom', () => ({
  NavLink: ({
    children,
    to,
    style,
  }: {
    children: React.ReactNode
    to: string
    style?: ((arg: { isActive: boolean }) => React.CSSProperties) | React.CSSProperties
  }) => {
    const resolvedStyle = typeof style === 'function' ? style({ isActive: to === '/' }) : style
    return <a href={to} style={resolvedStyle}>{children}</a>
  },
  // TopMovers + AssetTable now use useNavigate for row click-through (Задачи 4/5).
  useNavigate: () => () => undefined,
}))

// usePrices is async-first (isLoading=true on first render). Mock it with loaded data
// so MarketSummaryBar/TopMovers/AssetTable render their content synchronously.
vi.mock('../../hooks/usePrices', () => {
  type T = 'crypto' | 'stock' | 'forex' | 'index'
  const mk = (symbol: string, name: string, type: T, price: number, change24h: number) => ({
    symbol, name, type, price, change24h,
    volume24h: 1_000_000_000, marketCap: 100_000_000_000,
    high24h: price * 1.05, low24h: price * 0.95, color: '#888888', icon: symbol[0],
  })
  const cryptos = [mk('BTC-USDT', 'Bitcoin', 'crypto', 94000, 1.2), mk('ETH-USDT', 'Ethereum', 'crypto', 3200, -0.5), mk('SOL-USDT', 'Solana', 'crypto', 180, 3.1)]
  const stocks = [mk('AAPL', 'Apple', 'stock', 225, 0.8), mk('MSFT', 'Microsoft', 'stock', 430, -0.3)]
  const forex = [mk('EUR-USD', 'Euro', 'forex', 1.08, 0.1)]
  const indices = [mk('SPX', 'S&P 500', 'index', 5842, 0.4)]
  const all = [...cryptos, ...stocks, ...forex, ...indices]
  const bySymbol = Object.fromEntries(all.map((a) => [a.symbol, a]))
  return { usePrices: () => ({ all, cryptos, stocks, forex, indices, bySymbol, isLoading: false, lastUpdated: Date.now() }) }
})

describe('MarketOverview', () => {
  it('renders without crashing', () => {
    render(<MarketOverview />)
    // Use heading role to distinguish h1 from nav link
    expect(screen.getByRole('heading', { name: 'Обзор рынка' })).toBeInTheDocument()
  })

  it('shows all 4 stat card labels', () => {
    render(<MarketOverview />)
    expect(screen.getByText('Капитализация рынка')).toBeInTheDocument()
    // 'Объём 24ч' appears in both MarketSummaryBar and AssetTable header — use getAllByText
    expect(screen.getAllByText('Объём 24ч').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('BTC Доминирование')).toBeInTheDocument()
    expect(screen.getByText('Активов в списке')).toBeInTheDocument()
  })

  it('shows filter tabs', () => {
    render(<MarketOverview />)
    expect(screen.getByText(/Все/)).toBeInTheDocument()
    expect(screen.getByText(/Крипто/)).toBeInTheDocument()
    expect(screen.getByText(/Акции/)).toBeInTheDocument()
    expect(screen.getByText(/Форекс/)).toBeInTheDocument()
  })

  it('clicking Крипто tab filters the table', () => {
    render(<MarketOverview />)
    const cryptoTab = screen.getByText(/Крипто/)
    fireEvent.click(cryptoTab)
    // After clicking Крипто: BTC-USDT may appear in both TopMovers and AssetTable
    expect(screen.getAllByText('BTC-USDT').length).toBeGreaterThanOrEqual(1)
    // AAPL should not be visible (stock, not crypto)
    expect(screen.queryByText('AAPL')).not.toBeInTheDocument()
  })
})
