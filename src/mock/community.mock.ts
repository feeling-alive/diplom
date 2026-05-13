import type { CommunityPost } from '../types/market.types'

export const MOCK_COMMUNITY: CommunityPost[] = [
  {
    id: 'c1',
    author: {
      name: 'Алекс Б.',
      handle: 'alex_btc',
      initials: 'AB',
      avatarColor: '#F7931A',
    },
    content:
      'BTC формирует бычий флаг на 4H таймфрейме. Жду пробоя $95,400 для входа в лонг...',
    relatedAsset: 'BTC',
    assetColor: '#F7931A',
    likes: 42,
    comments: 8,
    createdAt: '2026-05-13T09:00:00.000Z',
    isLiked: false,
  },
  {
    id: 'c2',
    author: {
      name: 'Алекс Б.',
      handle: 'alex_btc',
      initials: 'AB',
      avatarColor: '#F7931A',
    },
    content:
      'Накапливаю BTC на каждой коррекции. Долгосрочный тренд остаётся восходящим, несмотря на краткосрочный шум.',
    relatedAsset: 'BTC',
    assetColor: '#F7931A',
    likes: 31,
    comments: 5,
    createdAt: '2026-05-12T16:20:00.000Z',
    isLiked: false,
  },
  {
    id: 'c3',
    author: {
      name: 'ETH Трейдер',
      handle: 'eth_trader',
      initials: 'ET',
      avatarColor: '#627EEA',
    },
    content:
      'ETH/BTC пара показывает силу. Если обновление пройдёт успешно — ожидаю ротацию капитала в альткоины.',
    relatedAsset: 'ETH',
    assetColor: '#627EEA',
    likes: 28,
    comments: 12,
    createdAt: '2026-05-13T07:45:00.000Z',
    isLiked: false,
  },
  {
    id: 'c4',
    author: {
      name: 'ETH Трейдер',
      handle: 'eth_trader',
      initials: 'ET',
      avatarColor: '#627EEA',
    },
    content:
      'Уровень $3,500 — ключевое сопротивление для ETH. Пробой этой отметки откроет путь к $4,000.',
    relatedAsset: 'ETH',
    assetColor: '#627EEA',
    likes: 19,
    comments: 6,
    createdAt: '2026-05-12T11:30:00.000Z',
    isLiked: false,
  },
  {
    id: 'c5',
    author: {
      name: 'Stock Pro',
      handle: 'stock_pro',
      initials: 'SP',
      avatarColor: '#1A1A1A',
    },
    content:
      'Apple после отчёта — классический buy the rumor, sell the news? Или всё-таки обновим хаи перед летом?',
    relatedAsset: 'AAPL',
    assetColor: '#1A1A1A',
    likes: 15,
    comments: 9,
    createdAt: '2026-05-13T06:10:00.000Z',
    isLiked: false,
  },
  {
    id: 'c6',
    author: {
      name: 'Stock Pro',
      handle: 'stock_pro',
      initials: 'SP',
      avatarColor: '#1A1A1A',
    },
    content:
      'Microsoft — лучшая big-tech история этого года. Copilot монетизируется быстрее, чем ожидал рынок.',
    relatedAsset: 'MSFT',
    assetColor: '#00A4EF',
    likes: 37,
    comments: 14,
    createdAt: '2026-05-12T14:00:00.000Z',
    isLiked: false,
  },
  {
    id: 'c7',
    author: {
      name: 'FX Master',
      handle: 'fx_master',
      initials: 'FM',
      avatarColor: '#003399',
    },
    content:
      'EUR/USD тестирует уровень 1.0850. Если ФРС даст голубиный сигнал, пара может уйти к 1.1000 к концу квартала.',
    relatedAsset: 'EUR',
    assetColor: '#003399',
    likes: 22,
    comments: 7,
    createdAt: '2026-05-13T08:00:00.000Z',
    isLiked: false,
  },
  {
    id: 'c8',
    author: {
      name: 'Крипто Анна',
      handle: 'crypto_anna',
      initials: 'CA',
      avatarColor: '#9945FF',
    },
    content:
      'SOL breakout подтверждается объёмами! DeFi на Solana снова набирает обороты. Следующая цель — $200.',
    relatedAsset: 'SOL',
    assetColor: '#9945FF',
    likes: 54,
    comments: 21,
    createdAt: '2026-05-13T05:30:00.000Z',
    isLiked: false,
  },
]
