import { Router } from 'express'
import { prisma } from '../db'
import { requireUser } from '../middleware/auth'

// /api/notifications
// GET               -> current user's notifications, newest first (?unread=true)
// PATCH /read-all   -> mark all of the user's notifications read
// PATCH /:id/read   -> mark one read (must belong to the user)
export const notificationsRouter = Router()

notificationsRouter.use(requireUser)

notificationsRouter.get('/', async (req, res) => {
  const user = req.currentUser!
  const unreadOnly = req.query.unread === 'true'

  const notifications = await prisma.notification.findMany({
    where: { recipientId: user.id, ...(unreadOnly ? { read: false } : {}) },
    include: { equipment: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  res.json(
    notifications.map((n) => ({
      id: n.id,
      equipmentId: n.equipmentId,
      equipmentName: n.equipment?.name ?? n.equipmentId,
      inspectionId: n.inspectionId,
      status: n.status,
      message: n.message,
      read: n.read,
      createdAt: n.createdAt.toISOString(),
    })),
  )
})

notificationsRouter.patch('/read-all', async (req, res) => {
  await prisma.notification.updateMany({
    where: { recipientId: req.currentUser!.id, read: false },
    data: { read: true },
  })
  res.status(204).end()
})

notificationsRouter.patch('/:id/read', async (req, res) => {
  // Scope the update to the caller so users can't mark others' rows read.
  const result = await prisma.notification.updateMany({
    where: { id: String(req.params.id), recipientId: req.currentUser!.id },
    data: { read: true },
  })
  if (result.count === 0) return res.status(404).json({ error: 'Notification not found' })
  res.status(204).end()
})
