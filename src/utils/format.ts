export function formatPrice(price: number, type?: string): string {
  if (!price && price !== 0) return '—'
  if (type === 'forex' || type === 'crypto' && price < 1) return price.toFixed(4)
  if (price < 0.01) return price.toFixed(6)
  if (price < 1) return price.toFixed(4)
  if (price < 10) return price.toFixed(3)
  if (price < 1000) return price.toFixed(2)
  if (price < 1000000) return '$' + price.toLocaleString('en-US', { maximumFractionDigits: 2 })
  return '$' + (price / 1000000).toFixed(2) + 'M'
}

export function formatChange(change: number): string {
  const sign = change >= 0 ? '+' : ''
  return `${sign}${change.toFixed(1)}%`
}

export function formatVolume(vol: number): string {
  if (!vol) return '—'
  if (vol >= 1_000_000_000) return `$${(vol / 1_000_000_000).toFixed(1)}B`
  if (vol >= 1_000_000) return `$${(vol / 1_000_000).toFixed(1)}M`
  return `$${(vol / 1_000).toFixed(1)}K`
}

export function formatMarketCap(cap: number): string {
  if (!cap) return '—'
  if (cap >= 1_000_000_000_000) return `$${(cap / 1_000_000_000_000).toFixed(2)}T`
  if (cap >= 1_000_000_000) return `$${(cap / 1_000_000_000).toFixed(2)}B`
  return `$${(cap / 1_000_000).toFixed(1)}M`
}
