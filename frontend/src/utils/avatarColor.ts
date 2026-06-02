// Pure helpers for initials-based avatars (used by the profile uploader and the
// sidebar). Lives in utils/ so it stays dependency-free and reusable.

/** First character of the name, uppercased. Falls back to '?'. */
export function initial(name: string | null | undefined): string {
  const trimmed = (name ?? '').trim()
  return trimmed ? trimmed[0].toUpperCase() : '?'
}

/** Deterministic pleasant HSL background derived from a username hash. */
export function hashToHsl(name: string | null | undefined): string {
  const str = name ?? ''
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
    hash |= 0 // keep it a 32-bit int
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 58%, 55%)`
}
