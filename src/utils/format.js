// Утилиты форматирования
export const formatMoney = (n) => {
  if (typeof n === 'string') return n
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export const formatK = (n) => {
  if (n >= 1000) return `$${(n/1000).toFixed(1).replace(/\.0$/, '')}k`
  return `$${n}`
}
