import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface User {
  id: string
  email: string
  username: string
  role: 'admin' | 'user'
  first_name?: string | null
  last_name?: string | null
  full_name?: string | null
}

export function displayName(u: User | null | undefined): string {
  if (!u) return ''
  return u.first_name?.trim() || u.username
}

export function isAdmin(u: User | null | undefined): boolean {
  return !!u && u.role === 'admin'
}

interface AuthState {
  user: User | null
  token: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  _hasHydrated: boolean
  setAuth: (user: User, token: string, refreshToken?: string | null) => void
  setTokens: (token: string, refreshToken?: string | null) => void
  setUser: (user: User) => void
  logout: () => void
  setHasHydrated: (v: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      _hasHydrated: false,
      setAuth: (user, token, refreshToken = null) =>
        set({ user, token, refreshToken, isAuthenticated: true }),
      setTokens: (token, refreshToken = null) =>
        set((s) => ({ token, refreshToken: refreshToken ?? s.refreshToken })),
      setUser: (user) => set({ user }),
      logout: () =>
        set({ user: null, token: null, refreshToken: null, isAuthenticated: false }),
      setHasHydrated: (v) => set({ _hasHydrated: v }),
    }),
    {
      name: 'curahome-auth',
      partialize: (s) => ({
        user: s.user,
        token: s.token,
        refreshToken: s.refreshToken,
        isAuthenticated: s.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => state?.setHasHydrated(true),
    },
  ),
)
