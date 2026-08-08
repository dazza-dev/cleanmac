/**
 * macOS reports storage in decimal units (1 GB = 1000 MB), so the app matches
 * Finder rather than showing a number the user can't reconcile with the OS.
 */
export function bytes(value: number, fractionDigits?: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const exponent = Math.min(Math.floor(Math.log10(value) / 3), units.length - 1)
  const scaled = value / 1000 ** exponent

  const digits = fractionDigits ?? (exponent === 0 ? 0 : scaled < 10 ? 1 : scaled < 100 ? 1 : 0)

  return `${scaled.toFixed(digits)} ${units[exponent]}`
}

export function relativeTime(timestamp: number, locale: string): string {
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const elapsedMs = timestamp - Date.now()

  const divisions: Array<[number, Intl.RelativeTimeFormatUnit]> = [
    [1000 * 60, 'minute'],
    [1000 * 60 * 60, 'hour'],
    [1000 * 60 * 60 * 24, 'day'],
    [1000 * 60 * 60 * 24 * 30, 'month'],
    [1000 * 60 * 60 * 24 * 365, 'year']
  ]

  let unit: Intl.RelativeTimeFormatUnit = 'minute'
  let divisor = 1000 * 60

  for (const [size, candidate] of divisions) {
    if (Math.abs(elapsedMs) >= size) {
      divisor = size
      unit = candidate
    }
  }

  return formatter.format(Math.round(elapsedMs / divisor), unit)
}

export function dateTime(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(iso))
}
