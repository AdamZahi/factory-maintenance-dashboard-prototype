import { useEffect, useMemo, useState } from 'react'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  LineChart, Line, XAxis, YAxis, CartesianGrid, AreaChart, Area,
} from 'recharts'
import { format, parseISO, subDays } from 'date-fns'
import { Card, CardHeader, Button } from './ui/Primitives'
import { StatusBadge, StatusDot } from './ui/StatusBadge'
import { statusColor } from '../lib/validation'
import { useEquipmentDefinitions } from '../hooks/useEquipment'
import type { InspectionRecord, StatusLevel } from '../types'
import { Activity, CheckCircle2, AlertTriangle, XCircle, ArrowRight, Filter, RotateCcw, CalendarDays, Gauge } from 'lucide-react'

// Categorical palette for per-field trend lines — validated colorblind-safe and
// deliberately distinct from the reserved status green/amber/red.
const SERIES_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#e87ba4', '#4a3aa7', '#e34948']

function useCountUp(target: number) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    const duration = 650
    const start = performance.now()
    let frame = 0
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(target * eased))
      if (progress < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [target])
  return value
}

function parseChartValue(value: number | string | null): number | null {
  if (value === null || value === '' || value === undefined) return null
  if (typeof value === 'number') return value
  const match = value.match(/-?\d+(?:[.,]\d+)?/)
  return match ? parseFloat(match[0].replace(',', '.')) : null
}

interface Filters {
  dateFrom: string
  dateTo: string
  equipmentId: string
  technicianId: string
  status: StatusLevel | 'all'
}

const EMPTY_FILTERS: Filters = { dateFrom: '', dateTo: '', equipmentId: 'all', technicianId: 'all', status: 'all' }

export function Dashboard({
  inspections,
  onSelectEquipment,
}: {
  inspections: InspectionRecord[]
  onSelectEquipment?: (equipmentId: string) => void
}) {
  const { definitions } = useEquipmentDefinitions()
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [trendRange, setTrendRange] = useState<'week' | 'month'>('week')

  const update = (patch: Partial<Filters>) => setFilters((prev) => ({ ...prev, ...patch }))
  const isFiltered =
    filters.dateFrom !== '' || filters.dateTo !== '' || filters.equipmentId !== 'all' || filters.technicianId !== 'all' || filters.status !== 'all'

  const latestDate = useMemo(
    () => inspections.reduce<string | null>((latest, r) => (latest && latest > r.date ? latest : r.date), null),
    [inspections],
  )

  const technicianOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of inspections) if (r.technicianId) map.set(r.technicianId, r.technicianName)
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [inspections])

  const applyQuickRange = (days: number | null) => {
    if (days === null) {
      update({ dateFrom: '', dateTo: '' })
      return
    }
    const end = latestDate ?? format(new Date(), 'yyyy-MM-dd')
    update({ dateFrom: format(subDays(parseISO(end), days - 1), 'yyyy-MM-dd'), dateTo: end })
  }

  const filtered = useMemo(() => {
    return inspections.filter((r) => {
      if (filters.dateFrom && r.date < filters.dateFrom) return false
      if (filters.dateTo && r.date > filters.dateTo) return false
      if (filters.status !== 'all' && r.overallStatus !== filters.status) return false
      if (filters.technicianId !== 'all' && r.technicianId !== filters.technicianId) return false
      if (filters.equipmentId !== 'all') {
        const has = r.equipmentReadings.some((e) => e.equipmentId === filters.equipmentId && e.status !== 'unknown')
        if (!has) return false
      }
      return true
    })
  }, [inspections, filters])

  const kpis = useMemo(() => {
    let normal = 0, warning = 0, critical = 0
    for (const r of filtered) {
      if (r.overallStatus === 'normal') normal++
      else if (r.overallStatus === 'warning') warning++
      else if (r.overallStatus === 'critical') critical++
    }
    return { total: filtered.length, normal, warning, critical }
  }, [filtered])

  const distribution = useMemo(() => {
    const counts: Record<string, number> = {}
    const defs = filters.equipmentId === 'all' ? definitions : definitions.filter((d) => d.id === filters.equipmentId)
    for (const def of defs) {
      for (const r of filtered) {
        for (const reading of r.equipmentReadings) {
          if (reading.equipmentId === def.id && reading.status !== 'unknown') counts[reading.status] = (counts[reading.status] ?? 0) + 1
        }
      }
    }
    return [
      { name: 'Normal', value: counts.normal ?? 0, color: statusColor('normal') },
      { name: 'Alerte', value: counts.warning ?? 0, color: statusColor('warning') },
      { name: 'Critique', value: counts.critical ?? 0, color: statusColor('critical') },
    ].filter((d) => d.value > 0)
  }, [filtered, filters.equipmentId, definitions])
  const totalReadings = distribution.reduce((sum, d) => sum + d.value, 0)

  const statusByDay = useMemo(() => {
    const byDate = new Map<string, { date: string; label: string; normal: number; warning: number; critical: number }>()
    for (const r of [...filtered].sort((a, b) => a.date.localeCompare(b.date))) {
      const entry = byDate.get(r.date) ?? { date: r.date, label: format(parseISO(r.date), 'dd/MM'), normal: 0, warning: 0, critical: 0 }
      if (r.overallStatus === 'normal') entry.normal += 1
      if (r.overallStatus === 'warning') entry.warning += 1
      if (r.overallStatus === 'critical') entry.critical += 1
      byDate.set(r.date, entry)
    }
    return Array.from(byDate.values())
  }, [filtered])

  // Latest known status per equipment (across the filtered set).
  const equipmentHealth = useMemo(() => {
    const defs = filters.equipmentId === 'all' ? definitions : definitions.filter((d) => d.id === filters.equipmentId)
    return defs.map((def) => {
      let status: StatusLevel = 'unknown'
      let date: string | null = null
      let message: string | undefined
      for (const r of [...filtered].sort((a, b) => a.date.localeCompare(b.date))) {
        const reading = r.equipmentReadings.find((e) => e.equipmentId === def.id && e.status !== 'unknown')
        if (reading) {
          status = reading.status
          date = r.date
          message = reading.fields.find((f) => f.status === reading.status)?.message
        }
      }
      return { id: def.id, name: def.name, status, date, message }
    })
  }, [filtered, filters.equipmentId])

  const watchList = useMemo(
    () =>
      equipmentHealth
        .filter((e) => e.status === 'critical' || e.status === 'warning')
        .sort((a, b) => (a.status === b.status ? 0 : a.status === 'critical' ? -1 : 1)),
    [equipmentHealth],
  )

  const equipmentTrends = useMemo(() => {
    const cutoff = latestDate ? format(subDays(parseISO(latestDate), trendRange === 'week' ? 6 : 29), 'yyyy-MM-dd') : null
    const defs = filters.equipmentId === 'all' ? definitions : definitions.filter((d) => d.id === filters.equipmentId)
    return defs.map((definition) => {
      const byDate = new Map<string, { date: string; label: string; [k: string]: string | number }>()
      for (const inspection of filtered) {
        if (cutoff && inspection.date < cutoff) continue
        const reading = inspection.equipmentReadings.find((e) => e.equipmentId === definition.id)
        if (!reading) continue
        const point = byDate.get(inspection.date) ?? { date: inspection.date, label: format(parseISO(inspection.date), 'dd/MM') }
        for (const field of definition.fields) {
          const fr = reading.fields.find((f) => f.fieldId === field.id)
          const num = parseChartValue(fr?.value ?? null)
          if (num !== null) point[field.id] = num
        }
        byDate.set(inspection.date, point)
      }
      const data = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date))
      const chartableFields = definition.fields.filter((f) => data.some((p) => typeof p[f.id] === 'number'))
      return { definition, data, chartableFields }
    })
  }, [filtered, filters.equipmentId, trendRange, latestDate, definitions])

  const rangeLabel =
    filters.dateFrom || filters.dateTo
      ? `${filters.dateFrom ? format(parseISO(filters.dateFrom), 'dd/MM/yy') : '…'} → ${filters.dateTo ? format(parseISO(filters.dateTo), 'dd/MM/yy') : '…'}`
      : 'Toute la période'

  return (
    <div className="space-y-6">
      {/* Filter bar */}
      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-2 text-[--color-graphite-700]">
            <Filter className="h-4 w-4 text-[--color-amber-signal]" />
            <span className="font-display text-sm font-semibold uppercase tracking-[0.1em]">Filtres</span>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {[
              { label: '7 j', days: 7 },
              { label: '30 j', days: 30 },
              { label: '90 j', days: 90 },
              { label: 'Tout', days: null },
            ].map((chip) => (
              <button
                key={chip.label}
                onClick={() => applyQuickRange(chip.days)}
                className="rounded-full border border-[--color-graphite-200] bg-white px-3 py-1.5 text-xs font-medium text-[--color-graphite-600] transition-colors hover:border-[--color-amber-signal] hover:text-[--color-graphite-900]"
              >
                {chip.label}
              </button>
            ))}
          </div>

          <div className="grid w-full grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <Field label="Du">
              <input type="date" value={filters.dateFrom} onChange={(e) => update({ dateFrom: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Au">
              <input type="date" value={filters.dateTo} onChange={(e) => update({ dateTo: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Équipement">
              <select value={filters.equipmentId} onChange={(e) => update({ equipmentId: e.target.value })} className={inputClass}>
                <option value="all">Tous</option>
                {definitions.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Technicien">
              <select value={filters.technicianId} onChange={(e) => update({ technicianId: e.target.value })} className={inputClass}>
                <option value="all">Tous</option>
                {technicianOptions.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Statut">
              <select value={filters.status} onChange={(e) => update({ status: e.target.value as Filters['status'] })} className={inputClass}>
                <option value="all">Tous</option>
                <option value="normal">Normal</option>
                <option value="warning">Alerte</option>
                <option value="critical">Critique</option>
              </select>
            </Field>
          </div>

          <div className="flex w-full items-center justify-between gap-3 border-t border-[--color-graphite-100] pt-3">
            <span className="inline-flex items-center gap-1.5 text-xs text-[--color-graphite-500]">
              <CalendarDays className="h-3.5 w-3.5" /> {rangeLabel} · <strong className="font-semibold text-[--color-graphite-900]">{filtered.length}</strong> inspection(s)
            </span>
            {isFiltered && (
              <Button size="sm" variant="ghost" onClick={() => setFilters(EMPTY_FILTERS)}>
                <RotateCcw className="h-3.5 w-3.5" /> Réinitialiser
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* KPI row */}
      <div className="stagger grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard style={{ '--i': 0 } as React.CSSProperties} icon={<Activity className="h-5 w-5" />} label="Inspections" value={kpis.total} tint="#2563EB" />
        <KpiCard style={{ '--i': 1 } as React.CSSProperties} icon={<CheckCircle2 className="h-5 w-5" />} label="Normales" value={kpis.normal} tint={statusColor('normal')} percent={kpis.total ? Math.round((kpis.normal / kpis.total) * 100) : 0} />
        <KpiCard style={{ '--i': 2 } as React.CSSProperties} icon={<AlertTriangle className="h-5 w-5" />} label="Alertes" value={kpis.warning} tint={statusColor('warning')} percent={kpis.total ? Math.round((kpis.warning / kpis.total) * 100) : 0} />
        <KpiCard style={{ '--i': 3 } as React.CSSProperties} icon={<XCircle className="h-5 w-5" />} label="Critiques" value={kpis.critical} tint={statusColor('critical')} percent={kpis.total ? Math.round((kpis.critical / kpis.total) * 100) : 0} />
      </div>

      {/* Trend area + distribution donut */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.5fr_0.85fr]">
        <Card className="overflow-hidden">
          <CardHeader title="Statut global par jour" subtitle="Répartition des inspections normales / alerte / critique" />
          <div className="h-80 p-5 pt-4">
            {statusByDay.length === 0 ? (
              <EmptyState />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={statusByDay} margin={{ left: -8, right: 12, top: 12, bottom: 0 }}>
                  <defs>
                    {(['normal', 'warning', 'critical'] as const).map((s) => (
                      <linearGradient key={s} id={`area-${s}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={statusColor(s)} stopOpacity={0.4} />
                        <stop offset="95%" stopColor={statusColor(s)} stopOpacity={0.04} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="#EDF0F3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#6B7A8F" axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#6B7A8F" axisLine={false} tickLine={false} width={32} />
                  <Tooltip contentStyle={tooltipStyle} labelFormatter={(l) => `Date ${l}`} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="normal" name="Normal" stackId="1" stroke={statusColor('normal')} fill="url(#area-normal)" strokeWidth={2} />
                  <Area type="monotone" dataKey="warning" name="Alerte" stackId="1" stroke={statusColor('warning')} fill="url(#area-warning)" strokeWidth={2} />
                  <Area type="monotone" dataKey="critical" name="Critique" stackId="1" stroke={statusColor('critical')} fill="url(#area-critical)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Répartition des lectures" subtitle="Par statut d'équipement" />
          <div className="relative h-80 p-5 pt-4">
            {distribution.length === 0 ? (
              <EmptyState />
            ) : (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={distribution} dataKey="value" nameKey="name" innerRadius={64} outerRadius={94} paddingAngle={3} stroke="#fff" strokeWidth={2}>
                      {distribution.map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 top-[-2.2rem] flex items-center justify-center">
                  <div className="text-center">
                    <p className="font-display text-3xl font-semibold text-[--color-graphite-900]">{totalReadings}</p>
                    <p className="text-xs uppercase tracking-wide text-[--color-graphite-500]">Lectures</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </Card>
      </div>

      {/* Equipment health matrix */}
      <Card>
        <CardHeader title="État actuel des équipements" subtitle="Dernier statut connu — cliquez pour le détail des paramètres" action={<span className="inline-flex items-center gap-1.5 rounded-full bg-[--color-graphite-50] px-3 py-1 text-xs font-medium text-[--color-graphite-500]"><Gauge className="h-3.5 w-3.5" />{equipmentHealth.length} équipements</span>} />
        <div className="stagger grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
          {equipmentHealth.map((eq, i) => (
            <button
              key={eq.id}
              onClick={() => onSelectEquipment?.(eq.id)}
              style={{ '--i': i } as React.CSSProperties}
              className="group flex items-center justify-between gap-3 rounded-2xl border border-[--color-graphite-100] bg-white p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-[--color-amber-signal] hover:shadow-[0_12px_28px_rgba(18,24,31,0.08)]"
            >
              <div className="flex min-w-0 items-center gap-3">
                <StatusDot status={eq.status} pulse />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[--color-graphite-900]">{eq.name}</p>
                  <p className="truncate text-xs text-[--color-graphite-500]">
                    {eq.date ? `Dernière lecture ${format(parseISO(eq.date), 'dd/MM/yyyy')}` : 'Aucune donnée'}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <StatusBadge status={eq.status} compact />
                <ArrowRight className="h-4 w-4 text-[--color-graphite-300] transition-all group-hover:translate-x-0.5 group-hover:text-[--color-amber-signal]" />
              </div>
            </button>
          ))}
        </div>
      </Card>

      {/* Watch list */}
      <Card>
        <CardHeader title="Équipements à surveiller" subtitle="Dernier statut anormal connu sur la période filtrée" />
        {watchList.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center">
            <CheckCircle2 className="h-7 w-7 text-[--color-status-normal]" />
            <p className="text-sm font-medium text-[--color-graphite-700]">Aucun équipement en alerte ou critique</p>
            <p className="text-xs text-[--color-graphite-500]">Tout est dans les normes sur la période sélectionnée.</p>
          </div>
        ) : (
          <ul className="divide-y divide-[--color-graphite-100]">
            {watchList.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-[--color-graphite-50]">
                <div className="flex items-center gap-3">
                  <StatusDot status={item.status} pulse />
                  <div>
                    <p className="text-sm font-medium text-[--color-graphite-900]">{item.name}</p>
                    {item.message && <p className="text-xs text-[--color-graphite-500]">{item.message}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {item.date && <span className="text-xs text-[--color-graphite-500]">{format(parseISO(item.date), 'dd/MM/yyyy')}</span>}
                  <StatusBadge status={item.status} compact />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Per-equipment parameter trends */}
      <Card>
        <CardHeader
          title="Évolution des paramètres"
          subtitle={`Valeurs enregistrées sur les ${trendRange === 'week' ? '7' : '30'} derniers jours`}
          action={
            <div className="flex items-center gap-1 rounded-full border border-[--color-graphite-200] bg-[--color-graphite-50] p-1 text-xs font-medium text-[--color-graphite-500]">
              {(['week', 'month'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setTrendRange(r)}
                  className={`rounded-full px-3 py-1.5 transition-colors ${trendRange === r ? 'bg-white text-[--color-graphite-900] shadow-sm' : 'hover:text-[--color-graphite-900]'}`}
                >
                  {r === 'week' ? '7 jours' : '30 jours'}
                </button>
              ))}
            </div>
          }
        />
        <div className="grid grid-cols-1 gap-4 p-5 lg:grid-cols-2">
          {equipmentTrends.map(({ definition, data, chartableFields }) => (
            <button
              key={definition.id}
              type="button"
              onClick={() => onSelectEquipment?.(definition.id)}
              className="group rounded-2xl border border-[--color-graphite-100] bg-[--color-graphite-50]/50 p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-[--color-amber-signal] hover:bg-white"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="font-display text-sm font-semibold uppercase tracking-[0.1em] text-[--color-graphite-900]">{definition.name}</p>
                  <p className="text-xs text-[--color-graphite-500]">
                    {chartableFields.length > 0 ? `${chartableFields.length} paramètre(s) suivi(s)` : 'Aucune valeur numérique'}
                  </p>
                </div>
                <span className="flex items-center gap-1 text-xs font-medium text-[--color-graphite-500] transition-colors group-hover:text-[--color-graphite-900]">
                  Détails <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
              <div className="h-56">
                {data.length === 0 || chartableFields.length === 0 ? (
                  <EmptyState message="Enregistrez des valeurs numériques pour alimenter ce graphique." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} margin={{ left: -12, right: 8, top: 6, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#EDF0F3" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#6B7A8F" axisLine={false} tickLine={false} />
                      <YAxis allowDecimals tick={{ fontSize: 11 }} stroke="#6B7A8F" width={40} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={tooltipStyle} labelFormatter={(l) => `Date ${l}`} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {chartableFields.map((field, index) => (
                        <Line
                          key={field.id}
                          type="monotone"
                          dataKey={field.id}
                          name={`${field.label}${field.unit ? ` (${field.unit})` : ''}`}
                          stroke={SERIES_COLORS[index % SERIES_COLORS.length]}
                          strokeWidth={2.5}
                          dot={{ r: 2.5 }}
                          activeDot={{ r: 5 }}
                          connectNulls
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </button>
          ))}
        </div>
      </Card>
    </div>
  )
}

const inputClass =
  'w-full rounded-xl border border-[--color-graphite-200] bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-[--color-amber-signal]'

const tooltipStyle = { borderRadius: 16, border: '1px solid #DCE1E7', boxShadow: '0 12px 32px rgba(18,24,31,0.12)', fontSize: 12 } as const

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-[--color-graphite-400]">{label}</span>
      {children}
    </label>
  )
}

function KpiCard({
  icon,
  label,
  value,
  tint,
  percent,
  style,
}: {
  icon: React.ReactNode
  label: string
  value: number
  tint: string
  percent?: number
  style?: React.CSSProperties
}) {
  const animated = useCountUp(value)
  return (
    <Card className="p-5" style={style}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ backgroundColor: `${tint}1A`, color: tint }}>
          {icon}
        </div>
        {percent !== undefined && (
          <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ backgroundColor: `${tint}14`, color: tint }}>
            {percent}%
          </span>
        )}
      </div>
      <p className="mt-4 font-display text-3xl font-semibold tabular-nums text-[--color-graphite-900]">{animated.toLocaleString('fr-FR')}</p>
      <p className="mt-1 text-xs uppercase tracking-wide text-[--color-graphite-500]">{label}</p>
    </Card>
  )
}

function EmptyState({ message = 'Aucune donnée sur la période — ajustez les filtres ou enregistrez une inspection.' }: { message?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-[--color-graphite-500]">
      <Activity className="h-6 w-6 text-[--color-graphite-200]" />
      {message}
    </div>
  )
}
