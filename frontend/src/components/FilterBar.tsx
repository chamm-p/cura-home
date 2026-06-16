import { type Area } from '../services/inventory'
import { Select } from './ui/select'

export interface Filters {
  area_id: string | null
  uncatalogued: boolean
  no_price: boolean
}

export function FilterBar({
  areas,
  filters,
  onChange,
}: {
  areas: Area[]
  filters: Filters
  onChange: (f: Filters) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        className="w-auto min-w-44"
        value={filters.area_id ?? ''}
        onChange={(e) => onChange({ ...filters, area_id: e.target.value || null })}
      >
        <option value="">Alle Bereiche</option>
        {areas.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </Select>

      <Toggle
        active={filters.uncatalogued}
        onClick={() => onChange({ ...filters, uncatalogued: !filters.uncatalogued })}
      >
        Unkatalogisiert
      </Toggle>
      <Toggle
        active={filters.no_price}
        onClick={() => onChange({ ...filters, no_price: !filters.no_price })}
      >
        Ohne Preis
      </Toggle>
    </div>
  )
}

function Toggle({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={
        'h-10 rounded-xl border px-3 text-sm font-medium transition-colors ' +
        (active
          ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300'
          : 'border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800')
      }
    >
      {children}
    </button>
  )
}
