import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { type Area, createArea, deleteArea, updateArea } from '../services/inventory'
import { Button } from './ui/button'
import { Dialog } from './ui/dialog'
import { Input } from './ui/input'

export function AreasDialog({
  open,
  onOpenChange,
  areas,
  onChanged,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  areas: Area[]
  onChanged: () => void
}) {
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)

  async function add() {
    if (!newName.trim()) return
    setBusy(true)
    try {
      await createArea(newName.trim())
      setNewName('')
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  async function rename(a: Area, name: string) {
    await updateArea(a.id, { name })
    onChanged()
  }

  async function remove(a: Area) {
    if (!confirm(`Bereich „${a.name}" löschen? Objekte bleiben erhalten (ohne Bereich).`)) return
    await deleteArea(a.id)
    onChanged()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Hausbereiche">
      <div className="space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder="Neuer Bereich (z.B. Küche)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <Button onClick={add} disabled={busy || !newName.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {areas.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">
            Noch keine Bereiche angelegt.
          </p>
        ) : (
          <ul className="space-y-2">
            {areas.map((a) => (
              <li key={a.id} className="flex items-center gap-2">
                <Input
                  defaultValue={a.name}
                  onBlur={(e) => {
                    const v = e.target.value.trim()
                    if (v && v !== a.name) rename(a, v)
                  }}
                />
                <Button variant="ghost" size="sm" onClick={() => remove(a)}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Dialog>
  )
}
