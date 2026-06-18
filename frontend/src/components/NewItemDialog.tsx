import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { CATEGORIES } from '../lib/categories'
import { type Area, categorizeName, createItem } from '../services/inventory'
import { Button } from './ui/button'
import { Dialog } from './ui/dialog'
import { Input } from './ui/input'
import { Select } from './ui/select'

export function NewItemDialog({
  open,
  onOpenChange,
  areas,
  defaultAreaId,
  onChanged,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  areas: Area[]
  defaultAreaId: string | null
  onChanged: () => void
  onCreated: (id: string) => void
}) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [areaId, setAreaId] = useState<string | null>(defaultAreaId)
  const [price, setPrice] = useState('')
  const [description, setDescription] = useState('')
  const [forSale, setForSale] = useState(false)
  const [forDisposal, setForDisposal] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [catBusy, setCatBusy] = useState(false)

  // Kategorie aus dem Namen vorschlagen, sofern noch keine gewählt ist.
  async function autoCategorize() {
    if (!name.trim() || category) return
    setCatBusy(true)
    try {
      const cat = await categorizeName(name.trim())
      if (cat) setCategory((cur) => cur || cat)
    } catch {
      /* still ignorieren */
    } finally {
      setCatBusy(false)
    }
  }

  // Beim Öffnen zurücksetzen.
  useEffect(() => {
    if (open) {
      setName('')
      setCategory('')
      setAreaId(defaultAreaId)
      setPrice('')
      setDescription('')
      setForSale(false)
      setForDisposal(false)
      setError(null)
    }
  }, [open, defaultAreaId])

  async function create(thenOpen: boolean) {
    if (!name.trim()) {
      setError('Bitte einen Namen vergeben.')
      return
    }
    setError(null)
    setBusy(true)
    try {
      const p = price.trim() ? Number(price.replace(',', '.')) : null
      const item = await createItem({
        name: name.trim(),
        category: category || null,
        area_id: areaId,
        price_new: Number.isFinite(p as number) ? p : null,
        description: description.trim() || null,
        is_catalogued: true,
        for_sale: forSale,
        for_disposal: forDisposal,
      })
      onChanged()
      onOpenChange(false)
      if (thenOpen) onCreated(item.id)
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Anlegen fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Neues Objekt (ohne Foto)">
      <div className="space-y-3">
        <Field label="Name">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={autoCategorize}
            placeholder="Objektname"
          />
        </Field>
        <Field label={catBusy ? 'Kategorie (wird vorgeschlagen…)' : 'Kategorie'}>
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
          </Field>
        </div>
        <Field label="Beschreibung">
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="optional"
          />
        </Field>

        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={forSale} onChange={(e) => setForSale(e.target.checked)} />
            Zu verkaufen
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={forDisposal}
              onChange={(e) => setForDisposal(e.target.checked)}
            />
            Zu entsorgen
          </label>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
            Abbrechen
          </Button>
          <Button variant="secondary" onClick={() => create(true)} disabled={busy}>
            Anlegen & Foto
          </Button>
          <Button onClick={() => create(false)} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Anlegen'}
          </Button>
        </div>
      </div>
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
