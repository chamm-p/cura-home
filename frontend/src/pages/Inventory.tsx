import { Boxes, Camera, FolderTree, Home, LogOut, Settings } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AreasDialog } from '../components/AreasDialog'
import { CaptureDialog } from '../components/CaptureDialog'
import { FilterBar, type Filters } from '../components/FilterBar'
import { HousesDialog } from '../components/HousesDialog'
import { ItemCard } from '../components/ItemCard'
import { ItemDialog } from '../components/ItemDialog'
import { SettingsDialog } from '../components/SettingsDialog'
import { ThemeToggle } from '../components/ThemeToggle'
import { Button } from '../components/ui/button'
import { Select } from '../components/ui/select'
import { Spinner } from '../components/ui/spinner'
import { money } from '../lib/format'
import { type House, listHouses } from '../services/houses'
import { type Area, type Item, listAreas, listItems, visionStatus } from '../services/inventory'
import { displayName, isAdmin, useAuthStore } from '../store/auth'
import { useHouseStore } from '../store/house'

export default function Inventory() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const currentHouseId = useHouseStore((s) => s.currentHouseId)
  const setCurrentHouse = useHouseStore((s) => s.setCurrentHouse)

  const [houses, setHouses] = useState<House[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [filters, setFilters] = useState<Filters>({
    area_id: null,
    uncatalogued: false,
    no_price: false,
  })
  const [loading, setLoading] = useState(true)
  const [visionAvailable, setVisionAvailable] = useState(false)

  const [captureOpen, setCaptureOpen] = useState(false)
  const [areasOpen, setAreasOpen] = useState(false)
  const [housesOpen, setHousesOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)

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
    setFilters((f) => ({ ...f, area_id: null }))
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
            <Button variant="ghost" size="sm" onClick={() => setHousesOpen(true)} title="Häuser & Teilen">
              <Home className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setAreasOpen(true)} title="Bereiche">
              <FolderTree className="h-4 w-4" />
            </Button>
            {isAdmin(user) && (
              <Button variant="ghost" size="sm" onClick={() => setSettingsOpen(true)} title="Einstellungen">
                <Settings className="h-4 w-4" />
              </Button>
            )}
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={logout} title="Abmelden">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="mx-auto max-w-5xl px-4 pb-3">
          <FilterBar areas={areas} filters={filters} onChange={setFilters} />
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
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {g.items.map((it) => (
                    <ItemCard
                      key={it.id}
                      item={it}
                      currency={currency}
                      onClick={() => setDetailId(it.id)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="text-sm">
            <span className="text-slate-500">Summe</span>{' '}
            <span className="text-base font-bold">{money(total, currency)}</span>{' '}
            <span className="text-slate-400">· {items.length} Objekte</span>
          </div>
          <Button size="lg" onClick={() => setCaptureOpen(true)}>
            <Camera className="h-5 w-5" /> Erfassen
          </Button>
        </div>
      </div>

      <CaptureDialog
        open={captureOpen}
        onOpenChange={setCaptureOpen}
        areas={areas}
        visionAvailable={visionAvailable}
        defaultAreaId={filters.area_id}
        onChanged={refreshAll}
      />
      <HousesDialog
        open={housesOpen}
        onOpenChange={setHousesOpen}
        houses={houses}
        onChanged={refreshAll}
      />
      <AreasDialog open={areasOpen} onOpenChange={setAreasOpen} areas={areas} onChanged={refreshAll} />
      {isAdmin(user) && (
        <SettingsDialog
          open={settingsOpen}
          onOpenChange={(v) => {
            setSettingsOpen(v)
            if (!v)
              visionStatus()
                .then((s) => setVisionAvailable(s.available))
                .catch(() => {})
          }}
        />
      )}
      <ItemDialog
        itemId={detailId}
        areas={areas}
        onClose={() => setDetailId(null)}
        onChanged={refreshAll}
      />
    </div>
  )
}
