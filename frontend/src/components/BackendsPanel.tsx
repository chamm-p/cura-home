import { CheckCircle2, Pencil, Plus, Trash2, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  type LlmBackend,
  deleteBackend,
  getKv,
  getSearchConfig,
  listBackends,
  putKv,
  putSearchConfig,
  testBackend,
} from '../services/settings'
import { BackendForm } from './BackendForm'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Select } from './ui/select'

export function BackendsPanel() {
  const [backends, setBackends] = useState<LlmBackend[]>([])
  const [visionId, setVisionId] = useState<string>('')
  const [pricingId, setPricingId] = useState<string>('')
  const [pricingMode, setPricingMode] = useState<string>('llm')
  const [searchProvider, setSearchProvider] = useState<string>('none')
  const [searxngUrl, setSearxngUrl] = useState<string>('')
  const [tavilyKey, setTavilyKey] = useState<string>('')
  const [hasTavilyKey, setHasTavilyKey] = useState(false)

  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; msg: string }>>({})

  async function reload() {
    const [bs, vcfg, pcfg, scfg] = await Promise.all([
      listBackends(),
      getKv('vision_config'),
      getKv('pricing_config'),
      getSearchConfig(),
    ])
    setBackends(bs)
    setVisionId((vcfg?.backend_id as string) || '')
    setPricingId((pcfg?.backend_id as string) || '')
    setPricingMode((pcfg?.mode as string) || 'llm')
    setSearchProvider(scfg.provider)
    setSearxngUrl(scfg.searxng_url || '')
    setHasTavilyKey(scfg.has_tavily_key)
    setTavilyKey('')
  }

  useEffect(() => {
    setAdding(false)
    setEditingId(null)
    reload().catch(() => {})
  }, [])

  async function setVision(id: string) {
    setVisionId(id)
    await putKv('vision_config', id ? { backend_id: id } : {})
  }

  async function savePricing(mode: string, backendId: string) {
    setPricingMode(mode)
    setPricingId(backendId)
    await putKv('pricing_config', {
      mode,
      ...(backendId ? { backend_id: backendId } : {}),
    })
  }

  async function saveSearch(
    next: Partial<{ provider: string; searxng_url: string; tavily_api_key: string }>,
  ) {
    const res = await putSearchConfig({
      provider: next.provider ?? searchProvider,
      searxng_url: next.searxng_url ?? searxngUrl,
      ...(next.tavily_api_key ? { tavily_api_key: next.tavily_api_key } : {}),
    })
    setSearchProvider(res.provider)
    setSearxngUrl(res.searxng_url || '')
    setHasTavilyKey(res.has_tavily_key)
    setTavilyKey('')
  }

  async function remove(b: LlmBackend) {
    if (!confirm(`Backend „${b.name}" löschen?`)) return
    await deleteBackend(b.id)
    await reload()
  }

  async function runTest(b: LlmBackend) {
    setTestResult((p) => ({ ...p, [b.id]: { ok: false, msg: '…' } }))
    const r = await testBackend(b.id)
    setTestResult((p) => ({
      ...p,
      [b.id]: { ok: r.ok, msg: r.ok ? r.sample || 'OK' : r.error || 'Fehler' },
    }))
  }

  function onFormSaved() {
    setAdding(false)
    setEditingId(null)
    reload()
  }

  return (
    <div className="space-y-5">
      {/* Vision-Backend-Auswahl */}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
            Backend für Objekterkennung (Vision)
          </label>
          <Select value={visionId} onChange={(e) => setVision(e.target.value)}>
            <option value="">Automatisch (erstes Vision-fähiges)</option>
            {backends
              .filter((b) => b.capabilities?.supports_vision)
              .map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.model_id})
                </option>
              ))}
          </Select>
        </div>

        {/* Preis-Indikation */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
              Preis-Indikation
            </label>
            <Select value={pricingMode} onChange={(e) => savePricing(e.target.value, pricingId)}>
              <option value="llm">Nur LLM-Schätzung</option>
              <option value="websearch">LLM + Websuche</option>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
              Preis-Backend
            </label>
            <Select value={pricingId} onChange={(e) => savePricing(pricingMode, e.target.value)}>
              <option value="">Automatisch (erstes aktive)</option>
              {backends.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.model_id})
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* Such-Provider (nur im Websuche-Modus) */}
        {pricingMode === 'websearch' && (
          <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
              Such-Provider (Preisrecherche)
            </label>
            <Select
              value={searchProvider}
              onChange={(e) => saveSearch({ provider: e.target.value })}
            >
              <option value="none">Keiner (nur LLM-Schätzung)</option>
              <option value="searxng">SearXNG (self-hosted)</option>
              <option value="tavily">Tavily (Cloud)</option>
            </Select>
            {searchProvider === 'searxng' && (
              <Input
                className="mt-2"
                placeholder="SearXNG-URL (z.B. http://192.168.0.10:32773)"
                value={searxngUrl}
                onChange={(e) => setSearxngUrl(e.target.value)}
                onBlur={() => saveSearch({ searxng_url: searxngUrl })}
              />
            )}
            {searchProvider === 'tavily' && (
              <div className="mt-2 flex gap-2">
                <Input
                  type="password"
                  placeholder={
                    hasTavilyKey ? 'Key gesetzt — neu eingeben zum Ändern' : 'Tavily API-Key'
                  }
                  value={tavilyKey}
                  onChange={(e) => setTavilyKey(e.target.value)}
                />
                <Button
                  size="sm"
                  onClick={() => saveSearch({ tavily_api_key: tavilyKey })}
                  disabled={!tavilyKey.trim()}
                >
                  Speichern
                </Button>
              </div>
            )}
            <p className="mt-1 text-xs text-slate-400">
              Es wird echt gesucht; die Treffer gehen als Quellen ans LLM
              (search-then-extract).
            </p>
          </div>
        )}

        {/* Backend-Liste */}
        <div className="space-y-2">
          {backends.map((b) =>
            editingId === b.id ? (
              <BackendForm
                key={b.id}
                initial={b}
                onSaved={onFormSaved}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <div
                key={b.id}
                className="rounded-xl border border-slate-200 p-3 dark:border-slate-700"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium">{b.name}</span>
                      {b.capabilities?.supports_vision && <Badge>Vision</Badge>}
                      {b.capabilities?.supports_tools && <Badge>Tools</Badge>}
                      {!b.is_active && <Badge tone="muted">inaktiv</Badge>}
                    </div>
                    <p className="truncate text-xs text-slate-400">
                      {b.model_id} · {b.api_base_url} · {b.has_api_key ? 'Key ✓' : 'kein Key'}
                    </p>
                    {testResult[b.id] && (
                      <p
                        className={
                          'mt-1 flex items-center gap-1 text-xs ' +
                          (testResult[b.id].ok ? 'text-emerald-600' : 'text-red-500')
                        }
                      >
                        {testResult[b.id].ok ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5" />
                        )}
                        {testResult[b.id].msg}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="secondary" size="sm" onClick={() => runTest(b)}>
                      Test
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setAdding(false)
                        setEditingId(b.id)
                      }}
                      title="Bearbeiten"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => remove(b)} title="Löschen">
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </div>
            ),
          )}
          {backends.length === 0 && !adding && (
            <p className="py-2 text-center text-sm text-slate-400">
              Noch kein Backend. Füge eines hinzu, damit Objekterkennung und
              Preis-Indikation funktionieren.
            </p>
          )}
        </div>

        {/* Hinzufügen */}
        {adding ? (
          <BackendForm initial={null} onSaved={onFormSaved} onCancel={() => setAdding(false)} />
        ) : (
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => {
              setEditingId(null)
              setAdding(true)
            }}
          >
            <Plus className="h-4 w-4" /> Backend hinzufügen
          </Button>
        )}
    </div>
  )
}

function Badge({ children, tone }: { children: React.ReactNode; tone?: 'muted' }) {
  return (
    <span
      className={
        'rounded-md px-1.5 py-0.5 text-[11px] font-medium ' +
        (tone === 'muted'
          ? 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
          : 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300')
      }
    >
      {children}
    </span>
  )
}
