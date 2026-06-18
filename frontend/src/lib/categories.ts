// Grobe Objektart-Kategorien (Tagging). Muss zu backend/app/constants.py passen.
export const CATEGORIES = [
  'Möbel',
  'Technik',
  'Kochen',
  'Haushalt',
  'Hobby',
  'Kleidung',
  'Schmuck',
  'Sonstiges',
] as const

export type Category = (typeof CATEGORIES)[number]
