import { motion } from 'framer-motion'
import { Armchair, Boxes, Home, Lamp, Package, Sofa } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Spinner } from '../components/ui/spinner'
import {
  type AuthConfig,
  devLogin,
  exchangeOidcCode,
  fetchMe,
  getAuthConfig,
  startOidcLogin,
} from '../services/auth'
import { useAuthStore } from '../store/auth'
import '../styles/login-animation.css'

const FLOAT_ICONS = [Boxes, Home, Sofa, Package, Armchair, Lamp]

function FloatingField() {
  const items = useMemo(
    () =>
      Array.from({ length: 14 }).map((_, i) => {
        const Icon = FLOAT_ICONS[i % FLOAT_ICONS.length]
        return {
          Icon,
          left: (i * 37) % 100,
          size: 26 + ((i * 13) % 40),
          duration: 16 + ((i * 7) % 16),
          delay: -((i * 5) % 20),
        }
      }),
    [],
  )
  return (
    <>
      {items.map((it, i) => (
        <it.Icon
          key={i}
          className="float-item"
          style={{
            left: `${it.left}%`,
            width: it.size,
            height: it.size,
            animationDuration: `${it.duration}s`,
            animationDelay: `${it.delay}s`,
          }}
        />
      ))}
    </>
  )
}

export default function Login() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [config, setConfig] = useState<AuthConfig | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  async function finishLogin(access: string, refresh: string) {
    useAuthStore.getState().setTokens(access, refresh)
    const me = await fetchMe()
    setAuth(me, access, refresh)
    navigate('/', { replace: true })
  }

  // OIDC-Callback: ?code=&state= → Token-Exchange.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const state = params.get('state')
    if (code) {
      setBusy(true)
      ;(async () => {
        try {
          const tokens = await exchangeOidcCode(code, state)
          window.history.replaceState({}, '', '/')
          await finishLogin(tokens.access_token, tokens.refresh_token)
        } catch (e) {
          console.error(e)
          setError('Anmeldung fehlgeschlagen. Bitte erneut versuchen.')
          window.history.replaceState({}, '', '/login')
        } finally {
          setBusy(false)
        }
      })()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true })
  }, [isAuthenticated, navigate])

  useEffect(() => {
    getAuthConfig()
      .then(setConfig)
      .catch(() =>
        setConfig({ oidc_enabled: false, oidc_label: '', dev_login_enabled: false }),
      )
  }, [])

  async function handleSso() {
    setError(null)
    setBusy(true)
    try {
      window.location.href = await startOidcLogin()
    } catch {
      setError('SSO-Login konnte nicht gestartet werden.')
      setBusy(false)
    }
  }

  async function handleDevLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const tokens = await devLogin(username, password)
      await finishLogin(tokens.access_token, tokens.refresh_token)
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Anmeldung fehlgeschlagen.')
      setBusy(false)
    }
  }

  const loading = config === null
  const showDev = config?.dev_login_enabled
  const showSso = config?.oidc_enabled
  const nothingEnabled = config && !showDev && !showSso

  return (
    <div className="login-bg flex min-h-screen items-center justify-center p-4">
      <FloatingField />
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="login-card w-full max-w-sm rounded-3xl p-8 text-center"
      >
        <div className="logo-pulse mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/20 ring-1 ring-indigo-400/40">
          <Boxes className="h-8 w-8 text-indigo-300" />
        </div>
        <h1 className="text-2xl font-semibold text-white">cura-home</h1>
        <p className="mt-2 text-sm text-slate-300">
          Dein Hausinventar — fotografieren, erkennen, behalten.
        </p>

        <div className="mt-8 space-y-4">
          {loading || busy ? (
            <div className="flex items-center justify-center gap-2 py-2 text-slate-300">
              <Spinner className="h-5 w-5" /> {busy ? 'Anmeldung läuft…' : 'Lädt…'}
            </div>
          ) : (
            <>
              {showDev && (
                <form onSubmit={handleDevLogin} className="space-y-3 text-left">
                  <Input
                    type="text"
                    placeholder="Benutzername"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                  <Input
                    type="password"
                    placeholder="Passwort"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <Button type="submit" size="lg" className="w-full">
                    Anmelden
                  </Button>
                </form>
              )}

              {showDev && showSso && (
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span className="h-px flex-1 bg-slate-600/50" /> oder
                  <span className="h-px flex-1 bg-slate-600/50" />
                </div>
              )}

              {showSso && (
                <Button
                  variant="secondary"
                  size="lg"
                  className="w-full"
                  onClick={handleSso}
                >
                  {config?.oidc_label || 'Mit SSO anmelden'}
                </Button>
              )}

              {nothingEnabled && (
                <p className="text-sm text-amber-300">
                  Keine Login-Methode aktiv. Setze DEV_LOGIN_ENABLED=true oder
                  konfiguriere OIDC im Backend.
                </p>
              )}
            </>
          )}
          {error && <p className="text-sm text-red-300">{error}</p>}
        </div>
      </motion.div>
    </div>
  )
}
