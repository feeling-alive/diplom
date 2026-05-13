# FinTrack — Project Rules

## Design system

Colors — use ONLY these variables, no new colors ever:
- accent: #E11D48
- accent-bg: #FFE5EC
- ink: #0F172A
- text: #1A1A1A
- muted: #64748B
- soft: #B8B6B0
- bg: #F4F3F1
- white: #FFFFFF
- border: #ECEAE3
- green: #22C55E
- red: #E11D48

Typography — Inter everywhere:
- Sizes: 48px hero, 22px h1, 16px h2, 13px body, 11px small, 9px label
- Weights: 800 hero, 700 numbers, 600 headings, 500 buttons, 400 text

Border radius — use only: 8px / 12px / 16px / 24px / 999px (pill)

Shadows:
- sm: 0 4px 14px rgba(0,0,0,0.06)
- md: 0 6px 18px rgba(0,0,0,0.08), 0 2px 6px -2px rgba(0,0,0,0.05)
- lg: 0 24px 60px -20px rgba(0,0,0,0.18), 0 8px 24px -8px rgba(0,0,0,0.08)

## Code requirements

- TypeScript strict — all props typed, no `any` ever
- Every hook accepts `useMock?: boolean = true`
- Every component renders empty state when data is missing
- Avatars: CSS circles with initials only, no external image URLs
- Icons: Lucide React only, no emoji in production code
- Framer Motion required for: page entrance, stagger cards, floating cards, hover effects

## Component rules

Price change display:
- Positive → color #22C55E
- Negative → color #E8264A
- Pills: background #FFE5EC, color #E8264A, border-radius 999px

Dark card (KpiStrip best position):
- background: #0D0D0D, color: white

Asset avatars: colored circle 28-32px, letter initial, 12px bold white

## Current priority — Dashboard only

This session covers Priority 1 (Dashboard) only.
Do not implement anything from Priority 2–7 until explicitly asked.

## PriceChartWidget rule

Before writing any code for PriceChartWidget:
1. Check 21dev MCP: "chart", "sparkline", "area chart", "finance"
2. Found → adapt to Asset + PricePoint[] and project colors
3. Not found → build custom SVG area chart per spec

## File structure

src/hooks/ — useAssetPrice, useOHLCV, useStockPrice, useForexRate, useNews, usePersonalized
src/types/ — market.types.ts only
src/mock/ — prices.mock.ts, news.mock.ts, community.mock.ts, ohlcv.mock.ts
src/components/dashboard/ — all dashboard components
src/pages/ — Dashboard.tsx

## Content naming

- Codename.com → FinTrack
- Sales list → Asset list
- Revenue → Portfolio value
- Best deal → Best position
- Armin / Mikasa / Eren → BTC / ETH / SOL
- Dribbble / Instagram / Behance / Google → BTC / ETH / AAPL / EUR-USD
- Sales dynamics → Market dynamics
- Seller → Asset
- Leads → Alerts
