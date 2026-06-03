import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import TopMovers from '../TopMovers'

const navigateMock = vi.fn()

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
    render(<TopMovers filter="all" />)

    const rows = screen
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-label')?.startsWith('Открыть'))
    expect(rows.length).toBeGreaterThan(0)

    const symbol = rows[0]!.getAttribute('aria-label')!.replace('Открыть ', '')
    fireEvent.click(rows[0]!)

    expect(navigateMock).toHaveBeenCalledWith('/asset/' + encodeURIComponent(symbol))
  })

  it('Enter на муверe тоже навигирует', () => {
    render(<TopMovers filter="all" />)
    const row = screen
      .getAllByRole('button')
      .find((b) => b.getAttribute('aria-label')?.startsWith('Открыть'))!
    const symbol = row.getAttribute('aria-label')!.replace('Открыть ', '')
    fireEvent.keyDown(row, { key: 'Enter' })
    expect(navigateMock).toHaveBeenCalledWith('/asset/' + encodeURIComponent(symbol))
  })
})
