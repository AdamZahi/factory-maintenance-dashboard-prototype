import 'dotenv/config'
import { prisma } from '../src/db'
import { EQUIPMENT_DEFINITIONS } from '../../client/src/data/equipment'

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
