import { Router } from 'express'
import { clerkClient } from '@clerk/express'
import { requireUser, requireSuperuser } from '../middleware/auth'

// /api/invitations  (SUPERUSER-exclusive)
// GET       -> proxy Clerk's invitation list (pending + accepted only)
// DELETE /:id -> revoke a pending invitation
export const invitationsRouter = Router()

invitationsRouter.use(requireUser, requireSuperuser)

invitationsRouter.get('/', async (_req, res) => {
  try {
    const list = await clerkClient.invitations.getInvitationList({ limit: 100 })
    const data = Array.isArray(list) ? list : list.data
    res.json(
      data
        .filter((inv) => inv.status === 'pending' || inv.status === 'accepted')
        .map((inv) => ({
          id: inv.id,
          email: inv.emailAddress,
          status: inv.status,
          role: (inv.publicMetadata?.role as string | undefined) ?? null,
          createdAt: new Date(inv.createdAt).toISOString(),
        })),
    )
  } catch (err) {
    console.error('[invitations] list failed', err)
    res.status(502).json({ error: 'Failed to load invitations' })
  }
})

invitationsRouter.delete('/:id', async (req, res) => {
  try {
    await clerkClient.invitations.revokeInvitation(String(req.params.id))
    res.status(204).end()
  } catch (err) {
    console.error('[invitations] revoke failed', err)
    res.status(400).json({ error: 'Could not revoke (already accepted or revoked?)' })
  }
})
