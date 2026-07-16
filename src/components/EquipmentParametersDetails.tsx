import { useMemo, useState } from 'react'
import { format, parseISO, subDays } from 'date-fns'
import {
  ResponsiveContainer,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  XAxis,
  YAxis,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { ArrowLeft, Activity, PieChart as PieChartIcon, BarChart3 } from 'lucide-react'
import { Card, CardHeader, Button, Badge } from './ui/Primitives'
import { StatusBadge } from './ui/StatusBadge'
import { EQUIPMENT_DEFINITIONS } from '../data/equipment'
import { statusColor } from '../lib/validation'
import type { InspectionRecord, StatusLevel } from '../types'

const RANGE_COLORS = ['#3A4657', '#2E9E5B', '#E3A008', '#D6423C', '#4E7AE6', '#7A8AA3']

type TrendRange = 'week' | 'month'

type FieldChartPoint = {
  date: string
  label: string
  [key: string]: string | number | null
}

type StatusPieSlice = {
  name: string
  value: number
  color: string
}

type HistogramBin = {
  label: string
  value: number
}

function parseNumericValue(value: number | string | null | undefined): number | null {
  if (value === null || value === '' || value === undefined) return null
  if (typeof value === 'number') return value
  const match = value.match(/-?\d+(?:[.,]\d+)?/)
  if (!match) return null
  return parseFloat(match[0].replace(',', '.'))
}

function buildHistogram(values: number[]): HistogramBin[] {
  if (values.length === 0) return []
  if (values.length === 1) {
    const single = values[0]
    return [{ label: `${single}`, value: 1 }]
  }

  const min = Math.min(...values)
  const max = Math.max(...values)
  if (min === max) {
    return [{ label: `${min}`, value: values.length }]
  }

  const binCount = Math.min(6, Math.max(3, Math.ceil(Math.sqrt(values.length))))
  const step = (max - min) / binCount
  const bins = Array.from({ length: binCount }, (_, index) => {
    const start = min + step * index
    const end = index === binCount - 1 ? max : min + step * (index + 1)
    return {
      label: `${start.toFixed(1)}-${end.toFixed(1)}`,
      value: 0,
    }
  })

  for (const value of values) {
    const index = Math.min(binCount - 1, Math.floor((value - min) / step))
    bins[index].value += 1
  }

  return bins
}

function latestDateForRange(inspections: InspectionRecord[]): string | null {
  return inspections.reduce<string | null>((latest, current) => (latest && latest > current.date ? latest : current.date), null)
}

export function EquipmentParametersDetails({
  equipmentId,
  inspections,
  onBack,
}: {
  equipmentId: string
  inspections: InspectionRecord[]
  onBack: () => void
}) {
  const [trendRange, setTrendRange] = useState<TrendRange>('week')

  const definition = EQUIPMENT_DEFINITIONS.find((item) => item.id === equipmentId)

  const equipmentData = useMemo(() => {
    if (!definition) return null

    const latestDate = latestDateForRange(inspections)
    const cutoff = latestDate ? format(subDays(parseISO(latestDate), trendRange === 'week' ? 6 : 29), 'yyyy-MM-dd') : null
    const relevantInspections = [...inspections]
      .filter((inspection) => (cutoff ? inspection.date >= cutoff : true))
      .sort((a, b) => a.date.localeCompare(b.date))

    const points = relevantInspections.map((inspection) => {
      const equipmentReading = inspection.equipmentReadings.find((reading) => reading.equipmentId === equipmentId)
      const point: FieldChartPoint = {
        date: inspection.date,
        label: format(parseISO(inspection.date), 'dd/MM'),
      }

      for (const field of definition.fields) {
        const fieldReading = equipmentReading?.fields.find((reading) => reading.fieldId === field.id)
        const numericValue = parseNumericValue(fieldReading?.value)
        if (numericValue !== null) {
          point[field.id] = numericValue
        }
        point[`${field.id}__status`] = fieldReading?.status ?? 'unknown'
      }

      return point
    })

    const fieldCards = definition.fields.map((field) => {
      const values = points
        .map((point) => point[field.id])
        .filter((value): value is number => typeof value === 'number')

      const statusCounts = points.reduce<Record<StatusLevel, number>>(
        (acc, point) => {
          const status = (point[`${field.id}__status`] ?? 'unknown') as StatusLevel
          acc[status] += 1
          return acc
        },
        { normal: 0, warning: 0, critical: 0, unknown: 0 }
      )

      const latestPoint = [...points].reverse().find((point) => typeof point[field.id] === 'number')
      const pieData: StatusPieSlice[] = [
        { name: 'Normal', value: statusCounts.normal, color: statusColor('normal') },
        { name: 'Alerte', value: statusCounts.warning, color: statusColor('warning') },
        { name: 'Critique', value: statusCounts.critical, color: statusColor('critical') },
        { name: 'Non renseigné', value: statusCounts.unknown, color: statusColor('unknown') },
      ].filter((item) => item.value > 0)

      return {
        field,
        values,
        latestValue: latestPoint ? (latestPoint[field.id] as number) : null,
        lineData: points,
        histogramData: buildHistogram(values),
        pieData,
      }
    })

    return { points, fieldCards }
  }, [equipmentId, definition, inspections, trendRange])

  const latestStatus = useMemo<StatusLevel>(() => {
    if (!definition || !equipmentData?.points.length) return 'unknown'
    const lastPoint = [...equipmentData.points].reverse().find((point) => definition.fields.some((field) => typeof point[field.id] === 'number'))
    if (!lastPoint) return 'unknown'

    let worst: StatusLevel = 'normal'
    for (const field of definition.fields) {
      const status = (lastPoint[`${field.id}__status`] ?? 'unknown') as StatusLevel
      if (status === 'critical') return 'critical'
      if (status === 'warning') worst = 'warning'
      if (status === 'unknown' && worst === 'normal') worst = 'unknown'
    }
    return worst
  }, [definition, equipmentData?.points])

  if (!definition) {
    return (
      <Card>
        <CardHeader
          title="Détails des paramètres"
          subtitle="Équipement introuvable"
          action={<Button variant="ghost" onClick={onBack}><ArrowLeft className="h-4 w-4" /> Retour</Button>}
        />
        <div className="p-6 text-sm text-[--color-graphite-500]">L’équipement demandé n’existe pas dans la configuration actuelle.</div>
      </Card>
    )
  }

  const latestDate = latestDateForRange(inspections)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title={`${definition.name} · Détails des paramètres`}
          subtitle={latestDate ? `Dernière lecture globale: ${format(parseISO(latestDate), 'dd/MM/yyyy')}` : 'Aucune inspection enregistrée'}
          action={
            <div className="flex items-center gap-3">
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
              <Button variant="secondary" onClick={onBack}>
                <ArrowLeft className="h-4 w-4" />
                Retour au tableau de bord
              </Button>
            </div>
          }
        />
        <div className="grid grid-cols-1 gap-4 border-b border-[--color-graphite-100] p-5 md:grid-cols-3">
          <div className="rounded-xl border border-[--color-graphite-100] bg-[--color-graphite-50] p-4">
            <p className="text-xs uppercase tracking-wide text-[--color-graphite-500]">Paramètres suivis</p>
            <p className="mt-1 font-display text-2xl font-semibold text-[--color-graphite-900]">{definition.fields.length}</p>
          </div>
          <div className="rounded-xl border border-[--color-graphite-100] bg-[--color-graphite-50] p-4">
            <p className="text-xs uppercase tracking-wide text-[--color-graphite-500]">Lectures sur la période</p>
            <p className="mt-1 font-display text-2xl font-semibold text-[--color-graphite-900]">{equipmentData?.points.length ?? 0}</p>
          </div>
          <div className="rounded-xl border border-[--color-graphite-100] bg-[--color-graphite-50] p-4">
            <p className="text-xs uppercase tracking-wide text-[--color-graphite-500]">Statut global</p>
            <div className="mt-2 flex items-center gap-2">
              <StatusBadge status={latestStatus} compact />
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {equipmentData?.fieldCards.map(({ field, values, latestValue, lineData, histogramData, pieData }) => (
          <Card key={field.id}>
            <CardHeader
              title={field.label}
              subtitle={
                latestValue !== null
                  ? `Dernière valeur: ${latestValue}${field.unit ?? ''}`
                  : 'Aucune valeur numérique enregistrée'
              }
              action={<Badge>{field.kind === 'number' ? 'Numérique' : 'Texte'}</Badge>}
            />
            <div className="space-y-4 p-5">
              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[--color-graphite-500]">
                  <Activity className="h-3.5 w-3.5" /> Évolution
                </div>
                <div className="h-56">
                  {values.length === 0 ? (
                    <EmptyChart message="Aucune valeur exploitable pour cette période." />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={lineData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#EDF0F3" />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#6B7A8F" />
                        <YAxis tick={{ fontSize: 11 }} stroke="#6B7A8F" width={44} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Line
                          type="monotone"
                          dataKey={field.id}
                          name={field.label}
                          stroke={RANGE_COLORS[0]}
                          strokeWidth={2}
                          dot={false}
                          connectNulls
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[--color-graphite-500]">
                    <BarChart3 className="h-3.5 w-3.5" /> Bar chart
                  </div>
                  <div className="h-56 rounded-xl border border-[--color-graphite-100] bg-[--color-graphite-50] p-2">
                    {values.length === 0 ? (
                      <EmptyChart message="Pas de série temporelle disponible." />
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={lineData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#EDF0F3" />
                          <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#6B7A8F" />
                          <YAxis tick={{ fontSize: 11 }} stroke="#6B7A8F" width={44} />
                          <Tooltip />
                          <Bar dataKey={field.id} fill={RANGE_COLORS[1]} radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[--color-graphite-500]">
                    <PieChartIcon className="h-3.5 w-3.5" /> Répartition des statuts
                  </div>
                  <div className="h-56 rounded-xl border border-[--color-graphite-100] bg-[--color-graphite-50] p-2">
                    {pieData.length === 0 ? (
                      <EmptyChart message="Statut indisponible sur la période." />
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={42} outerRadius={74} paddingAngle={3}>
                            {pieData.map((slice) => (
                              <Cell key={slice.name} fill={slice.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[--color-graphite-500]">
                  <BarChart3 className="h-3.5 w-3.5" /> Histogramme
                </div>
                <div className="h-56 rounded-xl border border-[--color-graphite-100] bg-[--color-graphite-50] p-2">
                  {histogramData.length === 0 ? (
                    <EmptyChart message="Histogramme indisponible sans valeurs numériques." />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={histogramData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#EDF0F3" />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#6B7A8F" />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#6B7A8F" width={44} />
                        <Tooltip />
                        <Bar dataKey="value" name="Occurrences" fill={RANGE_COLORS[2]} radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

function EmptyChart({ message }: { message: string }) {
  return <div className="flex h-full items-center justify-center px-4 text-center text-sm text-[--color-graphite-500]">{message}</div>
}
