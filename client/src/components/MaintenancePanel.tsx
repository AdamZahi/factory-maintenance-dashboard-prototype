import { useCallback, useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Card, CardHeader, Button } from './ui/Primitives'
import { Modal } from './ui/Modal'
import { useToast } from './ui/Toast'
import { useConfirm } from './ui/ConfirmDialog'
import {
  fetchMaintenanceAll, resetMaintenance, createMaintenance, updateMaintenance, deleteMaintenance,
  type MaintenanceStatus, type MaintenanceState, type MaintenanceScheduleInput,
} from '../hooks/useData'
import { useEquipmentDefinitions } from '../hooks/useEquipment'
import { Wrench, RotateCcw, Loader2, CheckCircle2, AlertTriangle, XCircle, CalendarClock, Gauge, Plus, Pencil, Trash2 } from 'lucide-react'

const STATE_META: Record<MaintenanceState, { label: string; cls: string; icon: React.ReactNode; bar: string }> = {
  ok: { label: 'À jour', cls: 'bg-[--color-status-normal-bg] text-[--color-status-normal]', icon: <CheckCircle2 className="h-3.5 w-3.5" />, bar: 'bg-[--color-status-normal]' },
  due_soon: { label: 'Bientôt dû', cls: 'bg-[--color-status-warning-bg] text-[--color-status-warning]', icon: <AlertTriangle className="h-3.5 w-3.5" />, bar: 'bg-[--color-status-warning]' },
  overdue: { label: 'En retard', cls: 'bg-[--color-status-critical-bg] text-[--color-status-critical]', icon: <XCircle className="h-3.5 w-3.5" />, bar: 'bg-[--color-status-critical]' },
}

function fmtDate(iso: string | null) {
  return iso ? format(parseISO(iso), 'dd/MM/yyyy') : '—'
}
function fmtNum(n: number | null, unit = '') {
  return n == null ? '—' : `${Math.round(n * 10) / 10}${unit}`
}

export function MaintenancePanel({ canManage = false }: { canManage?: boolean }) {
  const [items, setItems] = useState<MaintenanceStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [editing, setEditing] = useState<MaintenanceStatus | 'new' | null>(null)
  const { definitions } = useEquipmentDefinitions()
  const toast = useToast()
  const confirm = useConfirm()

  const load = useCallback(async () => {
    try {
      setItems(await fetchMaintenanceAll())
    } catch (err) {
      console.error('[maintenance] load failed', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const onReset = async (m: MaintenanceStatus) => {
    const ok = await confirm({
      title: 'Enregistrer un entretien',
      message: `Réinitialiser le compteur d'entretien du ${m.equipmentName} ? La nouvelle échéance repartira du compteur actuel (${fmtNum(m.currentMeter, ' h')}) et les rappels seront réarmés. Action tracée.`,
      confirmLabel: 'Réinitialiser',
    })
    if (!ok) return
    setBusy(m.equipmentId)
    try {
      const updated = await resetMaintenance(m.equipmentId)
      setItems((prev) => prev.map((s) => (s.equipmentId === updated.equipmentId ? updated : s)))
      toast.success('Entretien enregistré', `${m.equipmentName} — nouvelle échéance à ${fmtNum(updated.nextDueMeter, ' h')}.`)
    } catch (err) {
      console.error('[maintenance] reset failed', err)
      toast.error('Réinitialisation impossible', 'Vous n’êtes peut-être pas affecté à cet équipement.')
    } finally {
      setBusy(null)
    }
  }

  const onDelete = async (m: MaintenanceStatus) => {
    const ok = await confirm({
      title: 'Supprimer l’échéance',
      message: `Supprimer le suivi d'entretien du ${m.equipmentName} ? L'historique des interventions est conservé.`,
      confirmLabel: 'Supprimer',
      tone: 'danger',
    })
    if (!ok) return
    setBusy(m.equipmentId)
    try {
      await deleteMaintenance(m.equipmentId)
      setItems((prev) => prev.filter((s) => s.equipmentId !== m.equipmentId))
      toast.success('Échéance supprimée', m.equipmentName)
    } catch (err) {
      console.error('[maintenance] delete failed', err)
      toast.error('Suppression impossible', 'La modification n’a pas pu être appliquée.')
    } finally {
      setBusy(null)
    }
  }

  const onSaved = (status: MaintenanceStatus) => {
    setItems((prev) => {
      const exists = prev.some((s) => s.equipmentId === status.equipmentId)
      return exists ? prev.map((s) => (s.equipmentId === status.equipmentId ? status : s)) : [...prev, status]
    })
    setEditing(null)
  }

  const scheduledIds = new Set(items.map((i) => i.equipmentId))
  const availableEquipment = definitions.filter((d) => !scheduledIds.has(d.id))

  const summary = {
    overdue: items.filter((i) => i.state === 'overdue').length,
    due_soon: items.filter((i) => i.state === 'due_soon').length,
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Entretien périodique"
          subtitle="Suivi du compteur horaire et des échéances de servicing"
          action={
            <div className="flex items-center gap-2 text-xs">
              {summary.overdue > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-[--color-status-critical-bg] px-2.5 py-1 font-medium text-[--color-status-critical]"><XCircle className="h-3.5 w-3.5" />{summary.overdue} en retard</span>}
              {summary.due_soon > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-[--color-status-warning-bg] px-2.5 py-1 font-medium text-[--color-status-warning]"><AlertTriangle className="h-3.5 w-3.5" />{summary.due_soon} bientôt</span>}
              {summary.overdue === 0 && summary.due_soon === 0 && !loading && <span className="inline-flex items-center gap-1 rounded-full bg-[--color-status-normal-bg] px-2.5 py-1 font-medium text-[--color-status-normal]"><CheckCircle2 className="h-3.5 w-3.5" />Tout à jour</span>}
              {canManage && availableEquipment.length > 0 && (
                <Button size="sm" variant="primary" className="bg-gray-500" onClick={() => setEditing('new')}><Plus className="h-3.5 w-3.5" /> Nouvelle échéance</Button>
              )}
            </div>
          }
        />
        <div className="p-5">
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-[--color-graphite-500]"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>
          ) : items.length === 0 ? (
            <p className="py-8 text-center text-sm text-[--color-graphite-500]">Aucun équipement à entretien programmé.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {items.map((m) => (
                <MaintenanceCard
                  key={m.equipmentId}
                  m={m}
                  busy={busy === m.equipmentId}
                  canManage={canManage}
                  onReset={() => onReset(m)}
                  onEdit={() => setEditing(m)}
                  onDelete={() => onDelete(m)}
                />
              ))}
            </div>
          )}
        </div>
      </Card>

      {editing && (
        <ScheduleFormModal
          existing={editing === 'new' ? null : editing}
          availableEquipment={availableEquipment}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
        />
      )}
    </div>
  )
}

function MaintenanceCard({
  m, busy, canManage, onReset, onEdit, onDelete,
}: {
  m: MaintenanceStatus
  busy: boolean
  canManage: boolean
  onReset: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const meta = STATE_META[m.state]
  const cycle = m.intervalHours ?? 0
  const used = m.currentMeter != null ? m.currentMeter - m.lastServiceMeterReading : null
  const pct = cycle > 0 && used != null ? Math.max(0, Math.min(100, (used / cycle) * 100)) : 0

  return (
    <div className="flex flex-col rounded-2xl border border-[--color-graphite-100] bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[--color-brand-50] text-[--color-brand-600]"><Wrench className="h-4 w-4" /></span>
          <p className="text-sm font-semibold text-[--color-graphite-900]">{m.equipmentName}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.cls}`}>{meta.icon}{meta.label}</span>
          {canManage && (
            <>
              <button onClick={onEdit} title="Modifier" className="flex h-7 w-7 items-center justify-center rounded-lg text-[--color-graphite-400] transition-colors hover:bg-[--color-graphite-50] hover:text-[--color-graphite-900]"><Pencil className="h-3.5 w-3.5" /></button>
              <button onClick={onDelete} disabled={busy} title="Supprimer" className="flex h-7 w-7 items-center justify-center rounded-lg text-[--color-graphite-400] transition-colors hover:bg-[--color-status-critical-bg] hover:text-[--color-status-critical] disabled:opacity-40"><Trash2 className="h-3.5 w-3.5" /></button>
            </>
          )}
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-xs text-[--color-graphite-500]">
          <span className="inline-flex items-center gap-1"><Gauge className="h-3.5 w-3.5" /> Compteur</span>
          <span className="font-mono text-[--color-graphite-900]">{fmtNum(m.currentMeter, ' h')}</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-[--color-graphite-100]">
          <div className={`h-full rounded-full ${meta.bar} transition-all duration-500`} style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-1 flex justify-between text-[11px] text-[--color-graphite-400]">
          <span>Base {fmtNum(m.lastServiceMeterReading, ' h')}</span>
          <span>Échéance {fmtNum(m.nextDueMeter, ' h')}</span>
        </div>
      </div>

      <dl className="mt-4 space-y-1.5 text-xs">
        <Row label="Heures restantes" value={m.hoursRemaining == null ? '—' : `${Math.max(0, Math.round(m.hoursRemaining))} h`} />
        <Row label="Date approx. d'entretien" value={fmtDate(m.projectedDueDate)} hint={m.hoursPerDay ? `~${m.hoursPerDay} h/j` : 'usage insuffisant'} />
        {m.intervalDays != null && (
          <Row label="Échéance calendaire" value={fmtDate(m.dueDate)} hint={m.daysRemaining != null ? `${m.daysRemaining} j` : undefined} icon={<CalendarClock className="h-3.5 w-3.5" />} />
        )}
        <Row label="Dernier entretien" value={fmtDate(m.lastServiceDate)} />
      </dl>

      <Button variant="secondary" size="sm" className="mt-4 w-full" disabled={busy} onClick={onReset}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
        Enregistrer un entretien
      </Button>
    </div>
  )
}

function ScheduleFormModal({
  existing, availableEquipment, onClose, onSaved,
}: {
  existing: MaintenanceStatus | null
  availableEquipment: { id: string; name: string }[]
  onClose: () => void
  onSaved: (s: MaintenanceStatus) => void
}) {
  const toast = useToast()
  const isEdit = existing !== null
  const [equipmentId, setEquipmentId] = useState(existing?.equipmentId ?? availableEquipment[0]?.id ?? '')
  const [intervalHours, setIntervalHours] = useState(existing?.intervalHours != null ? String(existing.intervalHours) : '')
  const [intervalDays, setIntervalDays] = useState(existing?.intervalDays != null ? String(existing.intervalDays) : '')
  const [warningHoursBefore, setWarningHoursBefore] = useState(String(existing?.warningHoursBefore ?? 0))
  const [warningDaysBefore, setWarningDaysBefore] = useState(existing?.warningDaysBefore != null ? String(existing.warningDaysBefore) : '')
  const [baseMeter, setBaseMeter] = useState(String(existing?.lastServiceMeterReading ?? 0))
  const [baseDate, setBaseDate] = useState((existing?.lastServiceDate ?? new Date().toISOString()).slice(0, 10))
  const [saving, setSaving] = useState(false)

  const numOrNull = (s: string) => (s.trim() === '' ? null : Number(s))

  const save = async () => {
    if (!equipmentId) return
    if (!intervalHours.trim() && !intervalDays.trim()) {
      toast.warning('Intervalle requis', 'Renseignez un intervalle en heures ou en jours.')
      return
    }
    const body: MaintenanceScheduleInput = {
      intervalHours: numOrNull(intervalHours),
      intervalDays: numOrNull(intervalDays),
      warningHoursBefore: Number(warningHoursBefore) || 0,
      warningDaysBefore: numOrNull(warningDaysBefore),
      lastServiceMeterReading: Number(baseMeter) || 0,
      lastServiceDate: baseDate,
    }
    setSaving(true)
    try {
      const status = isEdit ? await updateMaintenance(equipmentId, body) : await createMaintenance(equipmentId, body)
      toast.success(isEdit ? 'Échéance mise à jour' : 'Échéance créée', status.equipmentName)
      onSaved(status)
    } catch (err) {
      console.error('[maintenance] save failed', err)
      toast.error('Enregistrement impossible', (err as Error).message?.replace(/^API.*?:\s*/, '') || 'Vérifiez les valeurs saisies.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? `Modifier l'échéance` : 'Nouvelle échéance d’entretien'}
      subtitle={isEdit ? existing!.equipmentName : 'Choisissez un équipement et son intervalle de servicing'}
      icon={<Wrench className="h-5 w-5" />}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button variant="primary" className="bg-green-500" disabled={saving} onClick={save}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Enregistrer</Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Équipement" full>
          {isEdit ? (
            <input value={existing!.equipmentName} disabled className={`${inputCls} bg-[--color-graphite-50]`} />
          ) : (
            <select value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)} className={inputCls}>
              {availableEquipment.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )}
        </Field>
        <Field label="Intervalle (heures)"><input type="number" value={intervalHours} onChange={(e) => setIntervalHours(e.target.value)} placeholder="ex. 2000" className={inputCls} /></Field>
        <Field label="Alerte avant (heures)"><input type="number" value={warningHoursBefore} onChange={(e) => setWarningHoursBefore(e.target.value)} placeholder="ex. 200" className={inputCls} /></Field>
        <Field label="Intervalle calendaire (jours)"><input type="number" value={intervalDays} onChange={(e) => setIntervalDays(e.target.value)} placeholder="ex. 365 (optionnel)" className={inputCls} /></Field>
        <Field label="Alerte avant (jours)"><input type="number" value={warningDaysBefore} onChange={(e) => setWarningDaysBefore(e.target.value)} placeholder="ex. 14 (optionnel)" className={inputCls} /></Field>
        <Field label="Compteur au dernier entretien (h)"><input type="number" value={baseMeter} onChange={(e) => setBaseMeter(e.target.value)} className={inputCls} /></Field>
        <Field label="Date du dernier entretien"><input type="date" value={baseDate} onChange={(e) => setBaseDate(e.target.value)} className={inputCls} /></Field>
      </div>
      <p className="mt-3 text-[11px] text-[--color-graphite-400]">Au moins un intervalle (heures ou jours) est requis. La prochaine échéance se calcule à partir du compteur / de la date ci-dessus.</p>
    </Modal>
  )
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`block ${full ? 'sm:col-span-2' : ''}`}>
      <span className="mb-1 block text-xs font-medium text-[--color-graphite-500]">{label}</span>
      {children}
    </label>
  )
}

function Row({ label, value, hint, icon }: { label: string; value: string; hint?: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="inline-flex items-center gap-1 text-[--color-graphite-500]">{icon}{label}</dt>
      <dd className="text-right font-medium text-[--color-graphite-900]">
        {value}
        {hint && <span className="ml-1 font-normal text-[--color-graphite-400]">({hint})</span>}
      </dd>
    </div>
  )
}

const inputCls = 'w-full rounded-lg border border-[--color-graphite-200] bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-[--color-brand-500]'
