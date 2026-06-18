import { Camera, Loader2, Sparkles, TriangleAlert, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { type Area, type Item, capture, deleteItem, processItems } from '../services/inventory'
import { Button } from './ui/button'
import { Dialog } from './ui/dialog'
import { Select } from './ui/select'

export function CaptureDialog({
  open,
  onOpenChange,
  areas,
  visionAvailable,
  defaultAreaId,
  onChanged,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  areas: Area[]
  visionAvailable: boolean
  defaultAreaId: string | null
  onChanged: () => void
}) {
  const [areaId, setAreaId] = useState<string | null>(defaultAreaId)
  const [items, setItems] = useState<Item[]>([])
  const [busy, setBusy] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!files.length) return
    setError(null)
    setBusy(true)
    try {
      for (const file of files) {
        const it = await capture(file, areaId)
        setItems((prev) => [it, ...prev])
      }
      onChanged()
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Upload fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    await deleteItem(id)
    setItems((prev) => prev.filter((i) => i.id !== id))
    onChanged()
  }

  function close() {
    setItems([])
    onChanged()
    onOpenChange(false)
  }

  async function finish() {
    if (!items.length) {
      close()
      return
    }
    setProcessing(true)
    setError(null)
    try {
      await processItems(items.map((i) => i.id))
      close()
    } catch {
      setError('Verarbeitung konnte nicht gestartet werden.')
      setProcessing(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => (v ? onOpenChange(v) : close())}
      title="Inventar erfassen"
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
            Hausbereich
          </label>
          <Select value={areaId ?? ''} onChange={(e) => setAreaId(e.target.value || null)}>
            <option value="">Ohne Bereich</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="visually-hidden"
          onChange={onPick}
        />
        <Button
          size="lg"
          className="w-full"
          onClick={() => fileRef.current?.click()}
          disabled={busy || processing}
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
          {busy ? 'Lädt…' : 'Foto aufnehmen'}
        </Button>
        {error && <p className="text-sm text-red-500">{error}</p>}

        {items.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Aufgenommen ({items.length}) — schlechte antippen zum Löschen
            </p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {items.map((it) => (
                <div
                  key={it.id}
                  className="group relative aspect-square overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800"
                >
                  <img
                    src={it.photos[0]?.thumb_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                  <button
                    onClick={() => remove(it.id)}
                    title="Löschen"
                    className="absolute right-1 top-1 rounded-full bg-black/55 p-1 text-white hover:bg-red-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="flex items-start gap-2 text-xs text-slate-400">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {visionAvailable
            ? '„Speichern & erkennen" startet Erkennung + Preis-Schätzung im Hintergrund; die Objekte werden zum Prüfen markiert.'
            : 'Kein Vision-Backend — Objekte werden gespeichert und zum Prüfen markiert (Namen/Preise dann manuell).'}
        </p>

        <Button
          size="lg"
          className="w-full"
          onClick={finish}
          disabled={processing || busy || items.length === 0}
        >
          {processing ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Sparkles className="h-5 w-5" />
          )}
          Speichern & erkennen{items.length ? ` (${items.length})` : ''}
        </Button>
      </div>
    </Dialog>
  )
}
