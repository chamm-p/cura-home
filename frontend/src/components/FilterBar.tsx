import { SlidersHorizontal } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { CATEGORIES } from '../lib/categories'
import { type Area } from '../services/inventory'
import { Select } from './ui/select'

export interface Filters {
  area_id: string | null
  uncatalogued: boolean
  no_price: boolean
  category: string | null
  needs_verification: boolean
  for_sale: boolean
  for_disposal: boolean
}

// Bool-Filter, gebündelt in einem Dropdown.
const FLAGS = [
  { key: 'needs_verification', label: 'Zu verifizieren' },
  { key: 'uncatalogued', label: 'Unkatalogisiert' },
  { key: 'no_price', label: 'Ohne Preis' },
  { key: 'for_sale', label: 'Zu verkaufen' },
  { key: 'for_disposal', label: 'Zu entsorgen' },
] as const

export function FilterBar({
  areas,
  filters,
  onChange,
}: {
  areas: Area[]
  filters: Filters
  onChange: (f: Filters) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const activeCount = FLAGS.filter((f) => filters[f.key]).length

  function clearFlags() {
    onChange({
      ...filters,
      needs_verification: false,
      uncatalogued: false,
      no_price: false,
      for_sale: false,
      for_disposal: false,
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        className="h-9 w-auto min-w-36"
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

      <Select
        className="h-9 w-auto min-w-36"
        value={filters.category ?? ''}
        onChange={(e) => onChange({ ...filters, category: e.target.value || null })}
      >
        <option value="">Alle Kategorien</option>
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </Select>

      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen((o) => !o)}
          className={
            'flex h-9 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium ' +
            (activeCount > 0
              ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300'
              : 'border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800')
          }
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filter
          {activeCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-500 px-1 text-xs text-white">
              {activeCount}
            </span>
          )}
        </button>

        {open && (
          <div className="absolute left-0 top-full z-40 mt-1 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            {FLAGS.map((f) => (
              <label
                key={f.key}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <input
                  type="checkbox"
                  checked={!!filters[f.key]}
                  onChange={(e) => onChange({ ...filters, [f.key]: e.target.checked })}
                />
                {f.label}
              </label>
            ))}
            {activeCount > 0 && (
              <button
                onClick={clearFlags}
                className="mt-1 w-full rounded-lg px-2 py-1.5 text-left text-xs text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Filter zurücksetzen
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
