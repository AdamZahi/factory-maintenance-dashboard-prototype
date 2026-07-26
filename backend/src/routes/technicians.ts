import { Router } from 'express'
import { clerkClient } from '@clerk/express'
import type { Role } from '@prisma/client'
import { prisma } from '../db'
import { requireUser, requireAdmin } from '../middleware/auth'

// /api/technicians  (admin only)
// GET               -> list all users (admins + technicians)
// PATCH /:id/role   -> promote/demote; mirrors the role into Clerk publicMetadata
export const techniciansRouter = Router()

techniciansRouter.use(requireUser, requireAdmin)

techniciansRouter.get('/', async (_req, res) => {
  const users = await prisma.user.findMany({ orderBy: { name: 'asc' } })
  // Shaped to match the frontend `Technician` type ({ id, name, role }) while
  // also exposing email for the admin screen.
  res.json(users.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role })))
})

techniciansRouter.patch('/:id/role', async (req, res) => {
  const role = String(req.body?.role ?? '').toUpperCase() as Role
  if (role !== 'ADMIN' && role !== 'TECHNICIAN') {
    return res.status(400).json({ error: 'role must be ADMIN or TECHNICIAN' })
  }

  const userId = String(req.params.id)
  const user = await prisma.user.update({
    where: { id: userId },
    data: { role },
  })

  // Keep Clerk's publicMetadata.role in sync so the frontend gate stays correct.
  await clerkClient.users
    .updateUserMetadata(userId, { publicMetadata: { role: role.toLowerCase() } })
    .catch((err) => console.error('[technicians] failed to sync Clerk metadata', err))

  res.json({ id: user.id, name: user.name, email: user.email, role: user.role })
})
