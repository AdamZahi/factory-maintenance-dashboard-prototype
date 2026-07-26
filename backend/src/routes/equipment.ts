import { Router } from 'express'
import { prisma } from '../db'
import { requireUser, requireAdmin } from '../middleware/auth'

// /api/equipment
// GET  -> readable by anyone signed in
// POST / DELETE -> admin only
export const equipmentRouter = Router()

equipmentRouter.use(requireUser)

equipmentRouter.get('/', async (_req, res) => {
  const equipment = await prisma.equipment.findMany({ orderBy: { name: 'asc' } })
  res.json(equipment)
})

equipmentRouter.post('/', requireAdmin, async (req, res) => {
  const { id, name } = req.body ?? {}
  if (!id || !name) return res.status(400).json({ error: 'id and name are required' })

  const equipment = await prisma.equipment.upsert({
    where: { id },
    update: { name },
    create: { id, name },
  })
  res.json(equipment)
})

equipmentRouter.delete('/:id', requireAdmin, async (req, res) => {
  await prisma.equipment.delete({ where: { id: String(req.params.id) } }).catch(() => {})
  res.status(204).end()
})
