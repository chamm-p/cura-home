// Währungen, die im UI auswählbar sind (Haus-Einstellung).
export const CURRENCIES = ['EUR', 'CHF', 'USD', 'GBP'] as const
export type Currency = (typeof CURRENCIES)[number]

const LOCALE: Record<string, string> = {
  EUR: 'de-DE',
  CHF: 'de-CH',
  USD: 'en-US',
  GBP: 'en-GB',
}

export function money(n: number | null | undefined, currency = 'EUR'): string {
  if (n == null) return '–'
  return new Intl.NumberFormat(LOCALE[currency] ?? 'de-DE', {
    style: 'currency',
    currency,
  }).format(n)
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
}
