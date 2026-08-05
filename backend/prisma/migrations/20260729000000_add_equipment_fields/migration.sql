-- Equipment display order (paper-form order for the originals)
ALTER TABLE "Equipment" ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;

-- Per-equipment parameter definitions (moved out of the client's static config)
CREATE TABLE "EquipmentField" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "unit" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'number',
    "order" INTEGER NOT NULL DEFAULT 0,
    "recordedOn" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "helpText" TEXT,
    "ruleMin" DOUBLE PRECISION,
    "ruleMax" DOUBLE PRECISION,
    "ruleEquals" DOUBLE PRECISION,
    "ruleThresholdBelow" DOUBLE PRECISION,
    "ruleThresholdAbove" DOUBLE PRECISION,
    "ruleGreaterThan" DOUBLE PRECISION,
    "ruleLessThan" DOUBLE PRECISION,
    "ruleUnit" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EquipmentField_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EquipmentField_equipmentId_key_key" ON "EquipmentField"("equipmentId", "key");
CREATE INDEX "EquipmentField_equipmentId_idx" ON "EquipmentField"("equipmentId");

ALTER TABLE "EquipmentField" ADD CONSTRAINT "EquipmentField_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
