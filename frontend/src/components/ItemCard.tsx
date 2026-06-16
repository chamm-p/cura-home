import { ImageOff, TriangleAlert } from 'lucide-react'
import { eur } from '../lib/format'
import { type Item } from '../services/inventory'

export function ItemCard({ item, onClick }: { item: Item; onClick: () => void }) {
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
        <span
          className={
            'mt-auto text-sm ' +
            (item.price_new == null
              ? 'text-slate-400'
              : 'font-semibold text-slate-700 dark:text-slate-200')
          }
        >
          {item.price_new == null ? 'kein Preis' : eur(item.price_new)}
        </span>
      </div>
    </button>
  )
}
