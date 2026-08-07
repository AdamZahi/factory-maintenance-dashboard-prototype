import { evaluateField, statusColor } from '../../lib/validation'
import type { EquipmentField, StatusLevel, ValidationRule } from '../../types'

// ---------------------------------------------------------------------------
// Meter model shared by the wall widgets. Status ALWAYS comes from the existing
// validation engine (evaluateField) — we never reimplement thresholds here. This
// only derives a numeric display domain + colored zones + a fill fraction so a
// gauge / thermometer / tank can render the value against its rule.
// ---------------------------------------------------------------------------

export interface MeterZone {
  from: number
  to: number
  tone: StatusLevel // 'normal' | 'warning' | 'critical'
}

export interface Meter {
  value: number | null
  status: StatusLevel
  color: string
  domain: [number, number]
  zones: MeterZone[]
  /** value position within domain, 0..1 (null when no numeric value) */
  fill: number | null
}

export function parseNumeric(value: number | string | null | undefined): number | null {
  if (value === null || value === '' || value === undefined) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const match = value.match(/-?\d+(?:[.,]\d+)?/)
  return match ? parseFloat(match[0].replace(',', '.')) : null
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

/** Colored zones + display domain derived from a validation rule. */
function zonesFromRule(rule: ValidationRule | undefined, value: number | null, capacity?: number | null): { domain: [number, number]; zones: MeterZone[] } {
  // Tank/fuel with a known capacity: 0..capacity, green above a low threshold.
  if (capacity && capacity > 0) {
    const low = rule?.thresholdBelow
    const zones: MeterZone[] =
      low != null
        ? [
            { from: 0, to: low, tone: 'warning' },
            { from: low, to: capacity, tone: 'normal' },
          ]
        : [{ from: 0, to: capacity, tone: 'normal' }]
    return { domain: [0, capacity], zones }
  }

  if (!rule) {
    const hi = value != null && value > 0 ? value * 1.4 : 100
    return { domain: [0, hi], zones: [{ from: 0, to: hi, tone: 'unknown' }] }
  }

  const hasMin = rule.min != null
  const hasMax = rule.max != null

  if (hasMin && hasMax) {
    const min = rule.min!
    const max = rule.max!
    const span = Math.max(max - min, Math.abs(max) * 0.1, 0.5)
    const m = span * 0.1
    const lo = min - span * 0.4
    const hi = max + span * 0.4
    return {
      domain: [lo, hi],
      zones: [
        { from: lo, to: min - m, tone: 'critical' },
        { from: min - m, to: min, tone: 'warning' },
        { from: min, to: max, tone: 'normal' },
        { from: max, to: max + m, tone: 'warning' },
        { from: max + m, to: hi, tone: 'critical' },
      ],
    }
  }

  if (hasMax) {
    // "lower is better" (e.g. compresseur température ≤ 90, terre ≤ 10)
    const max = rule.max!
    const lo = Math.min(0, max * 0.5)
    const hi = max * 1.3 || 1
    return {
      domain: [lo, hi],
      zones: [
        { from: lo, to: max, tone: 'normal' },
        { from: max, to: max * 1.1, tone: 'warning' },
        { from: max * 1.1, to: hi, tone: 'critical' },
      ],
    }
  }

  if (hasMin) {
    const min = rule.min!
    const lo = min * 0.7
    const hi = min * 1.4 || 1
    return {
      domain: [lo, hi],
      zones: [
        { from: lo, to: min * 0.9, tone: 'critical' },
        { from: min * 0.9, to: min, tone: 'warning' },
        { from: min, to: hi, tone: 'normal' },
      ],
    }
  }

  if (rule.equals != null) {
    const e = rule.equals
    const tol = Math.max(Math.abs(e) * 0.05, 0.2)
    const halfSpan = Math.max(Math.abs(e) * 0.4, tol * 4)
    const lo = e - halfSpan
    const hi = e + halfSpan
    return {
      domain: [lo, hi],
      zones: [
        { from: lo, to: e - 2 * tol, tone: 'critical' },
        { from: e - 2 * tol, to: e - tol, tone: 'warning' },
        { from: e - tol, to: e + tol, tone: 'normal' },
        { from: e + tol, to: e + 2 * tol, tone: 'warning' },
        { from: e + 2 * tol, to: hi, tone: 'critical' },
      ],
    }
  }

  const t = rule.thresholdBelow ?? rule.thresholdAbove ?? rule.greaterThan ?? rule.lessThan
  if (t != null) {
    const hi = Math.abs(t) * 2 || 1
    const belowGood = rule.thresholdAbove != null || rule.lessThan != null // normal is below the threshold
    return {
      domain: [0, hi],
      zones: belowGood
        ? [
            { from: 0, to: t, tone: 'normal' },
            { from: t, to: hi, tone: 'warning' },
          ]
        : [
            { from: 0, to: t, tone: 'warning' },
            { from: t, to: hi, tone: 'normal' },
          ],
    }
  }

  const hi = value != null && value > 0 ? value * 1.4 : 100
  return { domain: [0, hi], zones: [{ from: 0, to: hi, tone: 'unknown' }] }
}

export function deriveMeter(field: EquipmentField, rawValue: number | string | null, capacity?: number | null): Meter {
  const value = parseNumeric(rawValue)
  const status = evaluateField(field, rawValue).status
  const { domain, zones } = zonesFromRule(field.rule, value, capacity)
  const [lo, hi] = domain
  const fill = value == null || hi === lo ? null : clamp01((value - lo) / (hi - lo))
  return { value, status, color: statusColor(status), domain, zones, fill }
}

/** Human-readable target text for a rule, e.g. "180–250 V", "= 5 bar", "≤ 10 Ω". */
export function formatRange(field: EquipmentField): string | null {
  const r = field.rule
  if (!r) return null
  const u = field.unit ? ` ${field.unit}` : ''
  if (r.min != null && r.max != null) return `${r.min}–${r.max}${u}`
  if (r.max != null) return `≤ ${r.max}${u}`
  if (r.min != null) return `≥ ${r.min}${u}`
  if (r.equals != null) return `= ${r.equals}${u}`
  if (r.thresholdBelow != null) return `≥ ${r.thresholdBelow}${u}`
  if (r.thresholdAbove != null) return `≤ ${r.thresholdAbove}${u}`
  if (r.greaterThan != null) return `≤ ${r.greaterThan}${u}`
  if (r.lessThan != null) return `≥ ${r.lessThan}${u}`
  return null
}

/** Battery-style fill from a min/max voltage band (clamped 0..1). Null if not applicable. */
export function bandFill(field: EquipmentField, rawValue: number | string | null): number | null {
  const value = parseNumeric(rawValue)
  const r = field.rule
  if (value == null || r?.min == null || r?.max == null || r.max === r.min) return null
  return clamp01((value - r.min) / (r.max - r.min))
}
