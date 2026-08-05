import { Router } from 'express'
import { prisma } from '../db'
import { requireUser, requireAdmin } from '../middleware/auth'
import { requireEquipmentAccess } from '../middleware/equipmentAccess'
import {
  getMaintenanceStatus,
  resetMaintenance,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  MaintenanceError,
  type ScheduleInput,
} from '../services/maintenance'
import { listEquipment, upsertEquipment, deleteEquipment, EquipmentError } from '../services/equipment'

// /api/equipment
// GET  -> readable by anyone signed in
// POST / DELETE -> admin only
export const equipmentRouter = Router()

equipmentRouter.use(requireUser)

equipmentRouter.get('/', async (_req, res) => {
  res.json(await listEquipment())
})

// --- Periodic maintenance ---------------------------------------------------

// All tracked equipment's maintenance status (for the overview). Signed-in users.
equipmentRouter.get('/maintenance', async (_req, res) => {
  const schedules = await prisma.maintenanceSchedule.findMany({ select: { equipmentId: true } })
  const statuses = await Promise.all(schedules.map((s) => getMaintenanceStatus(s.equipmentId)))
  res.json(statuses.filter(Boolean))
})

// One equipment's maintenance status. Signed-in users.
equipmentRouter.get('/:equipmentId/maintenance', async (req, res) => {
  const status = await getMaintenanceStatus(String(req.params.equipmentId))
  if (!status) return res.status(404).json({ error: 'No maintenance schedule for this equipment' })
  res.json(status)
})

// Reset the service baseline. Admins always; technicians only if assigned.
equipmentRouter.post('/:equipmentId/maintenance/reset', requireEquipmentAccess, async (req, res) => {
  const equipmentId = String(req.params.equipmentId)
  const { meterReading, serviceDate } = req.body ?? {}
  if (meterReading !== undefined && typeof meterReading !== 'number') {
    return res.status(400).json({ error: 'meterReading must be a number' })
  }
  const status = await resetMaintenance(equipmentId, req.currentUser!.id, { meterReading, serviceDate })
  if (!status) return res.status(404).json({ error: 'No maintenance schedule for this equipment' })
  res.json(status)
})

// Servicing CRUD — admin / moderator only.
equipmentRouter.post('/:equipmentId/maintenance', requireAdmin, async (req, res) => {
  try {
    const status = await createSchedule(String(req.params.equipmentId), req.body as ScheduleInput)
    res.status(201).json(status)
  } catch (err) {
    if (err instanceof MaintenanceError) return res.status(400).json({ error: err.message })
    console.error('[maintenance] create failed', err)
    res.status(500).json({ error: 'Failed to create schedule' })
  }
})

equipmentRouter.patch('/:equipmentId/maintenance', requireAdmin, async (req, res) => {
  try {
    const status = await updateSchedule(String(req.params.equipmentId), req.body as ScheduleInput)
    if (!status) return res.status(404).json({ error: 'No maintenance schedule for this equipment' })
    res.json(status)
  } catch (err) {
    if (err instanceof MaintenanceError) return res.status(400).json({ error: err.message })
    console.error('[maintenance] update failed', err)
    res.status(500).json({ error: 'Failed to update schedule' })
  }
})

equipmentRouter.delete('/:equipmentId/maintenance', requireAdmin, async (req, res) => {
  await deleteSchedule(String(req.params.equipmentId))
  res.status(204).end()
})

// Create or fully update an equipment + its parameters. Admin / moderator only.
equipmentRouter.post('/', requireAdmin, async (req, res) => {
  try {
    const dto = await upsertEquipment(req.body ?? {})
    res.json(dto)
  } catch (err) {
    if (err instanceof EquipmentError) return res.status(400).json({ error: err.message })
    console.error('[equipment] upsert failed', err)
    res.status(500).json({ error: 'Failed to save equipment' })
  }
})

equipmentRouter.delete('/:id', requireAdmin, async (req, res) => {
  await deleteEquipment(String(req.params.id))
  res.status(204).end()
})
