import React from 'react'
import { render } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
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

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <BrowserRouter>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </BrowserRouter>
  )
}

describe('Dashboard', () => {
  it('renders without crashing', () => {
    render(<Dashboard />, { wrapper })
  })

  it('has AddWidget button', () => {
    render(<Dashboard />, { wrapper })
    const addBtn = document.querySelector('[aria-label="Добавить виджет"]')
    expect(addBtn).toBeInTheDocument()
  })

  it('has Reset layout button', () => {
    render(<Dashboard />, { wrapper })
    const resetBtn = document.querySelector('[aria-label="Сбросить раскладку"]')
    expect(resetBtn).toBeInTheDocument()
  })
})
