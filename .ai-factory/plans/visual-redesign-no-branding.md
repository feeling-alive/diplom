# Implementation Plan: Visual Redesign — Icon Rail + New Header + Global Style

Branch: feature/visual-redesign-no-branding
Created: 2026-05-13

## Settings
- Testing: yes
- Logging: verbose
- Docs: yes

## Roadmap Linkage
Milestone: "none"
Rationale: Skipped by user

## Commit Plan
- **Commit 1** (after task 1): "feat: update design tokens (colors, shadows) + sync RULES.md"
- **Commit 2** (after task 2): "feat: rewrite sidebar as icon-only 56px rail with tooltips"
- **Commit 3** (after tasks 3-4): "feat: redesign header (52px, search + actions + separator) and KPI section"
- **Commit 4** (after tasks 5-6): "feat: update widget cards global style + remove FinTrack branding"
- **Commit 5** (after task 7): "test: update component tests for visual changes"

## Tasks

### Phase 1: Design Tokens

- [x] Task 1: Update CSS variables in `src/index.css` and sync `.ai-factory/RULES.md`
  - Change `--accent`: #E8264A → #E11D48
  - Change `--ink`: #0D0D0D → #0F172A
  - Change `--muted`: #8A8A8A → #64748B
  - Update `--shadow-sm/md/lg` values per redesign spec (light, `0 4px 14px rgba(0,0,0,0.06)`)
  - Set `--rail-w: 56px`, `--sidebar-w: 0px` (sidebar removed, rail takes over)
  - Update `.app-shell` grid template columns to use new rail width
  - Sync all color values in `.ai-factory/RULES.md` to match new tokens
  - LOGGING: log old → new value mapping at INFO level

### Phase 2: Icon-Only Sidebar Rail

- [x] Task 2: Rewrite sidebar as 56px icon-only rail
  - **File: `src/components/layout/AppSidebar.tsx`**
    - Remove entire logo section ("F" circle + "FinTrack" text)
    - Remove all text labels from nav items → show only icons
    - Each nav item: 40×40px round button, icon only
    - Active item: red (`--accent-bg`) background with accent icon color
    - Bottom section: settings icon + avatar circle (initials only) + logout
    - Add Framer Motion tooltip on hover (appears after 300ms, shows item label)
    - Tooltip: dark background (`--ink`), white text, positioned right of icon
    - Remove watchlist section (sb-section, sb-sub-link, sb-divider)
    - Width: 56px (via CSS), min-height: 100vh, background: white
  - **File: `src/index.css`**
    - Replace `.app-sidebar`, `.sb-*` CSS with `.app-rail`, `.rail-*` classes
    - Nav icons container: flex column, gap 4px, center aligned
    - Each nav button: 40×40px, border-radius 50%, hover bg `var(--bg)`, active bg `var(--accent-bg)`
    - Bottom rail section: margin-top auto, border-top, padding 12px
    - Remove old `.sb-logo`, `.sb-logo-icon`, `.sb-logo-text`, `.sb-nav`, `.sb-link`, `.sb-divider`, `.sb-section`, `.sb-section-label`, `.sb-sub-link`, `.sb-sub-dot`, `.sb-bottom`, `.sb-bottom-btn`, `.sb-avatar` classes
  - LOGGING: log rail mount with nav items count

- [x] Task 3: Update layout references in `src/App.tsx`
  - `.app-shell` grid already auto-adjusts via `--rail-w: 56px`
  - Verify sidebar-to-rail transition looks correct (no "F" FinTrack left over)
  - Remove any `--sidebar-w` related overrides
  - LOGGING: log layout update

### Phase 3: Header + KPI + Assets

- [x] Task 4: Redesign DashboardHeader in `src/components/dashboard/DashboardHeader.tsx`
  - Outer `<header>`: height 52px, flex, align-items center, border-bottom 1px solid var(--border)
  - Left section: search bar
    - Width 280-320px, flex-basis limit
    - Search icon (Lucide `Search`) + `<input placeholder="Поиск активов...">`
    - Border-radius 12px, background white, border 1px solid var(--border)
    - Focus: border-color var(--accent) + subtle red glow
  - Right section: flex row, gap 8px, items center
    - Pencil button (edit toggle): 32×32px circle, border 1px solid var(--border), white bg, muted icon. Active: accent bg, white icon
    - Menu button: 32×32px circle, border 1px solid var(--border), white bg, `AlignLeft` icon
    - Avatar: 32×32px circle, accent bg, white initial letter
    - Plus button: 32×32px circle, accent bg, white `Plus` icon, NO shadow
  - All buttons: Framer Motion whileHover(1.05) whileTap(0.95)
  - LOGGING: log header render with isEditing state

- [x] Task 5: Redesign KPI section + Asset strip
  - **File: `src/components/dashboard/KpiStrip.tsx`**
    - Remove card wrapper (white bg + border) — use transparent bg to blend with page bg `--bg`
    - Big portfolio value: font-size 42-48px, font-weight 800, color var(--ink)
    - Label above: "Портфель за 1Д" in 13px/500 muted
    - Row below value: percent pill (accent-bg bg, accent text, 999px radius) + dollar pill (transparent bg, accent border, accent text)
    - Subtitle: "к пред. $X · за 1Д" 12px muted
    - Right side: timeframe pill group (1Ч / 1Д / 1М) — active button: dark bg (--ink), white text; inactive: transparent, border 1px solid --border, muted text
    - Framer Motion entrance: fade-up
    - If using local state for period, keep as-is
  - **File: `src/components/dashboard/AssetStrip.tsx`**
    - Update card border-radius to 14px
    - Add `box-shadow: var(--shadow-sm)` (light)
    - Hover: `translateY(-1px)` + `box-shadow: var(--shadow-md)` (already partially done)
    - Increase min-width slightly for better proportions
  - LOGGING: log portfolio calculation and asset count

### Phase 4: Widgets + Empty State

- [x] Task 6: Update widget card global style
  - **File: `src/components/dashboard/WidgetCard.tsx`**
    - border-radius: 14px (was 16px)
    - box-shadow: `0 4px 14px rgba(0,0,0,0.06)` (light shadow)
    - Hover effect via CSS: translateY(-1px) + enhanced shadow
    - Edit mode: dashed border (already done), keep as-is
  - **File: `src/components/dashboard/EmptyDashboard.tsx`**
    - Update CTA button border-radius to use var(--r-md) = 12px
    - Ensure ghost widgets and cursor animate with new accent color #E11D48
  - **File: `src/index.css`**
    - Update `.widget-card` base styles if any exist
    - Verify `.react-grid-item.react-draggable-dragging` uses new shadow tokens
  - LOGGING: log widget card style application

### Phase 5: Remove Branding

- [x] Task 7: Remove all "FinTrack" text from UI
  - `src/config/env.ts`: change `'FinTrack'` to `''` (empty string)
  - `src/pages/LoginPage.tsx`: remove "FinTrack" from "Войдите в свой аккаунт FinTrack" → just "Войдите в свой аккаунт"
  - `src/pages/RegisterPage.tsx`: remove "FinTrack" from "Создайте свой аккаунт FinTrack" → just "Создайте свой аккаунт"
  - `src/components/asset/ChatPanel.tsx`: remove "FinTrack" from system prompt
  - LOGGING: log each removed reference

### Phase 6: Tests + Verification

- [x] Task 8: Update component tests for visual changes
  - Check `src/components/dashboard/__tests__/` for existing tests
  - Update any test that references old classNames (`.sb-link`, `.sb-logo-text`, etc.)
  - Update test selectors that matched removed elements (logo text, watchlist items)
  - Ensure `data-testid` attributes on new rail elements work
  - Run tests: verify they pass
  - LOGGING: log test updates and results

- [x] Task 9: TypeScript verification
  - Run `npx tsc --noEmit` and fix any type errors
  - Verify all imports are correct
  - Check for unused imports in changed files
  - LOGGING: log any type errors found and fixed
