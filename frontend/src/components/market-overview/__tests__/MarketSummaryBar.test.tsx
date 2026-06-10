import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import MarketSummaryBar from '../MarketSummaryBar'

const navigateMock = vi.fn()

vi.mock('framer-motion', () => ({
  motion: {
    div: (props: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{props.children}</div>,
  },
}))

vi.mock('react-router-dom', () => ({ useNavigate: () => navigateMock }))

vi.mock('../../../hooks/usePrices', () => {
  type T = 'crypto' | 'stock' | 'forex'
  const mk = (symbol: string, name: string, type: T, price: number, change24h: number) => ({
    symbol, name, type, price, change24h,
    volume24h: 1_000_000_000, marketCap: 100_000_000_000,
    high24h: price * 1.05, low24h: price * 0.95, color: '#888888', icon: symbol[0],
  })
  const cryptos = [mk('BTC-USDT', 'Bitcoin', 'crypto', 94000, 1.2), mk('ETH-USDT', 'Ethereum', 'crypto', 3200, -0.5)]
  const stocks = [mk('AAPL', 'Apple', 'stock', 225, 0.8)]
  const forex = [mk('EUR-USD', 'Euro', 'forex', 1.08, 0.1)]
  const all = [...cryptos, ...stocks, ...forex]
  const bySymbol = Object.fromEntries(all.map((a) => [a.symbol, a]))
  return { usePrices: () => ({ all, cryptos, stocks, forex, bySymbol, isLoading: false, lastUpdated: Date.now() }) }
})

describe('MarketSummaryBar — интерактивные карточки (Задача 5)', () => {
  beforeEach(() => navigateMock.mockClear())

  it('клик по «BTC Доминирование» ведёт на /asset/BTC-USDT', () => {
    render(<MarketSummaryBar />)
    fireEvent.click(screen.getByText('BTC Доминирование'))
    expect(navigateMock).toHaveBeenCalledWith('/asset/BTC-USDT')
  })

  it('клик по «Капитализация рынка» открывает поповер с описанием (без навигации)', () => {
    render(<MarketSummaryBar />)
    expect(screen.queryByText(/Суммарная рыночная капитализация/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Капитализация рынка'))
    expect(screen.getByText(/Суммарная рыночная капитализация/)).toBeInTheDocument()
    expect(navigateMock).not.toHaveBeenCalled()
  })
})
