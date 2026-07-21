// ---------------------------------------------------------------------------
// Domain types
// These mirror the paper form "FICHE DE CONTRÔLE JOURNALIER DES ÉQUIPEMENTS"
// so the digital model can import/export that exact document.
// ---------------------------------------------------------------------------

export type EquipmentId =
  | 'chaudiere'
  | 'groupe_electrogene'
  | 'surpresseur_eau'
  | 'compresseur'
  | 'local_carburant'
  | 'chariot_elevateur'
  | 'consommation_eau'
  | 'tgbt_1'
  | 'tgbt_2'

export type FieldId = string // e.g. "th", "ph", "sulfite", "batterie" ...

export type FieldKind = 'number' | 'text'

export interface ValidationRule {
  min?: number
  max?: number
  equals?: number
  /** Value at/below (fuel) or at/above (hours) this triggers a warning, not a hard bound */
  thresholdBelow?: number
  thresholdAbove?: number
  greaterThan?: number
  lessThan?: number
  unit?: string
}

export interface EquipmentField {
  id: FieldId
  label: string
  unit?: string
  kind: FieldKind
  rule?: ValidationRule
  /** Days of the week this field is normally recorded on the paper form (0=Mon..5=Sat). Empty = every day. */
  recordedOn?: number[]
  helpText?: string
}

export interface EquipmentDefinition {
  id: EquipmentId
  name: string
  fields: EquipmentField[]
  maintenanceIntervalHours?: number
  hourFieldId?: FieldId // which field tracks running hours, for maintenance-interval alerts
}

export type StatusLevel = 'normal' | 'warning' | 'critical' | 'unknown'

export interface FieldReading {
  fieldId: FieldId
  value: number | string | null
  status: StatusLevel
  message?: string
}

export interface EquipmentReading {
  equipmentId: EquipmentId
  fields: FieldReading[]
  status: StatusLevel // worst-of-fields status
}

export interface Technician {
  id: string
  name: string
  role: string
}

export interface InspectionRecord {
  id: string
  date: string // ISO yyyy-MM-dd
  weekNumber?: string
  technicianId: string
  technicianName: string
  usine: string
  equipmentReadings: EquipmentReading[]
  overallStatus: StatusLevel
  createdAt: string
  controlledBy?: string
}

export interface DashboardFilters {
  dateFrom?: string
  dateTo?: string
  equipmentId?: EquipmentId | 'all'
  status?: StatusLevel | 'all'
}
