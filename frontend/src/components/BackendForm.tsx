import { Loader2, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import {
  type LlmBackend,
  createBackend,
  fetchModels,
  updateBackend,
} from '../services/settings'
import { Button } from './ui/button'
import { Input } from './ui/input'

/**
 * Formular zum Anlegen ODER Bearbeiten eines LLM-Backends. Alle Felder sind
 * editierbar; Modelle lassen sich direkt vom Endpunkt laden (beim Bearbeiten
 * auch mit dem bereits gespeicherten Key über die backend_id).
 */
export function BackendForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial: LlmBackend | null
  onSaved: () => void
  onCancel: () => void
}) {
  const isEdit = !!initial
  const [name, setName] = useState(initial?.name ?? '')
  const [baseUrl, setBaseUrl] = useState(
    initial?.api_base_url ?? 'https://api.openai.com/v1',
  )
  const [apiKey, setApiKey] = useState('')
  const [modelId, setModelId] = useState(initial?.model_id ?? '')
  const [vision, setVision] = useState(initial?.capabilities?.supports_vision ?? true)
  const [tools, setTools] = useState(initial?.capabilities?.supports_tools ?? false)
  const [active, setActive] = useState(initial?.is_active ?? true)

  const [models, setModels] = useState<string[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [modelsError, setModelsError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const datalistId = `models-${initial?.id ?? 'new'}`

  async function loadModels() {
    if (!baseUrl.trim()) {
      setModelsError('Bitte zuerst die API Base URL eintragen.')
      return
    }
    setModelsError(null)
    setLoadingModels(true)
    try {
      const ms = await fetchModels(baseUrl, apiKey || null, initial?.id)
      setModels(ms)
      if (!ms.length) setModelsError('Keine Modelle gefunden.')
      else if (!modelId) setModelId(ms[0])
    } catch (e: any) {
      setModelsError(e?.response?.data?.detail || 'Modelle konnten nicht geladen werden.')
    } finally {
      setLoadingModels(false)
    }
  }

  async function save() {
    if (!name.trim() || !baseUrl.trim() || !modelId.trim()) {
      setError('Name, API Base URL und Modell-ID sind erforderlich.')
      return
    }
    setError(null)
    setBusy(true)
    try {
      const payload = {
        name: name.trim(),
        api_base_url: baseUrl.trim(),
        model_id: modelId.trim(),
        supports_vision: vision,
        supports_tools: tools,
        is_active: active,
      }
      if (isEdit) {
        // Key nur überschreiben, wenn ein neuer eingegeben wurde.
        await updateBackend(initial!.id, {
          ...payload,
          ...(apiKey ? { api_key: apiKey } : {}),
        })
      } else {
        await createBackend({ ...payload, api_key: apiKey })
      }
      onSaved()
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Speichern fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-dashed border-slate-300 p-3 dark:border-slate-600">
      <Input
        placeholder="Anzeigename (z.B. OpenAI GPT-4o)"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <Input
        placeholder="API Base URL (…/v1)"
        value={baseUrl}
        onChange={(e) => setBaseUrl(e.target.value)}
      />
      <Input
        type="password"
        placeholder={
          isEdit && initial?.has_api_key
            ? 'Key gesetzt — leer lassen zum Behalten'
            : 'API-Key'
        }
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
      />
      <div className="flex gap-2">
        <Input
          placeholder="Modell-ID (z.B. gpt-4o)"
          list={datalistId}
          value={modelId}
          onChange={(e) => setModelId(e.target.value)}
        />
        <datalist id={datalistId}>
          {models.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
        <Button
          variant="secondary"
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
        <p className="text-xs text-slate-400">
          {models.length} Modelle geladen — Feld antippen für Vorschläge.
        </p>
      )}

      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={vision} onChange={(e) => setVision(e.target.checked)} />
          Vision
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={tools} onChange={(e) => setTools(e.target.checked)} />
          Tools / Websuche
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Aktiv
        </label>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onCancel}>
          Abbrechen
        </Button>
        <Button size="sm" onClick={save} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : isEdit ? 'Speichern' : 'Anlegen'}
        </Button>
      </div>
    </div>
  )
}
