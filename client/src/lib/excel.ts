import * as XLSX from 'xlsx'
import { addDays, format, parseISO, startOfWeek } from 'date-fns'
import { EQUIPMENT_DEFINITIONS, DAY_LABELS } from '../data/equipment'
import { evaluateEquipment, worstStatus } from './validation'
import { generateId } from './storage'
import type { EquipmentReading, InspectionRecord, StatusLevel } from '../types'

// ---------------------------------------------------------------------------
// This module is the single source of truth for the mapping between the
// digital data model and the exact cell layout of
// "FICHE DE CONTRÔLE JOURNALIER DES ÉQUIPEMENTS.xlsx" (the sheet the
// maintenance team fills in by hand today). Row numbers below match that
// file 1:1, so exports look identical to the paper form and historical
// files can be re-imported.
// ---------------------------------------------------------------------------

interface CellMapEntry {
  equipmentId: string
  fieldId: string
  row: number
}

const CELL_MAP: CellMapEntry[] = [
  { equipmentId: 'chaudiere', fieldId: 'th', row: 5 },
  { equipmentId: 'chaudiere', fieldId: 'ph', row: 6 },
  { equipmentId: 'chaudiere', fieldId: 'sulfite', row: 7 },
  { equipmentId: 'chaudiere', fieldId: 'niveau_peche_brut', row: 8 },
  { equipmentId: 'chaudiere', fieldId: 'niveau_peche_adoucie', row: 9 },
  { equipmentId: 'groupe_electrogene', fieldId: 'batterie', row: 10 },
  { equipmentId: 'groupe_electrogene', fieldId: 'niveau_carburant', row: 11 },
  { equipmentId: 'groupe_electrogene', fieldId: 'compteur', row: 12 },
  { equipmentId: 'groupe_electrogene', fieldId: 'nombre_start', row: 13 },
  { equipmentId: 'surpresseur_eau', fieldId: 'niveau_peche_eau', row: 14 },
  { equipmentId: 'surpresseur_eau', fieldId: 'pression', row: 15 },
  { equipmentId: 'compresseur', fieldId: 'compteur', row: 16 },
  { equipmentId: 'compresseur', fieldId: 'temperature', row: 17 },
  { equipmentId: 'compresseur', fieldId: 'temperateur_local', row: 18 },
  { equipmentId: 'compresseur', fieldId: 'pression', row: 19 },
  { equipmentId: 'local_carburant', fieldId: 'niveau_mazout', row: 20 },
  { equipmentId: 'chariot_elevateur', fieldId: 'compteur', row: 21 },
  { equipmentId: 'consommation_eau', fieldId: 'compteur', row: 22 },
  { equipmentId: 'tgbt_1', fieldId: 'tension_ph1', row: 23 },
  { equipmentId: 'tgbt_1', fieldId: 'tension_ph2', row: 24 },
  { equipmentId: 'tgbt_1', fieldId: 'tension_ph3', row: 25 },
  { equipmentId: 'tgbt_1', fieldId: 'courant', row: 26 },
  { equipmentId: 'tgbt_1', fieldId: 'cos_phi', row: 27 },
  { equipmentId: 'tgbt_1', fieldId: 'terre', row: 28 },
  { equipmentId: 'tgbt_2', fieldId: 'tension_ph1', row: 29 },
  { equipmentId: 'tgbt_2', fieldId: 'tension_ph2', row: 30 },
  { equipmentId: 'tgbt_2', fieldId: 'tension_ph3', row: 31 },
  { equipmentId: 'tgbt_2', fieldId: 'courant', row: 32 },
  { equipmentId: 'tgbt_2', fieldId: 'cos_phi', row: 33 },
  { equipmentId: 'tgbt_2', fieldId: 'terre', row: 34 },
]

const EQUIPMENT_LABEL_ROWS: { equipmentId: string; row: number; name: string }[] = [
  { equipmentId: 'chaudiere', row: 5, name: 'Chaudière' },
  { equipmentId: 'groupe_electrogene', row: 10, name: 'Groupe électrogène' },
  { equipmentId: 'surpresseur_eau', row: 14, name: "Surpresseur d'eau" },
  { equipmentId: 'compresseur', row: 16, name: 'Compresseur' },
  { equipmentId: 'local_carburant', row: 20, name: ' Local   carburant' },
  { equipmentId: 'chariot_elevateur', row: 21, name: 'Chariot élévateur' },
  { equipmentId: 'consommation_eau', row: 22, name: "consommation d'eau" },
  { equipmentId: 'tgbt_1', row: 23, name: 'TGBT "1"' },
  { equipmentId: 'tgbt_2', row: 29, name: 'TGBT "2"' },
]

// Columns C..H = the 6 working days, Mon(0)..Sat(5)
const DAY_COLUMNS = ['C', 'D', 'E', 'F', 'G', 'H']

function fieldLabel(equipmentId: string, fieldId: string): string {
  const def = EQUIPMENT_DEFINITIONS.find((e) => e.id === equipmentId)
  const field = def?.fields.find((f) => f.id === fieldId)
  return field ? `${field.label}${field.unit ? ` (${field.unit})` : ''}` : fieldId
}

// ---------------------------------------------------------------------------
// EXPORT
// ---------------------------------------------------------------------------

export interface ExportOptions {
  weekStartDate: string // ISO date, any day within the target week
  usine: string
  weekNumber?: string
  controlledBy?: string
}

/** Builds a workbook for one week of inspections, laid out exactly like the paper form. */
export function exportWeekToWorkbook(records: InspectionRecord[], options: ExportOptions): XLSX.WorkBook {
  const weekStart = startOfWeek(parseISO(options.weekStartDate), { weekStartsOn: 1 })
  const weekEnd = addDays(weekStart, 5)
  const recordsByDate = new Map(records.map((r) => [r.date, r]))

  const aoa: (string | number)[][] = Array.from({ length: 38 }, () => Array(11).fill(''))

  const setCell = (row: number, col: string, value: string | number) => {
    const colIdx = XLSX.utils.decode_col(col)
    aoa[row - 1][colIdx] = value
  }

  setCell(1, 'A', 'FICHE DE CONTRÔLE JOURNALIER DES ÉQUIPEMENTS')
  setCell(3, 'A', `Période : Du ${format(weekStart, 'dd/MM/yyyy')}    Au   ${format(weekEnd, 'dd/MM/yyyy')}`)
  setCell(3, 'D', `Semaine N° : ${options.weekNumber ?? format(weekStart, 'ww')}`)
  setCell(3, 'F', `Usine :           ${options.usine}`)
  setCell(3, 'H', 'Version : 01')
  setCell(3, 'I', 'État')
  DAY_LABELS.forEach((label, i) => setCell(4, DAY_COLUMNS[i], label))
  setCell(4, 'I', '✅')
  setCell(4, 'J', '⚠')
  setCell(4, 'K', '❌')

  for (const entry of EQUIPMENT_LABEL_ROWS) {
    setCell(entry.row, 'A', entry.name)
  }
  for (const entry of CELL_MAP) {
    setCell(entry.row, 'B', fieldLabel(entry.equipmentId, entry.fieldId))

    let weekStatus: StatusLevel = 'unknown'
    for (let day = 0; day < 6; day++) {
      const date = format(addDays(weekStart, day), 'yyyy-MM-dd')
      const record = recordsByDate.get(date)
      const reading = record?.equipmentReadings.find((r) => r.equipmentId === entry.equipmentId)
      const fieldReading = reading?.fields.find((f) => f.fieldId === entry.fieldId)
      if (fieldReading && fieldReading.value !== null && fieldReading.value !== '') {
        setCell(entry.row, DAY_COLUMNS[day], fieldReading.value as string | number)
        weekStatus = worstStatus(weekStatus, fieldReading.status)
      }
    }
    if (weekStatus === 'normal') setCell(entry.row, 'I', 'X')
    else if (weekStatus === 'warning') setCell(entry.row, 'J', 'X')
    else if (weekStatus === 'critical') setCell(entry.row, 'K', 'X')
  }

  setCell(35, 'A', 'TH=0 . PH=10,5 à 12 . sulfite=30 à 100 mg/L . Niveau bâche brut >= 10 / Batterie = 26,4 à 27,9 / Niveau carburant >= 200L / Niveau bâche eau >= 20')
  setCell(36, 'A', 'Compresseur: température locale > 23°C / Consommation eau: compteur > 10m³ / TGBT: tension Ph1-Ph3 entre 180V et 250V / Terre = maximum de 10 Ω')
  setCell(37, 'A', options.controlledBy ?? '')
  setCell(37, 'C', 'Temp. (°C) - Pression (bar) - Tension Ph1/Ph2/Ph3 (V) - Courant (A) - Terre (Ω) - Cos φ - Compteur (h) - Nombre de start - Volume(m³) - TH (°f) - Sulfite (mg/L)')
  setCell(38, 'A', 'Coordinateur technique Maintenance et infrastructure')
  setCell(38, 'C', 'Contrôlé par : ____________________________________')
  setCell(38, 'F', 'Signature : ____________________')

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!merges'] = [
    'A1:K2', 'A3:C3', 'D3:E3', 'F3:G3', 'I3:K3',
    'A5:A9', 'A10:A11', 'A12:A13', 'A14:A16', 'A17:A17',
    'A20:A23', 'A24:A27',
    'A35:K35', 'A36:K36', 'A37:B37', 'C37:K37', 'A38:B38', 'C38:E38', 'H38:I38',
  ].map((r) => XLSX.utils.decode_range(r))
  ws['!cols'] = [
    { wch: 20 }, { wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
    { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 6 }, { wch: 6 }, { wch: 6 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Feuil1')
  return wb
}

export function downloadWeekExport(records: InspectionRecord[], options: ExportOptions) {
  const wb = exportWeekToWorkbook(records, options)
  const filename = `Fiche_Controle_${format(parseISO(options.weekStartDate), 'yyyy-MM-dd')}.xlsx`
  XLSX.writeFile(wb, filename)
}

/**
 * Exports every week that overlaps the [from, to] interval as one workbook,
 * one paper-form sheet per week. Returns the number of weeks written (0 = empty).
 */
export function downloadIntervalExport(
  records: InspectionRecord[],
  options: { from: string; to: string; usine: string },
): number {
  const firstWeek = startOfWeek(parseISO(options.from), { weekStartsOn: 1 })
  const lastWeek = startOfWeek(parseISO(options.to), { weekStartsOn: 1 })

  const combined = XLSX.utils.book_new()
  const usedNames = new Set<string>()
  let weekStart = firstWeek
  let weeks = 0

  while (weekStart.getTime() <= lastWeek.getTime()) {
    const weekStartStr = format(weekStart, 'yyyy-MM-dd')
    const weekEnd = addDays(weekStart, 6)
    const weekRecords = records.filter((r) => {
      const d = parseISO(r.date)
      return d.getTime() >= weekStart.getTime() && d.getTime() <= weekEnd.getTime()
    })

    const weekWb = exportWeekToWorkbook(weekRecords, { weekStartDate: weekStartStr, usine: options.usine })
    const sheet = weekWb.Sheets[weekWb.SheetNames[0]]

    // Sheet names: unique and ≤ 31 chars (Excel limit).
    let name = `S${format(weekStart, 'ww')} ${format(weekStart, 'dd-MM')}`.slice(0, 31)
    const base = name.slice(0, 27)
    let i = 1
    while (usedNames.has(name)) name = `${base}_${i++}`
    usedNames.add(name)

    XLSX.utils.book_append_sheet(combined, sheet, name)
    weekStart = addDays(weekStart, 7)
    weeks++
  }

  if (weeks === 0) return 0
  const filename = `Fiches_Controle_${options.from}_au_${options.to}.xlsx`
  XLSX.writeFile(combined, filename)
  return weeks
}

// ---------------------------------------------------------------------------
// IMPORT
// ---------------------------------------------------------------------------

export interface ImportResult {
  records: InspectionRecord[]
  weekStart: string | null
  warnings: string[]
}

/** Parses an uploaded workbook that follows the same template and reconstructs daily InspectionRecords. */
export function importWorkbook(workbook: XLSX.WorkBook, technicianName = 'Import Excel'): ImportResult {
  const warnings: string[] = []
  const sheetName = workbook.SheetNames[0]
  const ws = workbook.Sheets[sheetName]
  if (!ws) {
    return { records: [], weekStart: null, warnings: ['Feuille introuvable dans le fichier.'] }
  }

  const getCell = (row: number, col: string): string | number | null => {
    const addr = `${col}${row}`
    const cell = ws[addr]
    if (!cell || cell.v === undefined || cell.v === null || cell.v === '') return null
    return cell.v
  }

  // Try to read the period text (A3) to recover the week's Monday
  let weekStart: Date | null = null
  const periodText = getCell(3, 'A')
  if (typeof periodText === 'string') {
    const match = periodText.match(/(\d{2})[./](\d{2})[./](\d{2,4})/)
    if (match) {
      const [, dd, mm, yyRaw] = match
      const yyyy = yyRaw.length === 2 ? `20${yyRaw}` : yyRaw
      const parsed = new Date(Number(yyyy), Number(mm) - 1, Number(dd))
      if (!isNaN(parsed.getTime())) weekStart = parsed
    }
  }
  if (!weekStart) {
    warnings.push("Date de période introuvable dans A3 — semaine ancrée sur aujourd'hui.")
    weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
  }

  const usine = typeof getCell(3, 'F') === 'string' ? String(getCell(3, 'F')).replace('Usine :', '').trim() : 'SBM Tunisie'

  const records: InspectionRecord[] = []
  for (let day = 0; day < 6; day++) {
    const date = format(addDays(weekStart, day), 'yyyy-MM-dd')
    const equipmentReadings: EquipmentReading[] = []
    let anyValue = false

    for (const def of EQUIPMENT_DEFINITIONS) {
      const entries = CELL_MAP.filter((e) => e.equipmentId === def.id)
      const values: Record<string, number | string | null> = {}
      for (const entry of entries) {
        const raw = getCell(entry.row, DAY_COLUMNS[day])
        values[entry.fieldId] = raw
        if (raw !== null) anyValue = true
      }
      equipmentReadings.push(evaluateEquipment(def, values))
    }

    if (!anyValue) continue // skip days with nothing filled in

    const overallStatus = equipmentReadings.reduce<StatusLevel>((acc, r) => worstStatus(acc, r.status === 'unknown' ? 'unknown' : r.status), 'unknown')

    records.push({
      id: generateId('insp'),
      date,
      technicianId: 'imported',
      technicianName,
      usine,
      equipmentReadings,
      overallStatus: overallStatus === 'unknown' ? 'normal' : overallStatus,
      createdAt: new Date().toISOString(),
    })
  }

  if (records.length === 0) warnings.push('Aucune donnée exploitable trouvée dans ce fichier.')

  return { records, weekStart: format(weekStart, 'yyyy-MM-dd'), warnings }
}

export function readWorkbookFromFile(file: File): Promise<XLSX.WorkBook> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        const wb = XLSX.read(data, { type: 'binary', cellDates: false })
        resolve(wb)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsBinaryString(file)
  })
}
