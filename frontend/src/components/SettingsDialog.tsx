import { CheckCircle2, Loader2, Plus, RefreshCw, Trash2, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  type LlmBackend,
  createBackend,
  deleteBackend,
  fetchModels,
  getKv,
  getSearchConfig,
  listBackends,
  putKv,
  putSearchConfig,
  testBackend,
} from '../services/settings'
import { Button } from './ui/button'
import { Dialog } from './ui/dialog'
import { Input } from './ui/input'
import { Select } from './ui/select'

const EMPTY = {
  name: '',
  api_base_url: 'https://api.openai.com/v1',
  api_key: '',
  model_id: '',
  supports_vision: true,
  supports_tools: false,
  is_active: true,
}

export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [backends, setBackends] = useState<LlmBackend[]>([])
  const [visionId, setVisionId] = useState<string>('')
  const [pricingId, setPricingId] = useState<string>('')
  const [pricingMode, setPricingMode] = useState<string>('llm')
  const [searchProvider, setSearchProvider] = useState<string>('none')
  const [searxngUrl, setSearxngUrl] = useState<string>('')
  const [tavilyKey, setTavilyKey] = useState<string>('')
  const [hasTavilyKey, setHasTavilyKey] = useState(false)
  const [form, setForm] = useState({ ...EMPTY })
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const [models, setModels] = useState<string[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [modelsError, setModelsError] = useState<string | null>(null)

  async function loadModels() {
    if (!form.api_base_url.trim()) {
      setModelsError('Bitte zuerst die API Base URL eintragen.')
      return
    }
    setModelsError(null)
    setLoadingModels(true)
    try {
      const ms = await fetchModels(form.api_base_url, form.api_key)
      setModels(ms)
      if (ms.length === 0) setModelsError('Keine Modelle gefunden.')
      else if (!form.model_id) setForm((f) => ({ ...f, model_id: ms[0] }))
    } catch (e: any) {
      setModelsError(e?.response?.data?.detail || 'Modelle konnten nicht geladen werden.')
    } finally {
      setLoadingModels(false)
    }
  }
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

  async function saveSearch(next: Partial<{ provider: string; searxng_url: string; tavily_api_key: string }>) {
    const payload = {
      provider: next.provider ?? searchProvider,
      searxng_url: next.searxng_url ?? searxngUrl,
      ...(next.tavily_api_key ? { tavily_api_key: next.tavily_api_key } : {}),
    }
    const res = await putSearchConfig(payload)
    setSearchProvider(res.provider)
    setSearxngUrl(res.searxng_url || '')
    setHasTavilyKey(res.has_tavily_key)
    setTavilyKey('')
  }

  async function savePricing(mode: string, backendId: string) {
    setPricingMode(mode)
    setPricingId(backendId)
    await putKv('pricing_config', {
      mode,
      ...(backendId ? { backend_id: backendId } : {}),
    })
  }

  useEffect(() => {
    if (open) reload().catch(() => {})
  }, [open])

  async function add() {
    if (!form.name.trim() || !form.model_id.trim()) return
    setBusy(true)
    try {
      await createBackend(form)
      setForm({ ...EMPTY })
      setAdding(false)
      await reload()
    } finally {
      setBusy(false)
    }
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

  async function setVision(id: string) {
    setVisionId(id)
    await putKv('vision_config', id ? { backend_id: id } : {})
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Einstellungen — LLM-Backends" className="max-w-2xl">
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
            <Select
              value={pricingMode}
              onChange={(e) => savePricing(e.target.value, pricingId)}
            >
              <option value="llm">Nur LLM-Schätzung</option>
              <option value="websearch">LLM + Websuche</option>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
              Preis-Backend
            </label>
            <Select
              value={pricingId}
              onChange={(e) => savePricing(pricingMode, e.target.value)}
            >
              <option value="">Automatisch (erstes aktive)</option>
              {backends.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.model_id})
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* Such-Provider für die Preis-Websuche */}
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
              <div className="mt-2">
                <Input
                  placeholder="SearXNG-URL (z.B. http://192.168.0.10:32773)"
                  value={searxngUrl}
                  onChange={(e) => setSearxngUrl(e.target.value)}
                  onBlur={() => saveSearch({ searxng_url: searxngUrl })}
                />
              </div>
            )}

            {searchProvider === 'tavily' && (
              <div className="mt-2 flex gap-2">
                <Input
                  type="password"
                  placeholder={hasTavilyKey ? 'Key gesetzt — neu eingeben zum Ändern' : 'Tavily API-Key'}
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
          {backends.map((b) => (
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
                  <Button variant="ghost" size="sm" onClick={() => remove(b)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {backends.length === 0 && (
            <p className="py-2 text-center text-sm text-slate-400">
              Noch kein Backend. Füge eines hinzu, damit die Objekterkennung funktioniert.
            </p>
          )}
        </div>

        {/* Hinzufügen */}
        {adding ? (
          <div className="space-y-2 rounded-xl border border-dashed border-slate-300 p-3 dark:border-slate-600">
            <Input placeholder="Anzeigename (z.B. OpenAI GPT-4o)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input placeholder="API Base URL (…/v1)" value={form.api_base_url} onChange={(e) => setForm({ ...form, api_base_url: e.target.value })} />
            <Input type="password" placeholder="API-Key" value={form.api_key} onChange={(e) => setForm({ ...form, api_key: e.target.value })} />
            <div className="flex gap-2">
              <Input
                placeholder="Modell-ID (z.B. gpt-4o)"
                list="model-options"
                value={form.model_id}
                onChange={(e) => setForm({ ...form, model_id: e.target.value })}
              />
              <datalist id="model-options">
                {models.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
              <Button
                variant="secondary"
                size="md"
                onClick={loadModels}
                disabled={loadingModels}
                title="Modelle vom Endpunkt laden"
              >
                {loadingModels ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Modelle
              </Button>
            </div>
            {modelsError && <p className="text-sm text-amber-600">{modelsError}</p>}
            {models.length > 0 && !modelsError && (
              <p className="text-xs text-slate-400">{models.length} Modelle geladen — Feld antippen für Vorschläge.</p>
            )}
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.supports_vision} onChange={(e) => setForm({ ...form, supports_vision: e.target.checked })} />
                Vision
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.supports_tools} onChange={(e) => setForm({ ...form, supports_tools: e.target.checked })} />
                Tools / Websuche
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                Aktiv
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setAdding(false)}>
                Abbrechen
              </Button>
              <Button size="sm" onClick={add} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Anlegen'}
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="secondary" className="w-full" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> Backend hinzufügen
          </Button>
        )}
      </div>
    </Dialog>
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
