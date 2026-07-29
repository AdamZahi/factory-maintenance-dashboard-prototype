import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { EQUIPMENT_DEFINITIONS } from '../data/equipment'
import { statusColor } from '../lib/validation'
import { StatusDot } from './ui/StatusBadge'
import { apiFetch } from '../lib/storage'
import { fetchMaintenanceAll, type MaintenanceStatus } from '../hooks/useData'
import type { InspectionRecord, StatusLevel } from '../types'
import { Maximize2, Minimize2, RefreshCw, Wrench, CircleDot } from 'lucide-react'

const REFRESH_MS = 45_000

export function MonitoringPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [inspections, setInspections] = useState<InspectionRecord[]>([])
  const [maintenance, setMaintenance] = useState<MaintenanceStatus[]>([])
  const [now, setNow] = useState(new Date())
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const [insp, maint] = await Promise.all([
        apiFetch<InspectionRecord[]>('/api/inspections'),
        fetchMaintenanceAll().catch(() => [] as MaintenanceStatus[]),
      ])
      setInspections(insp)
      setMaintenance(maint)
      setLastRefresh(new Date())
    } catch (err) {
      console.error('[monitoring] refresh failed', err)
    }
  }, [])

  // Data auto-refresh + live clock.
  useEffect(() => {
    void refresh()
    const dataTimer = setInterval(() => void refresh(), REFRESH_MS)
    const clockTimer = setInterval(() => setNow(new Date()), 1000)
    return () => {
      clearInterval(dataTimer)
      clearInterval(clockTimer)
    }
  }, [refresh])

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) containerRef.current?.requestFullscreen?.().catch(() => {})
    else document.exitFullscreen?.().catch(() => {})
  }

  const sorted = useMemo(() => [...inspections].sort((a, b) => b.date.localeCompare(a.date)), [inspections])
  const maintById = useMemo(() => new Map(maintenance.map((m) => [m.equipmentId, m])), [maintenance])

  const tiles = useMemo(
    () =>
      EQUIPMENT_DEFINITIONS.map((def) => {
        let reading: InspectionRecord['equipmentReadings'][number] | null = null
        let date: string | null = null
        for (const insp of sorted) {
          const r = insp.equipmentReadings.find((e) => e.equipmentId === def.id && e.status !== 'unknown')
          if (r) {
            reading = r
            date = insp.date
            break
          }
        }
        return { def, reading, date, status: (reading?.status ?? 'unknown') as StatusLevel, maint: maintById.get(def.id) ?? null }
      }),
    [sorted, maintById],
  )

  const counts = useMemo(() => {
    const c = { normal: 0, warning: 0, critical: 0, unknown: 0 }
    for (const t of tiles) c[t.status] += 1
    return c
  }, [tiles])

  return (
    <div ref={containerRef} className="flex h-full min-h-full flex-col gap-4 bg-[--color-graphite-50] p-1 sm:p-2">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[--color-graphite-100] bg-white px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[--color-brand-600] text-white"><CircleDot className="h-5 w-5" /></span>
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-[--color-graphite-400]">Supervision temps réel</p>
            <h2 className="text-lg font-bold tracking-tight text-[--color-graphite-900]">État des équipements</h2>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden items-center gap-2 text-xs font-medium sm:flex">
            <Count label="Normal" value={counts.normal} color={statusColor('normal')} />
            <Count label="Alerte" value={counts.warning} color={statusColor('warning')} />
            <Count label="Critique" value={counts.critical} color={statusColor('critical')} />
          </div>
          <div className="text-right">
            <p className="font-mono text-2xl font-bold tabular-nums text-[--color-graphite-900]">{format(now, 'HH:mm:ss')}</p>
            <p className="text-[11px] text-[--color-graphite-400]">
              {format(now, 'EEEE dd/MM/yyyy')}
              {lastRefresh && <> · maj {format(lastRefresh, 'HH:mm')}</>}
            </p>
          </div>
          <button
            onClick={() => void refresh()}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[--color-graphite-200] text-[--color-graphite-500] transition-colors hover:text-[--color-graphite-900]"
            title="Rafraîchir"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={toggleFullscreen}
            className="flex h-9 items-center gap-2 rounded-full border border-[--color-graphite-200] px-3 text-xs font-medium text-[--color-graphite-700] transition-colors hover:bg-[--color-graphite-50]"
            title="Plein écran"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            <span className="hidden sm:inline">{isFullscreen ? 'Quitter' : 'Plein écran'}</span>
          </button>
        </div>
      </div>

      {/* Equipment grid — sized to fill the remaining height */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {tiles.map((t) => (
          <EquipmentTile key={t.def.id} tile={t} />
        ))}
      </div>
    </div>
  )
}

function Count({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1" style={{ backgroundColor: `${color}14`, color }}>
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {value} {label}
    </span>
  )
}

type Tile = {
  def: (typeof EQUIPMENT_DEFINITIONS)[number]
  reading: InspectionRecord['equipmentReadings'][number] | null
  date: string | null
  status: StatusLevel
  maint: MaintenanceStatus | null
}

const BORDER: Record<StatusLevel, string> = {
  normal: 'border-l-[--color-status-normal]',
  warning: 'border-l-[--color-status-warning]',
  critical: 'border-l-[--color-status-critical]',
  unknown: 'border-l-[--color-graphite-200]',
}

function EquipmentTile({ tile }: { tile: Tile }) {
  const { def, reading, date, status, maint } = tile
  const maintAlert = maint && (maint.state === 'due_soon' || maint.state === 'overdue')

  return (
    <div className={`flex min-h-0 flex-col overflow-hidden rounded-2xl border border-l-4 border-[--color-graphite-100] bg-white ${BORDER[status]}`}>
      <div className="flex items-center justify-between gap-2 border-b border-[--color-graphite-100] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <StatusDot status={status} pulse />
          <p className="text-sm font-bold text-[--color-graphite-900]">{def.name}</p>
        </div>
        {maintAlert && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ backgroundColor: `${statusColor(maint!.state === 'overdue' ? 'critical' : 'warning')}18`, color: statusColor(maint!.state === 'overdue' ? 'critical' : 'warning') }}
            title="Entretien"
          >
            <Wrench className="h-3 w-3" />
            {maint!.state === 'overdue' ? 'Entretien en retard' : 'Entretien proche'}
          </span>
        )}
      </div>

      <div className="grid flex-1 auto-rows-min grid-cols-2 gap-x-4 gap-y-1.5 overflow-y-auto p-4">
        {def.fields.map((field) => {
          const fr = reading?.fields.find((f) => f.fieldId === field.id)
          const hasValue = fr && fr.value !== null && fr.value !== ''
          const color = fr && (fr.status === 'warning' || fr.status === 'critical') ? statusColor(fr.status) : undefined
          return (
            <div key={field.id} className="flex items-baseline justify-between gap-2 border-b border-dashed border-[--color-graphite-100] pb-1">
              <span className="truncate text-[11px] text-[--color-graphite-500]">{field.label}</span>
              <span className="shrink-0 font-mono text-sm font-semibold" style={{ color: color ?? 'var(--color-graphite-900)' }}>
                {hasValue ? `${fr!.value}${field.unit ? ` ${field.unit}` : ''}` : '—'}
              </span>
            </div>
          )
        })}
      </div>

      <div className="border-t border-[--color-graphite-100] px-4 py-1.5 text-[11px] text-[--color-graphite-400]">
        {date ? `Dernière lecture ${format(parseISO(date), 'dd/MM/yyyy')}` : 'Aucune donnée'}
        {maint?.currentMeter != null && ` · ${maint.currentMeter} h`}
      </div>
    </div>
  )
}
