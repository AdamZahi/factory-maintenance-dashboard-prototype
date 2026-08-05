-- AlterTable: per-technician tab allowlist ([] = all default tabs)
ALTER TABLE "User" ADD COLUMN "allowedTabs" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
