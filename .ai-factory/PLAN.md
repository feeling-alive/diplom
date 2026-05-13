# FinTrack Dashboard — Step 1: Foundation

**Scope:** TypeScript setup · Design system tokens · Core types  
**Date:** 2026-05-13  
**Testing:** Yes (type-check only — no runtime tests at this step)  
**Logging:** Verbose

---

## Settings

- Testing: type-check via `tsc --noEmit`
- Logging: verbose — log every non-obvious decision in comments
- Docs: warn-only

---

## Tasks

### ~~Task 1 — Install missing dependencies~~ ✅

**Deliverable:** `@tanstack/react-query` available in node_modules

```bash
npm install @tanstack/react-query
```

Verify: `package.json` lists `@tanstack/react-query` under `dependencies`.

**Logging:** none needed — package install is self-evident.

---

### ~~Task 2 — Add TypeScript support~~ ✅

**Files to create/modify:**
- `tsconfig.json` (create)
- `tsconfig.node.json` (create)
- `vite.config.ts` (rename from `vite.config.js`)

**tsconfig.json** — strict mode, path aliases ready for `src/`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

**tsconfig.node.json:**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
```

**vite.config.ts** — identical content to current vite.config.js, just rename:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
```

After creating, delete `vite.config.js`.

**Verify:** `npx tsc --noEmit` — expected: many errors for existing JSX files, but no crash on the config itself. New `.ts`/`.tsx` files must pass cleanly.

**Note:** Existing `.jsx` files are intentionally left as-is. New dashboard files will be `.tsx`. Migration of old files is out of scope.

---

### ~~Task 3 — Replace CSS design tokens in `src/index.css`~~ ✅

**File:** `src/index.css`

Replace the entire `:root { }` block with the canonical design system variables from RULES.md. Keep all other rules (reset, `.card`, `.badge`, etc.) intact.

**New `:root` block:**

```css
:root {
  /* Colors */
  --accent:      #E8264A;
  --accent-bg:   #FFE5EC;
  --ink:         #0D0D0D;
  --text:        #1A1A1A;
  --muted:       #8A8A8A;
  --soft:        #B8B6B0;
  --bg:          #F4F3F1;
  --white:       #FFFFFF;
  --border:      #ECEAE3;
  --green:       #22C55E;
  --red:         #E8264A;

  /* Typography */
  --font: 'Inter', -apple-system, sans-serif;

  /* Border radius */
  --r-sm:   8px;
  --r-md:   12px;
  --r-lg:   16px;
  --r-xl:   24px;
  --r-pill: 999px;

  /* Shadows */
  --shadow-sm: 0 4px 14px -4px rgba(20,20,20,.10);
  --shadow-md: 0 6px 18px -6px rgba(20,20,20,.10), 0 2px 6px -2px rgba(20,20,20,.06);
  --shadow-lg: 0 24px 60px -20px rgba(20,20,20,.18), 0 8px 24px -8px rgba(20,20,20,.08);

  /* Layout */
  --rail-w:    56px;
  --sidebar-w: 200px;
}
```

After the replacement, update `body` to use `var(--bg)` as background and `var(--font)` as font-family.

Update `.card` to use `var(--white)`, `var(--r-md)`, `var(--shadow-sm)`, `var(--border)`.

**Logging:** none — pure CSS swap.

---

### ~~Task 4 — Create `src/types/market.types.ts`~~ ✅

**File:** `src/types/market.types.ts` (new file — create `src/types/` directory)

Exact types as specified in the prompt:

```typescript
export interface Asset {
  symbol: string         // 'BTC-USDT' | 'ETH-USDT' | 'AAPL' | 'EUR-USD'
  name: string           // 'Bitcoin'
  type: 'crypto' | 'stock' | 'forex' | 'index'
  price: number
  change24h: number      // percent change over 24h
  changeDollar: number   // dollar change
  volume24h: number
  marketCap?: number
  high24h: number
  low24h: number
  color: string          // icon color e.g. '#F7931A'
  icon?: string          // initial letter 'B' | 'E' | 'A'
}

export interface PricePoint {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface NewsItem {
  id: string
  title: string
  summary: string
  source: string
  url: string
  publishedAt: string
  sentiment: 'positive' | 'negative' | 'neutral'
  relatedAssets: string[]
  imageUrl?: string
}

export interface CommunityPost {
  id: string
  author: {
    name: string
    handle: string
    initials: string
    avatarColor: string
  }
  content: string
  relatedAsset: string
  assetColor: string
  likes: number
  comments: number
  createdAt: string
  isLiked: boolean
}

export interface WatchlistItem {
  symbol: string
  addedAt: string
  viewCount: number  // incremented on each asset open — used for personalization
}

export type Timeframe = '1m' | '5m' | '15m' | '1H' | '4H' | '1D' | '1W' | '1M'
```

**Verify:** `npx tsc --noEmit` — this file must produce zero errors.

---

### ~~Task 5 — Verify Step 1 is complete~~ ✅

Run:
```bash
npx tsc --noEmit 2>&1 | grep -v "\.jsx" | grep error || echo "No TS errors in .ts/.tsx files"
npm run dev
```

Confirm:
- [ ] `src/types/market.types.ts` exists with all 6 exported types
- [ ] `tsconfig.json` + `tsconfig.node.json` present
- [ ] `vite.config.ts` present, `vite.config.js` deleted
- [ ] `src/index.css` `:root` uses new variable names (`--accent`, `--bg`, `--border`, etc.)
- [ ] `npm run dev` still starts without crashing

---

## Commit Plan

Single commit after all 5 tasks:

```
feat: TypeScript setup + design tokens + core types

- Add tsconfig.json (strict mode, react-jsx)
- Rename vite.config.js → vite.config.ts
- Replace CSS custom properties with canonical design system tokens
- Add src/types/market.types.ts (Asset, PricePoint, NewsItem, CommunityPost, WatchlistItem, Timeframe)
- Install @tanstack/react-query
```

---

## Next Step

After this step is verified, run `/aif-plan` again for **Step 2: Mock Data** (`src/mock/`).
