import { Crown, LogOut, Plus, Share2, Trash2, UserPlus, X } from 'lucide-react'
import { useState } from 'react'
import {
  type House,
  type HouseMember,
  addMember,
  createHouse,
  deleteHouse,
  listMembers,
  removeMember,
  updateHouse,
} from '../services/houses'
import { useAuthStore } from '../store/auth'
import { Button } from './ui/button'
import { Dialog } from './ui/dialog'
import { Input } from './ui/input'

export function HousesDialog({
  open,
  onOpenChange,
  houses,
  onChanged,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  houses: House[]
  onChanged: () => void
}) {
  const me = useAuthStore((s) => s.user)
  const [newName, setNewName] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [members, setMembers] = useState<HouseMember[]>([])
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function add() {
    if (!newName.trim()) return
    setBusy(true)
    try {
      await createHouse(newName.trim())
      setNewName('')
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  async function toggleShare(h: House) {
    if (expanded === h.id) {
      setExpanded(null)
      return
    }
    setExpanded(h.id)
    setError(null)
    setEmail('')
    setMembers(await listMembers(h.id))
  }

  async function invite(h: House) {
    if (!email.trim()) return
    setError(null)
    setBusy(true)
    try {
      await addMember(h.id, email.trim())
      setEmail('')
      setMembers(await listMembers(h.id))
      onChanged()
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Einladen fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  async function kick(h: House, userId: string) {
    await removeMember(h.id, userId)
    setMembers(await listMembers(h.id))
    onChanged()
  }

  async function leave(h: House) {
    if (!me || !confirm(`Haus „${h.name}" verlassen?`)) return
    await removeMember(h.id, me.id)
    onChanged()
  }

  async function remove(h: House) {
    if (!confirm(`Haus „${h.name}" und sein gesamtes Inventar löschen?`)) return
    await deleteHouse(h.id)
    onChanged()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Häuser & Wohnungen">
      <div className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Neues Haus (z.B. Wohnung Zürich)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <Button onClick={add} disabled={busy || !newName.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <ul className="space-y-2">
          {houses.map((h) => (
            <li
              key={h.id}
              className="rounded-xl border border-slate-200 p-3 dark:border-slate-700"
            >
              <div className="flex items-center gap-2">
                {h.is_owner ? (
                  <Input
                    defaultValue={h.name}
                    onBlur={(e) => {
                      const v = e.target.value.trim()
                      if (v && v !== h.name) updateHouse(h.id, v).then(onChanged)
                    }}
                  />
                ) : (
                  <span className="flex-1 font-medium">{h.name}</span>
                )}
                <span className="flex shrink-0 items-center gap-1 text-xs text-slate-400">
                  {h.is_owner ? <Crown className="h-3.5 w-3.5 text-amber-500" /> : null}
                  {h.member_count} 👤
                </span>
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                <Button variant="ghost" size="sm" onClick={() => toggleShare(h)}>
                  <Share2 className="h-4 w-4" /> Teilen
                </Button>
                {h.is_owner ? (
                  <Button variant="ghost" size="sm" onClick={() => remove(h)}>
                    <Trash2 className="h-4 w-4 text-red-500" /> Löschen
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => leave(h)}>
                    <LogOut className="h-4 w-4" /> Verlassen
                  </Button>
                )}
              </div>

              {expanded === h.id && (
                <div className="mt-3 space-y-2 border-t border-slate-200 pt-3 dark:border-slate-700">
                  {h.is_owner && (
                    <>
                      <div className="flex gap-2">
                        <Input
                          type="email"
                          placeholder="E-Mail einladen"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && invite(h)}
                        />
                        <Button size="sm" onClick={() => invite(h)} disabled={busy}>
                          <UserPlus className="h-4 w-4" />
                        </Button>
                      </div>
                      {error && <p className="text-sm text-red-500">{error}</p>}
                      <p className="text-xs text-slate-400">
                        Die Person muss sich vorher einmal angemeldet haben.
                      </p>
                    </>
                  )}
                  <ul className="space-y-1">
                    {members.map((m) => (
                      <li
                        key={m.user_id}
                        className="flex items-center justify-between rounded-lg bg-slate-50 px-2 py-1 text-sm dark:bg-slate-800"
                      >
                        <span className="flex items-center gap-1.5">
                          {m.is_owner && <Crown className="h-3.5 w-3.5 text-amber-500" />}
                          {m.name}{' '}
                          <span className="text-slate-400">({m.email})</span>
                        </span>
                        {h.is_owner && !m.is_owner && (
                          <button
                            onClick={() => kick(h, m.user_id)}
                            className="text-slate-400 hover:text-red-500"
                            title="Entfernen"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </Dialog>
  )
}
