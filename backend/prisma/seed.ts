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
  for (const [index, equipment] of EQUIPMENT_DEFINITIONS.entries()) {
    await prisma.equipment.upsert({
      where: { id: equipment.id },
      update: { name: equipment.name, order: index },
      create: { id: equipment.id, name: equipment.name, order: index },
    })

    // Replace the field set from the canonical config (readings are keyed by
    // field key, so recreating rows never affects historical inspections).
    await prisma.equipmentField.deleteMany({ where: { equipmentId: equipment.id } })
    await prisma.equipmentField.createMany({
      data: equipment.fields.map((f, i) => ({
        equipmentId: equipment.id,
        key: f.id,
        label: f.label,
        unit: f.unit ?? null,
        kind: f.kind,
        order: i,
        recordedOn: f.recordedOn ?? [],
        helpText: f.helpText ?? null,
        ruleMin: f.rule?.min ?? null,
        ruleMax: f.rule?.max ?? null,
        ruleEquals: f.rule?.equals ?? null,
        ruleThresholdBelow: f.rule?.thresholdBelow ?? null,
        ruleThresholdAbove: f.rule?.thresholdAbove ?? null,
        ruleGreaterThan: f.rule?.greaterThan ?? null,
        ruleLessThan: f.rule?.lessThan ?? null,
        ruleUnit: f.rule?.unit ?? null,
      })),
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
