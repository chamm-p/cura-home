import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Theme = 'light' | 'dark' | 'system'

function prefersDark(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

/** Setzt/entfernt die .dark-Klasse am <html> je nach Theme. */
export function applyTheme(theme: Theme): void {
  const dark = theme === 'dark' || (theme === 'system' && prefersDark())
  document.documentElement.classList.toggle('dark', dark)
}

interface ThemeState {
  theme: Theme
  setTheme: (t: Theme) => void
  cycle: () => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'system',
      setTheme: (t) => {
        set({ theme: t })
        applyTheme(t)
      },
      // light → dark → system → light
      cycle: () => {
        const order: Theme[] = ['light', 'dark', 'system']
        const next = order[(order.indexOf(get().theme) + 1) % order.length]
        get().setTheme(next)
      },
    }),
    {
      name: 'curahome-theme',
      onRehydrateStorage: () => (state) => {
        applyTheme(state?.theme ?? 'system')
      },
    },
  ),
)
