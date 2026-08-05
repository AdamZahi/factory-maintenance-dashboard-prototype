import { prisma } from '../db'

export interface Recipient {
  id: string
  email: string
  name: string
  role: string
}

/**
 * Active admin-level recipients (ADMIN + MODERATOR) — the shared recipient list
 * for status alerts and maintenance reminders. Soft-deleted users are excluded.
 */
export function getAdminUsers(): Promise<Recipient[]> {
  return prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'MODERATOR'] }, isActive: true },
    select: { id: true, email: true, name: true, role: true },
  })
}
