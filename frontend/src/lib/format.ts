export const eur = (n: number | null | undefined): string =>
  n == null
    ? '–'
    : new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR',
      }).format(n)
