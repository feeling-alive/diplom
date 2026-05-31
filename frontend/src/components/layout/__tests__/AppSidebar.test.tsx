import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import AppSidebar from '../AppSidebar'

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, style }: React.HTMLAttributes<HTMLDivElement>) =>
      <div style={style}>{children}</div>,
    span: ({ children, style }: React.HTMLAttributes<HTMLSpanElement>) =>
      <span style={style}>{children}</span>,
    button: ({ children, style, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) =>
      <button style={style} {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

describe('AppSidebar', () => {
  function renderWithRouter(ui: React.ReactElement) {
    return render(
      <BrowserRouter>
        {ui}
      </BrowserRouter>,
      { container: document.body }
    )
  }

  it('renders without crashing', () => {
    renderWithRouter(<AppSidebar />)
  })

  it('contains link to / dashboard', () => {
    renderWithRouter(<AppSidebar />)
    const link = screen.getByTestId('rail-link-dashboard')
    expect(link).toBeInTheDocument()
  })

  it('contains link to /market', () => {
    renderWithRouter(<AppSidebar />)
    const link = screen.getByTestId('rail-link-market')
    expect(link).toBeInTheDocument()
  })

  it('shows user avatar placeholder with text', () => {
    renderWithRouter(<AppSidebar />)
    const avatar = screen.getByTestId('user-avatar')
    expect(avatar).toBeInTheDocument()
  })

  it('has logout button', () => {
    renderWithRouter(<AppSidebar />)
    const logout = screen.getByTestId('sidebar-logout')
    expect(logout).toBeInTheDocument()
  })

  it('has settings button', () => {
    renderWithRouter(<AppSidebar />)
    const settings = screen.getByTestId('rail-settings')
    expect(settings).toBeInTheDocument()
  })
})
