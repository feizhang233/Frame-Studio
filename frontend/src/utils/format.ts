export function formatNumber(value: number, digits = 3): string {
  if (!Number.isFinite(value)) return '—'
  const absolute = Math.abs(value)
  if (absolute !== 0 && (absolute >= 1e5 || absolute < 1e-3)) {
    return value.toExponential(digits)
  }
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(value)
}

export function formatEngineering(value: number, unit: string): string {
  const absolute = Math.abs(value)
  const prefixes = [
    { limit: 1e9, divisor: 1e9, prefix: 'G' },
    { limit: 1e6, divisor: 1e6, prefix: 'M' },
    { limit: 1e3, divisor: 1e3, prefix: 'k' },
  ]
  const match = prefixes.find((item) => absolute >= item.limit)
  return match
    ? `${formatNumber(value / match.divisor)} ${match.prefix}${unit}`
    : `${formatNumber(value)} ${unit}`
}
