import {
  Boxes,
  Camera,
  CheckSquare,
  LayoutGrid,
  List,
  LogOut,
  Plus,
  Printer,
  Settings,
  Trash2,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { CaptureDialog } from '../components/CaptureDialog'
import { ExportDialog } from '../components/ExportDialog'
import { FilterBar, type Filters } from '../components/FilterBar'
import { ItemCard } from '../components/ItemCard'
import { ItemDialog } from '../components/ItemDialog'
import { ItemRow } from '../components/ItemRow'
import { NewItemDialog } from '../components/NewItemDialog'
import { SettingsHub } from '../components/SettingsHub'
import { ThemeToggle } from '../components/ThemeToggle'
import { Button } from '../components/ui/button'
import { Select } from '../components/ui/select'
import { Spinner } from '../components/ui/spinner'
import { money } from '../lib/format'
import { type House, listHouses } from '../services/houses'
import {
  type Area,
  type Item,
  bulkDeleteItems,
  bulkSetArea,
  listAreas,
  listItems,
  visionStatus,
} from '../services/inventory'
import { displayName, useAuthStore } from '../store/auth'
import { useHouseStore } from '../store/house'
import { useUiStore } from '../store/ui'

export default function Inventory() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const currentHouseId = useHouseStore((s) => s.currentHouseId)
  const setCurrentHouse = useHouseStore((s) => s.setCurrentHouse)
  const viewMode = useUiStore((s) => s.viewMode)
  const setViewMode = useUiStore((s) => s.setViewMode)

  const [houses, setHouses] = useState<House[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [filters, setFilters] = useState<Filters>({
    area_id: null,
    uncatalogued: false,
    no_price: false,
    category: null,
    needs_verification: false,
    for_sale: false,
    for_disposal: false,
  })
  const [loading, setLoading] = useState(true)
  const [visionAvailable, setVisionAvailable] = useState(false)

  const [captureOpen, setCaptureOpen] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  function exitSelection() {
    setSelectionMode(false)
    setSelected(new Set())
  }

  async function bulkDelete() {
    if (!selected.size) return
    if (!confirm(`${selected.size} Objekt(e) endgültig löschen?`)) return
    await bulkDeleteItems([...selected])
    exitSelection()
    refreshAll()
  }

  async function bulkMove(areaId: string | null) {
    if (!selected.size) return
    await bulkSetArea([...selected], areaId)
    exitSelection()
    refreshAll()
  }

  // Häuser laden + aktives Haus bestimmen.
  const loadHouses = useCallback(async () => {
    const hs = await listHouses()
    setHouses(hs)
    const persisted = useHouseStore.getState().currentHouseId
    const valid = hs.find((h) => h.id === persisted)
    if (!valid && hs.length) setCurrentHouse(hs[0].id)
    return hs
  }, [setCurrentHouse])

  useEffect(() => {
    loadHouses()
  }, [loadHouses])

  const loadAreas = useCallback(() => listAreas().then(setAreas), [])
  const loadItems = useCallback(() => listItems(filters).then(setItems), [filters])

  // Bei Hauswechsel: Bereiche, Vision-Status und Filter zurücksetzen.
  useEffect(() => {
    if (!currentHouseId) return
    loadAreas()
    visionStatus()
      .then((s) => setVisionAvailable(s.available))
      .catch(() => setVisionAvailable(false))
    setFilters((f) => ({ ...f, area_id: null, category: null }))
    setSelectionMode(false)
    setSelected(new Set())
  }, [currentHouseId, loadAreas])

  useEffect(() => {
    if (!currentHouseId) return
    setLoading(true)
    loadItems().finally(() => setLoading(false))
  }, [currentHouseId, loadItems])

  const refreshAll = useCallback(() => {
    loadHouses()
    loadAreas()
    loadItems()
  }, [loadHouses, loadAreas, loadItems])

  const groups = useMemo(() => {
    const areaName = new Map(areas.map((a) => [a.id, a.name]))
    const byArea = new Map<string, Item[]>()
    for (const it of items) {
      const key = it.area_id ?? '__none__'
      if (!byArea.has(key)) byArea.set(key, [])
      byArea.get(key)!.push(it)
    }
    const entries = [...byArea.entries()].map(([key, its]) => ({
      key,
      name: key === '__none__' ? 'Ohne Bereich' : areaName.get(key) ?? 'Unbekannt',
      items: its,
      sum: its.reduce((s, i) => s + (i.price_new ?? 0), 0),
    }))
    entries.sort((a, b) => {
      if (a.key === '__none__') return 1
      if (b.key === '__none__') return -1
      return a.name.localeCompare(b.name, 'de')
    })
    return entries
  }, [items, areas])

  const total = useMemo(
    () => items.reduce((s, i) => s + (i.price_new ?? 0), 0),
    [items],
  )

  const currency = useMemo(
    () => houses.find((h) => h.id === currentHouseId)?.currency ?? 'EUR',
    [houses, currentHouseId],
  )

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 ring-1 ring-indigo-400/30">
              <Boxes className="h-5 w-5 text-indigo-500" />
            </div>
            {/* Haus-Umschalter */}
            <Select
              className="h-9 max-w-[12rem]"
              value={currentHouseId ?? ''}
              onChange={(e) => setCurrentHouse(e.target.value)}
            >
              {houses.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExportOpen(true)}
              title="Inventarliste als PDF / drucken"
            >
              <Printer className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSettingsOpen(true)}
              title="Einstellungen (Häuser, Bereiche, KI)"
            >
              <Settings className="h-4 w-4" />
            </Button>
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={logout} title="Abmelden">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 pb-3">
          <FilterBar areas={areas} filters={filters} onChange={setFilters} />
          <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => (selectionMode ? exitSelection() : setSelectionMode(true))}
            title="Auswählen"
            className={
              'flex h-9 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium ' +
              (selectionMode
                ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300'
                : 'border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800')
            }
          >
            <CheckSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Auswählen</span>
          </button>
          <div className="flex h-9 overflow-hidden rounded-xl border border-slate-300 dark:border-slate-700">
            <button
              onClick={() => setViewMode('tiles')}
              title="Kacheln"
              className={
                'flex w-9 items-center justify-center ' +
                (viewMode === 'tiles'
                  ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800')
              }
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              title="Liste"
              className={
                'flex w-9 items-center justify-center border-l border-slate-300 dark:border-slate-700 ' +
                (viewMode === 'list'
                  ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800')
              }
            >
              <List className="h-4 w-4" />
            </button>
          </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-5">
        {user && (
          <p className="mb-4 text-lg text-slate-700 dark:text-slate-200">
            Hallo, <span className="font-semibold">{displayName(user)}</span> 👋
          </p>
        )}
        {loading ? (
          <div className="flex justify-center py-20">
            <Spinner className="h-7 w-7 text-slate-400" />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-500 dark:border-slate-700">
            <Camera className="mx-auto mb-3 h-10 w-10 opacity-40" />
            <p className="font-medium">Nichts gefunden.</p>
            <p className="mt-1 text-sm">
              Tippe unten auf „Erfassen", um Inventar zu fotografieren.
            </p>
          </div>
        ) : (
          <div className="space-y-7">
            {groups.map((g) => (
              <section key={g.key}>
                <div className="mb-2 flex items-baseline justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                    {g.name}{' '}
                    <span className="font-normal text-slate-400">({g.items.length})</span>
                  </h2>
                  <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                    {money(g.sum, currency)}
                  </span>
                </div>
                {viewMode === 'tiles' ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                    {g.items.map((it) => (
                      <ItemCard
                        key={it.id}
                        item={it}
                        currency={currency}
                        selectable={selectionMode}
                        selected={selected.has(it.id)}
                        onClick={() =>
                          selectionMode ? toggleSelect(it.id) : setDetailId(it.id)
                        }
                      />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {g.items.map((it) => (
                      <ItemRow
                        key={it.id}
                        item={it}
                        currency={currency}
                        selectable={selectionMode}
                        selected={selected.has(it.id)}
                        onClick={() =>
                          selectionMode ? toggleSelect(it.id) : setDetailId(it.id)
                        }
                      />
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        {selectionMode ? (
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3">
            <span className="text-sm font-medium">{selected.size} ausgewählt</span>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                className="h-10 w-auto"
                value=""
                disabled={!selected.size}
                onChange={(e) =>
                  bulkMove(e.target.value === '__none__' ? null : e.target.value)
                }
              >
                <option value="" disabled>
                  Verschieben nach…
                </option>
                <option value="__none__">Ohne Bereich</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
              <Button variant="danger" size="lg" onClick={bulkDelete} disabled={!selected.size}>
                <Trash2 className="h-5 w-5" /> Löschen
              </Button>
              <Button variant="secondary" size="lg" onClick={exitSelection}>
                <X className="h-5 w-5" /> Fertig
              </Button>
            </div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
            <div className="text-sm">
              <span className="text-slate-500">Summe</span>{' '}
              <span className="text-base font-bold">{money(total, currency)}</span>{' '}
              <span className="text-slate-400">· {items.length} Objekte</span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="lg"
                onClick={() => setNewOpen(true)}
                title="Objekt ohne Foto manuell anlegen"
              >
                <Plus className="h-5 w-5" />
              </Button>
              <Button size="lg" onClick={() => setCaptureOpen(true)}>
                <Camera className="h-5 w-5" /> Erfassen
              </Button>
            </div>
          </div>
        )}
      </div>

      <CaptureDialog
        open={captureOpen}
        onOpenChange={setCaptureOpen}
        areas={areas}
        visionAvailable={visionAvailable}
        defaultAreaId={filters.area_id}
        onChanged={refreshAll}
      />
      <NewItemDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        areas={areas}
        defaultAreaId={filters.area_id}
        onChanged={refreshAll}
        onCreated={(id) => setDetailId(id)}
      />
      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} filters={filters} />
      <SettingsHub
        open={settingsOpen}
        onOpenChange={(v) => {
          setSettingsOpen(v)
          if (!v)
            visionStatus()
              .then((s) => setVisionAvailable(s.available))
              .catch(() => {})
        }}
        houses={houses}
        areas={areas}
        onChanged={refreshAll}
      />
      <ItemDialog
        itemId={detailId}
        areas={areas}
        onClose={() => setDetailId(null)}
        onChanged={refreshAll}
        onNavigate={(id) => setDetailId(id)}
      />
    </div>
  )
}
