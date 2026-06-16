import { type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Inventory from './pages/Inventory'
import Login from './pages/Login'
import { useAuthStore } from './store/auth'

function RequireAuth({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const hydrated = useAuthStore((s) => s._hasHydrated)
  if (!hydrated) return null
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Inventory />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
