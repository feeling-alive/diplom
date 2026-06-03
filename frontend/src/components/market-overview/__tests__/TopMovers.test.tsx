import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import TopMovers from '../TopMovers'

const navigateMock = vi.fn()

// usePrices теперь читает котировки через TanStack Query (Задача 2) → нужен провайдер.
// placeholderData=снимок отдаёт данные синхронно, поэтому строки рендерятся сразу.
function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

// Spread props so onClick/onKeyDown/role/tabIndex/aria-label pass through to the div.
vi.mock('framer-motion', () => ({
  motion: {
    div: (props: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{props.children}</div>,
  },
}))

vi.mock('react-router-dom', () => ({ useNavigate: () => navigateMock }))

describe('TopMovers — кликабельность лидеров (Задача 4)', () => {
  beforeEach(() => navigateMock.mockClear())

  it('клик по муверу ведёт на /asset/<symbol>', () => {
    renderWithQuery(<TopMovers filter="all" />)

    const rows = screen
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-label')?.startsWith('Открыть'))
    expect(rows.length).toBeGreaterThan(0)

    const symbol = rows[0]!.getAttribute('aria-label')!.replace('Открыть ', '')
    fireEvent.click(rows[0]!)

    expect(navigateMock).toHaveBeenCalledWith('/asset/' + encodeURIComponent(symbol))
  })

  it('Enter на муверe тоже навигирует', () => {
    renderWithQuery(<TopMovers filter="all" />)
    const row = screen
      .getAllByRole('button')
      .find((b) => b.getAttribute('aria-label')?.startsWith('Открыть'))!
    const symbol = row.getAttribute('aria-label')!.replace('Открыть ', '')
    fireEvent.keyDown(row, { key: 'Enter' })
    expect(navigateMock).toHaveBeenCalledWith('/asset/' + encodeURIComponent(symbol))
  })
})
