import { useMemo, useState } from 'react'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { format, parseISO, subDays } from 'date-fns'
import { Card, CardHeader } from './ui/Primitives'
import { StatusBadge, StatusDot } from './ui/StatusBadge'
import { EQUIPMENT_DEFINITIONS } from '../data/equipment'
import { statusColor } from '../lib/validation'
import type { InspectionRecord, StatusLevel } from '../types'
import { Activity, CheckCircle2, AlertTriangle, XCircle, ArrowRight } from 'lucide-react'

function KpiCard({ icon, label, value, tint }: { icon: React.ReactNode; label: string; value: string | number; tint: string }) {
  return (
    <Card className="flex items-center gap-4 p-5">
      <div className="flex h-11 w-11 items-center justify-center rounded-lg" style={{ backgroundColor: `${tint}1A`, color: tint }}>
        {icon}
      </div>
      <div>
        <p className="font-display text-2xl font-semibold tabular-nums text-[--color-graphite-900]">{value}</p>
        <p className="text-xs uppercase tracking-wide text-[--color-graphite-500]">{label}</p>
      </div>
    </Card>
  )
}

type TrendRange = 'week' | 'month'

type TrendPoint = {
  date: string
  label: string
  [fieldId: string]: string | number
}

const TREND_COLORS = ['#3A4657', '#2E9E5B', '#E3A008', '#D6423C', '#4E7AE6', '#7A8AA3']

function parseChartValue(value: number | string | null): number | null {
  if (value === null || value === '' || value === undefined) return null
  if (typeof value === 'number') return value
  const match = value.match(/-?\d+(?:[.,]\d+)?/)
  if (!match) return null
  return parseFloat(match[0].replace(',', '.'))
}

export function Dashboard({
  inspections,
  onSelectEquipment,
}: {
  inspections: InspectionRecord[]
  onSelectEquipment?: (equipmentId: string) => void
}) {
  const [trendRange, setTrendRange] = useState<TrendRange>('week')

  const kpis = useMemo(() => {
    const total = inspections.length
    let normal = 0, warning = 0, critical = 0
    for (const r of inspections) {
      if (r.overallStatus === 'normal') normal++
      else if (r.overallStatus === 'warning') warning++
      else if (r.overallStatus === 'critical') critical++
    }
    return { total, normal, warning, critical }
  }, [inspections])

  const distribution = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const def of EQUIPMENT_DEFINITIONS) {
      const readings = inspections.flatMap((i) => i.equipmentReadings.filter((r) => r.equipmentId === def.id))
      for (const r of readings) counts[r.status] = (counts[r.status] ?? 0) + 1
    }
    return [
      { name: 'Normal', value: counts.normal ?? 0, color: statusColor('normal') },
      { name: 'Alerte', value: counts.warning ?? 0, color: statusColor('warning') },
      { name: 'Critique', value: counts.critical ?? 0, color: statusColor('critical') },
    ].filter((d) => d.value > 0)
  }, [inspections])

  const history = useMemo(() => {
    const byDate = new Map<string, { date: string; normal: number; warning: number; critical: number }>()
    for (const r of [...inspections].sort((a, b) => a.date.localeCompare(b.date))) {
      const key = r.date
      const entry = byDate.get(key) ?? { date: key, normal: 0, warning: 0, critical: 0 }
      entry[r.overallStatus === 'unknown' ? 'normal' : (r.overallStatus as 'normal' | 'warning' | 'critical')]++
      byDate.set(key, entry)
    }
    return Array.from(byDate.values()).map((d) => ({ ...d, label: format(parseISO(d.date), 'dd/MM') }))
  }, [inspections])

  const criticalEquipment = useMemo(() => {
    const latestByEquipment = new Map<string, { status: StatusLevel; date: string; message?: string }>()
    for (const r of [...inspections].sort((a, b) => a.date.localeCompare(b.date))) {
      for (const reading of r.equipmentReadings) {
        if (reading.status === 'critical' || reading.status === 'warning') {
          const worstField = reading.fields.find((f) => f.status === reading.status)
          latestByEquipment.set(reading.equipmentId, { status: reading.status, date: r.date, message: worstField?.message })
        } else if (reading.status === 'normal') {
          latestByEquipment.delete(reading.equipmentId)
        }
      }
    }
    return Array.from(latestByEquipment.entries())
      .map(([equipmentId, info]) => ({ equipmentId, ...info, name: EQUIPMENT_DEFINITIONS.find((e) => e.id === equipmentId)?.name ?? equipmentId }))
      .sort((a, b) => (a.status === b.status ? 0 : a.status === 'critical' ? -1 : 1))
  }, [inspections])

  const equipmentTrends = useMemo(() => {
    const latestDate = inspections.reduce<string | null>((latest, record) => (latest && latest > record.date ? latest : record.date), null)
    const cutoff = latestDate ? format(subDays(parseISO(latestDate), trendRange === 'week' ? 6 : 29), 'yyyy-MM-dd') : null

    return EQUIPMENT_DEFINITIONS.map((definition) => {
      const byDate = new Map<string, TrendPoint>()

      for (const inspection of inspections) {
        if (cutoff && inspection.date < cutoff) continue
        const equipmentReading = inspection.equipmentReadings.find((reading) => reading.equipmentId === definition.id)
        if (!equipmentReading) continue

        const point = byDate.get(inspection.date) ?? {
          date: inspection.date,
          label: format(parseISO(inspection.date), 'dd/MM'),
        }

        for (const field of definition.fields) {
          const fieldReading = equipmentReading.fields.find((reading) => reading.fieldId === field.id)
          const numericValue = parseChartValue(fieldReading?.value ?? null)
          if (numericValue !== null) {
            point[field.id] = numericValue
          }
        }

        byDate.set(inspection.date, point)
      }

      const data = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date))
      const chartableFields = definition.fields.filter((field) => data.some((point) => typeof point[field.id] === 'number'))

      return { definition, data, chartableFields }
    })
  }, [inspections, trendRange])

  const latestInspectionByEquipment = useMemo(() => {
    const latest = new Map<string, string>()
    for (const inspection of [...inspections].sort((a, b) => a.date.localeCompare(b.date))) {
      for (const reading of inspection.equipmentReadings) {
        latest.set(reading.equipmentId, inspection.date)
      }
    }
    return latest
  }, [inspections])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard icon={<Activity className="h-5 w-5" />} label="Inspections" value={kpis.total} tint="#3A4657" />
        <KpiCard icon={<CheckCircle2 className="h-5 w-5" />} label="Normales" value={kpis.normal} tint={statusColor('normal')} />
        <KpiCard icon={<AlertTriangle className="h-5 w-5" />} label="Alertes" value={kpis.warning} tint={statusColor('warning')} />
        <KpiCard icon={<XCircle className="h-5 w-5" />} label="Critiques" value={kpis.critical} tint={statusColor('critical')} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Évolution historique" subtitle="Statut global par jour d'inspection" />
          <div className="h-72 p-5 pt-2">
            {history.length === 0 ? (
              <EmptyState />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EDF0F3" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#6B7A8F" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#6B7A8F" />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="normal" name="Normal" stroke={statusColor('normal')} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="warning" name="Alerte" stroke={statusColor('warning')} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="critical" name="Critique" stroke={statusColor('critical')} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Répartition des statuts" subtitle="Toutes lectures d'équipement" />
          <div className="h-72 p-5 pt-2">
            {distribution.length === 0 ? (
              <EmptyState />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={distribution} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3}>
                    {distribution.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Évolution des paramètres par équipement"
          subtitle="Suivi des valeurs enregistrées sur les 7 ou 30 derniers jours"
          action={
            <div className="flex items-center gap-2 rounded-lg border border-[--color-graphite-200] bg-[--color-graphite-50] p-1 text-xs font-medium text-[--color-graphite-500]">
              <button
                type="button"
                onClick={() => setTrendRange('week')}
                className={`rounded-md px-3 py-1.5 transition-colors ${trendRange === 'week' ? 'bg-white text-[--color-graphite-900] shadow-sm' : 'hover:text-[--color-graphite-900]'}`}
              >
                7 jours
              </button>
              <button
                type="button"
                onClick={() => setTrendRange('month')}
                className={`rounded-md px-3 py-1.5 transition-colors ${trendRange === 'month' ? 'bg-white text-[--color-graphite-900] shadow-sm' : 'hover:text-[--color-graphite-900]'}`}
              >
                30 jours
              </button>
            </div>
          }
        />
        <div className="grid grid-cols-1 gap-4 p-5 lg:grid-cols-2">
          {equipmentTrends.map(({ definition, data, chartableFields }) => (
            <button
              key={definition.id}
              type="button"
              onClick={() => onSelectEquipment?.(definition.id)}
              className="rounded-xl border border-[--color-graphite-100] bg-[--color-graphite-50]/50 p-4 text-left transition-transform duration-150 hover:-translate-y-0.5 hover:border-[--color-amber-signal] hover:bg-white"
              data-equipment-id={definition.id}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="font-display text-sm font-semibold uppercase tracking-wide text-[--color-graphite-900]">{definition.name}</p>
                  <p className="text-xs text-[--color-graphite-500]">
                    {chartableFields.length > 0 ? `${chartableFields.length} paramètre(s) suivi(s)` : 'Aucune valeur numérique sur la période'}
                    {latestInspectionByEquipment.get(definition.id) && ` · Dernière lecture ${format(parseISO(latestInspectionByEquipment.get(definition.id)!), 'dd/MM/yyyy')}`}
                  </p>
                </div>
                <span className="flex items-center gap-1 text-xs font-medium text-[--color-graphite-500]">
                  Détails
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
              <div className="h-64">
                {data.length === 0 || chartableFields.length === 0 ? (
                  <EmptyState message="Enregistrez des valeurs numériques pour alimenter ce graphique." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#EDF0F3" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#6B7A8F" />
                      <YAxis allowDecimals tick={{ fontSize: 11 }} stroke="#6B7A8F" width={44} />
                      <Tooltip
                        labelFormatter={(label) => `Date: ${label}`}
                        formatter={(value, name) => [value, name]}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      {chartableFields.map((field, index) => (
                        <Line
                          key={field.id}
                          type="monotone"
                          dataKey={field.id}
                          name={`${field.label}${field.unit ? ` (${field.unit})` : ''}`}
                          stroke={TREND_COLORS[index % TREND_COLORS.length]}
                          strokeWidth={2}
                          dot={false}
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

      <Card>
        <CardHeader title="Équipements à surveiller" subtitle="Dernier statut anormal connu, par équipement" />
        {criticalEquipment.length === 0 ? (
          <div className="p-6">
            <EmptyState message="Aucun équipement en alerte ou critique." />
          </div>
        ) : (
          <ul className="divide-y divide-[--color-graphite-100]">
            {criticalEquipment.map((item) => (
              <li key={item.equipmentId} className="flex items-center justify-between gap-4 px-5 py-3">
                <div className="flex items-center gap-3">
                  <StatusDot status={item.status} pulse />
                  <div>
                    <p className="text-sm font-medium text-[--color-graphite-900]">{item.name}</p>
                    {item.message && <p className="text-xs text-[--color-graphite-500]">{item.message}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[--color-graphite-500]">{format(parseISO(item.date), 'dd/MM/yyyy')}</span>
                  <StatusBadge status={item.status} compact />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

function EmptyState({ message = "Aucune donnée pour l'instant — enregistrez une inspection pour l'alimenter." }: { message?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-[--color-graphite-500]">
      <Activity className="h-6 w-6 text-[--color-graphite-200]" />
      {message}
    </div>
  )
}
