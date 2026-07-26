import type { NextFunction, Request, Response } from 'express'
import { clerkMiddleware, getAuth, clerkClient } from '@clerk/express'
import type { Role } from '@prisma/client'
import { prisma } from '../db'

// ---------------------------------------------------------------------------
// Auth & RBAC middleware
//
// `clerkMiddleware()` attaches the Clerk auth context to every request; the
// helpers below read it via `getAuth()`. We resolve the DB `User` row once per
// request and hang it (plus the effective role) off `req.currentUser` so route
// handlers don't each have to re-query.
// ---------------------------------------------------------------------------

export type CurrentUser = {
  id: string
  email: string
  name: string
  role: Role
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      currentUser?: CurrentUser
    }
  }
}

/** Mount once on the app: parses the Clerk session from the request. */
export const clerkAuth = clerkMiddleware()

/**
 * Requires a valid Clerk session and a matching row in our `User` table.
 * New Clerk users are mirrored into the DB lazily here on their first
 * authenticated request (role taken from Clerk publicMetadata). This is the
 * only sync mechanism — there is no webhook.
 */
export async function requireUser(req: Request, res: Response, next: NextFunction) {
  const { userId } = getAuth(req)
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  try {
    let user = await prisma.user.findUnique({ where: { id: userId } })

    if (!user) {
      // First time we've seen this Clerk user — mirror them into our DB.
      const clerkUser = await clerkClient.users.getUser(userId)
      const email =
        clerkUser.primaryEmailAddress?.emailAddress ??
        clerkUser.emailAddresses[0]?.emailAddress ??
        `${userId}@unknown.local`
      const name =
        [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ').trim() ||
        clerkUser.username ||
        email
      const role = (clerkUser.publicMetadata?.role as Role | undefined) ?? 'TECHNICIAN'

      user = await prisma.user.upsert({
        where: { id: userId },
        update: {},
        create: { id: userId, email, name, role },
      })
    }

    req.currentUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    }
    next()
  } catch (err) {
    console.error('[auth] requireUser failed', err)
    res.status(500).json({ error: 'Failed to resolve user' })
  }
}

/** Requires the current user to hold one of the given roles. Use after `requireUser`. */
export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.currentUser
    if (!user) return res.status(401).json({ error: 'Not authenticated' })
    if (!roles.includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden: insufficient role' })
    }
    next()
  }
}

export const requireAdmin = requireRole('ADMIN')
