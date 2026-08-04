import { Router } from 'express'
import { clerkClient } from '@clerk/express'
import type { Role } from '@prisma/client'
import { prisma } from '../db'
import { requireUser, requireSuperuser } from '../middleware/auth'

// /api/users  (SUPERUSER-exclusive) — user management
// POST /invite  -> create a Clerk invitation with role/name metadata
// GET  /        -> active users with role, position, assignment count/list
// PATCH /:id    -> { role?, position? } — kept in sync with Clerk metadata
// DELETE /:id   -> soft delete + Clerk delete + assignment strip (transactional)
export const usersRouter = Router()

usersRouter.use(requireUser, requireSuperuser)

const VALID_ROLES: Role[] = ['SUPERUSER', 'ADMIN', 'TECHNICIAN']

function serialize(u: { id: string; name: string; email: string; role: Role; position: string | null }) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, position: u.position }
}

usersRouter.post('/invite', async (req, res) => {
  const emailAddress = String(req.body?.emailAddress ?? '').trim()
  const name = String(req.body?.name ?? '').trim()
  const role = String(req.body?.role ?? '').toUpperCase() as Role
  if (!emailAddress || !name) return res.status(400).json({ error: 'emailAddress and name are required' })
  if (!VALID_ROLES.includes(role)) return res.status(400).json({ error: 'invalid role' })

  try {
    // Restricted mode: we can't create a credentialed user directly. Invite them;
    // the metadata below is copied onto their account when they accept, and the
    // requireUser lazy-mirror picks up role/name/position from there on first call.
    const invitation = await clerkClient.invitations.createInvitation({
      emailAddress,
      redirectUrl: `${(process.env.FRONTEND_URL ?? '').replace(/\/$/, '')}/sign-up`,
      publicMetadata: { role: role.toLowerCase(), name },
      ignoreExisting: true,
    })
    res.status(201).json({
      id: invitation.id,
      email: invitation.emailAddress,
      status: invitation.status,
      createdAt: new Date(invitation.createdAt).toISOString(),
    })
  } catch (err: unknown) {
    console.error('[users] invite failed', err)
    const message = extractClerkError(err) ?? 'Invitation failed'
    res.status(400).json({ error: message })
  }
})

usersRouter.get('/', async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { assignments: true } },
      assignments: { select: { equipmentId: true } },
    },
  })
  res.json(
    users.map((u) => ({
      ...serialize(u),
      assignmentCount: u._count.assignments,
      assignments: u.assignments.map((a) => a.equipmentId),
    })),
  )
})

usersRouter.patch('/:id', async (req, res) => {
  const id = String(req.params.id)

  const data: { role?: Role; position?: string | null } = {}
  const clerkMeta: Record<string, unknown> = {}

  if (req.body?.role !== undefined) {
    const role = String(req.body.role).toUpperCase() as Role
    if (!VALID_ROLES.includes(role)) return res.status(400).json({ error: 'invalid role' })
    data.role = role
    clerkMeta.role = role.toLowerCase()
  }
  if (req.body?.position !== undefined) {
    const raw = typeof req.body.position === 'string' ? req.body.position.trim() : ''
    data.position = raw.length > 0 ? raw : null
    clerkMeta.position = data.position
  }
  if (Object.keys(data).length === 0) return res.status(400).json({ error: 'Nothing to update' })

  try {
    // Sync Clerk first so the DB never gets ahead of the source-of-truth metadata.
    if (Object.keys(clerkMeta).length > 0) {
      await clerkClient.users.updateUserMetadata(id, { publicMetadata: clerkMeta })
    }
    const user = await prisma.user.update({ where: { id }, data })
    res.json(serialize(user))
  } catch (err) {
    console.error('[users] update failed', err)
    res.status(502).json({ error: 'Failed to update user (role/metadata kept consistent — no partial change)' })
  }
})

usersRouter.delete('/:id', async (req, res) => {
  const id = String(req.params.id)
  if (id === req.currentUser!.id) {
    return res.status(400).json({ error: 'You cannot delete your own account' })
  }

  try {
    // Soft-delete locally + strip assignments + delete from Clerk, atomically:
    // if the Clerk call throws, the local changes roll back.
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { isActive: false } })
      await tx.equipmentAssignment.deleteMany({ where: { technicianId: id } })
      await clerkClient.users.deleteUser(id)
    })
    res.status(204).end()
  } catch (err) {
    console.error('[users] delete failed', err)
    res.status(502).json({ error: 'Failed to delete user — no changes applied' })
  }
})

function extractClerkError(err: unknown): string | undefined {
  const e = err as { errors?: { message?: string }[] }
  return e?.errors?.[0]?.message
}
