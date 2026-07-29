import type { MaintenanceSchedule } from '@prisma/client'
import { prisma } from '../db'
import { getAdminUsers } from './recipients'
import { sendMaintenanceReminderEmail } from './email'

// The meter field that all tracked equipment record their running hours on.
const METER_FIELD_ID = 'compteur'
const DAY_MS = 86_400_000

export type MaintenanceState = 'ok' | 'due_soon' | 'overdue'
const STATE_RANK: Record<MaintenanceState, number> = { ok: 0, due_soon: 1, overdue: 2 }
const worseState = (a: MaintenanceState, b: MaintenanceState) => (STATE_RANK[a] >= STATE_RANK[b] ? a : b)

interface FieldReading {
  fieldId: string
  value: unknown
}

function parseNumeric(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    const m = value.match(/-?\d+(?:[.,]\d+)?/)
    if (m) return parseFloat(m[0].replace(',', '.'))
  }
  return null
}

function meterFromFields(fields: unknown): number | null {
  const arr = Array.isArray(fields) ? (fields as FieldReading[]) : []
  const f = arr.find((x) => x.fieldId === METER_FIELD_ID)
  return f ? parseNumeric(f.value) : null
}

/** Meter reading (Compteur) from the most recent inspection that recorded one. */
export async function getMostRecentMeter(equipmentId: string): Promise<number | null> {
  const readings = await prisma.equipmentReading.findMany({
    where: { equipmentId },
    select: { fields: true, inspection: { select: { date: true, createdAt: true } } },
    orderBy: [{ inspection: { date: 'desc' } }, { inspection: { createdAt: 'desc' } }],
    take: 20,
  })
  for (const r of readings) {
    const m = meterFromFields(r.fields)
    if (m !== null) return m
  }
  return null
}

/**
 * Average running hours/day for an equipment, from the span between its
 * earliest and latest recorded meter readings. Returns null when there isn't
 * enough data (need ≥2 dated readings, a positive time span, and a rising meter).
 */
export async function computeHoursPerDay(equipmentId: string): Promise<number | null> {
  const readings = await prisma.equipmentReading.findMany({
    where: { equipmentId },
    select: { fields: true, inspection: { select: { date: true } } },
  })
  const points = readings
    .map((r) => ({ date: r.inspection.date.getTime(), meter: meterFromFields(r.fields) }))
    .filter((p): p is { date: number; meter: number } => p.meter !== null)
    .sort((a, b) => a.date - b.date)

  if (points.length < 2) return null
  const first = points[0]
  const last = points[points.length - 1]
  const spanDays = (last.date - first.date) / DAY_MS
  const deltaMeter = last.meter - first.meter
  if (spanDays <= 0 || deltaMeter <= 0) return null
  return deltaMeter / spanDays
}

/** Projects the calendar date the meter is expected to reach `targetMeter`, or null if not estimable. */
export async function projectServiceDate(equipmentId: string, currentMeter: number | null, targetMeter: number): Promise<string | null> {
  if (currentMeter === null) return null
  const remaining = targetMeter - currentMeter
  if (remaining <= 0) return toDateStr(new Date())
  const rate = await computeHoursPerDay(equipmentId)
  if (!rate || rate <= 0) return null
  return toDateStr(new Date(Date.now() + (remaining / rate) * DAY_MS))
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export interface MaintenanceStatusDTO {
  equipmentId: string
  equipmentName: string
  intervalHours: number | null
  intervalDays: number | null
  warningHoursBefore: number
  warningDaysBefore: number | null
  lastServiceMeterReading: number
  lastServiceDate: string
  currentMeter: number | null
  nextDueMeter: number | null
  hoursRemaining: number | null
  hourReminderSent: boolean
  dueDate: string | null
  daysRemaining: number | null
  dayReminderSent: boolean
  hoursPerDay: number | null
  projectedDueDate: string | null
  state: MaintenanceState
  updatedAt: string
}

/** Full computed maintenance status for the GET endpoint and the UI. */
export async function getMaintenanceStatus(equipmentId: string): Promise<MaintenanceStatusDTO | null> {
  const schedule = await prisma.maintenanceSchedule.findUnique({
    where: { equipmentId },
    include: { equipment: { select: { name: true } } },
  })
  if (!schedule) return null

  const currentMeter = await getMostRecentMeter(equipmentId)
  const now = Date.now()

  // Hour branch
  const nextDueMeter = schedule.intervalHours != null ? schedule.lastServiceMeterReading + schedule.intervalHours : null
  const hoursRemaining = nextDueMeter != null && currentMeter != null ? nextDueMeter - currentMeter : null
  let hourState: MaintenanceState = 'ok'
  if (nextDueMeter != null && currentMeter != null) {
    if (currentMeter >= nextDueMeter) hourState = 'overdue'
    else if (currentMeter >= nextDueMeter - schedule.warningHoursBefore) hourState = 'due_soon'
  }

  // Day branch (calendar deadline, e.g. groupe électrogène)
  let dueDate: string | null = null
  let daysRemaining: number | null = null
  let dayState: MaintenanceState = 'ok'
  if (schedule.intervalDays != null) {
    const dueMs = schedule.lastServiceDate.getTime() + schedule.intervalDays * DAY_MS
    dueDate = toDateStr(new Date(dueMs))
    daysRemaining = Math.ceil((dueMs - now) / DAY_MS)
    const warnDays = schedule.warningDaysBefore ?? 0
    if (now >= dueMs) dayState = 'overdue'
    else if (now >= dueMs - warnDays * DAY_MS) dayState = 'due_soon'
  }

  const projectedDueDate = nextDueMeter != null ? await projectServiceDate(equipmentId, currentMeter, nextDueMeter) : null
  const hoursPerDay = await computeHoursPerDay(equipmentId)

  return {
    equipmentId,
    equipmentName: schedule.equipment.name,
    intervalHours: schedule.intervalHours,
    intervalDays: schedule.intervalDays,
    warningHoursBefore: schedule.warningHoursBefore,
    warningDaysBefore: schedule.warningDaysBefore,
    lastServiceMeterReading: schedule.lastServiceMeterReading,
    lastServiceDate: schedule.lastServiceDate.toISOString(),
    currentMeter,
    nextDueMeter,
    hoursRemaining,
    hourReminderSent: schedule.hourReminderSent,
    dueDate,
    daysRemaining,
    dayReminderSent: schedule.dayReminderSent,
    hoursPerDay: hoursPerDay ? Math.round(hoursPerDay * 100) / 100 : null,
    projectedDueDate,
    state: worseState(hourState, dayState),
  updatedAt: schedule.updatedAt.toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Trigger 1: on inspection submission — hour-based reminder only.
// ---------------------------------------------------------------------------

export interface MaintenanceNotifiableInspection {
  id: string
  equipmentReadings: { equipmentId: string; fields: unknown }[]
}

export async function evaluateMaintenanceOnInspection(inspection: MaintenanceNotifiableInspection): Promise<void> {
  for (const reading of inspection.equipmentReadings) {
    const schedule = await prisma.maintenanceSchedule.findUnique({ where: { equipmentId: reading.equipmentId } })
    if (!schedule || schedule.intervalHours == null || schedule.hourReminderSent) continue

    const meter = meterFromFields(reading.fields)
    if (meter === null) continue

    const nextDueMeter = schedule.lastServiceMeterReading + schedule.intervalHours
    if (meter < nextDueMeter - schedule.warningHoursBefore) continue // not in the warning window yet

    // Entered the warning window for the first time this cycle → remind admins.
    await prisma.maintenanceSchedule.update({ where: { equipmentId: reading.equipmentId }, data: { hourReminderSent: true } })
    const approxDate = await projectServiceDate(reading.equipmentId, meter, nextDueMeter)
    await emailAdmins(schedule, 'hour', meter, nextDueMeter, approxDate)
  }
}

// ---------------------------------------------------------------------------
// Trigger 2: daily cron — calendar deadline (groupe électrogène 365 days).
// ---------------------------------------------------------------------------

export async function runDayReminderCheck(): Promise<void> {
  const schedules = await prisma.maintenanceSchedule.findMany({ where: { intervalDays: { not: null }, dayReminderSent: false } })
  const now = Date.now()
  for (const schedule of schedules) {
    const dueMs = schedule.lastServiceDate.getTime() + (schedule.intervalDays ?? 0) * DAY_MS
    const warnMs = dueMs - (schedule.warningDaysBefore ?? 0) * DAY_MS
    if (now < warnMs) continue

    await prisma.maintenanceSchedule.update({ where: { equipmentId: schedule.equipmentId }, data: { dayReminderSent: true } })
    const currentMeter = await getMostRecentMeter(schedule.equipmentId)
    await emailAdmins(schedule, 'day', currentMeter, null, toDateStr(new Date(dueMs)))
  }
}

// ---------------------------------------------------------------------------
// Reset action
// ---------------------------------------------------------------------------

export async function resetMaintenance(
  equipmentId: string,
  performedById: string,
  opts: { meterReading?: number; serviceDate?: string },
): Promise<MaintenanceStatusDTO | null> {
  const schedule = await prisma.maintenanceSchedule.findUnique({ where: { equipmentId } })
  if (!schedule) return null

  // Baseline defaults to the latest submitted meter, then the existing baseline.
  const meterReading =
    opts.meterReading ?? (await getMostRecentMeter(equipmentId)) ?? schedule.lastServiceMeterReading
  const serviceDate = opts.serviceDate ? new Date(opts.serviceDate) : new Date()

  await prisma.$transaction([
    prisma.maintenanceSchedule.update({
      where: { equipmentId },
      data: {
        lastServiceMeterReading: meterReading,
        lastServiceDate: serviceDate,
        hourReminderSent: false,
        dayReminderSent: false,
      },
    }),
    prisma.maintenanceLog.create({
      data: { equipmentId, performedById, meterReadingAtService: meterReading, serviceDate },
    }),
  ])

  return getMaintenanceStatus(equipmentId)
}

async function emailAdmins(
  schedule: MaintenanceSchedule,
  kind: 'hour' | 'day',
  currentMeter: number | null,
  nextDueMeter: number | null,
  approxDate: string | null,
): Promise<void> {
  const equipment = await prisma.equipment.findUnique({ where: { id: schedule.equipmentId }, select: { name: true } })
  const admins = await getAdminUsers()
  for (const admin of admins) {
    try {
      await sendMaintenanceReminderEmail({
        to: admin.email,
        equipmentName: equipment?.name ?? schedule.equipmentId,
        kind,
        currentMeter,
        nextDueMeter,
        approxDate,
        lastServiceMeter: schedule.lastServiceMeterReading,
        lastServiceDate: schedule.lastServiceDate.toISOString().slice(0, 10),
      })
    } catch (err) {
      console.error(`[maintenance] reminder email to ${admin.email} failed`, err)
    }
  }
}
