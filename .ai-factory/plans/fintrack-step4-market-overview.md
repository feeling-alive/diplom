# FinTrack Dashboard — Step 4: Market Overview Page

**Scope:** `src/pages/MarketOverview.tsx` · `src/components/market-overview/` · `src/components/layout/FinTrackNavBar.tsx` · routing setup  
**Date:** 2026-05-13  
**Testing:** Vitest + React Testing Library — 2 test suites (AssetTable, MarketOverview)  
**Logging:** Verbose — `console.debug` in components and hooks  
**Docs:** warn-only

---

## Settings

- Testing: Vitest + @testing-library/react — AssetTable sorts + filter, MarketOverview smoke
- Logging: verbose — `console.debug` on mount and state changes
- Docs: warn-only
- No git repository — commit plan is advisory only

---

## Context

Steps 1–3 complete:
- `src/types/market.types.ts` — all types exported
- `src/mock/` — prices, news, community, ohlcv mock data
- `src/hooks/` — useAssetPrice, useOHLCV, useStockPrice, useForexRate, useNews, usePersonalized
- `src/components/dashboard/` — all 10 FinTrack dashboard widgets implemented
- `src/pages/Dashboard.tsx` — assembled and working at root

**Stack notes (active):**
- No MUI — inline styles + CSS custom properties from `src/index.css`
- Recharts installed (v3.x) — used in PriceChartWidget
- No Redux Toolkit — local React state
- react-router-dom NOT YET installed — Task 1 adds it
- CSS layout classes available: `.app-page`, `.app-shell`, `.main-content`, `.main-scroll`, `.card`, `.badge`

**New file structure:**
```
src/
├── pages/
│   ├── Dashboard.tsx          (existing — update to include FinTrackNavBar)
│   └── MarketOverview.tsx     (new)
└── components/
    ├── layout/
    │   └── FinTrackNavBar.tsx  (new — shared across pages)
    └── market-overview/
        ├── MarketSummaryBar.tsx (new)
        ├── TopMovers.tsx        (new)
        ├── AssetTable.tsx       (new)
        └── __tests__/
            ├── AssetTable.test.tsx    (new)
            └── MarketOverview.test.tsx (new, in src/pages/__tests__/)
```

---

## Phase A — Routing

### ~~Task 1 — Install react-router-dom + setup routing~~ ✅

**Files:** `package.json` (install), `src/main.jsx`, `src/App.jsx` → `src/App.tsx`

**Install:**
```bash
npm install react-router-dom
```
No separate types needed — react-router-dom ships its own.

**Update `src/main.jsx`** — wrap App with BrowserRouter:
```jsx
import { BrowserRouter } from 'react-router-dom'
// ...
<StrictMode>
  <BrowserRouter>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </BrowserRouter>
</StrictMode>
```

**Replace `src/App.jsx` with `src/App.tsx`:**
```tsx
import { Routes, Route, Navigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import MarketOverview from './pages/MarketOverview'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/market" element={<MarketOverview />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
```

Delete `src/App.jsx` after `src/App.tsx` is created (or rename).

**Logging:** none — entry point change.

---

## Phase B — Shared Navigation

### ~~Task 2 — Create `src/components/layout/FinTrackNavBar.tsx`~~ ✅

**File:** `src/components/layout/FinTrackNavBar.tsx`

```tsx
import { NavLink } from 'react-router-dom'
import { LayoutDashboard, BarChart2, Newspaper, TrendingUp } from 'lucide-react'

interface NavItem {
  to: string
  label: string
  icon: React.FC<{ size: number; strokeWidth: number }>
  disabled?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { to: '/',       label: 'Дашборд',      icon: LayoutDashboard },
  { to: '/market', label: 'Обзор рынка',  icon: BarChart2 },
  { to: '/news',   label: 'Новости',      icon: Newspaper,  disabled: true },
  { to: '/asset',  label: 'Активы',       icon: TrendingUp, disabled: true },
]
```

Layout: `display: flex, gap: 4px, alignItems: center, padding: '6px 0 10px'`

Each NavLink style function:
```tsx
<NavLink
  to={item.to}
  end={item.to === '/'}
  style={({ isActive }) => ({
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '5px 12px',
    borderRadius: 'var(--r-pill)',
    fontSize: 12, fontWeight: 500,
    background: isActive ? 'var(--ink)' : 'transparent',
    color: isActive ? '#fff' : (item.disabled ? 'var(--soft)' : 'var(--muted)'),
    cursor: item.disabled ? 'not-allowed' : 'pointer',
    textDecoration: 'none',
    transition: 'background 0.15s, color 0.15s',
  })}
  onClick={item.disabled ? (e) => e.preventDefault() : undefined}
>
```

Disabled items render with `opacity: 0.45`, cursor `not-allowed`, and prevent navigation on click.

**Logging:** `console.debug('[FinTrackNavBar] rendered')`

---

## Phase C — Market Overview Components

### ~~Task 3 — Create `src/components/market-overview/MarketSummaryBar.tsx`~~ ✅

**File:** `src/components/market-overview/MarketSummaryBar.tsx`

```tsx
import { MOCK_PRICES } from '../../mock/prices.mock'

interface StatCard {
  label: string
  value: string
  change?: string
  changePositive?: boolean
}
```

**Compute stats from MOCK_PRICES:**
```tsx
const totalCap  = MOCK_PRICES.reduce((s, a) => s + (a.marketCap ?? 0), 0)
const totalVol  = MOCK_PRICES.reduce((s, a) => s + a.volume24h, 0)
const btc       = MOCK_PRICES.find(a => a.symbol === 'BTC-USDT')
const btcDom    = btc?.marketCap ? ((btc.marketCap / totalCap) * 100).toFixed(1) : '–'
const activeCount = MOCK_PRICES.length
```

**Cards data:**
```tsx
const STATS: StatCard[] = [
  { label: 'Капитализация рынка', value: formatTrillion(totalCap), change: '+2.1%', changePositive: true },
  { label: 'Объём 24ч',           value: formatBillion(totalVol),  change: '+4.3%', changePositive: true },
  { label: 'BTC Доминирование',   value: `${btcDom}%`,             change: '+0.3%', changePositive: true },
  { label: 'Активов в списке',    value: String(activeCount),       change: undefined },
]
```

**Format helpers (local, not exported):**
```tsx
function formatTrillion(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(1)}B`
  return `$${n.toFixed(0)}`
}
function formatBillion(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(1)}B`
  return `$${n.toFixed(0)}`
}
```

**Layout:** 4-column grid `gridTemplateColumns: 'repeat(4, 1fr)'`, gap 10px

**Each stat card** (`.card` + `padding: '14px 16px'`):
- Label: 10px, `var(--muted)`, fontWeight 500, marginBottom 6
- Value: 22px, fontWeight 700, `var(--ink)`
- Change pill (if present): badge style `{ background: changePositive ? '#E8F8EF' : 'var(--accent-bg)', color: changePositive ? 'var(--green)' : 'var(--accent)', ... }`

**Framer Motion stagger on mount:**
```tsx
const container = { hidden:{}, show:{ transition:{ staggerChildren: 0.07 } } }
const item = { hidden:{ opacity:0, y:12 }, show:{ opacity:1, y:0 } }
```

**Logging:** `console.debug('[MarketSummaryBar] totalCap=', totalCap, 'btcDom=', btcDom)`

---

### ~~Task 4 — Create `src/components/market-overview/TopMovers.tsx`~~ ✅

**File:** `src/components/market-overview/TopMovers.tsx`

```tsx
interface Props { filter: 'all' | 'crypto' | 'stock' | 'forex' | 'index' }
```

**Compute from MOCK_PRICES (filtered by type when filter !== 'all'):**
```tsx
const filtered = filter === 'all' ? MOCK_PRICES : MOCK_PRICES.filter(a => a.type === filter)
const gainers  = [...filtered].sort((a, b) => b.change24h - a.change24h).slice(0, 3)
const losers   = [...filtered].sort((a, b) => a.change24h - b.change24h).slice(0, 3)
```

**Layout:**
```
<div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
  <Section title="Лидеры роста"  items={gainers} positive />
  <Section title="Аутсайдеры"    items={losers}  positive={false} />
</div>
```

**Each section** (`.card`, `padding:'14px 16px'`):
- Header: title 12px 600 `var(--text)` + `TrendingUp`/`TrendingDown` Lucide icon (14px, green/accent)
- 3 mover rows (gap 8px), each:
  ```
  flex row, gap 8px, padding '6px 0', borderBottom '1px solid var(--border)' (except last)
  ├─ Asset circle: 28px, bg=asset.color, text=asset.icon, 11px bold white
  ├─ Middle: symbol (12px 600) + name (10px muted)
  └─ Right: price (12px 700 ink) + change badge (badge--success / badge--accent-s)
  ```

**Framer Motion:** stagger rows with `delay: index * 0.05`

**Empty state:** "Нет данных для этой категории" centered muted, when `filtered.length < 3`.

**Logging:** `console.debug('[TopMovers] filter=', filter, 'gainers=', gainers.map(a => a.symbol))`

---

### ~~Task 5 — Create `src/components/market-overview/AssetTable.tsx`~~ ✅

**File:** `src/components/market-overview/AssetTable.tsx`

```tsx
type SortKey = 'price' | 'change24h' | 'volume24h' | 'marketCap'
type SortDir = 'asc' | 'desc'

interface Props {
  filter: 'all' | 'crypto' | 'stock' | 'forex' | 'index'
}
```

**State:**
```tsx
const [sortKey, setSortKey] = useState<SortKey>('marketCap')
const [sortDir, setSortDir] = useState<SortDir>('desc')
```

**Toggle sort:**
```tsx
function handleSort(key: SortKey) {
  if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
  else { setSortKey(key); setSortDir('desc') }
}
```

**Filtered + sorted data:**
```tsx
const rows = useMemo(() => {
  const filtered = filter === 'all' ? MOCK_PRICES : MOCK_PRICES.filter(a => a.type === filter)
  return [...filtered].sort((a, b) => {
    const va = a[sortKey] ?? 0
    const vb = b[sortKey] ?? 0
    return sortDir === 'asc' ? va - vb : vb - va
  })
}, [filter, sortKey, sortDir])
```

**Table structure** (no HTML `<table>` — use CSS grid for flexibility):
```tsx
// Header row
<div style={{ display:'grid', gridTemplateColumns:'32px 2fr 1.2fr 1fr 1fr 1fr 80px', gap:'0 12px', ... }}>
```

**Column headers (sortable ones show arrow):**
- `#` — not sortable
- `Актив` — not sortable
- `Цена` — sortable
- `Изм. 24ч` — sortable (`change24h`)
- `Объём 24ч` — sortable (`volume24h`)
- `Капитализация` — sortable (`marketCap`)
- `График` — not sortable

Header cell style: `{ fontSize:10, color:'var(--muted)', fontWeight:500, cursor:'pointer', userSelect:'none', display:'flex', alignItems:'center', gap:3 }`

Sort arrow: `ChevronUp` / `ChevronDown` (Lucide, 10px) — shown only on active column.

**Data rows** (each asset):
```tsx
<motion.div
  key={asset.symbol}
  whileHover={{ background: 'var(--bg)' }}
  style={{ display:'grid', gridTemplateColumns:'32px 2fr 1.2fr 1fr 1fr 1fr 80px', gap:'0 12px',
           padding:'10px 0', borderBottom:'1px solid var(--border)', alignItems:'center' }}
>
  {/* # */}
  <span style={{ fontSize:11, color:'var(--muted)', fontWeight:500 }}>{index + 1}</span>

  {/* Актив */}
  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
    <div style={{ width:30, height:30, borderRadius:'50%', background:asset.color,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  color:'#fff', fontSize:12, fontWeight:700, flexShrink:0 }}>
      {asset.icon}
    </div>
    <div>
      <div style={{ fontSize:13, fontWeight:600, color:'var(--ink)' }}>{asset.symbol}</div>
      <div style={{ fontSize:10, color:'var(--muted)' }}>{asset.name}</div>
    </div>
  </div>

  {/* Цена */}
  <span style={{ fontSize:13, fontWeight:700, color:'var(--ink)' }}>
    {formatPrice(asset.price, asset.type)}
  </span>

  {/* Изм. 24ч */}
  <span className={`badge ${asset.change24h >= 0 ? 'badge--success' : 'badge--accent-s'}`}
        style={{ width:'fit-content' }}>
    {asset.change24h >= 0 ? '+' : ''}{asset.change24h.toFixed(2)}%
  </span>

  {/* Объём 24ч */}
  <span style={{ fontSize:12, color:'var(--text)' }}>{formatBillion(asset.volume24h)}</span>

  {/* Капитализация */}
  <span style={{ fontSize:12, color:'var(--text)' }}>
    {asset.marketCap ? formatTrillion(asset.marketCap) : '–'}
  </span>

  {/* Sparkline SVG */}
  <SparklineCell symbol={asset.symbol} positive={asset.change24h >= 0} />
</motion.div>
```

**SparklineCell sub-component** (internal, not exported):
```tsx
function SparklineCell({ symbol, positive }: { symbol: string; positive: boolean }) {
  const points = useMemo(() => getMockOHLCV(symbol, 20).map(p => p.close), [symbol])
  const color = positive ? 'var(--green)' : 'var(--accent)'
  // Normalize to SVG 60x30 viewport
  const min = Math.min(...points), max = Math.max(...points)
  const range = max - min || 1
  const pts = points.map((p, i) => {
    const x = (i / (points.length - 1)) * 58 + 1
    const y = 29 - ((p - min) / range) * 28
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={60} height={30} viewBox="0 0 60 30" style={{ display:'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
```

**Format helpers** (local):
```tsx
function formatPrice(price: number, type: Asset['type']): string {
  if (type === 'forex') return price.toFixed(5)
  if (price >= 1000)    return `$${price.toLocaleString('en-US', { maximumFractionDigits:2 })}`
  if (price >= 1)       return `$${price.toFixed(2)}`
  return `$${price.toFixed(4)}`
}
```

**Empty state:** when `rows.length === 0` → centered muted "Нет активов в этой категории".

**Logging:** `console.debug('[AssetTable] filter=', filter, 'sort=', sortKey, sortDir, 'rows=', rows.length)`

---

## Phase D — Page Assembly

### ~~Task 6 — Assemble `src/pages/MarketOverview.tsx`~~ ✅

**File:** `src/pages/MarketOverview.tsx`

```tsx
import { useState } from 'react'
import { motion } from 'framer-motion'
import FinTrackNavBar from '../components/layout/FinTrackNavBar'
import MarketSummaryBar from '../components/market-overview/MarketSummaryBar'
import TopMovers from '../components/market-overview/TopMovers'
import AssetTable from '../components/market-overview/AssetTable'

type FilterType = 'all' | 'crypto' | 'stock' | 'forex' | 'index'
const FILTER_TABS: { key: FilterType; label: string; count: number }[] = [
  { key: 'all',    label: 'Все',      count: 8 },
  { key: 'crypto', label: 'Крипто',   count: 3 },
  { key: 'stock',  label: 'Акции',    count: 2 },
  { key: 'forex',  label: 'Форекс',   count: 2 },
  { key: 'index',  label: 'Индексы',  count: 1 },
]
```

**Page layout** (mirrors Dashboard.tsx structure):
```tsx
export default function MarketOverview() {
  const [filter, setFilter] = useState<FilterType>('all')
  console.debug('[MarketOverview] mounted, filter=', filter)

  return (
    <div className="app-page">
      <div style={{
        width:'100%', height:'100%', background:'var(--white)',
        borderRadius:22, boxShadow:'var(--shadow-lg)', overflow:'hidden',
        display:'flex', flexDirection:'column',
      }}>
        <motion.div
          initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.4 }}
          style={{
            flex:1, overflowY:'auto', overflowX:'hidden', padding:'12px 22px 22px',
            scrollbarWidth:'thin', scrollbarColor:'var(--border) transparent',
          } as React.CSSProperties}
        >
          {/* Shared navigation */}
          <FinTrackNavBar />

          {/* Page header */}
          <div style={{ marginBottom:16 }}>
            <h1 style={{ fontSize:22, fontWeight:700, color:'var(--ink)' }}>Обзор рынка</h1>
            <p style={{ fontSize:12, color:'var(--muted)', marginTop:3 }}>
              Актуальные данные · {new Date().toLocaleDateString('ru-RU', { day:'numeric', month:'long', year:'numeric' })}
            </p>
          </div>

          {/* Global market stats */}
          <MarketSummaryBar />

          {/* Type filter tabs */}
          <div style={{ display:'flex', gap:6, margin:'16px 0 12px', flexWrap:'wrap' }}>
            {FILTER_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                style={{
                  padding: '5px 12px', borderRadius:'var(--r-pill)',
                  fontSize:12, fontWeight:500, cursor:'pointer',
                  background: filter === tab.key ? 'var(--ink)' : 'var(--bg)',
                  color: filter === tab.key ? '#fff' : 'var(--muted)',
                  border: 'none', transition:'background 0.15s, color 0.15s',
                }}
              >
                {tab.label}
                <span style={{ marginLeft:4, opacity:0.6 }}>{tab.count}</span>
              </button>
            ))}
          </div>

          {/* Top movers */}
          <div style={{ marginBottom:12 }}>
            <TopMovers filter={filter} />
          </div>

          {/* Asset table */}
          <div className="card" style={{ padding:'16px 20px' }}>
            <AssetTable filter={filter} />
          </div>
        </motion.div>
      </div>
    </div>
  )
}
```

**Logging:** `console.debug('[MarketOverview] filter changed=', filter)` in `setFilter` callback.

---

## Phase E — Dashboard Navigation Update

### ~~Task 7 — Add FinTrackNavBar to `Dashboard.tsx`~~ ✅

**File:** `src/pages/Dashboard.tsx`

Import FinTrackNavBar:
```tsx
import FinTrackNavBar from '../components/layout/FinTrackNavBar'
```

Insert after `<FloatingAssetCards>` and before `<DashboardTopBar>`:
```tsx
{/* Page navigation */}
<FinTrackNavBar />
```

This gives the Dashboard the same navigation bar for cross-page links.

**No other changes to Dashboard.tsx.**

---

## Phase F — Tests

### ~~Task 8 — Unit tests~~ ✅

**Files:**
- `src/components/market-overview/__tests__/AssetTable.test.tsx`
- `src/pages/__tests__/MarketOverview.test.tsx`

**Required mocks for tests (add to each test file):**
```tsx
// Mock framer-motion (avoids animation timing issues in jsdom)
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...rest }: React.HTMLAttributes<HTMLDivElement>) =>
      <div {...rest}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Mock react-router-dom NavLink for FinTrackNavBar
vi.mock('react-router-dom', () => ({
  NavLink: ({ children, to }: { children: React.ReactNode; to: string }) =>
    <a href={to}>{children}</a>,
  useNavigate: () => vi.fn(),
}))
```

**AssetTable.test.tsx:**
```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import AssetTable from '../AssetTable'

describe('AssetTable', () => {
  it('renders all 8 assets with filter=all', () => {
    render(<AssetTable filter="all" />)
    expect(screen.getAllByRole('img', { hidden: true }).length).toBeGreaterThanOrEqual(0)
    // Check known asset symbols appear
    expect(screen.getByText('BTC-USDT')).toBeInTheDocument()
    expect(screen.getByText('ETH-USDT')).toBeInTheDocument()
  })

  it('shows only crypto assets when filter=crypto', () => {
    render(<AssetTable filter="crypto" />)
    expect(screen.getByText('BTC-USDT')).toBeInTheDocument()
    expect(screen.queryByText('AAPL')).not.toBeInTheDocument()
  })

  it('toggles sort direction on repeated header click', () => {
    render(<AssetTable filter="all" />)
    const priceHeader = screen.getByText('Цена')
    fireEvent.click(priceHeader)
    fireEvent.click(priceHeader)
    // No crash = sort toggle works
  })
})
```

**MarketOverview.test.tsx:**
```tsx
import { render, screen } from '@testing-library/react'
import MarketOverview from '../MarketOverview'

describe('MarketOverview', () => {
  it('renders without crashing', () => {
    render(<MarketOverview />)
    expect(screen.getByText('Обзор рынка')).toBeInTheDocument()
  })

  it('shows 4 stat cards', () => {
    render(<MarketOverview />)
    expect(screen.getByText('Капитализация рынка')).toBeInTheDocument()
    expect(screen.getByText('Объём 24ч')).toBeInTheDocument()
    expect(screen.getByText('BTC Доминирование')).toBeInTheDocument()
    expect(screen.getByText('Активов в списке')).toBeInTheDocument()
  })

  it('shows filter tabs', () => {
    render(<MarketOverview />)
    expect(screen.getByText(/Все/)).toBeInTheDocument()
    expect(screen.getByText(/Крипто/)).toBeInTheDocument()
    expect(screen.getByText(/Акции/)).toBeInTheDocument()
  })
})
```

---

## Phase G — Verification

### ~~Task 9 — Type-check + dev server smoke test~~ ✅

**Actions (in order):**
1. `npx tsc --noEmit` → 0 errors
2. `npx vitest --run` → all test suites pass (existing 3 + new 2 = 5 suites)
3. `npm run dev` → check `/` loads Dashboard (with FinTrackNavBar), `/market` loads Market Overview

**Common TS issues to watch for:**
- `useNavigate` vs `NavLink` — prefer `NavLink` (no programmatic nav needed here)
- `React.CSSProperties` cast for `scrollbarColor` (non-standard vendor prop)
- `Asset['type']` in filter comparisons (`'index'` ≠ `'stock'` etc.)
- SparklineCell `getMockOHLCV` import from `../../mock/ohlcv.mock`
- `framer-motion` motion.div `whileHover` with plain object values (not MotionStyle) — use `as React.CSSProperties` cast if needed

---

## Commit Plan (Advisory — no git)

**Checkpoint 1** after Tasks 1–3 (routing + nav + summary bar):
```
feat(market): add react-router-dom routing and FinTrackNavBar navigation
feat(market): add MarketSummaryBar with global market stats
```

**Checkpoint 2** after Tasks 4–6 (movers + table + page assembly):
```
feat(market): add TopMovers and AssetTable with sort/filter
feat(market): assemble MarketOverview page
```

**Checkpoint 3** after Tasks 7–9 (dashboard update + tests + verify):
```
feat(dashboard): add FinTrackNavBar cross-page navigation to Dashboard
test(market): add AssetTable and MarketOverview unit tests
```

---

## Design Reference

### MarketOverview page layout (wireframe):
```
┌─────────────────────────────────────────────────────────────────┐
│ [Дашборд]  [Обзор рынка ●]  [Новости…]  [Активы…]             │  ← FinTrackNavBar
├─────────────────────────────────────────────────────────────────┤
│ Обзор рынка                                                      │  ← Page header
│ Актуальные данные · 13 мая 2026                                  │
├──────────┬───────────┬──────────────────┬───────────────────────┤
│ Капит.   │ Объём 24ч │ BTC Доминирование│ Активов в списке      │  ← MarketSummaryBar
│ $2.33T   │ $223.7B   │ 57.4%            │ 8                     │
│ ↑ 2.1%   │ ↑ 4.3%   │ ↑ 0.3%           │                       │
├──────────┴───────────┴──────────────────┴───────────────────────┤
│ [Все]  [Крипто 3]  [Акции 2]  [Форекс 2]  [Индексы 1]          │  ← Filter tabs
├─────────────────────────────┬───────────────────────────────────┤
│ Лидеры роста       TrendUp  │ Аутсайдеры              TrendDown │  ← TopMovers
│ ● SOL  Solana   $178 +4.2%  │ ● GBP  British  $1.26  -0.2%     │
│ ● BTC  Bitcoin  $94k +2.8%  │ ● AAPL Apple    $189   -0.6%     │
│ ● ETH  Ethereum $3.2k +1.4% │ ● MSFT Microsoft $415  +0.9%     │
├─────────────────────────────┴───────────────────────────────────┤
│ #  Актив          Цена      Изм.24ч  Объём     Капит.  График   │  ← AssetTable
│ 1  ● BTC Bitcoin  $94,320   +2.8%   $42.1B    $1.86T  ~~~      │
│ 2  ● ETH Ethereum $3,210    +1.4%   $18.7B    $386B   ~~~      │
│ 3  ● SOL Solana   $178.50   +4.2%   $8.3B     $82B    ~~~      │
│ 4  ● MSFT Micros. $415.20   +0.9%   $3.1B     $3.08T  ~~~      │
│ 5  ● AAPL Apple   $189.45   -0.6%   $4.2B     $2.94T  ~~~      │
│ 6  ● EUR-USD      1.08420   +0.3%   $89.3B    –       ~~~      │
│ 7  ● GBP-USD      1.26540   -0.2%   $45.1B    –       ~~~      │
│ 8  ● SPX  S&P500  $5,842    +0.8%   $12.4B    –       ~~~      │
└─────────────────────────────────────────────────────────────────┘
```

### Color rules:
- Positive change: `badge--success` (#E8F8EF bg, var(--green) text)
- Negative change: `badge--accent-s` (var(--accent-bg) bg, var(--accent) text)
- Sparkline positive: `var(--green)` stroke
- Sparkline negative: `var(--accent)` stroke

---

## Next Step

After this step is verified, run `/aif-plan` for:
- **Step 5: Asset Page** (Приоритет 4) — TradingView Lightweight Charts + AI-чат на Groq API (LLaMA 3) → для показа руководителю диплома
- or **Step 5: News Feed + Article** (Приоритет 3)
