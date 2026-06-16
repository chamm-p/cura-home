import { CheckCircle2, Loader2, Plus, Trash2, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  type LlmBackend,
  createBackend,
  deleteBackend,
  getKv,
  listBackends,
  putKv,
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
  const [form, setForm] = useState({ ...EMPTY })
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; msg: string }>>({})

  async function reload() {
    const [bs, cfg] = await Promise.all([listBackends(), getKv('vision_config')])
    setBackends(bs)
    setVisionId((cfg?.backend_id as string) || '')
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
            <Input placeholder="Modell-ID (z.B. gpt-4o)" value={form.model_id} onChange={(e) => setForm({ ...form, model_id: e.target.value })} />
            <Input type="password" placeholder="API-Key" value={form.api_key} onChange={(e) => setForm({ ...form, api_key: e.target.value })} />
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
