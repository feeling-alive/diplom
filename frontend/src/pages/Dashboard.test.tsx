import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Dashboard from './Dashboard'

vi.mock('framer-motion', () => ({
  motion: {
    div: (props: React.HTMLAttributes<HTMLDivElement>) =>
      <div {...props}>{props.children}</div>,
    button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) =>
      <button {...props}>{props.children}</button>,
    h3: (props: React.HTMLAttributes<HTMLHeadingElement>) =>
      <h3 {...props}>{props.children}</h3>,
    p: (props: React.HTMLAttributes<HTMLParagraphElement>) =>
      <p {...props}>{props.children}</p>,
    span: (props: React.HTMLAttributes<HTMLSpanElement>) =>
      <span {...props}>{props.children}</span>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('react-grid-layout/legacy', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  WidthProvider: <P extends object>(Comp: React.ComponentType<P>) => Comp,
}))

// Guest session → useDashboardConfig uses the localStorage source (no backend),
// so these tests exercise the localStorage seed/clear-all path synchronously.
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: null, isAuthenticated: false, isLoading: false,
    setUser: vi.fn(), updateUser: vi.fn(), logout: vi.fn(), refresh: vi.fn(),
  }),
}))

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <BrowserRouter>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </BrowserRouter>
  )
}

const ENVELOPE_KEY = 'fintrack_dashboards_v1'

describe('Dashboard', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('renders without crashing', () => {
    render(<Dashboard />, { wrapper })
  })

  it('has AddWidget button', () => {
    render(<Dashboard />, { wrapper })
    const addBtn = document.querySelector('[aria-label="Добавить виджет"]')
    expect(addBtn).toBeInTheDocument()
  })

  it('has Clear-all button (Задача 8)', () => {
    render(<Dashboard />, { wrapper })
    const clearBtn = document.querySelector('[aria-label="Очистить все виджеты"]')
    expect(clearBtn).toBeInTheDocument()
  })

  it('clear-all empties the dashboard and persists [] (Задача 8)', () => {
    // First mount seeds the 4 default widgets.
    const { rerender } = render(<Dashboard />, { wrapper })
    expect(document.querySelector('[aria-label="Очистить все виджеты"]')).toBeInTheDocument()

    // Confirm dialog → accept.
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    fireEvent.click(document.querySelector('[aria-label="Очистить все виджеты"]')!)

    // Empty state is shown and the cleared layout is persisted as [] (NOT reseeded):
    // the active dashboard in the envelope now has an empty widget array.
    expect(screen.getByText('Добавь свой первый виджет')).toBeInTheDocument()
    const env = JSON.parse(localStorage.getItem(ENVELOPE_KEY)!)
    const activeDash = env.dashboards.find((d: { id: string }) => d.id === env.activeId)
    expect(activeDash.layout).toEqual([])

    // Remount must respect the cleared state (defaults do NOT come back).
    rerender(<Dashboard />)
    expect(screen.getByText('Добавь свой первый виджет')).toBeInTheDocument()
  })
})
