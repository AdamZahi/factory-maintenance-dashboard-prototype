import { useCallback, useEffect, useState } from 'react'
import { Card, CardHeader, Button } from './ui/Primitives'
import { EQUIPMENT_DEFINITIONS } from '../data/equipment'
import {
  useAssignments,
  createAssignment,
  deleteAssignment,
  fetchUsers,
  setUserRole,
  type AppUser,
} from '../hooks/useData'
import { ShieldCheck, User, Loader2 } from 'lucide-react'

// Admin-only screen: a technicians × equipment grid of checkboxes, plus a
// per-user role toggle (promote/demote). Every action hits the backend and
// re-syncs.
export function AdminAssignments() {
  const [users, setUsers] = useState<AppUser[]>([])
  const [usersLoading, setUsersLoading] = useState(true)
  const { assignments, loading: assignmentsLoading, reload: reloadAssignments } = useAssignments()
  const [pending, setPending] = useState<Set<string>>(new Set())

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
    markPending(key, true)
    try {
      if (assigned.has(key)) await deleteAssignment(technicianId, equipmentId)
      else await createAssignment(technicianId, equipmentId)
      await reloadAssignments()
    } catch (err) {
      console.error('[admin] toggle assignment failed', err)
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
    } catch (err) {
      console.error('[admin] change role failed', err)
    } finally {
      markPending(`role:${user.id}`, false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Utilisateurs et rôles"
          subtitle="Promouvoir un technicien en administrateur ou l'inverse"
        />
        <div className="divide-y divide-[--color-graphite-100]">
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
              <div key={u.id} className="flex items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3">
                  <span className={`flex h-9 w-9 items-center justify-center rounded-full ${u.role === 'ADMIN' ? 'bg-[--color-status-normal-bg] text-[--color-status-normal]' : 'bg-[--color-graphite-50] text-[--color-graphite-500]'}`}>
                    {u.role === 'ADMIN' ? <ShieldCheck className="h-4 w-4" /> : <User className="h-4 w-4" />}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-[--color-graphite-900]">{u.name}</p>
                    <p className="text-xs text-[--color-graphite-500]">{u.email} · {u.role === 'ADMIN' ? 'Administrateur' : 'Technicien'}</p>
                  </div>
                </div>
                <Button size="sm" variant="ghost" disabled={pending.has(`role:${u.id}`)} onClick={() => changeRole(u)}>
                  {u.role === 'ADMIN' ? 'Rétrograder en technicien' : 'Promouvoir admin'}
                </Button>
              </div>
            ))
          )}
        </div>
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
                  {EQUIPMENT_DEFINITIONS.map((def) => (
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
                    {EQUIPMENT_DEFINITIONS.map((def) => {
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
