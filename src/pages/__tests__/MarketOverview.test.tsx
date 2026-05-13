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
}))

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
