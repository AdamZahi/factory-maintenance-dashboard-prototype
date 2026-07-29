import { Router } from 'express'
import { clerkClient } from '@clerk/express'
import type { Role } from '@prisma/client'
import { prisma } from '../db'
import { requireUser, requireAdmin } from '../middleware/auth'

// /api/technicians  (admin only)
// GET                 -> list all users (admins + technicians)
// PATCH /:id/role     -> promote/demote; mirrors the role into Clerk publicMetadata
// PATCH /:id/position -> set the user's job title; mirrors into Clerk publicMetadata
export const techniciansRouter = Router()

techniciansRouter.use(requireUser, requireAdmin)

function serialize(u: { id: string; name: string; email: string; role: Role; position: string | null }) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, position: u.position }
}

techniciansRouter.get('/', async (_req, res) => {
  const users = await prisma.user.findMany({ orderBy: { name: 'asc' } })
  res.json(users.map(serialize))
})

techniciansRouter.patch('/:id/role', async (req, res) => {
  const role = String(req.body?.role ?? '').toUpperCase() as Role
  if (role !== 'ADMIN' && role !== 'TECHNICIAN') {
    return res.status(400).json({ error: 'role must be ADMIN or TECHNICIAN' })
  }

  const userId = String(req.params.id)
  const user = await prisma.user.update({ where: { id: userId }, data: { role } })

  // Keep Clerk's publicMetadata.role in sync so the frontend gate stays correct.
  await clerkClient.users
    .updateUserMetadata(userId, { publicMetadata: { role: role.toLowerCase() } })
    .catch((err) => console.error('[technicians] failed to sync Clerk role metadata', err))

  res.json(serialize(user))
})

techniciansRouter.patch('/:id/position', async (req, res) => {
  const raw = typeof req.body?.position === 'string' ? req.body.position.trim() : ''
  const position = raw.length > 0 ? raw : null

  const userId = String(req.params.id)
  const user = await prisma.user.update({ where: { id: userId }, data: { position } })

  // Mirror into Clerk publicMetadata so the signed-in user sees their own title client-side.
  await clerkClient.users
    .updateUserMetadata(userId, { publicMetadata: { position } })
    .catch((err) => console.error('[technicians] failed to sync Clerk position metadata', err))

  res.json(serialize(user))
})
