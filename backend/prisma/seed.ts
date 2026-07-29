import 'dotenv/config'
import { prisma } from '../src/db'
import { EQUIPMENT_DEFINITIONS } from '../../client/src/data/equipment'

// Periodic-maintenance schedules for the hour-tracked equipment.
const MAINTENANCE_SCHEDULES = [
  { equipmentId: 'compresseur', intervalHours: 2000, intervalDays: null, warningHoursBefore: 200, warningDaysBefore: null },
  { equipmentId: 'chariot_elevateur', intervalHours: 250, intervalDays: null, warningHoursBefore: 40, warningDaysBefore: null },
  { equipmentId: 'groupe_electrogene', intervalHours: 250, intervalDays: 365, warningHoursBefore: 90, warningDaysBefore: 14 },
]

async function main() {
  for (const equipment of EQUIPMENT_DEFINITIONS) {
    await prisma.equipment.upsert({
      where: { id: equipment.id },
      update: { name: equipment.name },
      create: { id: equipment.id, name: equipment.name },
    })
  }

  for (const s of MAINTENANCE_SCHEDULES) {
    await prisma.maintenanceSchedule.upsert({
      where: { equipmentId: s.equipmentId },
      // Only sync the config; never clobber a live baseline / reminder state.
      update: {
        intervalHours: s.intervalHours,
        intervalDays: s.intervalDays,
        warningHoursBefore: s.warningHoursBefore,
        warningDaysBefore: s.warningDaysBefore,
      },
      create: s,
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
