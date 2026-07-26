import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

// Prisma 7 requires a driver adapter to connect. We build one from
// DATABASE_URL (the Aiven connection string already carries ?sslmode=require).
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined
}

function createPrisma() {
  // Aiven serves a self-signed CA, and new `pg` treats sslmode=require as
  // verify-full (rejecting that chain). Strip sslmode from the URL so the
  // explicit ssl config below is authoritative: TLS on, CA verification off.
  // For production, pin Aiven's CA instead: ssl: { ca: <pem>, rejectUnauthorized: true }.
  const connectionString = (process.env.DATABASE_URL ?? '')
    .replace(/([?&])sslmode=[^&]*/i, '$1')
    .replace(/[?&]$/, '')
  const adapter = new PrismaPg({
    connectionString,
    ssl: { rejectUnauthorized: false },
  })
  return new PrismaClient({ adapter })
}

export const prisma = globalThis.__prisma ?? createPrisma()

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma
}
