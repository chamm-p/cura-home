import { useState } from 'react'
import { type House } from '../services/houses'
import { type Area } from '../services/inventory'
import { isAdmin, useAuthStore } from '../store/auth'
import { AreasPanel } from './AreasPanel'
import { BackendsPanel } from './BackendsPanel'
import { HousesPanel } from './HousesPanel'
import { Dialog } from './ui/dialog'

type Tab = 'houses' | 'areas' | 'backends'

export function SettingsHub({
  open,
  onOpenChange,
  houses,
  areas,
  onChanged,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  houses: House[]
  areas: Area[]
  onChanged: () => void
}) {
  const user = useAuthStore((s) => s.user)
  const admin = isAdmin(user)
  const [tab, setTab] = useState<Tab>('houses')

  const tabs: { id: Tab; label: string }[] = [
    { id: 'houses', label: 'Häuser' },
    { id: 'areas', label: 'Bereiche' },
    ...(admin ? [{ id: 'backends' as Tab, label: 'KI & Backends' }] : []),
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Einstellungen" className="max-w-2xl">
      <div className="mb-4 flex gap-1 border-b border-slate-200 dark:border-slate-700">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={
              '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ' +
              (tab === t.id
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-300'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300')
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'houses' && <HousesPanel houses={houses} onChanged={onChanged} />}
      {tab === 'areas' && <AreasPanel areas={areas} onChanged={onChanged} />}
      {tab === 'backends' && admin && <BackendsPanel />}
    </Dialog>
  )
}
