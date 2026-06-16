import { Camera, Check, Loader2, Sparkles, TriangleAlert } from 'lucide-react'
import { useRef, useState } from 'react'
import {
  type Area,
  type CaptureResult,
  capture,
  updateItem,
} from '../services/inventory'
import { Button } from './ui/button'
import { Dialog } from './ui/dialog'
import { Input } from './ui/input'
import { Select } from './ui/select'

interface Row extends CaptureResult {
  draftName: string
  draftPrice: string
  saved: boolean
}

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
  const [rows, setRows] = useState<Row[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = '' // erlaubt erneutes Wählen desselben Fotos
    if (!files.length) return
    setError(null)
    setBusy(true)
    try {
      for (const file of files) {
        const res = await capture(file, areaId)
        setRows((prev) => [
          {
            ...res,
            draftName: res.item.name ?? '',
            draftPrice: '',
            saved: false,
          },
          ...prev,
        ])
      }
      onChanged()
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Upload fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  async function save(idx: number) {
    const row = rows[idx]
    const price = row.draftPrice.trim()
      ? Number(row.draftPrice.replace(',', '.'))
      : null
    const updated = await updateItem(row.item.id, {
      name: row.draftName.trim() || null,
      price_new: Number.isFinite(price as number) ? price : null,
      is_catalogued: !!row.draftName.trim(),
    })
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, item: updated, saved: true } : r)),
    )
    onChanged()
  }

  function patch(idx: number, p: Partial<Row>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...p } : r)))
  }

  function close() {
    setRows([])
    onChanged()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : close())} title="Inventar erfassen">
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
            Hausbereich
          </label>
          <Select
            value={areaId ?? ''}
            onChange={(e) => setAreaId(e.target.value || null)}
          >
            <option value="">Ohne Bereich</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </div>

        {!visionAvailable && (
          <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            Kein Vision-Backend konfiguriert — Fotos werden erfasst, aber nicht
            automatisch benannt. (Einstellungen → LLM-Backends)
          </p>
        )}

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
          disabled={busy}
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
          {busy ? 'Erkenne…' : 'Foto aufnehmen'}
        </Button>
        {error && <p className="text-sm text-red-500">{error}</p>}

        {rows.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Diese Sitzung ({rows.length})
            </p>
            {rows.map((row, idx) => (
              <div
                key={row.item.id}
                className="flex gap-3 rounded-xl border border-slate-200 p-2 dark:border-slate-700"
              >
                <img
                  src={row.item.photos[0]?.thumb_url}
                  alt=""
                  className="h-16 w-16 shrink-0 rounded-lg object-cover"
                />
                <div className="flex flex-1 flex-col gap-1">
                  <div className="flex items-center gap-1">
                    {row.vision_ok && (
                      <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                    )}
                    <Input
                      className="h-8"
                      placeholder="Name"
                      value={row.draftName}
                      onChange={(e) => patch(idx, { draftName: e.target.value, saved: false })}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      className="h-8 w-28"
                      placeholder="Preis €"
                      inputMode="decimal"
                      value={row.draftPrice}
                      onChange={(e) => patch(idx, { draftPrice: e.target.value, saved: false })}
                    />
                    <Button
                      size="sm"
                      variant={row.saved ? 'secondary' : 'primary'}
                      onClick={() => save(idx)}
                    >
                      {row.saved ? <Check className="h-4 w-4" /> : 'Speichern'}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <Button variant="secondary" className="w-full" onClick={close}>
          Fertig
        </Button>
      </div>
    </Dialog>
  )
}
