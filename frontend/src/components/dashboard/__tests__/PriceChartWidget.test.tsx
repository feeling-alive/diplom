import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import PriceChartWidget from '../PriceChartWidget'

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('PriceChartWidget', () => {
  it('renders without crashing', () => {
    render(<PriceChartWidget />, { wrapper })
    // Should render the asset select element
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('renders 4 asset options in the selector', () => {
    render(<PriceChartWidget />, { wrapper })
    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(4)
    expect(options[0]).toHaveTextContent('BTC')
    expect(options[1]).toHaveTextContent('ETH')
    expect(options[2]).toHaveTextContent('AAPL')
    expect(options[3]).toHaveTextContent('EUR/USD')
  })

  it('renders 4 timeframe buttons', () => {
    render(<PriceChartWidget />, { wrapper })
    expect(screen.getByText('1Д')).toBeInTheDocument()
    expect(screen.getByText('1Н')).toBeInTheDocument()
    expect(screen.getByText('1М')).toBeInTheDocument()
    expect(screen.getByText('3М')).toBeInTheDocument()
  })

  it('initial active timeframe is "1Д"', () => {
    render(<PriceChartWidget />, { wrapper })
    const btn = screen.getByText('1Д')
    // Active button has ink background
    expect(btn).toHaveStyle({ background: 'var(--ink)' })
  })

  it('clicking a timeframe button changes the active one', () => {
    render(<PriceChartWidget />, { wrapper })
    const weekBtn = screen.getByText('1Н')
    fireEvent.click(weekBtn)
    expect(weekBtn).toHaveStyle({ background: 'var(--ink)' })
    // Previous active should no longer have ink background
    const dayBtn = screen.getByText('1Д')
    expect(dayBtn).toHaveStyle({ background: 'var(--bg)' })
  })
})
