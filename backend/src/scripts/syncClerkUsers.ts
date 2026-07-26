import 'dotenv/config'
import { clerkClient } from '@clerk/express'
import type { Role } from '@prisma/client'
import { prisma } from '../db'

// Optional one-shot backfill: pull every existing Clerk user into our `User`
// table. Not required for normal use (requireUser mirrors users lazily on their
// first authenticated call) — handy to pre-populate technicians so an admin can
// assign equipment before they've signed in. Role is taken from Clerk
// publicMetadata.role. Run with: npm run sync:users
async function main() {
  const { data: users } = await clerkClient.users.getUserList({ limit: 200 })

  for (const u of users) {
    const email =
      u.primaryEmailAddress?.emailAddress ??
      u.emailAddresses[0]?.emailAddress ??
      `${u.id}@unknown.local`
    const name =
      [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.username || email
    const role: Role =
      (u.publicMetadata?.role as string | undefined)?.toLowerCase() === 'admin'
        ? 'ADMIN'
        : 'TECHNICIAN'

    await prisma.user.upsert({
      where: { id: u.id },
      update: { email, name, role },
      create: { id: u.id, email, name, role },
    })
    console.log(`  synced ${name} <${email}> [${role}]`)
  }

  console.log(`Done: ${users.length} Clerk user(s) synced.`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
