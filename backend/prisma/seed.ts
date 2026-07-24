import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { EQUIPMENT_DEFINITIONS } from '../../client/src/data/equipment'

const prisma = new PrismaClient()

async function main() {
  for (const equipment of EQUIPMENT_DEFINITIONS) {
    await prisma.equipment.upsert({
      where: { id: equipment.id },
      update: { name: equipment.name },
      create: { id: equipment.id, name: equipment.name },
    })
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
