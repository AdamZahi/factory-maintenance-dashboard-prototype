import { useCallback, useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Card, CardHeader, Button } from './ui/Primitives'
import { Modal } from './ui/Modal'
import { useToast } from './ui/Toast'
import { useConfirm } from './ui/ConfirmDialog'
import { EQUIPMENT_DEFINITIONS } from '../data/equipment'
import {
  fetchManagedUsers, inviteUser, updateManagedUser, deleteManagedUser,
  fetchInvitations, revokeInvitation, useAssignments, createAssignment, deleteAssignment,
  type ManagedUser, type Invitation, type UserRole,
} from '../hooks/useData'
import { UserPlus, Loader2, Pencil, Trash2, Mail, ShieldCheck, ShieldAlert, User, Send, X, Clock, CheckCircle2 } from 'lucide-react'

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'TECHNICIAN', label: 'Technicien' },
  { value: 'ADMIN', label: 'Administrateur' },
  { value: 'SUPERUSER', label: 'Superutilisateur' },
]

const ROLE_META: Record<UserRole, { label: string; cls: string; icon: React.ReactNode }> = {
  SUPERUSER: { label: 'Superutilisateur', cls: 'bg-[--color-brand-50] text-[--color-brand-700]', icon: <ShieldAlert className="h-3.5 w-3.5" /> },
  ADMIN: { label: 'Administrateur', cls: 'bg-[--color-status-normal-bg] text-[--color-status-normal]', icon: <ShieldCheck className="h-3.5 w-3.5" /> },
  TECHNICIAN: { label: 'Technicien', cls: 'bg-[--color-graphite-100] text-[--color-graphite-600]', icon: <User className="h-3.5 w-3.5" /> },
}

export function UserManagement() {
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<ManagedUser | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const toast = useToast()
  const confirm = useConfirm()

  const load = useCallback(async () => {
    try {
      const [u, inv] = await Promise.all([fetchManagedUsers(), fetchInvitations().catch(() => [] as Invitation[])])
      setUsers(u)
      setInvitations(inv)
    } catch (err) {
      console.error('[users] load failed', err)
      toast.error('Chargement impossible', 'Impossible de charger les utilisateurs.')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  // --- Invite form ---
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<UserRole>('TECHNICIAN')
  const [inviting, setInviting] = useState(false)

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !name.trim()) return
    setInviting(true)
    try {
      await inviteUser({ emailAddress: email.trim(), name: name.trim(), role })
      toast.success('Invitation envoyée', `${email.trim()} a été invité(e) comme ${ROLE_META[role].label.toLowerCase()}.`)
      setEmail('')
      setName('')
      setRole('TECHNICIAN')
      const inv = await fetchInvitations().catch(() => invitations)
      setInvitations(inv)
    } catch (err) {
      console.error('[users] invite failed', err)
      toast.error('Invitation refusée', (err as Error).message?.includes(':') ? 'Adresse déjà invitée ou invalide.' : 'Échec de l’invitation.')
    } finally {
      setInviting(false)
    }
  }

  const handleDelete = async (u: ManagedUser) => {
    const ok = await confirm({
      title: 'Supprimer l’utilisateur',
      message: `Supprimer ${u.name} (${u.email}) ? Son compte Clerk sera définitivement supprimé et ses affectations retirées. L’historique d’inspections est conservé. Action irréversible.`,
      confirmLabel: 'Supprimer',
      tone: 'danger',
    })
    if (!ok) return
    setBusy(u.id)
    try {
      await deleteManagedUser(u.id)
      setUsers((prev) => prev.filter((x) => x.id !== u.id))
      toast.success('Utilisateur supprimé', `${u.name} n’a plus accès à l’application.`)
    } catch (err) {
      console.error('[users] delete failed', err)
      toast.error('Suppression impossible', 'Aucune modification appliquée.')
    } finally {
      setBusy(null)
    }
  }

  const handleRevoke = async (inv: Invitation) => {
    setBusy(inv.id)
    try {
      await revokeInvitation(inv.id)
      setInvitations((prev) => prev.filter((x) => x.id !== inv.id))
      toast.success('Invitation annulée', inv.email)
    } catch (err) {
      console.error('[users] revoke failed', err)
      toast.error('Annulation impossible', 'L’invitation a peut-être déjà été acceptée.')
    } finally {
      setBusy(null)
    }
  }

  const pending = invitations.filter((i) => i.status === 'pending')
  const accepted = invitations.filter((i) => i.status === 'accepted')

  return (
    <div className="space-y-4">
      {/* Invite */}
      <Card>
        <CardHeader title="Inviter un utilisateur" subtitle="Envoie une invitation Clerk ; le compte est créé quand la personne accepte" />
        <form onSubmit={handleInvite} className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <label className="mb-1 block text-xs font-medium text-[--color-graphite-500]">Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="prenom@sbmtunisie.com" className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[--color-graphite-500]">Nom complet</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. Fehmi Mabrouk" className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[--color-graphite-500]">Rôle</label>
            <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className={inputCls}>
              {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <Button type="submit" variant="primary" className="w-full" disabled={inviting}>
              {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Envoyer l'invitation
            </Button>
          </div>
        </form>
      </Card>

      {/* Active users */}
      <Card>
        <CardHeader title="Utilisateurs actifs" subtitle="Rôle, fonction et équipements affectés" action={<span className="rounded-full bg-[--color-graphite-50] px-2.5 py-1 text-xs font-medium text-[--color-graphite-500]">{users.length}</span>} />
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center gap-2 p-6 text-sm text-[--color-graphite-500]"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[--color-graphite-100] text-left text-xs uppercase tracking-wide text-[--color-graphite-500]">
                  <th className="px-5 py-2 font-medium">Utilisateur</th>
                  <th className="px-5 py-2 font-medium">Rôle</th>
                  <th className="px-5 py-2 font-medium">Fonction</th>
                  <th className="px-5 py-2 font-medium">Équipements</th>
                  <th className="px-5 py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-[--color-graphite-100] hover:bg-[--color-graphite-50]">
                    <td className="px-5 py-3">
                      <p className="font-medium text-[--color-graphite-900]">{u.name}</p>
                      <p className="text-xs text-[--color-graphite-500]">{u.email}</p>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${ROLE_META[u.role].cls}`}>
                        {ROLE_META[u.role].icon}{ROLE_META[u.role].label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-[--color-graphite-700]">{u.position ?? <span className="text-[--color-graphite-400]">—</span>}</td>
                    <td className="px-5 py-3 text-[--color-graphite-700]">{u.assignmentCount}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(u)}><Pencil className="h-3.5 w-3.5" /> Modifier</Button>
                        <Button size="sm" variant="danger" className="bg-red-600" disabled={busy === u.id} onClick={() => handleDelete(u)}>
                          {busy === u.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-[--color-graphite-500]">Aucun utilisateur actif.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {/* Invitations */}
      <Card>
        <CardHeader title="Invitations" subtitle="Statut des invitations envoyées" />
        <div className="divide-y divide-[--color-graphite-100]">
          {!loading && pending.length === 0 && accepted.length === 0 && (
            <p className="p-5 text-sm text-[--color-graphite-500]">Aucune invitation.</p>
          )}
          {[...pending, ...accepted].map((inv) => (
            <div key={inv.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[--color-graphite-50] text-[--color-graphite-500]"><Mail className="h-4 w-4" /></span>
                <div>
                  <p className="text-sm font-medium text-[--color-graphite-900]">{inv.email}</p>
                  <p className="text-xs text-[--color-graphite-500]">{inv.role ?? '—'} · {format(parseISO(inv.createdAt), 'dd/MM/yyyy')}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {inv.status === 'pending' ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[--color-status-warning-bg] px-2.5 py-1 text-[11px] font-medium text-[--color-status-warning]"><Clock className="h-3.5 w-3.5" /> En attente</span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[--color-status-normal-bg] px-2.5 py-1 text-[11px] font-medium text-[--color-status-normal]"><CheckCircle2 className="h-3.5 w-3.5" /> Acceptée</span>
                )}
                {inv.status === 'pending' && (
                  <Button size="sm" variant="ghost" disabled={busy === inv.id} onClick={() => handleRevoke(inv)}>
                    {busy === inv.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />} Annuler
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {editing && (
        <EditUserModal
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setUsers((prev) => prev.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)))
            setEditing(null)
          }}
          onAssignmentsChanged={(count) => setUsers((prev) => prev.map((x) => (x.id === editing.id ? { ...x, assignmentCount: count } : x)))}
        />
      )}
    </div>
  )
}

function EditUserModal({
  user,
  onClose,
  onSaved,
  onAssignmentsChanged,
}: {
  user: ManagedUser
  onClose: () => void
  onSaved: (u: { id: string; role: UserRole; position: string | null }) => void
  onAssignmentsChanged: (count: number) => void
}) {
  const toast = useToast()
  const [role, setRole] = useState<UserRole>(user.role)
  const [position, setPosition] = useState(user.position ?? '')
  const [saving, setSaving] = useState(false)
  const { assignments, reload } = useAssignments(user.id)
  const [pendingEq, setPendingEq] = useState<string | null>(null)

  const assignedIds = new Set(assignments.map((a) => a.equipmentId))

  const toggleEquipment = async (equipmentId: string) => {
    setPendingEq(equipmentId)
    try {
      if (assignedIds.has(equipmentId)) await deleteAssignment(user.id, equipmentId)
      else await createAssignment(user.id, equipmentId)
      await reload()
    } catch (err) {
      console.error('[users] assignment toggle failed', err)
      toast.error('Affectation impossible', 'La modification n’a pas pu être appliquée.')
    } finally {
      setPendingEq(null)
    }
  }

  // Keep the parent's assignment count in sync as toggles happen.
  useEffect(() => {
    onAssignmentsChanged(assignments.length)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignments.length])

  const save = async () => {
    setSaving(true)
    try {
      await updateManagedUser(user.id, { role, position: position.trim() })
      toast.success('Utilisateur mis à jour', user.name)
      onSaved({ id: user.id, role, position: position.trim() || null })
    } catch (err) {
      console.error('[users] update failed', err)
      toast.error('Mise à jour impossible', 'Le rôle et les métadonnées sont restés cohérents.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Modifier ${user.name}`}
      subtitle={user.email}
      icon={<UserPlus className="h-5 w-5" />}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button variant="primary" disabled={saving} onClick={save}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Enregistrer
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-[--color-graphite-500]">Rôle</label>
            <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className={inputCls}>
              {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[--color-graphite-500]">Fonction</label>
            <input value={position} onChange={(e) => setPosition(e.target.value)} placeholder="ex. Responsable maintenance" className={inputCls} />
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-[--color-graphite-500]">Équipements affectés</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {EQUIPMENT_DEFINITIONS.map((def) => {
              const checked = assignedIds.has(def.id)
              return (
                <label key={def.id} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors ${checked ? 'border-[--color-brand-300] bg-[--color-brand-50]' : 'border-[--color-graphite-200] hover:bg-[--color-graphite-50]'}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={pendingEq === def.id}
                    onChange={() => toggleEquipment(def.id)}
                    className="h-4 w-4 cursor-pointer accent-[--color-brand-600] disabled:opacity-40"
                  />
                  <span className="text-[--color-graphite-800]">{def.name}</span>
                  {pendingEq === def.id && <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-[--color-graphite-400]" />}
                </label>
              )
            })}
          </div>
          <p className="mt-2 text-[11px] text-[--color-graphite-400]">Les affectations sont enregistrées immédiatement.</p>
        </div>
      </div>
    </Modal>
  )
}

const inputCls = 'w-full rounded-lg border border-[--color-graphite-200] bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-[--color-brand-500]'
