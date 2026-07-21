import { useEffect, useMemo, useState } from 'react'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  AreaChart, Area, BarChart, Bar, ReferenceDot,
} from 'recharts'
import { format, parseISO, subDays } from 'date-fns'
import { Card, CardHeader } from './ui/Primitives'
import { StatusBadge, StatusDot } from './ui/StatusBadge'
import { EQUIPMENT_DEFINITIONS } from '../data/equipment'
import { statusColor } from '../lib/validation'
import type { InspectionRecord, StatusLevel } from '../types'
import { Activity, CheckCircle2, AlertTriangle, XCircle, ArrowRight, Bell, ChevronUp, ChevronDown } from 'lucide-react'

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

function KpiCard({
  icon,
  label,
  value,
  tint,
  trend,
  sparkline,
}: {
  icon: React.ReactNode
  label: string
  value: number
  tint: string
  trend: { label: string; direction: 'up' | 'down'; value: string }
  sparkline: number[]
}) {
  const animatedValue = useCountUp(value)
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ backgroundColor: `${tint}1A`, color: tint }}>
            {icon}
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-[--color-graphite-500]">{label}</p>
            <p className="mt-1 font-display text-3xl font-semibold tabular-nums text-[--color-graphite-900] animate-count-up">{animatedValue.toLocaleString('fr-FR')}</p>
            <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${trend.direction === 'up' ? 'bg-[--color-status-normal-bg] text-[--color-status-normal]' : 'bg-[--color-status-warning-bg] text-[--color-status-warning]'}`}>
              {trend.direction === 'up' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {trend.value} {trend.label}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex h-12 items-end gap-1.5">
            {sparkline.map((bar, index) => (
              <span
                key={index}
                className="w-1.5 rounded-full"
                style={{ height: `${Math.max(10, bar)}px`, backgroundColor: tint, opacity: 0.18 + index * 0.12 }}
              />
            ))}
          </div>
          <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[--color-graphite-50] text-[--color-graphite-500]">
            <Bell className="h-3.5 w-3.5" />
          </div>
        </div>
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
const CHART_GRADIENT = '#2E9E5B'

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

  const kpiTrends = useMemo(() => {
    const sorted = [...inspections].sort((a, b) => a.date.localeCompare(b.date))
    const cutoffIndex = Math.max(0, sorted.length - 14)
    const recent = sorted.slice(cutoffIndex)
    const previous = sorted.slice(Math.max(0, cutoffIndex - recent.length), cutoffIndex)

    const countByStatus = (items: InspectionRecord[]) => ({
      total: items.length,
      normal: items.filter((item) => item.overallStatus === 'normal').length,
      warning: items.filter((item) => item.overallStatus === 'warning').length,
      critical: items.filter((item) => item.overallStatus === 'critical').length,
    })

    const recentCounts = countByStatus(recent)
    const previousCounts = countByStatus(previous)

    const delta = (current: number, baseline: number) => {
      if (baseline === 0) return current > 0 ? 100 : 0
      return Math.round(((current - baseline) / baseline) * 100)
    }

    const sparkline = (items: InspectionRecord[], accessor: (item: InspectionRecord) => number) =>
      items.slice(-6).map((item) => Math.max(10, accessor(item) * 12 + 8))

    return {
      total: { value: kpis.total, trend: { label: 'vs prev. période', direction: delta(recentCounts.total, previousCounts.total) >= 0 ? 'up' as const : 'down' as const, value: `${Math.abs(delta(recentCounts.total, previousCounts.total))}%` }, sparkline: sparkline(recent, () => 6) },
      normal: { value: kpis.normal, trend: { label: 'vs prev. période', direction: delta(recentCounts.normal, previousCounts.normal) >= 0 ? 'up' as const : 'down' as const, value: `${Math.abs(delta(recentCounts.normal, previousCounts.normal))}%` }, sparkline: sparkline(recent, (item) => (item.overallStatus === 'normal' ? 1 : 0)) },
      warning: { value: kpis.warning, trend: { label: 'vs prev. période', direction: delta(recentCounts.warning, previousCounts.warning) >= 0 ? 'up' as const : 'down' as const, value: `${Math.abs(delta(recentCounts.warning, previousCounts.warning))}%` }, sparkline: sparkline(recent, (item) => (item.overallStatus === 'warning' ? 1 : 0)) },
      critical: { value: kpis.critical, trend: { label: 'vs prev. période', direction: delta(recentCounts.critical, previousCounts.critical) >= 0 ? 'up' as const : 'down' as const, value: `${Math.abs(delta(recentCounts.critical, previousCounts.critical))}%` }, sparkline: sparkline(recent, (item) => (item.overallStatus === 'critical' ? 1 : 0)) },
    }
  }, [inspections, kpis])

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

  const statusBreakdownByDay = useMemo(() => {
    const byDate = new Map<string, { date: string; label: string; normal: number; warning: number; critical: number; total: number }>()
    for (const r of [...inspections].sort((a, b) => a.date.localeCompare(b.date))) {
      const entry = byDate.get(r.date) ?? { date: r.date, label: format(parseISO(r.date), 'dd/MM'), normal: 0, warning: 0, critical: 0, total: 0 }
      entry.total += 1
      if (r.overallStatus === 'normal') entry.normal += 1
      if (r.overallStatus === 'warning') entry.warning += 1
      if (r.overallStatus === 'critical') entry.critical += 1
      byDate.set(r.date, entry)
    }
    return Array.from(byDate.values())
  }, [inspections])

  const comparisonByDay = useMemo(() => {
    const byDate = new Map<string, { date: string; label: string; normal: number; anomaly: number }>()
    for (const r of [...inspections].sort((a, b) => a.date.localeCompare(b.date))) {
      const entry = byDate.get(r.date) ?? { date: r.date, label: format(parseISO(r.date), 'dd/MM'), normal: 0, anomaly: 0 }
      if (r.overallStatus === 'normal') entry.normal += 1
      else entry.anomaly += 1
      byDate.set(r.date, entry)
    }
    return Array.from(byDate.values())
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

  const latestPoint = statusBreakdownByDay.at(-1)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={<Activity className="h-5 w-5" />}
          label="Inspections"
          value={kpis.total}
          tint="#3A4657"
          trend={kpiTrends.total.trend}
          sparkline={kpiTrends.total.sparkline}
        />
        <KpiCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          label="Normales"
          value={kpis.normal}
          tint={statusColor('normal')}
          trend={kpiTrends.normal.trend}
          sparkline={kpiTrends.normal.sparkline}
        />
        <KpiCard
          icon={<AlertTriangle className="h-5 w-5" />}
          label="Alertes"
          value={kpis.warning}
          tint={statusColor('warning')}
          trend={kpiTrends.warning.trend}
          sparkline={kpiTrends.warning.sparkline}
        />
        <KpiCard
          icon={<XCircle className="h-5 w-5" />}
          label="Critiques"
          value={kpis.critical}
          tint={statusColor('critical')}
          trend={kpiTrends.critical.trend}
          sparkline={kpiTrends.critical.sparkline}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.45fr_0.85fr]">
        <Card className="overflow-hidden">
          <CardHeader
            title="Total inspections this month"
            subtitle="Statut global par jour d'inspection"
            action={<span className="rounded-full bg-[--color-graphite-50] px-3 py-1 text-xs font-medium text-[--color-graphite-500]">This year</span>}
          />
          <div className="h-88 p-5 pt-4 chart-shadow">
            {statusBreakdownByDay.length === 0 ? (
              <EmptyState />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={statusBreakdownByDay} margin={{ left: 0, right: 12, top: 20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="area-normal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={statusColor('normal')} stopOpacity={0.42} />
                      <stop offset="95%" stopColor={statusColor('normal')} stopOpacity={0.04} />
                    </linearGradient>
                    <linearGradient id="area-warning" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={statusColor('warning')} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={statusColor('warning')} stopOpacity={0.04} />
                    </linearGradient>
                    <linearGradient id="area-critical" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={statusColor('critical')} stopOpacity={0.34} />
                      <stop offset="95%" stopColor={statusColor('critical')} stopOpacity={0.04} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="#EDF0F3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#6B7A8F" axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#6B7A8F" axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 18, border: '1px solid #DCE1E7', boxShadow: '0 12px 32px rgba(18,24,31,0.12)' }}
                    formatter={(value, name) => [value, name]}
                    labelFormatter={(label) => `Date ${label}`}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="normal" name="Normal" stackId="1" stroke={statusColor('normal')} fill="url(#area-normal)" strokeWidth={2} />
                  <Area type="monotone" dataKey="warning" name="Alerte" stackId="1" stroke={statusColor('warning')} fill="url(#area-warning)" strokeWidth={2} />
                  <Area type="monotone" dataKey="critical" name="Critique" stackId="1" stroke={statusColor('critical')} fill="url(#area-critical)" strokeWidth={2} />
                  {latestPoint && (
                    <ReferenceDot
                      x={latestPoint.label}
                      y={latestPoint.total}
                      r={6}
                      fill={statusColor('normal')}
                      stroke="#fff"
                      strokeWidth={2}
                      label={{ value: `${latestPoint.total} · Last month`, position: 'top', fill: '#2E9E5B', fontSize: 11, fontWeight: 700 }}
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader title="Status distribution" subtitle="Toutes lectures d'équipement" />
            <div className="relative h-88 p-5 pt-4">
              {distribution.length === 0 ? (
                <EmptyState />
              ) : (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={distribution} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={4}>
                        {distribution.map((d) => (
                          <Cell key={d.name} fill={d.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <p className="font-display text-3xl font-semibold text-[--color-graphite-900]">{kpis.total}</p>
                      <p className="text-xs uppercase tracking-wide text-[--color-graphite-500]">Lectures</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Daily comparison" subtitle="Normal vs anomalies" />
            <div className="h-88 p-5 pt-4 chart-shadow">
              {comparisonByDay.length === 0 ? (
                <EmptyState />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparisonByDay} barGap={8}>
                    <CartesianGrid strokeDasharray="4 4" stroke="#EDF0F3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#6B7A8F" axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#6B7A8F" axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: 18, border: '1px solid #DCE1E7', boxShadow: '0 12px 32px rgba(18,24,31,0.12)' }}
                      formatter={(value, name) => [value, name]}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="normal" name="Normal" fill={statusColor('normal')} radius={[8, 8, 0, 0]} />
                    <Bar dataKey="anomaly" name="Anomalies" fill={statusColor('warning')} radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader
          title="Évolution des paramètres par équipement"
          subtitle="Suivi des valeurs enregistrées sur les 7 ou 30 derniers jours"
          action={
            <div className="flex items-center gap-2 rounded-full border border-[--color-graphite-200] bg-[--color-graphite-50] p-1 text-xs font-medium text-[--color-graphite-500]">
              <button
                type="button"
                onClick={() => setTrendRange('week')}
                className={`rounded-full px-3 py-1.5 transition-colors ${trendRange === 'week' ? 'bg-white text-[--color-graphite-900] shadow-sm' : 'hover:text-[--color-graphite-900]'}`}
              >
                7 jours
              </button>
              <button
                type="button"
                onClick={() => setTrendRange('month')}
                className={`rounded-full px-3 py-1.5 transition-colors ${trendRange === 'month' ? 'bg-white text-[--color-graphite-900] shadow-sm' : 'hover:text-[--color-graphite-900]'}`}
              >
                30 jours
              </button>
            </div>
          }
        />
        <div className="grid grid-cols-1 gap-4 p-6 lg:grid-cols-2">
          {equipmentTrends.map(({ definition, data, chartableFields }) => (
            <button
              key={definition.id}
              type="button"
              onClick={() => onSelectEquipment?.(definition.id)}
              className="group rounded-2xl border border-[--color-graphite-100] bg-[--color-graphite-50]/60 p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-[--color-amber-signal] hover:bg-white"
              data-equipment-id={definition.id}
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="font-display text-sm font-semibold uppercase tracking-[0.12em] text-[--color-graphite-900]">{definition.name}</p>
                  <p className="text-xs text-[--color-graphite-500]">
                    {chartableFields.length > 0 ? `${chartableFields.length} paramètre(s) suivi(s)` : 'Aucune valeur numérique sur la période'}
                    {latestInspectionByEquipment.get(definition.id) && ` · Dernière lecture ${format(parseISO(latestInspectionByEquipment.get(definition.id)!), 'dd/MM/yyyy')}`}
                  </p>
                </div>
                <span className="flex items-center gap-1 text-xs font-medium text-[--color-graphite-500] transition-colors group-hover:text-[--color-graphite-900]">
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
                      <defs>
                        <linearGradient id={`trend-${definition.id}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={CHART_GRADIENT} stopOpacity={0.28} />
                          <stop offset="95%" stopColor={CHART_GRADIENT} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#EDF0F3" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#6B7A8F" />
                      <YAxis allowDecimals tick={{ fontSize: 11 }} stroke="#6B7A8F" width={44} />
                      <Tooltip
                        contentStyle={{ borderRadius: 18, border: '1px solid #DCE1E7', boxShadow: '0 12px 32px rgba(18,24,31,0.12)' }}
                        labelFormatter={(label) => `Date: ${label}`}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      {chartableFields.map((field, index) => (
                        <Line
                          key={field.id}
                          type="monotone"
                          dataKey={field.id}
                          name={`${field.label}${field.unit ? ` (${field.unit})` : ''}`}
                          stroke={TREND_COLORS[index % TREND_COLORS.length]}
                          strokeWidth={2.5}
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
              <li key={item.equipmentId} className="flex items-center justify-between gap-4 px-6 py-4">
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
