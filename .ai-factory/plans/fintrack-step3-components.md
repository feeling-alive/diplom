# FinTrack Dashboard — Step 3: Components + Dashboard Assembly

**Scope:** `src/components/dashboard/` · `src/pages/Dashboard.tsx` · `src/App.jsx` update  
**Date:** 2026-05-13  
**Testing:** Unit tests (Vitest + React Testing Library) + `tsc --noEmit`  
**Logging:** Verbose — `console.debug` in hooks and component mount  
**Docs:** warn-only

---

## Settings

- Testing: Vitest + @testing-library/react — 3 component test suites (CommunityWidget, NewsWidget, PriceChartWidget)
- Logging: verbose — console.debug on component render where state changes occur
- Docs: warn-only
- No git repository — commit plan is advisory only

---

## Context

Steps 1–3 complete (combined as Plan Step 2):
- `src/types/market.types.ts` — all types exported
- `src/mock/` — prices, news, community, ohlcv mock data
- `src/hooks/` — useAssetPrice, useOHLCV, useStockPrice, useForexRate, useNews, usePersonalized
- Design tokens in `src/index.css`
- Installed: framer-motion, @tanstack/react-query, lucide-react, recharts, @dnd-kit

**Important stack notes (differ from original prompt):**
- **No MUI** — using inline styles + CSS custom properties from `index.css`
- **Recharts** (installed) replaces custom SVG area chart for PriceChartWidget
- **@dnd-kit** (installed) replaces react-grid-layout (used in future Priority 3 drag-and-drop)
- **No Redux Toolkit** — React state + usePersonalized hook (volume24h proxy)

Existing `.jsx` components (Codename.com template) stay untouched. New FinTrack components are `.tsx`.

---

## Phase A — Foundation

### ~~Task 1 — App integration: QueryClient + Dashboard route~~ ✅

**Files:** `src/main.jsx`, `src/App.jsx`

Update `src/main.jsx` to wrap App with `QueryClientProvider`:
```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
const queryClient = new QueryClient()
// wrap <App /> with <QueryClientProvider client={queryClient}>
```

Update `src/App.jsx` to render the new Dashboard page:
```jsx
import Dashboard from './pages/Dashboard'
// Replace old Codename layout with: <Dashboard />
// Keep old components importable but don't render them
```

**Logging:** none needed — entry point change.

---

## Phase B — Floating + Hero Row

### ~~Task 2 — FloatingAssetCards.tsx~~ ✅

**File:** `src/components/dashboard/FloatingAssetCards.tsx`

```tsx
interface Props { assets?: Asset[] }
export default function FloatingAssetCards({ assets }: Props)
```

Layout: `display: flex, gap: 10px, overflowX: auto, padding: 0 0 4px`

Each card (`whiteCard` style): white bg, border `1px solid var(--border)`, border-radius 14px, box-shadow `var(--shadow-sm)`, padding 10px 14px.

**Framer Motion — entry (staggerChildren):**
```tsx
const container = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } }
const item = { hidden: { opacity: 0, y: -15 }, show: { opacity: 1, y: 0 } }
<motion.div variants={container} initial="hidden" animate="show">
  {assets.map((a, i) => (
    <motion.div key={a.symbol} variants={item}>
      <FloatCard asset={a} floatDelay={i * 0.8} />
    </motion.div>
  ))}
</motion.div>
```

**Framer Motion — persistent float per card:**
```tsx
<motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 4, ease: 'easeInOut', repeat: Infinity, delay: floatDelay }}>
```

Card content:
- Colored circle 28px: `{ width:28, height:28, borderRadius:'50%', background:asset.color, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:12, fontWeight:700 }` → shows `asset.icon`
- Name: 13px, fontWeight 600, color `var(--text)`
- Price: 12px, fontWeight 700, color `var(--ink)`
- Change: 10px, color `asset.change24h >= 0 ? 'var(--green)' : 'var(--accent)'`

"+" add button after cards: circle 36px, border `1px dashed var(--border)`, color `var(--muted)`.

Data: `usePersonalized()` — default to `MOCK_PRICES.slice(0,4)` when empty.

**Logging:** `console.debug('[FloatingAssetCards] rendering', assets.length, 'cards')`

---

### ~~Task 3 — PortfolioHero.tsx~~ ✅

**File:** `src/components/dashboard/PortfolioHero.tsx`

Layout: `display: flex, justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 0 16px'`

**Left side:**
- Label: "Стоимость портфеля" — 12px, `var(--muted)`
- Count-up value: useEffect animating from 0 → 528976.82 over 1500ms (RAF-based, easing: `t => 1-(1-t)**3`)
  - Format: `$528,976.82` — 48px, fontWeight 800, color `var(--ink)`
- Pill row (gap 8px):
  - Pill 1 "↑ 7.9%": `background: var(--accent-bg), color: var(--accent), borderRadius: var(--r-pill), padding: '4px 10px', fontSize: 12, fontWeight: 600`
  - Pill 2 "+$27,335.09": same style but `border: 1px solid var(--accent)`, transparent bg
- Caption: "к пред. $501,641.73 · 1 июн – 31 авг 2025" — 12px, `var(--muted)`

**Right side:**
- "Период" label + toggle (HTML `<input type="checkbox">` styled as slider, CSS class `toggle-switch`)
- Date range display: "1 сен – 30 ноя 2025" — select element, muted style

**Logging:** `console.debug('[PortfolioHero] countUp complete, value=528976.82')`

---

## Phase C — KPI + Asset Row

### ~~Task 4 — KpiStrip.tsx~~ ✅

**File:** `src/components/dashboard/KpiStrip.tsx`

Layout: `display: grid, gridTemplateColumns: 'repeat(6, 1fr)', gap: 10px`

Cards 1,3,4,5 (white): `background: var(--white), border: 1px solid var(--border), borderRadius: 14px, padding: '14px 16px'`

**Card 1 — "Топ актив":**
- Label "Топ актив" 10px muted
- Row: BTC circle + "Bitcoin" 13px 600 + "↗" icon (Lucide TrendingUp 14px green)

**Card 2 — "Лучшая позиция" (DARK):**
- `background: var(--ink), color: '#fff', borderRadius: 14px, padding: '14px 16px'`
- Star icon (Lucide Star, 14px, `color: '#FBBF24'`)
- Asset name + amount
- Arrow button: white circle 28px, `{ background:'#fff', color: 'var(--ink)' }`

**Cards 3,4,5:** Pull from `MOCK_PRICES[0..2]`: symbol, price, %change badge.

**Button "Подробнее" (slot 6):**
- `background: var(--ink), color: '#fff', borderRadius: 14px, width:'100%', height:'100%', minHeight:80`
- `<motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}>`

**Framer Motion stagger on mount:**
```tsx
const container = { hidden:{}, show:{ transition:{ staggerChildren:0.08 } } }
const card = { hidden:{ opacity:0, y:20 }, show:{ opacity:1, y:0 } }
```

**Logging:** `console.debug('[KpiStrip] rendered with', MOCK_PRICES.length, 'assets')`

---

### ~~Task 5 — AssetStrip.tsx~~ ✅

**File:** `src/components/dashboard/AssetStrip.tsx`

Scrollable row: `display: flex, gap: 10px, overflowX: 'auto', padding: '2px 0 6px'` + hide scrollbar CSS.

Each pill card (white, border, radius 12px, padding 10px 14px, flex col, gap 4px):
- Header row: colored dot 8px (asset.color) + symbol 12px 600
- Price: 13px 700 `var(--ink)`
- Change badge: `var(--green)` / `var(--accent)` bg tint pill

Framer Motion: stagger fade-in (opacity 0→1, x: -10→0).

**Logging:** `console.debug('[AssetStrip]', assets.length, 'assets rendered')`

---

## Phase D — Three-Column Panels

### ~~Task 6 — WatchlistPanel.tsx~~ ✅

**File:** `src/components/dashboard/WatchlistPanel.tsx`

Card (white, border, radius 12px, padding 16px):
- Header: "Вотчлист" 14px 600 + "Смотреть всё →" 11px `var(--accent)` (right-aligned)
- List of 5 assets from `MOCK_PRICES.slice(0,5)`:
  - Each row (`display:flex, alignItems:center, gap:10px, padding:'8px 0', cursor:'pointer'`)
  - Left: colored avatar circle 32px + initials
  - Middle: symbol 13px 600 + name 11px muted
  - Right: price 13px 700 + change pill 10px

Hover row: `background: var(--bg), borderRadius: 8px, marginLeft: -8px, paddingLeft: 8px` (via CSS or Framer Motion whileHover).

Empty state: "Вотчлист пуст — добавьте активы" centered muted text.

**Logging:** `console.debug('[WatchlistPanel] showing', assets.length, 'items')`

---

### ~~Task 7 — AllocationChart.tsx~~ ✅

**File:** `src/components/dashboard/AllocationChart.tsx`

Card (white, border, radius 12px, padding 16px):
- Header: "Распределение" 14px 600

Use Recharts `PieChart` (200px × 200px) with `Pie` + `Cell`:
```tsx
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
const data = MOCK_PRICES.slice(0,5).map(a => ({ name: a.name, value: a.volume24h, color: a.color }))
```

- Inner labels: custom `renderCustomizedLabel` showing asset `icon` in colored circle
- Custom `Tooltip`: white card, shadow, asset name + %
- Below chart: legend rows (colored dot + name + %)

**Logging:** `console.debug('[AllocationChart] rendered', data.length, 'slices')`

---

### ~~Task 8 — PersonalizedPanel.tsx~~ ✅

**File:** `src/components/dashboard/PersonalizedPanel.tsx`

Card (white, border, radius 12px, padding 16px):
- Header: "Часто просматриваете" 14px 600

Use `usePersonalized()` (top 5 by volume24h proxy).

Each asset row:
- Colored circle 28px + name 13px 600 + price 12px right
- Mini trend badge: if change24h > 0 → "▲ trending" green pill, else "▼" red pill

Category tag pills below list:
- Detect types from topAssets, render one pill per unique type (Крипто, Акции, Форекс)
- Style: `background: var(--bg), color: var(--muted), borderRadius: var(--r-pill), fontSize: 10px, padding: '2px 8px'`

Empty state: "Нет данных" muted.

**Logging:** `console.debug('[PersonalizedPanel] topAssets=', topAssets.map(a => a.symbol))`

---

## Phase E — Bottom Widgets

### ~~Task 9 — PriceChartWidget.tsx~~ ✅

**File:** `src/components/dashboard/PriceChartWidget.tsx`

Card (white, border, radius 12px, padding 16px):

**Top row:**
- Asset selector: `<select>` styled (no MUI) — options: BTC-USDT, ETH-USDT, AAPL, EUR-USD
- Asset name + price (from useAssetPrice) + %change pill

**Timeframe buttons row (gap 4px):**
```tsx
const TFS = ['1Д','1Н','1М','3М'] as const
// active: { background: 'var(--ink)', color: '#fff', borderRadius: 6 }
// inactive: { background: 'var(--bg)', color: 'var(--muted)', borderRadius: 6 }
```

**Recharts AreaChart:**
```tsx
<ResponsiveContainer width="100%" height={200}>
  <AreaChart data={chartData}>
    <defs>
      <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor="#E8264A" stopOpacity={0.2}/>
        <stop offset="95%" stopColor="#E8264A" stopOpacity={0}/>
      </linearGradient>
    </defs>
    <XAxis dataKey="time" tick={{ fontSize:10, fill:'var(--muted)' }} tickLine={false} axisLine={false}/>
    <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" vertical={false}/>
    <Tooltip content={<CustomTooltip/>}/>
    <Area type="monotone" dataKey="close" stroke="#E8264A" strokeWidth={2.5} fill="url(#chartGrad)" dot={false}/>
  </AreaChart>
</ResponsiveContainer>
```

Map `PricePoint[]` → `{ time: HH:MM, close }`.

**Custom tooltip** (white card, shadow-sm): shows price formatted + timestamp.

Data: `useOHLCV(selectedSymbol, selectedTimeframe)` — map timeframe buttons to Timeframe type.

**Logging:** `console.debug('[PriceChartWidget]', selectedSymbol, selectedTimeframe, 'points=', data?.length)`

---

### ~~Task 10 — CommunityWidget.tsx~~ ✅

**File:** `src/components/dashboard/CommunityWidget.tsx`

Card (white, border, radius 12px, padding 16px):
- Header: flex row — "Идеи сообщества" 14px 600 + "Смотреть все →" 11px accent (right-aligned)

Show first 3 posts from `MOCK_COMMUNITY`.

Each post (padding 10px 0, border-bottom `1px solid var(--border)` except last):
```
Flex row, gap 10px, cursor pointer
└─ Avatar: circle 32px, bg=author.avatarColor, text=author.initials, 12px bold white
└─ Right column
   ├─ "@handle · N мин назад" (9px, var(--muted)) — use formatRelativeTime(createdAt)
   ├─ content truncated: content.length > 85 ? content.slice(0,85)+'...' : content (12px var(--text))
   └─ Footer flex: asset pill + "♥ N" (Lucide Heart 12px) + "💬 N" (Lucide MessageCircle 12px)
```

Asset pill: `{ background: author.avatarColor + '22', color: author.avatarColor, borderRadius: var(--r-pill), fontSize:9, padding:'2px 7px', fontWeight:600 }`

Hover post: `whileHover={{ background: 'var(--bg)', borderRadius: 10, marginX: -8, paddingX: 8 }}` (Framer Motion).

Helper: `formatRelativeTime(iso: string): string` — returns "5 мин назад" / "2 ч назад" / "1 д назад".

**Logging:** `console.debug('[CommunityWidget] rendered', posts.length, 'posts')`

---

### ~~Task 11 — NewsWidget.tsx~~ ✅

**File:** `src/components/dashboard/NewsWidget.tsx`

Card (white, border, radius 12px, padding 16px):
- Header: "Новости рынка" 14px 600

**Filter tabs** (state: `filter: 'all'|'crypto'|'stock'|'forex'`):
```tsx
const TABS = [
  { key: 'all', label: 'Всё' },
  { key: 'crypto', label: 'Крипто' },
  { key: 'stock', label: 'Акции' },
  { key: 'forex', label: 'Форекс' },
]
// Active: { background: 'var(--ink)', color: '#fff', borderRadius: var(--r-pill), padding: '3px 10px', fontSize: 11, fontWeight: 500 }
// Inactive: { color: 'var(--muted)', padding: '3px 10px', fontSize: 11 }
```

Filter logic:
- `all` → show all
- `crypto` → relatedAssets contains 'BTC-USDT' | 'ETH-USDT' | 'SOL-USDT'
- `stock` → relatedAssets contains 'AAPL' | 'MSFT' | 'SPX'
- `forex` → relatedAssets contains 'EUR-USD' | 'GBP-USD'

Show first 3-4 filtered items.

Each news item (padding 8px 0, cursor pointer):
```
Flex row, gap 8px, alignItems 'flex-start'
└─ Sentiment dot: 8px circle, { positive: 'var(--green)', negative: 'var(--accent)', neutral: 'var(--muted)' }, marginTop 4px
└─ Right:
   ├─ Title (12px 600, lineClamp 2 via -webkit-line-clamp)
   └─ "source · N мин назад" (10px muted)
```

Hover item: `whileHover={{ x: -2, borderLeft: '2px solid var(--accent)', paddingLeft: 6 }}` (Framer Motion or CSS transition).

onClick: `console.info('[NewsWidget] navigate /news/', item.id)` (no router yet).

**Logging:** `console.debug('[NewsWidget] filter=', filter, 'showing', filtered.length, 'items')`

---

## Phase F — Modal + Assembly

### ~~Task 12 — AddWidgetModal.tsx~~ ✅

**File:** `src/components/dashboard/AddWidgetModal.tsx`

```tsx
export type WidgetId = 'chart'|'community'|'news'|'watchlist'|'allocation'|'personalized'
interface Props { open: boolean; onClose: () => void; enabledWidgets: WidgetId[]; onApply: (ids: WidgetId[]) => void }
```

Modal overlay: `position:fixed, inset:0, background:'rgba(13,13,13,0.4)', zIndex:1000, display:open?'flex':'none', alignItems:'center', justifyContent:'center'`

Modal card (white, radius 20px, padding 24px, minWidth 380px):
```tsx
<motion.div initial={{ scale:0.9, opacity:0 }} animate={{ scale:1, opacity:1 }} exit={{ scale:0.9, opacity:0 }} transition={{ duration:0.18 }}>
```

Content:
- Header: "Управление виджетами" 16px 600 + X close button (Lucide X icon)
- Grid of widget toggle cards (2 columns): icon + name + description, active = accent border + accent-bg
- "Применить" button: accent bg, white text, full-width, radius pill

**Logging:** `console.debug('[AddWidgetModal] open=', open, 'enabled=', enabledWidgets)`

---

### ~~Task 13 — Assemble Dashboard.tsx~~ ✅

**File:** `src/pages/Dashboard.tsx`

```tsx
import { motion } from 'framer-motion'
// import all 10 dashboard components

export default function Dashboard() {
  const [showAddWidget, setShowAddWidget] = useState(false)
  const [enabledWidgets, setEnabledWidgets] = useState<WidgetId[]>(['chart','community','news','watchlist','allocation','personalized'])

  return (
    <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.4 }}>
      {/* Floating asset cards — above topbar */}
      <FloatingAssetCards />

      {/* Topbar — reuse existing TopBar.jsx */}
      <TopBar />

      {/* Portfolio hero */}
      <PortfolioHero />

      {/* 5 KPI + button */}
      <KpiStrip />

      {/* Horizontal asset scroll */}
      <AssetStrip />

      {/* Three-column section */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginTop:12 }}>
        <WatchlistPanel />
        <AllocationChart />
        <PersonalizedPanel />
      </div>

      {/* Bottom: chart + community/news stack */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:12 }}>
        <PriceChartWidget />
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <CommunityWidget />
          <NewsWidget />
        </div>
      </div>

      {/* Widget modal */}
      <AddWidgetModal
        open={showAddWidget}
        onClose={() => setShowAddWidget(false)}
        enabledWidgets={enabledWidgets}
        onApply={setEnabledWidgets}
      />
    </motion.div>
  )
}
```

`TopBar` import: reuse `src/components/layout/TopBar.jsx` (adapt if needed for FinTrack context — change search placeholder to "Поиск активов...").

**Logging:** `console.debug('[Dashboard] mounted, widgets=', enabledWidgets)`

---

## Phase G — Testing + Verification

### ~~Task 14 — Unit tests for 3 core components~~ ✅

**Files:**
- `src/components/dashboard/__tests__/CommunityWidget.test.tsx`
- `src/components/dashboard/__tests__/NewsWidget.test.tsx`
- `src/components/dashboard/__tests__/PriceChartWidget.test.tsx`
- `vite.config.ts` (add test config)

**Install:**
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

**vite.config.ts test block:**
```ts
test: { globals: true, environment: 'jsdom', setupFiles: './src/test-setup.ts' }
```

**src/test-setup.ts:**
```ts
import '@testing-library/jest-dom'
```

**CommunityWidget.test.tsx:**
- Renders without crashing
- Shows exactly 3 posts
- Truncates content > 85 chars
- Shows author initials in avatar

**NewsWidget.test.tsx:**
- Renders with default "Всё" filter active
- Clicking "Крипто" tab shows only crypto news
- Clicking "Акции" tab shows only stock news

**PriceChartWidget.test.tsx:**
- Renders asset selector with 4 options
- Renders 4 timeframe buttons
- Initial active timeframe is "1Д"

**Logging:** no logs in tests.

---

### ~~Task 15 — Type-check + dev server smoke test~~ ✅

**Actions:**
1. `npx tsc --noEmit` → 0 errors
2. `npx vitest --run` → all test suites pass
3. `npm run dev` → dashboard visible at localhost:5173, no console errors

**Common fixes to watch for:**
- Import paths for `.jsx` from `.tsx` (add `/* @ts-ignore */` only if absolutely necessary, prefer fixing types)
- `TopBar` JSX props — add `@ts-ignore` comment only if no types available
- Recharts types (`AreaProps`, `TooltipProps`) — import from `'recharts'`
- Framer Motion `MotionStyle` vs `React.CSSProperties`

---

## Commit Plan (Advisory — no git)

**Checkpoint 1** after Tasks 1–5 (App integration + header row + KPI + strip):
```
feat(dashboard): add app integration, FloatingAssetCards, PortfolioHero, KpiStrip, AssetStrip
```

**Checkpoint 2** after Tasks 6–9 (three-column panels + chart widget):
```
feat(dashboard): add WatchlistPanel, AllocationChart, PersonalizedPanel, PriceChartWidget
```

**Checkpoint 3** after Tasks 10–13 (community, news, modal, assembly):
```
feat(dashboard): add CommunityWidget, NewsWidget, AddWidgetModal, assemble Dashboard.tsx
```

**Checkpoint 4** after Tasks 14–15 (tests + verification):
```
test(dashboard): add vitest suites for CommunityWidget, NewsWidget, PriceChartWidget
```

---

## Next Step

After this step is verified, run `/aif-plan` again for **Step 4: Market Overview** page (Приоритет 2) or continue with **Step 4 (prompt): Asset Page** (Приоритет 4) for the diploma supervisor demo.
