import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import CommunityWidget from '../CommunityWidget'
import { MOCK_COMMUNITY } from '../../../mock/community.mock'

describe('CommunityWidget', () => {
  it('renders without crashing', () => {
    render(<CommunityWidget />)
    expect(screen.getByText('Идеи сообщества')).toBeInTheDocument()
  })

  it('shows exactly 3 posts by default', () => {
    render(<CommunityWidget />)
    // Default slice is posts 0,1,2. Posts 0+1 share author "AB" (alex_btc), post 2 is "ET".
    // Use getAllByText for initials that appear more than once.
    const abElements = screen.getAllByText('AB')
    expect(abElements).toHaveLength(2)
    expect(screen.getByText('ET')).toBeInTheDocument()
  })

  it('truncates content longer than 85 characters', () => {
    const longPost = {
      ...MOCK_COMMUNITY[0]!,
      id: 'test-long',
      content: 'A'.repeat(100),
    }
    render(<CommunityWidget posts={[longPost]} />)
    // Truncated content should end with "..."
    expect(screen.getByText('A'.repeat(85) + '...')).toBeInTheDocument()
  })

  it('does not truncate content within 85 characters', () => {
    const shortPost = {
      ...MOCK_COMMUNITY[0]!,
      id: 'test-short',
      content: 'Short text',
    }
    render(<CommunityWidget posts={[shortPost]} />)
    expect(screen.getByText('Short text')).toBeInTheDocument()
  })

  it('renders empty state when posts array is empty', () => {
    render(<CommunityWidget posts={[]} />)
    expect(screen.getByText('Нет публикаций')).toBeInTheDocument()
  })

  it('shows "Смотреть все →" link', () => {
    render(<CommunityWidget />)
    expect(screen.getByText('Смотреть все →')).toBeInTheDocument()
  })
})
