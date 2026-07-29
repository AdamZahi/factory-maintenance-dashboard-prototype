import { prisma } from '../db'

export interface Recipient {
  id: string
  email: string
  name: string
  role: string
}

/** All ADMIN users — the shared recipient list for status alerts and maintenance reminders. */
export function getAdminUsers(): Promise<Recipient[]> {
  return prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { id: true, email: true, name: true, role: true },
  })
}
