import type {
  EquipmentDefinition,
  EquipmentField,
  EquipmentReading,
  FieldReading,
  StatusLevel,
  ValidationRule,
} from '../types'

const STATUS_RANK: Record<StatusLevel, number> = {
  unknown: 0,
  normal: 1,
  warning: 2,
  critical: 3,
}

export function worstStatus(a: StatusLevel, b: StatusLevel): StatusLevel {
  return STATUS_RANK[a] >= STATUS_RANK[b] ? a : b
}

/** Evaluate a single field's numeric value against its rule. */
export function evaluateField(field: EquipmentField, rawValue: number | string | null): FieldReading {
  if (rawValue === null || rawValue === '' || rawValue === undefined) {
    return { fieldId: field.id, value: null, status: 'unknown' }
  }

  const rule = field.rule
  if (!rule) {
    return { fieldId: field.id, value: rawValue, status: 'normal' }
  }

  const numeric = typeof rawValue === 'number' ? rawValue : parseFirstNumber(rawValue)
  if (numeric === null) {
    // Text field (e.g. "220/221/219") that we couldn't parse a single number from
    return { fieldId: field.id, value: rawValue, status: 'normal' }
  }

  const { status, message } = applyRule(rule, numeric)
  return { fieldId: field.id, value: rawValue, status, message }
}

function parseFirstNumber(value: string): number | null {
  const match = value.match(/-?\d+([.,]\d+)?/)
  if (!match) return null
  return parseFloat(match[0].replace(',', '.'))
}

function applyRule(rule: ValidationRule, value: number): { status: StatusLevel; message?: string } {
  if (rule.equals !== undefined) {
    const diff = Math.abs(value - rule.equals)
    const tolerance = Math.max(rule.equals * 0.05, 0.2)
    if (diff === 0) return { status: 'normal' }
    if (diff <= tolerance) return { status: 'warning', message: `Attendu ${rule.equals}${rule.unit ?? ''}, écart léger` }
    return { status: 'critical', message: `Attendu ${rule.equals}${rule.unit ?? ''}, hors norme` }
  }

  if (rule.thresholdBelow !== undefined) {
    if (value <= rule.thresholdBelow) {
      return { status: 'warning', message: `Sous le seuil de ${rule.thresholdBelow}${rule.unit ?? ''}` }
    }
    return { status: 'normal' }
  }

  if (rule.thresholdAbove !== undefined) {
    if (value >= rule.thresholdAbove) {
      return { status: 'warning', message: `Au-dessus du seuil de ${rule.thresholdAbove}${rule.unit ?? ''}` }
    }
    return { status: 'normal' }
  }

  if (rule.greaterThan !== undefined) {
    if (value > rule.greaterThan) {
      return { status: 'warning', message: `Supérieur à ${rule.greaterThan}${rule.unit ?? ''}` }
    }
    return { status: 'normal' }
  }

  if (rule.lessThan !== undefined) {
    if (value < rule.lessThan) {
      return { status: 'warning', message: `Inférieur à ${rule.lessThan}${rule.unit ?? ''}` }
    }
    return { status: 'normal' }
  }

  if (rule.min !== undefined || rule.max !== undefined) {
    const min = rule.min ?? -Infinity
    const max = rule.max ?? Infinity
    if (value >= min && value <= max) return { status: 'normal' }

    const range = isFinite(max - min) ? max - min : Math.max(Math.abs(min), Math.abs(max), 1)
    const margin = range * 0.1
    if (value >= min - margin && value <= max + margin) {
      return { status: 'warning', message: `Hors plage [${rule.min ?? '-'} , ${rule.max ?? '-'}]${rule.unit ?? ''}` }
    }
    return { status: 'critical', message: `Hors plage [${rule.min ?? '-'} , ${rule.max ?? '-'}]${rule.unit ?? ''}` }
  }

  return { status: 'normal' }
}

/** Evaluate an entire equipment's set of field values against their rules. */
export function evaluateEquipment(
  definition: EquipmentDefinition,
  values: Record<string, number | string | null>
): EquipmentReading {
  const fields = definition.fields.map((field) => evaluateField(field, values[field.id] ?? null))

  const status = fields.reduce<StatusLevel>((acc, f) => worstStatus(acc, f.status === 'unknown' ? 'unknown' : f.status), 'unknown')
  // Equipment is "normal" only if it has at least one recorded field and no warning/critical
  const hasAnyValue = fields.some((f) => f.status !== 'unknown')
  const finalStatus: StatusLevel = !hasAnyValue ? 'unknown' : status === 'unknown' ? 'normal' : status

  return { equipmentId: definition.id, fields, status: finalStatus }
}

export function statusColor(status: StatusLevel): string {
  switch (status) {
    case 'normal':
      return '#2E9E5B'
    case 'warning':
      return '#E3A008'
    case 'critical':
      return '#D6423C'
    default:
      return '#9AA5B1'
  }
}

export function statusLabel(status: StatusLevel): string {
  switch (status) {
    case 'normal':
      return 'Normal'
    case 'warning':
      return 'Alerte'
    case 'critical':
      return 'Critique'
    default:
      return 'Non renseigné'
  }
}
