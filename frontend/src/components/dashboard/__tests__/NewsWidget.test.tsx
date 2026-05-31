import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import NewsWidget from '../NewsWidget'

describe('NewsWidget', () => {
  it('renders without crashing', () => {
    render(<NewsWidget />)
    expect(screen.getByText('Новости рынка')).toBeInTheDocument()
  })

  it('renders the four filter tabs', () => {
    render(<NewsWidget />)
    expect(screen.getByText('Всё')).toBeInTheDocument()
    expect(screen.getByText('Крипто')).toBeInTheDocument()
    expect(screen.getByText('Акции')).toBeInTheDocument()
    expect(screen.getByText('Форекс')).toBeInTheDocument()
  })

  it('shows news items on default "Всё" filter', () => {
    render(<NewsWidget />)
    // Default shows up to 4 items
    const items = screen.getAllByRole('paragraph')
    expect(items.length).toBeGreaterThan(0)
  })

  it('clicking "Крипто" filters to crypto-related news', () => {
    render(<NewsWidget />)
    const cryptoTab = screen.getByText('Крипто')
    fireEvent.click(cryptoTab)
    // Bitcoin headline should be present (crypto news)
    expect(
      screen.getByText('Bitcoin преодолел $94,000 на фоне институционального спроса'),
    ).toBeInTheDocument()
  })

  it('clicking "Акции" filters to stock-related news', () => {
    render(<NewsWidget />)
    fireEvent.click(screen.getByText('Акции'))
    // Apple headline should be present
    expect(
      screen.getByText('Apple отчёт Q4: выручка превысила прогнозы аналитиков на 4%'),
    ).toBeInTheDocument()
  })

  it('clicking "Форекс" filters to forex-related news', () => {
    render(<NewsWidget />)
    fireEvent.click(screen.getByText('Форекс'))
    // Forex headline should appear
    expect(
      screen.getByText('Инфляция в США снизилась до 2.4%: форекс волатильность растёт'),
    ).toBeInTheDocument()
  })
})
