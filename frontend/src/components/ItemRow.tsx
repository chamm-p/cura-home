import { ImageOff, TriangleAlert } from 'lucide-react'
import { fmtDate, money } from '../lib/format'
import { type Item } from '../services/inventory'

export function ItemRow({
  item,
  currency,
  onClick,
}: {
  item: Item
  currency: string
  onClick: () => void
}) {
  const primary = item.photos.find((p) => p.is_primary) ?? item.photos[0]
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left transition-colors hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
    >
      <div className="group relative shrink-0">
        {primary ? (
          <>
            <img
              src={primary.thumb_url}
              alt={item.name ?? ''}
              className="h-11 w-11 rounded-lg object-cover"
              loading="lazy"
            />
            {/* Hover-Vorschau (Desktop) */}
            <img
              src={primary.url}
              alt=""
              className="pointer-events-none absolute left-12 top-1/2 z-30 hidden h-48 w-48 -translate-y-1/2 rounded-xl object-cover shadow-2xl ring-1 ring-black/10 group-hover:block"
            />
          </>
        ) : (
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-slate-300 dark:bg-slate-800">
            <ImageOff className="h-5 w-5" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-medium">
            {item.name || <span className="italic text-slate-400">Unbenannt</span>}
          </span>
          {!item.is_catalogued && (
            <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-amber-500" />
          )}
        </div>
      </div>

      <div className="shrink-0 text-right">
        <span
          className={
            item.price_new == null ? 'text-sm text-slate-400' : 'text-sm font-semibold'
          }
        >
          {item.price_new == null ? 'kein Preis' : money(item.price_new, currency)}
        </span>
        {item.price_new != null && item.price_determined_at && (
          <span className="block text-[11px] text-slate-400">
            {fmtDate(item.price_determined_at)}
          </span>
        )}
      </div>
    </button>
  )
}
