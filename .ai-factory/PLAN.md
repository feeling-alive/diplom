# Implementation Plan: DnD Swap + Resize Shift

Created: 2026-05-13

## Settings
- Testing: no
- Logging: verbose

## Tasks

- [x] Task 1: Implement swap logic on drag in `src/pages/Dashboard.tsx`
  - Replace `compactType={null} preventCollision={true}` with `compactType={null} preventCollision={false}`
  - On `onDragStop`: detect overlap between dropped widget and others → swap their x,y
  - Helper function `rectsOverlap(a, b)` and `swapPositions(widgets, idA, idB)`
  - Add Framer Motion `layout` prop to grid item wrappers for smooth position transitions

- [x] Task 2: Implement shift logic on resize
  - On `onResizeStop`: after updating size, check if resized widget overlaps others
  - If overlap found, shift the overlapped widget right/down to clear the space
  - Use `preventCollision={true}` only during resize to avoid manual shift (simpler)
  - Keep smooth CSS transitions on `.react-grid-item` for size changes

- [x] Task 3: Add Framer Motion entrance/exit animations for widgets
  - Wrap `WidgetCard` in `motion.div` with `layout` prop for smooth position changes
  - Add scale/opacity animation when widget is added
  - Add exit animation when widget is removed

- [x] Task 4: TypeScript check + verify
  - `npx tsc --noEmit`
