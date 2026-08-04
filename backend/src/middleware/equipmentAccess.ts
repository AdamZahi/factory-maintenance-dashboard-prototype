import type { NextFunction, Request, Response } from 'express'
import type { Role } from '@prisma/client'
import { prisma } from '../db'
import { isAtLeastAdmin } from './auth'

/**
 * Verifies the current user is assigned to every equipment id in `equipmentIds`.
 * Admins (and superusers) bypass the check. Returns the list of equipment ids
 * the user is NOT allowed to touch (empty === allowed).
 */
export async function unauthorizedEquipmentFor(
  user: { id: string; role: Role },
  equipmentIds: string[],
): Promise<string[]> {
  if (isAtLeastAdmin(user.role)) return []
  if (equipmentIds.length === 0) return []

  const assignments = await prisma.equipmentAssignment.findMany({
    where: { technicianId: user.id, equipmentId: { in: equipmentIds } },
    select: { equipmentId: true },
  })
  const allowed = new Set(assignments.map((a) => a.equipmentId))
  return equipmentIds.filter((id) => !allowed.has(id))
}

/**
 * Express middleware guarding a single-equipment route param (`:equipmentId`).
 * For multi-equipment payloads (inspection POST) use `unauthorizedEquipmentFor`
 * directly inside the handler instead.
 */
export async function requireEquipmentAccess(req: Request, res: Response, next: NextFunction) {
  const user = req.currentUser
  if (!user) return res.status(401).json({ error: 'Not authenticated' })

  const equipmentId = (req.params.equipmentId ?? req.body?.equipmentId) as string | undefined
  if (!equipmentId) return res.status(400).json({ error: 'Missing equipmentId' })

  const denied = await unauthorizedEquipmentFor(user, [equipmentId])
  if (denied.length > 0) {
    return res.status(403).json({ error: `Not assigned to equipment "${equipmentId}"` })
  }
  next()
}
