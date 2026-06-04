import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import NewsWidget from '../NewsWidget'

vi.mock('../../../hooks/useNews', () => ({
  useNews: () => ({ data: { pages: [{ articles: [], total: 0, page: 1, has_more: false }] } }),
  useNewsFavorites: () => ({ data: { articles: [] } }),
}))

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}))

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('NewsWidget', () => {
  it('renders without crashing', () => {
    render(<NewsWidget />, { wrapper: Wrapper })
    expect(screen.getByText('Новости рынка')).toBeInTheDocument()
  })

  it('shows loading state when no articles', () => {
    render(<NewsWidget />, { wrapper: Wrapper })
    expect(screen.getByText('Загрузка...')).toBeInTheDocument()
  })
})
