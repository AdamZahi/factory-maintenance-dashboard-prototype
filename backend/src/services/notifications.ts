import { prisma } from '../db'
import { sendCriticalAlertEmail } from './email'

// Shape of a field reading stored in EquipmentReading.fields (JSON).
interface FieldReading {
  fieldId: string
  value: unknown
  status: string
  message?: string
}

// Minimal shape the notifier needs from a freshly created inspection.
export interface NotifiableInspection {
  id: string
  date: string
  technicianName: string
  equipmentReadings: { equipmentId: string; status: string; fields: unknown }[]
}

/**
 * Returns the most recent *known* status for an equipment prior to (and
 * excluding) the given inspection, or null if there is none. "unknown"
 * readings (equipment not measured that day) are skipped so a measurement gap
 * doesn't reset the transition state and cause duplicate critical alerts.
 */
export async function getPreviousStatus(equipmentId: string, beforeInspectionId: string): Promise<string | null> {
  const prev = await prisma.equipmentReading.findFirst({
    where: {
      equipmentId,
      inspectionId: { not: beforeInspectionId },
      status: { not: 'unknown' },
    },
    orderBy: [{ inspection: { date: 'desc' } }, { inspection: { createdAt: 'desc' } }],
    select: { status: true },
  })
  return prev?.status ?? null
}

function statusLabelFr(status: string) {
  return status === 'critical' ? 'critique' : 'alerte'
}

function buildMessage(equipmentName: string, status: string, fields: FieldReading[]): string {
  const bad = fields.filter((f) => f.status === status)
  const detail = bad
    .map((f) => f.message ?? `${f.fieldId} = ${f.value ?? '—'}`)
    .slice(0, 3)
    .join(' · ')
  return `${equipmentName} — état ${statusLabelFr(status)}${detail ? ` : ${detail}` : ''}`
}

/**
 * Creates alert notifications for a newly created inspection. For each
 * equipment reading that TRANSITIONS into warning/critical (differs from the
 * equipment's previous known status): creates one in-app notification per
 * recipient (all admins + technicians assigned to that equipment, deduped),
 * and for CRITICAL additionally emails each admin. Email failures are logged
 * and never bubble up — the in-app notifications must survive regardless.
 */
export async function notifyOnInspection(inspection: NotifiableInspection): Promise<void> {
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { id: true, email: true, name: true, role: true },
  })
  const equipment = await prisma.equipment.findMany({ select: { id: true, name: true } })
  const equipmentName = new Map(equipment.map((e) => [e.id, e.name]))

  for (const reading of inspection.equipmentReadings) {
    const status = reading.status
    if (status !== 'critical' && status !== 'warning') continue

    const previous = await getPreviousStatus(reading.equipmentId, inspection.id)
    if (previous === status) continue // not a transition — throttle repeats (rule 3)

    const assignedTechs = await prisma.user.findMany({
      where: { role: 'TECHNICIAN', assignments: { some: { equipmentId: reading.equipmentId } } },
      select: { id: true, email: true, name: true, role: true },
    })

    // Dedupe recipients by id (a user counted once even if admin + assigned).
    const byId = new Map<string, { id: string; email: string; name: string; role: string }>()
    for (const u of [...admins, ...assignedTechs]) byId.set(u.id, u)
    const recipients = [...byId.values()]
    if (recipients.length === 0) continue

    const name = equipmentName.get(reading.equipmentId) ?? reading.equipmentId
    const fields = (Array.isArray(reading.fields) ? reading.fields : []) as FieldReading[]
    const message = buildMessage(name, status, fields)

    await prisma.notification.createMany({
      data: recipients.map((r) => ({
        recipientId: r.id,
        equipmentId: reading.equipmentId,
        inspectionId: inspection.id,
        status,
        message,
      })),
    })

    // Email admins on CRITICAL only (warning is in-app only, rule 1).
    if (status === 'critical') {
      const outFields = fields.filter((f) => f.status === 'critical')
      for (const admin of recipients.filter((r) => r.role === 'ADMIN')) {
        try {
          await sendCriticalAlertEmail({
            to: admin.email,
            equipmentName: name,
            fields: outFields,
            date: inspection.date,
            technicianName: inspection.technicianName,
            inspectionId: inspection.id,
          })
          await prisma.notification.updateMany({
            where: { recipientId: admin.id, equipmentId: reading.equipmentId, inspectionId: inspection.id },
            data: { emailSent: true },
          })
        } catch (err) {
          console.error(`[notify] email to ${admin.email} failed`, err)
        }
      }
    }
  }
}
