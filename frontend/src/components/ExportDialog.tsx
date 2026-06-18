import { Loader2, Printer } from 'lucide-react'
import { useState } from 'react'
import { openInventoryPdf } from '../services/export'
import { type ItemFilters } from '../services/inventory'
import { Button } from './ui/button'
import { Dialog } from './ui/dialog'

export function ExportDialog({
  open,
  onOpenChange,
  filters,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  filters: ItemFilters
}) {
  const [withImages, setWithImages] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    setError(null)
    setBusy(true)
    try {
      await openInventoryPdf(filters, withImages)
      onOpenChange(false)
    } catch {
      setError('PDF-Export fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Inventarliste drucken / PDF">
      <div className="space-y-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Erstellt die Liste des aktiven Hauses (mit den aktuellen Filtern), gruppiert
          nach Bereich mit Summen und Total.
        </p>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={withImages}
            onChange={(e) => setWithImages(e.target.checked)}
          />
          <span>
            Fotos mitdrucken
            <span className="block text-xs text-slate-400">
              Kleine Thumbnails (~1 cm) — papiersparend, viele Objekte pro Seite.
            </span>
          </span>
        </label>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
            Abbrechen
          </Button>
          <Button onClick={run} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
            PDF erstellen
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
