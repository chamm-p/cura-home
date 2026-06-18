import { Camera, Loader2, ScanSearch, Sparkles, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { CATEGORIES } from '../lib/categories'
import { fmtDate } from '../lib/format'
import {
  type Area,
  type Item,
  addPhoto,
  deleteItem,
  getItem,
  recognizeItem,
  updateItem,
  visionStatus,
} from '../services/inventory'
import { type PriceEstimate, estimatePrice, pricingStatus } from '../services/pricing'
import { Button } from './ui/button'
import { Dialog } from './ui/dialog'
import { Input } from './ui/input'
import { Select } from './ui/select'

export function ItemDialog({
  itemId,
  areas,
  onClose,
  onChanged,
}: {
  itemId: string | null
  areas: Area[]
  onClose: () => void
  onChanged: () => void
}) {
  const [item, setItem] = useState<Item | null>(null)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [areaId, setAreaId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [priceAvailable, setPriceAvailable] = useState(false)
  const [visionAvailable, setVisionAvailable] = useState(false)
  const [recognizing, setRecognizing] = useState(false)
  const [estimating, setEstimating] = useState(false)
  const [suggestion, setSuggestion] = useState<PriceEstimate | null>(null)
  const [priceError, setPriceError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!itemId) return
    setSuggestion(null)
    setPriceError(null)
    getItem(itemId).then((it) => {
      setItem(it)
      setName(it.name ?? '')
      setCategory(it.category ?? '')
      setDescription(it.description ?? '')
      setPrice(it.price_new != null ? String(it.price_new) : '')
      setAreaId(it.area_id)
    })
    pricingStatus()
      .then((s) => setPriceAvailable(s.available))
      .catch(() => setPriceAvailable(false))
    visionStatus()
      .then((s) => setVisionAvailable(s.available))
      .catch(() => setVisionAvailable(false))
  }, [itemId])

  async function reRecognize() {
    if (!item) return
    setRecognizing(true)
    try {
      const updated = await recognizeItem(item.id)
      setItem(updated)
      setName(updated.name ?? '')
      setCategory(updated.category ?? '')
      if (updated.description) setDescription(updated.description)
      onChanged()
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Erkennung fehlgeschlagen.')
    } finally {
      setRecognizing(false)
    }
  }

  async function suggestPrice() {
    if (!name.trim()) {
      setPriceError('Bitte zuerst einen Namen vergeben.')
      return
    }
    setPriceError(null)
    setEstimating(true)
    try {
      const res = await estimatePrice(name.trim(), description.trim() || null)
      setSuggestion(res)
      if (res.price != null) setPrice(String(res.price))
    } catch (e: any) {
      setPriceError(e?.response?.data?.detail || 'Preisvorschlag fehlgeschlagen.')
    } finally {
      setEstimating(false)
    }
  }

  async function save() {
    if (!item) return
    setBusy(true)
    try {
      const p = price.trim() ? Number(price.replace(',', '.')) : null
      await updateItem(item.id, {
        name: name.trim() || null,
        category: category || null,
        description: description.trim() || null,
        price_new: Number.isFinite(p as number) ? p : null,
        area_id: areaId,
        is_catalogued: !!name.trim(),
      })
      onChanged()
      onClose()
    } finally {
      setBusy(false)
    }
  }

  async function onAddPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !item) return
    setBusy(true)
    try {
      setItem(await addPhoto(item.id, file))
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!item || !confirm('Dieses Objekt wirklich löschen?')) return
    setBusy(true)
    try {
      await deleteItem(item.id)
      onChanged()
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={!!itemId} onOpenChange={(v) => !v && onClose()} title="Objekt bearbeiten">
      {!item ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="space-y-4">
          {item.photos.length > 0 && (
            <div className="flex gap-2 overflow-x-auto">
              {item.photos.map((p) => (
                <img
                  key={p.id}
                  src={p.thumb_url}
                  alt=""
                  className="h-24 w-24 shrink-0 rounded-xl object-cover"
                />
              ))}
            </div>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="visually-hidden"
            onChange={onAddPhoto}
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
              <Camera className="h-4 w-4" /> Foto hinzufügen
            </Button>
            {visionAvailable && item.photos.length > 0 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={reRecognize}
                disabled={recognizing}
                title="Objekt anhand des Fotos erneut per Vision erkennen"
              >
                {recognizing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ScanSearch className="h-4 w-4" />
                )}
                Mit Vision erkennen
              </Button>
            )}
          </div>

          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Objektname" />
          </Field>
          <Field label="Kategorie">
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">— keine —</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Bereich">
              <Select value={areaId ?? ''} onChange={(e) => setAreaId(e.target.value || null)}>
                <option value="">Ohne Bereich</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Neupreis">
              <Input
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="z.B. 89,99"
              />
              {item.price_new != null && item.price_determined_at && (
                <p className="mt-1 text-xs text-slate-400">
                  ermittelt am {fmtDate(item.price_determined_at)}
                </p>
              )}
            </Field>
          </div>

          {priceAvailable && (
            <div>
              <Button
                variant="secondary"
                size="sm"
                onClick={suggestPrice}
                disabled={estimating}
              >
                {estimating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 text-indigo-500" />
                )}
                Preis vorschlagen
              </Button>
              {priceError && <p className="mt-1 text-sm text-red-500">{priceError}</p>}
              {suggestion && (
                <div className="mt-2 rounded-xl bg-indigo-50 p-3 text-sm dark:bg-indigo-500/10">
                  <p className="text-slate-600 dark:text-slate-300">
                    {suggestion.note ||
                      (suggestion.mode === 'websearch'
                        ? 'Vorschlag mit Websuche'
                        : 'LLM-Schätzung')}
                  </p>
                  {suggestion.sources.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {suggestion.sources.map((s, i) => (
                        <li key={i} className="truncate">
                          <a
                            href={s}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 hover:underline dark:text-indigo-400"
                          >
                            {s}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
          <Field label="Beschreibung">
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="optional"
            />
          </Field>

          <div className="flex items-center justify-between pt-2">
            <Button variant="danger" size="sm" onClick={remove} disabled={busy}>
              <Trash2 className="h-4 w-4" /> Löschen
            </Button>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={onClose} disabled={busy}>
                Abbrechen
              </Button>
              <Button onClick={save} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Speichern'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
        {label}
      </label>
      {children}
    </div>
  )
}
