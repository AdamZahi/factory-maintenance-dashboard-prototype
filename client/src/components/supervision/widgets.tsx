import { statusColor, statusLabel, evaluateField, worstStatus } from '../../lib/validation'
import type { EquipmentField, StatusLevel } from '../../types'
import type { MaintenanceStatus } from '../../hooks/useData'
import { deriveMeter, parseNumeric, formatRange, bandFill, type Meter } from './meter'
import { CheckCircle2, AlertTriangle, XCircle, CircleDashed, Clock } from 'lucide-react'

// ---------------------------------------------------------------------------
// Wall-display widgets. Designed for glanceability from across a room: big
// numbers, high contrast, status color always paired with an icon + label
// (never color alone). Status is taken from the validation engine via
// deriveMeter — thresholds are never reimplemented here.
// ---------------------------------------------------------------------------

export interface WidgetProps {
  equipmentName: string
  field: EquipmentField
  value: number | string | null
  stale?: boolean
  capacity?: number | null
  maintenance?: MaintenanceStatus | null
}

function fmtValue(value: number | string | null): string {
  const n = parseNumeric(value)
  if (n === null) return '—'
  const rounded = Math.round(n * 100) / 100
  return rounded.toLocaleString('fr-FR')
}

const STATUS_ICON: Record<StatusLevel, React.ReactNode> = {
  normal: <CheckCircle2 className="h-4 w-4" />,
  warning: <AlertTriangle className="h-4 w-4" />,
  critical: <XCircle className="h-4 w-4" />,
  unknown: <CircleDashed className="h-4 w-4" />,
}

function StatusPill({ status }: { status: StatusLevel }) {
  const color = statusColor(status)
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide"
      style={{ backgroundColor: `${color}1A`, color }}
    >
      {STATUS_ICON[status]}
      {statusLabel(status)}
    </span>
  )
}

/** Shared card frame: equipment + parameter heading, status pill, stale ribbon. */
export function WidgetFrame({
  equipmentName,
  label,
  status,
  stale,
  children,
}: {
  equipmentName: string
  label: string
  status: StatusLevel
  stale?: boolean
  children: React.ReactNode
}) {
  const color = statusColor(status)
  return (
    <div
      className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[--color-graphite-200] bg-white shadow-sm"
      style={{ borderTopColor: color, borderTopWidth: 4 }}
    >
      <div className="flex items-start justify-between gap-2 px-4 pt-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-[--color-graphite-400]">{equipmentName}</p>
          <p className="truncate text-lg font-bold leading-tight text-[--color-graphite-900]">{label}</p>
        </div>
        <StatusPill status={status} />
      </div>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 pb-3 pt-1">{children}</div>
      {stale && (
        <div className="flex items-center justify-center gap-1 bg-[--color-status-warning-bg] py-1 text-[10px] font-semibold uppercase tracking-wide text-[--color-status-warning]">
          <Clock className="h-3 w-3" /> Donnée ancienne
        </div>
      )}
    </div>
  )
}

function BigValue({ value, unit, color }: { value: number | string | null; unit?: string; color?: string }) {
  return (
    <div className="flex items-baseline justify-center gap-1.5">
      <span className="font-display text-5xl font-bold tabular-nums leading-none" style={{ color: color ?? 'var(--color-graphite-900)' }}>
        {fmtValue(value)}
      </span>
      {unit && <span className="text-lg font-semibold text-[--color-graphite-400]">{unit}</span>}
    </div>
  )
}

// --- SVG helpers -----------------------------------------------------------

function polar(cx: number, cy: number, r: number, frac: number) {
  const theta = Math.PI * (1 - frac)
  return { x: cx + r * Math.cos(theta), y: cy - r * Math.sin(theta) }
}
function arcPath(cx: number, cy: number, r: number, a0: number, a1: number) {
  const s = polar(cx, cy, r, a0)
  const e = polar(cx, cy, r, a1)
  // The gauge spans a 180° semicircle, so any sub-arc is ≤180° → always the
  // minor arc (large-arc-flag 0). Sweep 1 keeps it on the top half.
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 0 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`
}
function toFrac(m: Meter, v: number) {
  const [lo, hi] = m.domain
  return hi === lo ? 0 : Math.max(0, Math.min(1, (v - lo) / (hi - lo)))
}

// --- 1. Radial / fuel gauge ------------------------------------------------

export function GaugeWidget({ equipmentName, field, value, stale, capacity }: WidgetProps) {
  const m = deriveMeter(field, value, capacity)
  const cx = 110
  const cy = 110
  const r = 88
  const noData = m.value === null
  const pct = capacity && capacity > 0 && m.value != null ? Math.round((m.value / capacity) * 100) : null

  return (
    <WidgetFrame equipmentName={equipmentName} label={field.label} status={noData ? 'unknown' : m.status} stale={stale}>
      <svg viewBox="0 0 220 128" className="w-full max-w-[240px] max-h-full">
        {/* base track */}
        <path d={arcPath(cx, cy, r, 0, 1)} fill="none" stroke="var(--color-graphite-100)" strokeWidth={16} strokeLinecap="round" />
        {/* colored zones */}
        {m.zones.map((z, i) => (
          <path key={i} d={arcPath(cx, cy, r, toFrac(m, z.from), toFrac(m, z.to))} fill="none" stroke={statusColor(z.tone)} strokeWidth={16} strokeOpacity={0.9} />
        ))}
        {/* needle */}
        {m.fill !== null && (
          <>
            <line
              x1={cx}
              y1={cy}
              x2={polar(cx, cy, r - 10, m.fill).x}
              y2={polar(cx, cy, r - 10, m.fill).y}
              stroke="var(--color-graphite-900)"
              strokeWidth={4}
              strokeLinecap="round"
            />
            <circle cx={cx} cy={cy} r={7} fill="var(--color-graphite-900)" />
          </>
        )}
      </svg>
      <BigValue value={value} unit={field.unit} color={noData ? undefined : m.color} />
      <p className="mt-0.5 text-xs text-[--color-graphite-400]">
        {pct !== null ? `${pct}% du réservoir` : formatRange(field) ?? 'Valeur brute'}
      </p>
    </WidgetFrame>
  )
}

// --- 2. Battery indicator --------------------------------------------------

export function BatteryWidget({ equipmentName, field, value, stale }: WidgetProps) {
  const m = deriveMeter(field, value)
  const noData = m.value === null
  const fill = bandFill(field, value)
  const pct = fill === null ? null : Math.round(fill * 100)
  const color = noData ? 'var(--color-graphite-300)' : m.color

  return (
    <WidgetFrame equipmentName={equipmentName} label={field.label} status={noData ? 'unknown' : m.status} stale={stale}>
      <svg viewBox="0 0 200 90" className="w-full max-w-[220px] max-h-full">
        <rect x={6} y={18} width={172} height={54} rx={10} fill="none" stroke="var(--color-graphite-300)" strokeWidth={4} />
        <rect x={182} y={36} width={12} height={18} rx={3} fill="var(--color-graphite-300)" />
        {fill !== null && <rect x={12} y={24} width={Math.max(4, 160 * fill)} height={42} rx={6} fill={color} />}
        <text x={92} y={53} textAnchor="middle" className="font-display" fontSize={30} fontWeight={700} fill={fill !== null ? '#fff' : 'var(--color-graphite-400)'}>
          {pct !== null ? `${pct}%` : '—'}
        </text>
      </svg>
      <BigValue value={value} unit={field.unit} color={noData ? undefined : m.color} />
      <p className="mt-0.5 text-xs text-[--color-graphite-400]">{formatRange(field) ?? 'Tension batterie'}</p>
    </WidgetFrame>
  )
}

// --- 3. Tank / barrel fill -------------------------------------------------

export function TankWidget({ equipmentName, field, value, stale, capacity }: WidgetProps) {
  const m = deriveMeter(field, value, capacity)
  const noData = m.value === null
  const fill = capacity && capacity > 0 && m.value != null ? Math.max(0, Math.min(1, m.value / capacity)) : null
  const color = noData ? 'var(--color-graphite-300)' : m.color
  const h = 84
  const fillH = fill === null ? 0 : h * fill

  return (
    <WidgetFrame equipmentName={equipmentName} label={field.label} status={noData ? 'unknown' : m.status} stale={stale}>
      <svg viewBox="0 0 120 110" className="h-[120px] max-h-full w-auto">
        {/* vessel */}
        <rect x={34} y={10} width={52} height={92} rx={10} fill="var(--color-graphite-50)" stroke="var(--color-graphite-300)" strokeWidth={3} />
        {fill !== null && <rect x={37} y={13 + (h - fillH)} width={46} height={fillH} rx={7} fill={color} fillOpacity={0.9} />}
        {/* gradations */}
        {[0.25, 0.5, 0.75].map((g) => (
          <line key={g} x1={34} y1={13 + h * (1 - g)} x2={44} y2={13 + h * (1 - g)} stroke="var(--color-graphite-300)" strokeWidth={2} />
        ))}
      </svg>
      <BigValue value={value} unit={field.unit} color={noData ? undefined : m.color} />
      <p className="mt-0.5 text-xs text-[--color-graphite-400]">
        {fill !== null ? `${Math.round(fill * 100)}% rempli` : formatRange(field) ?? 'Volume'}
      </p>
    </WidgetFrame>
  )
}

// --- 4. Thermometer --------------------------------------------------------

export function ThermometerWidget({ equipmentName, field, value, stale }: WidgetProps) {
  const m = deriveMeter(field, value)
  const noData = m.value === null
  const color = noData ? 'var(--color-graphite-300)' : m.color
  const top = 12
  const h = 78
  const fillH = m.fill === null ? 0 : h * m.fill

  return (
    <WidgetFrame equipmentName={equipmentName} label={field.label} status={noData ? 'unknown' : m.status} stale={stale}>
      <svg viewBox="0 0 120 118" className="h-[124px] max-h-full w-auto">
        {/* zone scale */}
        {m.zones.map((z, i) => {
          const zy = top + h * (1 - toFrac(m, z.to))
          const zh = h * (toFrac(m, z.to) - toFrac(m, z.from))
          return <rect key={i} x={70} y={zy} width={8} height={Math.max(0, zh)} fill={statusColor(z.tone)} fillOpacity={0.85} rx={2} />
        })}
        {/* tube */}
        <rect x={48} y={top} width={16} height={h} rx={8} fill="var(--color-graphite-50)" stroke="var(--color-graphite-300)" strokeWidth={3} />
        {m.fill !== null && <rect x={51} y={top + (h - fillH)} width={10} height={fillH} rx={5} fill={color} />}
        {/* bulb */}
        <circle cx={56} cy={top + h + 8} r={15} fill={color} stroke="var(--color-graphite-300)" strokeWidth={3} />
      </svg>
      <BigValue value={value} unit={field.unit} color={noData ? undefined : m.color} />
      <p className="mt-0.5 text-xs text-[--color-graphite-400]">{formatRange(field) ?? 'Température'}</p>
    </WidgetFrame>
  )
}

// --- 5. Digital counter readout --------------------------------------------

export function DigitalCounterWidget({ equipmentName, field, value, stale, maintenance }: WidgetProps) {
  const noData = parseNumeric(value) === null
  // Counters are cumulative meters with no pass/fail rule → neutral status.
  const remaining = maintenance?.hoursRemaining
  const withinWarning =
    maintenance != null && remaining != null && maintenance.warningHoursBefore != null && remaining <= maintenance.warningHoursBefore
  const serviceColor = maintenance?.state === 'overdue' ? statusColor('critical') : withinWarning ? statusColor('warning') : statusColor('normal')

  return (
    <WidgetFrame equipmentName={equipmentName} label={field.label} status="unknown" stale={stale}>
      <div className="w-full rounded-xl bg-[--color-graphite-900] px-4 py-4 text-center">
        <span className="font-mono text-4xl font-bold tabular-nums tracking-wider text-[--color-status-normal]" style={{ color: '#5FE3A1' }}>
          {noData ? '——' : fmtValue(value)}
        </span>
        {field.unit && <span className="ml-1.5 text-base font-semibold text-[--color-graphite-400]">{field.unit}</span>}
      </div>
      {maintenance ? (
        <p className="mt-2 text-center text-xs font-semibold" style={{ color: serviceColor }}>
          {maintenance.state === 'overdue'
            ? 'Entretien en retard'
            : remaining != null
              ? `${Math.max(0, Math.round(remaining))} h avant entretien`
              : 'Entretien planifié'}
        </p>
      ) : (
        <p className="mt-2 text-center text-xs text-[--color-graphite-400]">Compteur cumulé</p>
      )}
    </WidgetFrame>
  )
}

// --- 7. Multi-parameter bar chart (e.g. TGBT phase tensions) ---------------

export interface BarSeriesItem {
  field: EquipmentField
  value: number | string | null
}

export function BarChartWidget({
  equipmentName,
  label,
  series,
  stale,
}: {
  equipmentName: string
  label: string
  series: BarSeriesItem[]
  stale?: boolean
}) {
  const points = series.map((s) => {
    const v = parseNumeric(s.value)
    const status = v === null ? ('unknown' as StatusLevel) : evaluateField(s.field, s.value).status
    // Short axis label, e.g. "Tension Ph1" -> "Ph1"
    const short = s.field.label.replace(/tension/i, '').trim() || s.field.label
    return { v, status, short, field: s.field }
  })
  const overall = points.reduce<StatusLevel>((acc, p) => (p.v === null ? acc : worstStatus(acc, p.status)), 'normal')
  const unit = series[0]?.field.unit
  const rule = series[0]?.field.rule
  const vals = points.map((p) => p.v).filter((v): v is number => v !== null)
  const top = Math.max(...vals, rule?.max ?? 0, 1) * 1.15

  // geometry
  const W = 240
  const plotTop = 22
  const plotBottom = 116
  const plotH = plotBottom - plotTop
  const left = 10
  const right = 10
  const inner = W - left - right
  const slot = inner / points.length
  const barW = Math.min(46, slot * 0.5)
  const y = (v: number) => plotTop + plotH * (1 - Math.max(0, Math.min(1, v / top)))

  return (
    <WidgetFrame equipmentName={equipmentName} label={label} status={vals.length ? overall : 'unknown'} stale={stale}>
      <svg viewBox={`0 0 ${W} 140`} className="w-full max-w-[260px] max-h-full">
        {/* valid-range band */}
        {rule?.min != null && rule?.max != null && (
          <>
            <rect x={left} y={y(rule.max)} width={inner} height={Math.max(0, y(rule.min) - y(rule.max))} fill={statusColor('normal')} opacity={0.12} />
            <line x1={left} y1={y(rule.max)} x2={W - right} y2={y(rule.max)} stroke={statusColor('normal')} strokeWidth={1} strokeDasharray="4 3" opacity={0.6} />
            <line x1={left} y1={y(rule.min)} x2={W - right} y2={y(rule.min)} stroke={statusColor('normal')} strokeWidth={1} strokeDasharray="4 3" opacity={0.6} />
          </>
        )}
        {/* baseline */}
        <line x1={left} y1={plotBottom} x2={W - right} y2={plotBottom} stroke="var(--color-graphite-200)" strokeWidth={1.5} />
        {points.map((p, i) => {
          const cx = left + slot * i + slot / 2
          if (p.v === null) {
            return (
              <text key={i} x={cx} y={plotBottom - 4} textAnchor="middle" fontSize={16} fill="var(--color-graphite-300)">
                —
              </text>
            )
          }
          const color = statusColor(p.status)
          const barY = y(p.v)
          return (
            <g key={i}>
              <rect x={cx - barW / 2} y={barY} width={barW} height={plotBottom - barY} rx={4} fill={color} />
              <text x={cx} y={barY - 6} textAnchor="middle" className="font-display" fontSize={14} fontWeight={700} fill="var(--color-graphite-900)">
                {fmtValue(p.v)}
              </text>
            </g>
          )
        })}
        {/* phase labels */}
        {points.map((p, i) => {
          const cx = left + slot * i + slot / 2
          return (
            <text key={i} x={cx} y={132} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--color-graphite-500)">
              {p.short}
            </text>
          )
        })}
      </svg>
      <p className="mt-0.5 text-xs text-[--color-graphite-400]">
        {rule?.min != null && rule?.max != null ? `Plage ${rule.min}–${rule.max}${unit ? ` ${unit}` : ''}` : unit ? `en ${unit}` : ''}
      </p>
    </WidgetFrame>
  )
}

// --- 6. Value + range chip (fallback) --------------------------------------

export function ValueRangeWidget({ equipmentName, field, value, stale }: WidgetProps) {
  const m = deriveMeter(field, value)
  const noData = m.value === null
  const range = formatRange(field)

  return (
    <WidgetFrame equipmentName={equipmentName} label={field.label} status={noData ? 'unknown' : m.status} stale={stale}>
      <BigValue value={value} unit={field.unit} color={noData ? undefined : m.color} />
      {/* linear position bar against the valid range */}
      {m.fill !== null && (
        <div className="mt-3 h-2 w-full max-w-[200px] overflow-hidden rounded-full bg-[--color-graphite-100]">
          <div className="h-full rounded-full" style={{ width: `${m.fill * 100}%`, backgroundColor: m.color }} />
        </div>
      )}
      {range && <p className="mt-2 text-sm font-medium text-[--color-graphite-400]">Cible {range}</p>}
    </WidgetFrame>
  )
}
