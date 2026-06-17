import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ViewMode = 'tiles' | 'list'

interface UiState {
  viewMode: ViewMode
  setViewMode: (m: ViewMode) => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      viewMode: 'tiles',
      setViewMode: (m) => set({ viewMode: m }),
    }),
    { name: 'curahome-ui' },
  ),
)
