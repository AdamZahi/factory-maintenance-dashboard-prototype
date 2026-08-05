import { prisma } from '../db'
import type { EquipmentField as DbField, Prisma } from '@prisma/client'

// ---------------------------------------------------------------------------
// Equipment definitions live in the database (Equipment + EquipmentField).
// The client consumes them in the exact shape the old static config used, so
// these serializers translate between the DB rows and that DTO.
// ---------------------------------------------------------------------------

export class EquipmentError extends Error {}

interface RuleDTO {
  min?: number
  max?: number
  equals?: number
  thresholdBelow?: number
  thresholdAbove?: number
  greaterThan?: number
  lessThan?: number
  unit?: string
}

interface FieldDTO {
  id: string // = DB `key`
  label: string
  unit?: string
  kind: string
  recordedOn?: number[]
  helpText?: string
  rule?: RuleDTO
}

interface EquipmentDTO {
  id: string
  name: string
  fields: FieldDTO[]
}

function serializeField(f: DbField): FieldDTO {
  const rule: RuleDTO = {}
  if (f.ruleMin != null) rule.min = f.ruleMin
  if (f.ruleMax != null) rule.max = f.ruleMax
  if (f.ruleEquals != null) rule.equals = f.ruleEquals
  if (f.ruleThresholdBelow != null) rule.thresholdBelow = f.ruleThresholdBelow
  if (f.ruleThresholdAbove != null) rule.thresholdAbove = f.ruleThresholdAbove
  if (f.ruleGreaterThan != null) rule.greaterThan = f.ruleGreaterThan
  if (f.ruleLessThan != null) rule.lessThan = f.ruleLessThan
  if (f.ruleUnit) rule.unit = f.ruleUnit
  return {
    id: f.key,
    label: f.label,
    unit: f.unit ?? undefined,
    kind: f.kind,
    recordedOn: f.recordedOn,
    helpText: f.helpText ?? undefined,
    rule: Object.keys(rule).length ? rule : undefined,
  }
}

export async function listEquipment(): Promise<EquipmentDTO[]> {
  const rows = await prisma.equipment.findMany({
    orderBy: { order: 'asc' },
    include: { fields: { orderBy: { order: 'asc' } } },
  })
  return rows.map((e) => ({
    id: e.id,
    name: e.name,
    fields: e.fields.map(serializeField),
  }))
}

/** Turn a "chaudière" name into a stable, URL/JSON-safe id. */
function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '') // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

function toFieldWrite(f: FieldDTO, index: number): Prisma.EquipmentFieldCreateWithoutEquipmentInput {
  const key = String(f.id ?? '').trim() || slugify(f.label || `champ_${index}`)
  if (!key) throw new EquipmentError('Chaque paramètre doit avoir un identifiant ou un libellé.')
  if (!f.label?.trim()) throw new EquipmentError('Chaque paramètre doit avoir un libellé.')
  const r = f.rule ?? {}
  return {
    key,
    label: f.label.trim(),
    unit: f.unit?.trim() || null,
    kind: f.kind === 'text' ? 'text' : 'number',
    order: index,
    recordedOn: Array.isArray(f.recordedOn) ? f.recordedOn.filter((d) => Number.isInteger(d) && d >= 0 && d <= 5) : [],
    helpText: f.helpText?.trim() || null,
    ruleMin: num(r.min),
    ruleMax: num(r.max),
    ruleEquals: num(r.equals),
    ruleThresholdBelow: num(r.thresholdBelow),
    ruleThresholdAbove: num(r.thresholdAbove),
    ruleGreaterThan: num(r.greaterThan),
    ruleLessThan: num(r.lessThan),
    ruleUnit: r.unit?.trim() || null,
  }
}

function normalizeFields(fields: unknown): FieldDTO[] {
  if (!Array.isArray(fields)) throw new EquipmentError('La liste des paramètres est invalide.')
  const dtos = fields as FieldDTO[]
  const keys = new Set<string>()
  return dtos.map((f, i) => {
    const key = String(f.id ?? '').trim() || slugify(f.label || `champ_${i}`)
    if (keys.has(key)) throw new EquipmentError(`Identifiant de paramètre en double : "${key}".`)
    keys.add(key)
    return f
  })
}

/**
 * Create or fully update an equipment and its fields. The field set is
 * replaced wholesale (readings are keyed by field `key`, not by field row id,
 * so dropping/recreating field rows never touches history).
 */
export async function upsertEquipment(input: {
  id?: string
  name?: string
  fields?: unknown
}): Promise<EquipmentDTO> {
  const name = String(input.name ?? '').trim()
  if (!name) throw new EquipmentError('Le nom de l’équipement est requis.')

  const id = String(input.id ?? '').trim() || slugify(name)
  if (!id) throw new EquipmentError('Impossible de générer un identifiant pour cet équipement.')

  const fieldDtos = normalizeFields(input.fields ?? [])
  const fieldWrites = fieldDtos.map(toFieldWrite)

  const existing = await prisma.equipment.findUnique({ where: { id } })

  await prisma.$transaction(async (tx) => {
    if (existing) {
      await tx.equipment.update({ where: { id }, data: { name } })
      await tx.equipmentField.deleteMany({ where: { equipmentId: id } })
    } else {
      const max = await tx.equipment.aggregate({ _max: { order: true } })
      await tx.equipment.create({ data: { id, name, order: (max._max.order ?? 0) + 1 } })
    }
    if (fieldWrites.length) {
      await tx.equipmentField.createMany({
        data: fieldWrites.map((f) => ({ ...f, equipmentId: id })),
      })
    }
  })

  const dto = (await listEquipment()).find((e) => e.id === id)
  if (!dto) throw new EquipmentError('Équipement introuvable après enregistrement.')
  return dto
}

export async function deleteEquipment(id: string): Promise<void> {
  // Cascades to fields, readings, assignments, schedule, notifications, logs.
  await prisma.equipment.delete({ where: { id } }).catch(() => {})
}
