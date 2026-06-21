import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Newspaper, TrendingUp } from 'lucide-react'
import type { ChatLinkCard as LinkCardData } from '../../hooks/useGroqChat'

// Clickable navigation card rendered inside the chat feed when the assistant uses
// a search_news / get_asset tool (bug #11.3). Click → react-router navigation.
// Accent #E11D48 per the app design system (.ai-factory/RULES.md).
export default function ChatLinkCard({ card }: { card: LinkCardData }) {
  const navigate = useNavigate()
  const isNews = card.type === 'news'
  const Icon = isNews ? Newspaper : TrendingUp

  return (
    <motion.button
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={() => {
        console.debug('[ChatLinkCard] navigate', card.type, card.href)
        navigate(card.href)
      }}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
        padding: '10px 12px', borderRadius: 12, textAlign: 'left',
        border: '1px solid var(--border)', background: 'var(--white)',
        cursor: 'pointer', fontFamily: 'var(--font)',
      }}
    >
      <span style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--accent-bg, #fce7ef)', color: 'var(--accent, #E11D48)',
      }}>
        <Icon size={16} />
      </span>
      <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{
          fontSize: 12, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.3,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {card.title}
        </span>
        {card.subtitle && (
          <span style={{
            fontSize: 11, color: 'var(--muted)', lineHeight: 1.3,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {card.subtitle}
          </span>
        )}
      </span>
    </motion.button>
  )
}
