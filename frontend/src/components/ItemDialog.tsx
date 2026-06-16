import { Camera, Loader2, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import {
  type Area,
  type Item,
  addPhoto,
  deleteItem,
  getItem,
  updateItem,
} from '../services/inventory'
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
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [areaId, setAreaId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!itemId) return
    getItem(itemId).then((it) => {
      setItem(it)
      setName(it.name ?? '')
      setDescription(it.description ?? '')
      setPrice(it.price_new != null ? String(it.price_new) : '')
      setAreaId(it.area_id)
    })
  }, [itemId])

  async function save() {
    if (!item) return
    setBusy(true)
    try {
      const p = price.trim() ? Number(price.replace(',', '.')) : null
      await updateItem(item.id, {
        name: name.trim() || null,
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
          <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
            <Camera className="h-4 w-4" /> Foto hinzufügen
          </Button>

          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Objektname" />
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
            <Field label="Neupreis (€)">
              <Input
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="z.B. 89,99"
              />
            </Field>
          </div>
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
