import { ImageOff, TriangleAlert } from 'lucide-react'
import { fmtDate, money } from '../lib/format'
import { type Item } from '../services/inventory'

export function ItemCard({
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
      className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-left transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="relative aspect-square w-full bg-slate-100 dark:bg-slate-800">
        {primary ? (
          <img
            src={primary.thumb_url}
            alt={item.name ?? 'Inventarobjekt'}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-300">
            <ImageOff className="h-10 w-10" />
          </div>
        )}
        {!item.is_catalogued && (
          <span className="absolute left-2 top-2 flex items-center gap-1 rounded-lg bg-amber-500/90 px-2 py-0.5 text-xs font-medium text-white">
            <TriangleAlert className="h-3 w-3" /> unkatalogisiert
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <span className="line-clamp-2 font-medium">
          {item.name || <span className="italic text-slate-400">Unbenannt</span>}
        </span>
        {item.category && (
          <span className="w-fit rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            {item.category}
          </span>
        )}
        <div className="mt-auto">
          <span
            className={
              'text-sm ' +
              (item.price_new == null
                ? 'text-slate-400'
                : 'font-semibold text-slate-700 dark:text-slate-200')
            }
          >
            {item.price_new == null ? 'kein Preis' : money(item.price_new, currency)}
          </span>
          {item.price_new != null && item.price_determined_at && (
            <span className="block text-[11px] text-slate-400">
              Preis vom {fmtDate(item.price_determined_at)}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
