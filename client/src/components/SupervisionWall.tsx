import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { format } from 'date-fns'
import { Maximize2, Minimize2, RefreshCw, Radio, WifiOff, CircleDot } from 'lucide-react'
import { statusColor, worstStatus as worst } from '../lib/validation'
import { useEquipmentDefinitions } from '../hooks/useEquipment'
import { useSupervision } from '../hooks/useSupervision'
import { fetchMaintenanceAll, type MaintenanceStatus } from '../hooks/useData'
import { SUPERVISION_LAYOUT, STALE_AFTER_MS, type WidgetKind } from '../lib/supervisionConfig'
import type { EquipmentField, StatusLevel } from '../types'
import { deriveMeter } from './supervision/meter'
import {
  GaugeWidget,
  BatteryWidget,
  TankWidget,
  ThermometerWidget,
  DigitalCounterWidget,
  ValueRangeWidget,
  BarChartWidget,
  type WidgetProps,
  type BarSeriesItem,
} from './supervision/widgets'

// Single-parameter widgets, keyed by kind. 'bars' is multi-parameter and handled separately.
const SINGLE_WIDGETS: Record<Exclude<WidgetKind, 'bars'>, (p: WidgetProps) => React.ReactElement> = {
  gauge: GaugeWidget,
  battery: BatteryWidget,
  tank: TankWidget,
  thermometer: ThermometerWidget,
  counter: DigitalCounterWidget,
  valuerange: ValueRangeWidget,
}

interface Cell {
  key: string
  kind: WidgetKind
  equipmentName: string
  label: string
  stale: boolean
  countStatus: StatusLevel | null // null = excluded from the summary (counters)
  field?: EquipmentField
  value?: number | string | null
  capacity?: number | null
  maintenance?: MaintenanceStatus | null
  series?: BarSeriesItem[]
}

/** Choose a column count so `count` cells tile the WxH area with the least wasted
 *  space and a pleasant cell aspect — guaranteeing every cell fits without scroll. */
function fitGrid(count: number, w: number, h: number): { cols: number; rows: number } {
  if (count <= 0) return { cols: 1, rows: 1 }
  if (w <= 0 || h <= 0) {
    const cols = Math.min(count, 5)
    return { cols, rows: Math.ceil(count / cols) }
  }
  const TARGET = 1.25 // slightly-wide cards look best
  let best = { cols: 1, rows: count, score: -Infinity }
  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.ceil(count / cols)
    const aspect = w / cols / (h / rows)
    const empties = cols * rows - count
    const score = -Math.abs(Math.log(aspect / TARGET)) - empties * 0.12
    if (score > best.score) best = { cols, rows, score }
  }
  return { cols: best.cols, rows: best.rows }
}

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize({ w: width, h: height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, size] as const
}

export function SupervisionWall() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [gridRef, gridSize] = useElementSize<HTMLDivElement>()
  const { definitions } = useEquipmentDefinitions()
  const { data, lastUpdated, connection, refresh } = useSupervision(20_000)
  const [maintenance, setMaintenance] = useState<MaintenanceStatus[]>([])
  const [now, setNow] = useState(new Date())
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const load = () => fetchMaintenanceAll().then(setMaintenance).catch(() => setMaintenance([]))
    void load()
    const t = setInterval(load, 60_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const clock = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(clock)
  }, [])

  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) containerRef.current?.requestFullscreen?.().catch(() => {})
    else document.exitFullscreen?.().catch(() => {})
  }, [])

  const defById = useMemo(() => new Map(definitions.map((d) => [d.id, d])), [definitions])
  const supById = useMemo(() => new Map((data?.equipment ?? []).map((e) => [e.equipmentId, e])), [data])
  const maintById = useMemo(() => new Map(maintenance.map((m) => [m.equipmentId, m])), [maintenance])

  // Expand the curated layout templates (by-id + by-name-token) into a FLAT list
  // of renderable cells (no per-equipment grouping — each card names its own equipment).
  const cells = useMemo(() => {
    const isStale = (recordedAt?: string) => Boolean(recordedAt && Date.now() - new Date(recordedAt).getTime() > STALE_AFTER_MS)

    const resolved: { equipmentId: string; name: string; widgets: (typeof SUPERVISION_LAYOUT)[number]['widgets'] }[] = []
    for (const tpl of SUPERVISION_LAYOUT) {
      if (tpl.type === 'id') {
        const def = defById.get(tpl.equipmentId)
        if (def) resolved.push({ equipmentId: def.id, name: def.name, widgets: tpl.widgets })
      } else {
        const token = tpl.token.toLowerCase()
        for (const def of definitions) {
          if (def.id.toLowerCase().includes(token) || def.name.toLowerCase().includes(token)) {
            resolved.push({ equipmentId: def.id, name: def.name, widgets: tpl.widgets })
          }
        }
      }
    }

    const out: Cell[] = []
    for (const section of resolved) {
      const def = defById.get(section.equipmentId)!
      const sup = supById.get(section.equipmentId)
      const supValue = (fieldId: string) => sup?.fields.find((f) => f.fieldId === fieldId)

      for (const w of section.widgets) {
        if (w.kind === 'bars') {
          type BarPoint = BarSeriesItem & { recordedAt?: string }
          const series: BarPoint[] = (w.fieldIds ?? [])
            .map((id): BarPoint | null => {
              const field = def.fields.find((f) => f.id === id)
              if (!field) return null
              const sf = supValue(id)
              return { field, value: sf?.value ?? null, recordedAt: sf?.recordedAt }
            })
            .filter((s): s is BarPoint => s !== null)
          if (series.length === 0) continue
          const withVal = series.filter((s) => s.value !== null && s.value !== '')
          out.push({
            key: `${section.equipmentId}:${w.label ?? 'bars'}`,
            kind: 'bars',
            equipmentName: section.name,
            label: w.label ?? 'Valeurs',
            series: series.map((s) => ({ field: s.field, value: s.value })),
            stale: withVal.length > 0 && withVal.every((s) => isStale(s.recordedAt)),
            countStatus: withVal.length ? withVal.reduce<StatusLevel>((acc, s) => worst(acc, deriveMeter(s.field, s.value).status), 'normal') : 'unknown',
          })
          continue
        }

        const field = w.fieldId ? def.fields.find((f) => f.id === w.fieldId) : undefined
        if (!field) continue
        const sf = supValue(field.id)
        const value = sf?.value ?? null
        const hasValue = value !== null && value !== ''
        out.push({
          key: `${section.equipmentId}:${field.id}`,
          kind: w.kind,
          equipmentName: section.name,
          label: field.label,
          field,
          value,
          stale: Boolean(hasValue && isStale(sf?.recordedAt)),
          capacity: w.capacity ?? null,
          maintenance: maintById.get(section.equipmentId) ?? null,
          countStatus: w.kind === 'counter' ? null : hasValue ? deriveMeter(field, value).status : 'unknown',
        })
      }
    }
    return out
  }, [defById, supById, maintById, definitions])

  const counts = useMemo(() => {
    const c = { normal: 0, warning: 0, critical: 0, unknown: 0 }
    for (const cell of cells) if (cell.countStatus) c[cell.countStatus] += 1
    return c
  }, [cells])

  const { cols, rows } = useMemo(() => fitGrid(cells.length, gridSize.w, gridSize.h), [cells.length, gridSize.w, gridSize.h])

  const hasData = (data?.equipment.length ?? 0) > 0
  const allStale = hasData && cells.length > 0 && cells.every((c) => !c.value || c.stale)

  return (
    <div ref={containerRef} className="flex h-full min-h-0 flex-col gap-2 overflow-hidden bg-[--color-graphite-50]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[--color-graphite-100] bg-white px-4 py-2.5">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[--color-brand-600] text-white"><CircleDot className="h-5 w-5" /></span>
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-[--color-graphite-400]">Supervision temps réel</p>
            <h2 className="text-base font-bold tracking-tight text-[--color-graphite-900]">Mur de contrôle des équipements</h2>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 text-xs font-medium sm:flex">
            <Count label="Normal" value={counts.normal} color={statusColor('normal')} />
            <Count label="Alerte" value={counts.warning} color={statusColor('warning')} />
            <Count label="Critique" value={counts.critical} color={statusColor('critical')} />
          </div>

          <ConnectionBadge connection={connection} lastUpdated={lastUpdated} />

          <div className="text-right">
            <p className="font-mono text-xl font-bold tabular-nums text-[--color-graphite-900]">{format(now, 'HH:mm:ss')}</p>
            <p className="text-[10px] text-[--color-graphite-400]">{format(now, 'EEEE dd/MM/yyyy')}</p>
          </div>

          <button onClick={() => void refresh()} className="flex h-9 w-9 items-center justify-center rounded-full border border-[--color-graphite-200] text-[--color-graphite-500] transition-colors hover:text-[--color-graphite-900]" title="Rafraîchir">
            <RefreshCw className="h-4 w-4" />
          </button>
          <button onClick={toggleFullscreen} className="flex h-9 items-center gap-2 rounded-full border border-[--color-graphite-200] px-3 text-xs font-medium text-[--color-graphite-700] transition-colors hover:bg-[--color-graphite-50]" title="Plein écran">
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            <span className="hidden sm:inline">{isFullscreen ? 'Quitter' : 'Plein écran'}</span>
          </button>
        </div>
      </div>

      {allStale && (
        <div className="rounded-xl border border-[--color-status-warning] bg-[--color-status-warning-bg] px-4 py-1.5 text-center text-xs font-semibold text-[--color-status-warning]">
          Données anciennes — aucune inspection récente. Les valeurs affichées peuvent ne pas refléter l’état actuel.
        </div>
      )}

      {/* Auto-fitting widget grid — fills the remaining height exactly, no scroll */}
      {!hasData && connection === 'connecting' ? (
        <div className="flex flex-1 items-center justify-center text-sm text-[--color-graphite-500]">Chargement des données…</div>
      ) : !hasData && connection === 'error' ? (
        <div className="flex flex-1 items-center justify-center text-sm text-[--color-status-critical]">Connexion impossible au serveur.</div>
      ) : (
        <div
          ref={gridRef}
          className="grid min-h-0 flex-1 gap-2 sm:gap-3"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}
        >
          {cells.map((cell) =>
            cell.kind === 'bars' ? (
              <div key={cell.key} className="min-h-0">
                <BarChartWidget equipmentName={cell.equipmentName} label={cell.label} series={cell.series ?? []} stale={cell.stale} />
              </div>
            ) : (
              (() => {
                const Widget = SINGLE_WIDGETS[cell.kind]
                return (
                  <div key={cell.key} className="min-h-0">
                    <Widget
                      equipmentName={cell.equipmentName}
                      field={cell.field!}
                      value={cell.value ?? null}
                      stale={cell.stale}
                      capacity={cell.capacity}
                      maintenance={cell.maintenance}
                    />
                  </div>
                )
              })()
            ),
          )}
        </div>
      )}
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

function ConnectionBadge({ connection, lastUpdated }: { connection: 'connecting' | 'live' | 'error'; lastUpdated: Date | null }) {
  const meta =
    connection === 'live'
      ? { color: statusColor('normal'), label: 'En direct', icon: <Radio className="h-3.5 w-3.5" />, pulse: true }
      : connection === 'error'
        ? { color: statusColor('critical'), label: 'Hors ligne', icon: <WifiOff className="h-3.5 w-3.5" />, pulse: false }
        : { color: statusColor('unknown'), label: 'Connexion…', icon: <Radio className="h-3.5 w-3.5" />, pulse: true }
  return (
    <div className="flex flex-col items-end">
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: `${meta.color}18`, color: meta.color }}>
        <span className="relative flex h-2 w-2">
          {meta.pulse && <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ backgroundColor: meta.color }} />}
          <span className="relative inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: meta.color }} />
        </span>
        {meta.label}
      </span>
      {lastUpdated && <span className="mt-0.5 text-[10px] text-[--color-graphite-400]">maj {format(lastUpdated, 'HH:mm:ss')}</span>}
    </div>
  )
}
