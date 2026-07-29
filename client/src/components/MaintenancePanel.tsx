import { useCallback, useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Card, CardHeader, Button } from './ui/Primitives'
import { useToast } from './ui/Toast'
import { useConfirm } from './ui/ConfirmDialog'
import { fetchMaintenanceAll, resetMaintenance, type MaintenanceStatus, type MaintenanceState } from '../hooks/useData'
import { Wrench, RotateCcw, Loader2, CheckCircle2, AlertTriangle, XCircle, CalendarClock, Gauge } from 'lucide-react'

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

export function MaintenancePanel() {
  const [items, setItems] = useState<MaintenanceStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
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
                <MaintenanceCard key={m.equipmentId} m={m} busy={busy === m.equipmentId} onReset={() => onReset(m)} />
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

function MaintenanceCard({ m, busy, onReset }: { m: MaintenanceStatus; busy: boolean; onReset: () => void }) {
  const meta = STATE_META[m.state]
  // Progress within the current hour cycle.
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
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.cls}`}>{meta.icon}{meta.label}</span>
      </div>

      {/* Hour cycle progress */}
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
