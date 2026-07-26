import { Router } from 'express'
import { prisma } from '../db'
import { requireUser, requireAdmin } from '../middleware/auth'

// /api/assignments
// GET    -> admins see all (optional ?technicianId= filter); technicians see
//           only their own. ?technicianId=me resolves to the caller.
// POST   -> admin only: assign a technician to an equipment.
// DELETE -> admin only: /:id, or ?technicianId=&equipmentId=.
export const assignmentsRouter = Router()

assignmentsRouter.use(requireUser)

assignmentsRouter.get('/', async (req, res) => {
  const user = req.currentUser!
  const requested = req.query.technicianId as string | undefined

  let technicianId: string | undefined
  if (user.role === 'ADMIN') {
    technicianId = requested === 'me' ? user.id : requested
  } else {
    // Technicians can only ever read their own assignments.
    technicianId = user.id
  }

  const assignments = await prisma.equipmentAssignment.findMany({
    where: technicianId ? { technicianId } : undefined,
    orderBy: { assignedAt: 'desc' },
  })
  res.json(assignments)
})

assignmentsRouter.post('/', requireAdmin, async (req, res) => {
  const { technicianId, equipmentId } = req.body ?? {}
  if (!technicianId || !equipmentId) {
    return res.status(400).json({ error: 'technicianId and equipmentId are required' })
  }

  try {
    const assignment = await prisma.equipmentAssignment.upsert({
      where: { technicianId_equipmentId: { technicianId, equipmentId } },
      update: {},
      create: { technicianId, equipmentId, assignedBy: req.currentUser!.id },
    })
    res.status(201).json(assignment)
  } catch (err) {
    console.error('[assignments] create failed', err)
    res.status(400).json({ error: 'Could not create assignment (check technician/equipment ids)' })
  }
})

assignmentsRouter.delete('/:id', requireAdmin, async (req, res) => {
  await prisma.equipmentAssignment.delete({ where: { id: String(req.params.id) } }).catch(() => {})
  res.status(204).end()
})

// Convenience delete by pair, so the frontend grid can toggle without tracking ids.
assignmentsRouter.delete('/', requireAdmin, async (req, res) => {
  const technicianId = req.query.technicianId as string | undefined
  const equipmentId = req.query.equipmentId as string | undefined
  if (!technicianId || !equipmentId) {
    return res.status(400).json({ error: 'technicianId and equipmentId query params are required' })
  }
  await prisma.equipmentAssignment
    .delete({ where: { technicianId_equipmentId: { technicianId, equipmentId } } })
    .catch(() => {})
  res.status(204).end()
})
