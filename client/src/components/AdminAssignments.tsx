import { useCallback, useEffect, useState } from 'react'
import { Card, CardHeader, Button } from './ui/Primitives'
import { useEquipmentDefinitions } from '../hooks/useEquipment'
import {
  useAssignments,
  createAssignment,
  deleteAssignment,
  fetchUsers,
  setUserRole,
  setUserPosition,
  type AppUser,
} from '../hooks/useData'
import { useToast } from './ui/Toast'
import { ShieldCheck, User, Loader2, ChevronDown } from 'lucide-react'

// Admin-only screen: a technicians × equipment grid of checkboxes, plus a
// per-user role toggle (promote/demote). Every action hits the backend and
// re-syncs.
export function AdminAssignments() {
  const [users, setUsers] = useState<AppUser[]>([])
  const [usersLoading, setUsersLoading] = useState(true)
  const { assignments, loading: assignmentsLoading, reload: reloadAssignments } = useAssignments()
  const { definitions } = useEquipmentDefinitions()
  const [pending, setPending] = useState<Set<string>>(new Set())
  const [usersOpen, setUsersOpen] = useState(true)
  const toast = useToast()

  const loadUsers = useCallback(async () => {
    setUsersLoading(true)
    try {
      setUsers(await fetchUsers())
    } catch (err) {
      console.error('[admin] load users failed', err)
    } finally {
      setUsersLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  const technicians = users.filter((u) => u.role === 'TECHNICIAN')
  const assigned = new Set(assignments.map((a) => `${a.technicianId}:${a.equipmentId}`))

  const markPending = (key: string, on: boolean) =>
    setPending((prev) => {
      const next = new Set(prev)
      if (on) next.add(key)
      else next.delete(key)
      return next
    })

  const toggle = async (technicianId: string, equipmentId: string) => {
    const key = `${technicianId}:${equipmentId}`
    const wasAssigned = assigned.has(key)
    const tech = technicians.find((t) => t.id === technicianId)
    const equipmentName = definitions.find((d) => d.id === equipmentId)?.name ?? equipmentId
    markPending(key, true)
    try {
      if (wasAssigned) await deleteAssignment(technicianId, equipmentId)
      else await createAssignment(technicianId, equipmentId)
      await reloadAssignments()
      toast.success(
        wasAssigned ? 'Affectation retirée' : 'Affectation ajoutée',
        `${equipmentName} ${wasAssigned ? 'retiré de' : 'affecté à'} ${tech?.name ?? 'le technicien'}.`,
      )
    } catch (err) {
      console.error('[admin] toggle assignment failed', err)
      toast.error('Échec de la mise à jour', 'Impossible de modifier l’affectation.')
    } finally {
      markPending(key, false)
    }
  }

  const changeRole = async (user: AppUser) => {
    const nextRole = user.role === 'ADMIN' ? 'TECHNICIAN' : 'ADMIN'
    markPending(`role:${user.id}`, true)
    try {
      await setUserRole(user.id, nextRole)
      await loadUsers()
      toast.success('Rôle mis à jour', `${user.name} est maintenant ${nextRole === 'ADMIN' ? 'administrateur' : 'technicien'}.`)
    } catch (err) {
      console.error('[admin] change role failed', err)
      toast.error('Échec du changement de rôle', 'La mise à jour n’a pas pu être appliquée.')
    } finally {
      markPending(`role:${user.id}`, false)
    }
  }

  const savePosition = async (user: AppUser, position: string) => {
    if ((position.trim() || null) === (user.position ?? null)) return // unchanged
    markPending(`pos:${user.id}`, true)
    try {
      await setUserPosition(user.id, position.trim())
      await loadUsers()
      toast.success('Fonction mise à jour', `${user.name} — ${position.trim() || 'aucune fonction'}.`)
    } catch (err) {
      console.error('[admin] set position failed', err)
      toast.error('Échec de la mise à jour', 'La fonction n’a pas pu être enregistrée.')
    } finally {
      markPending(`pos:${user.id}`, false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <button
          onClick={() => setUsersOpen((v) => !v)}
          aria-expanded={usersOpen}
          className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-[--color-graphite-50] sm:px-6"
        >
          <div>
            <h3 className="text-[15px] font-semibold text-[--color-graphite-900]">Utilisateurs et rôles</h3>
            <p className="mt-0.5 text-xs text-[--color-graphite-500]">Promouvoir un technicien en administrateur ou l'inverse</p>
          </div>
          <div className="flex items-center gap-3">
            {!usersLoading && (
              <span className="inline-flex items-center rounded-full bg-[--color-graphite-100] px-2.5 py-1 text-xs font-medium text-[--color-graphite-600]">
                {users.length} utilisateur{users.length > 1 ? 's' : ''}
              </span>
            )}
            <ChevronDown className={`h-4 w-4 text-[--color-graphite-400] transition-transform duration-200 ${usersOpen ? 'rotate-180' : ''}`} />
          </div>
        </button>
        {usersOpen && (
          <div className="animate-fade-in divide-y divide-[--color-graphite-100] border-t border-[--color-graphite-100]">
            {usersLoading ? (
              <div className="flex items-center gap-2 p-5 text-sm text-[--color-graphite-500]">
                <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
              </div>
            ) : users.length === 0 ? (
              <p className="p-5 text-sm text-[--color-graphite-500]">
                Aucun utilisateur. Les comptes apparaissent ici après leur première connexion via Clerk.
              </p>
            ) : (
              users.map((u) => (
              <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3">
                  <span className={`flex h-9 w-9 items-center justify-center rounded-full ${u.role === 'TECHNICIAN' ? 'bg-[--color-graphite-50] text-[--color-graphite-500]' : 'bg-[--color-status-normal-bg] text-[--color-status-normal]'}`}>
                    {u.role === 'TECHNICIAN' ? <User className="h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-[--color-graphite-900]">{u.name}</p>
                    <p className="text-xs text-[--color-graphite-500]">
                      {u.email} · {u.role === 'MODERATOR' ? 'Modérateur' : u.role === 'ADMIN' ? 'Administrateur' : 'Technicien'}
                      {u.position ? ` · ${u.position}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <PositionEditor user={u} pending={pending.has(`pos:${u.id}`)} onSave={(v) => savePosition(u, v)} />
                  {u.role === 'MODERATOR' ? (
                    <span className="text-xs text-[--color-graphite-400]">Géré dans Utilisateurs</span>
                  ) : (
                    <Button size="sm" variant="ghost" className="bg-graphite-500 hover:bg-graphite-700 text-white cursor-pointer" disabled={pending.has(`role:${u.id}`)} onClick={() => changeRole(u)}>
                      {u.role === 'ADMIN' ? 'Rétrograder en technicien' : 'Promouvoir admin'}
                    </Button>
                  )}
                </div>
              </div>
              ))
            )}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Affectation des équipements"
          subtitle="Cochez les équipements que chaque technicien peut inspecter"
        />
        <div className="overflow-x-auto p-5">
          {assignmentsLoading && technicians.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-[--color-graphite-500]">
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
            </div>
          ) : technicians.length === 0 ? (
            <p className="text-sm text-[--color-graphite-500]">Aucun technicien à afficher.</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-[--color-graphite-500]">
                  <th className="sticky left-0 bg-white px-3 py-2 font-medium">Technicien</th>
                  {definitions.map((def) => (
                    <th key={def.id} className="px-3 py-2 text-center font-medium">
                      <span className="block max-w-24 text-[11px] leading-tight">{def.name}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {technicians.map((tech) => (
                  <tr key={tech.id} className="border-t border-[--color-graphite-100]">
                    <td className="sticky left-0 bg-white px-3 py-2 font-medium text-[--color-graphite-900]">{tech.name}</td>
                    {definitions.map((def) => {
                      const key = `${tech.id}:${def.id}`
                      const isAssigned = assigned.has(key)
                      const isPending = pending.has(key)
                      return (
                        <td key={def.id} className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={isAssigned}
                            disabled={isPending}
                            onChange={() => toggle(tech.id, def.id)}
                            className="h-4 w-4 cursor-pointer accent-[--color-status-normal] disabled:opacity-40"
                          />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  )
}

// Inline job-title editor. Saves on blur / Enter when the value changed.
function PositionEditor({ user, pending, onSave }: { user: AppUser; pending: boolean; onSave: (value: string) => void }) {
  const [value, setValue] = useState(user.position ?? '')
  useEffect(() => setValue(user.position ?? ''), [user.position])
  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => onSave(value)}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        placeholder="Fonction…"
        disabled={pending}
        className="w-44 rounded-lg border border-[--color-graphite-200] bg-white px-3 py-1.5 pr-7 text-xs outline-none transition-colors focus:border-[--color-brand-500] disabled:opacity-50"
        aria-label={`Fonction de ${user.name}`}
      />
      {pending && <Loader2 className="absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-[--color-graphite-400]" />}
    </div>
  )
}
