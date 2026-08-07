import { Router } from 'express'
import { prisma } from '../db'
import { requireUser } from '../middleware/auth'

// /api/supervision
// Read model for the always-on wall display. No writes.
// GET /latest -> for each equipment, the most recent NON-EMPTY value per field
//                across all inspections (not just the latest inspection), each with
//                its own timestamp so the client can flag stale parameters.
export const supervisionRouter = Router()

supervisionRouter.use(requireUser)

// How many recent readings per equipment to scan for the latest value of each
// field. Parameters recorded weekly still resolve within a handful of readings;
// 60 covers long gaps comfortably.
const SCAN_LIMIT = 60

type StoredField = { fieldId: string; value: number | string | null; status?: string; message?: string }

function isEmpty(v: number | string | null | undefined): boolean {
  return v === null || v === undefined || v === ''
}

supervisionRouter.get('/latest', async (_req, res) => {
  const equipment = await prisma.equipment.findMany({
    orderBy: { order: 'asc' },
    select: { id: true, name: true },
  })

  const items = await Promise.all(
    equipment.map(async (e) => {
      const readings = await prisma.equipmentReading.findMany({
        where: { equipmentId: e.id },
        orderBy: [{ inspection: { date: 'desc' } }, { inspection: { createdAt: 'desc' } }],
        include: { inspection: { select: { date: true, createdAt: true } } },
        take: SCAN_LIMIT,
      })

      // Walk newest → oldest, keeping the first (most recent) non-empty value per field.
      const latestByField = new Map<
        string,
        { fieldId: string; value: number | string | null; status: string; recordedAt: string; date: string }
      >()
      for (const r of readings) {
        const fields = (r.fields ?? []) as StoredField[]
        for (const f of fields) {
          if (!f?.fieldId || latestByField.has(f.fieldId) || isEmpty(f.value)) continue
          latestByField.set(f.fieldId, {
            fieldId: f.fieldId,
            value: f.value,
            status: f.status ?? 'unknown',
            recordedAt: r.inspection.createdAt.toISOString(),
            date: r.inspection.date.toISOString().slice(0, 10),
          })
        }
      }

      const fields = [...latestByField.values()]
      const lastRecordedAt = fields.reduce<string | null>(
        (max, f) => (max && max >= f.recordedAt ? max : f.recordedAt),
        null,
      )

      return { equipmentId: e.id, equipmentName: e.name, lastRecordedAt, fields }
    }),
  )

  res.json({ serverTime: new Date().toISOString(), equipment: items })
})
