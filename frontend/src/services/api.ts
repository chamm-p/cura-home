import axios, { AxiosError, type AxiosRequestConfig } from 'axios'
import { useAuthStore } from '../store/auth'
import { useHouseStore } from '../store/house'

export const API_BASE = import.meta.env.VITE_API_URL || ''

// Kein globaler Content-Type: axios setzt application/json für Objekte und
// multipart/form-data (inkl. boundary) für FormData automatisch — sonst würden
// Foto-Uploads mit falschem Content-Type brechen.
const api = axios.create({ baseURL: API_BASE })

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  // Aktives Haus an jeden Request hängen (Scoping wie curai's X-Workspace-Id).
  const house = useHouseStore.getState().currentHouseId
  if (house) config.headers['X-House-Id'] = house
  return config
})

// ── Silent-Refresh: 401 → einmal neues Access-Token holen, Request retryen ──
let _refreshInflight: Promise<string | null> | null = null

async function _doRefresh(): Promise<string | null> {
  const s = useAuthStore.getState()
  if (!s.refreshToken) return null
  try {
    const r = await axios.post(`${API_BASE}/api/auth/refresh`, {
      refresh_token: s.refreshToken,
    })
    const newAccess = r.data?.access_token as string | undefined
    const newRefresh = r.data?.refresh_token as string | undefined
    if (!newAccess) return null
    s.setTokens(newAccess, newRefresh ?? null)
    return newAccess
  } catch {
    return null
  }
}

api.interceptors.response.use(
  (r) => r,
  async (err: AxiosError) => {
    const original = err.config as (AxiosRequestConfig & { _retry?: boolean }) | undefined
    if (
      err.response?.status === 401 &&
      original &&
      !original._retry &&
      !(original.url || '').includes('/api/auth/refresh')
    ) {
      const s = useAuthStore.getState()
      if (!s.isAuthenticated || !s.refreshToken) {
        if (s.isAuthenticated) s.logout()
        return Promise.reject(err)
      }
      original._retry = true
      if (!_refreshInflight) {
        _refreshInflight = _doRefresh().finally(() => {
          _refreshInflight = null
        })
      }
      const newToken = await _refreshInflight
      if (!newToken) {
        s.logout()
        return Promise.reject(err)
      }
      if (!original.headers) original.headers = {} as any
      ;(original.headers as any).Authorization = `Bearer ${newToken}`
      return api.request(original)
    }
    return Promise.reject(err)
  },
)

export default api
