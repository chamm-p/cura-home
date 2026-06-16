import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface HouseState {
  currentHouseId: string | null
  setCurrentHouse: (id: string | null) => void
}

export const useHouseStore = create<HouseState>()(
  persist(
    (set) => ({
      currentHouseId: null,
      setCurrentHouse: (id) => set({ currentHouseId: id }),
    }),
    { name: 'curahome-house' },
  ),
)
