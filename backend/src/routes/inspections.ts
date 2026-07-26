import { Router } from 'express'
import type { Prisma } from '@prisma/client'
import { prisma } from '../db'
import { requireUser } from '../middleware/auth'
import { unauthorizedEquipmentFor } from '../middleware/equipmentAccess'
import type { CurrentUser } from '../middleware/auth'

// /api/inspections
// GET         -> technicians: only their own; admins: all (+ ?technicianId= filter)
// POST        -> create/update one inspection (assignment-checked for technicians)
// POST /batch -> bulk upsert (used by the Excel import)
// DELETE /:id -> technicians: own only; admins: any
export const inspectionsRouter = Router()

inspectionsRouter.use(requireUser)

const USINE = 'SBM Tunisie'

type InspectionWithRelations = Prisma.InspectionGetPayload<{
  include: { technician: true; readings: true }
}>

/** Map a DB inspection to the frontend `InspectionRecord` shape. */
function serialize(insp: InspectionWithRelations) {
  return {
    id: insp.id,
    date: insp.date.toISOString().slice(0, 10),
    technicianId: insp.technicianId,
    technicianName: insp.technician?.name ?? 'Technicien',
    usine: USINE,
    equipmentReadings: insp.readings.map((r) => ({
      equipmentId: r.equipmentId,
      status: r.status,
      fields: r.fields,
    })),
    overallStatus: insp.overallStatus,
    createdAt: insp.createdAt.toISOString(),
  }
}

type IncomingReading = { equipmentId: string; status?: string; fields?: unknown }
type IncomingInspection = {
  id?: string
  date?: string
  overallStatus?: string
  equipmentReadings?: IncomingReading[]
}

class AccessError extends Error {}

/**
 * Upsert a single inspection on behalf of `user`. The inspection is always
 * attributed to `user` (the signed-in technician/admin). For technicians we
 * verify they're assigned to every equipment they're actually recording
 * (readings whose status is not "unknown"); admins bypass the check.
 */
async function upsertInspection(user: CurrentUser, body: IncomingInspection) {
  const readings = Array.isArray(body.equipmentReadings) ? body.equipmentReadings : []

  const recordedEquipment = readings
    .filter((r) => r.status && r.status !== 'unknown')
    .map((r) => r.equipmentId)
  const denied = await unauthorizedEquipmentFor(user, recordedEquipment)
  if (denied.length > 0) {
    throw new AccessError(`Not assigned to equipment: ${denied.join(', ')}`)
  }

  const date = body.date ? new Date(body.date) : new Date()
  const overallStatus = body.overallStatus ?? 'normal'
  const readingRows = readings.map((r) => ({
    equipmentId: r.equipmentId,
    status: r.status ?? 'unknown',
    fields: (r.fields ?? []) as Prisma.InputJsonValue,
  }))

  const id = body.id

  const result = await prisma.$transaction(async (tx) => {
    if (id) {
      const existing = await tx.inspection.findUnique({ where: { id } })
      if (existing && existing.technicianId !== user.id && user.role !== 'ADMIN') {
        throw new AccessError('Cannot modify an inspection you do not own')
      }
      // Replace readings wholesale on update.
      await tx.equipmentReading.deleteMany({ where: { inspectionId: id } })
      return tx.inspection.upsert({
        where: { id },
        update: {
          date,
          overallStatus,
          readings: { create: readingRows },
        },
        create: {
          id,
          date,
          overallStatus,
          technicianId: user.id,
          readings: { create: readingRows },
        },
        include: { technician: true, readings: true },
      })
    }

    return tx.inspection.create({
      data: {
        date,
        overallStatus,
        technicianId: user.id,
        readings: { create: readingRows },
      },
      include: { technician: true, readings: true },
    })
  })

  return serialize(result)
}

inspectionsRouter.get('/', async (req, res) => {
  const user = req.currentUser!
  const requested = req.query.technicianId as string | undefined

  let where: Prisma.InspectionWhereInput | undefined
  if (user.role === 'ADMIN') {
    where = requested ? { technicianId: requested === 'me' ? user.id : requested } : undefined
  } else {
    where = { technicianId: user.id }
  }

  const inspections = await prisma.inspection.findMany({
    where,
    include: { technician: true, readings: true },
    orderBy: { date: 'desc' },
  })
  res.json(inspections.map(serialize))
})

inspectionsRouter.post('/', async (req, res) => {
  try {
    const record = await upsertInspection(req.currentUser!, req.body ?? {})
    res.status(201).json(record)
  } catch (err) {
    if (err instanceof AccessError) return res.status(403).json({ error: err.message })
    console.error('[inspections] upsert failed', err)
    res.status(500).json({ error: 'Failed to save inspection' })
  }
})

inspectionsRouter.post('/batch', async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : req.body?.items
  if (!Array.isArray(items)) return res.status(400).json({ error: 'Expected an array of inspections' })

  const saved = []
  try {
    for (const item of items) {
      saved.push(await upsertInspection(req.currentUser!, item))
    }
    res.status(201).json(saved)
  } catch (err) {
    if (err instanceof AccessError) return res.status(403).json({ error: err.message })
    console.error('[inspections] batch failed', err)
    res.status(500).json({ error: 'Failed to import inspections' })
  }
})

inspectionsRouter.delete('/:id', async (req, res) => {
  const user = req.currentUser!
  const inspectionId = String(req.params.id)
  const existing = await prisma.inspection.findUnique({ where: { id: inspectionId } })
  if (!existing) return res.status(204).end()
  if (existing.technicianId !== user.id && user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Cannot delete an inspection you do not own' })
  }
  await prisma.inspection.delete({ where: { id: inspectionId } })
  res.status(204).end()
})
