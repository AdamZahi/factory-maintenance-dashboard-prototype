// ---------------------------------------------------------------------------
// Supervision wall layout — the exact parameters to show, and which widget for
// each. This is a curated list (only these widgets appear on the wall).
//
// Sections are matched either by exact equipment id, or by a name/id token so a
// rule can cover several equipment at once (all "Compresseur …" units).
//
// Tank / fuel capacities are NOT part of the domain data. `null` = show the raw
// value (L / m³) with status coloring but no % fill.
// ---------------------------------------------------------------------------

export const TANK_CAPACITIES = {
  /** Groupe électrogène fuel tank (L) — niveau_carburant. Unknown; ask maintenance. */
  groupeElectrogeneFuelL: null as number | null,
  /** Surpresseur bâche eau (m³) — niveau_peche_eau. */
  surpresseurBacheEauM3: 35 as number | null,
  /** Consommation d'eau compteur (m³). */
  consommationEauM3: 35 as number | null,
  /** Local carburant mazout tank (L) — niveau_mazout. Known from the rule = 500 L. */
  localCarburantMazoutL: 500 as number | null,
}

export type WidgetKind = 'gauge' | 'battery' | 'tank' | 'thermometer' | 'counter' | 'valuerange' | 'bars'

export interface WidgetSpec {
  kind: WidgetKind
  /** Single-parameter widgets. */
  fieldId?: string
  /** Multi-parameter widgets (bars): the parameters to plot together. */
  fieldIds?: string[]
  /** Display label override (used by group widgets like the tension bars). */
  label?: string
  capacity?: number | null
}

export type SectionTemplate =
  | { type: 'id'; equipmentId: string; widgets: WidgetSpec[] }
  | { type: 'match'; token: string; widgets: WidgetSpec[] } // matches any equipment whose id/name contains the token

export const SUPERVISION_LAYOUT: SectionTemplate[] = [
  { type: 'id', equipmentId: 'chaudiere', widgets: [{ fieldId: 'sulfite', kind: 'valuerange' }] },
  {
    type: 'id',
    equipmentId: 'groupe_electrogene',
    widgets: [
      { fieldId: 'batterie', kind: 'battery' },
      { fieldId: 'niveau_carburant', kind: 'gauge', capacity: TANK_CAPACITIES.groupeElectrogeneFuelL },
    ],
  },
  {
    type: 'id',
    equipmentId: 'surpresseur_eau',
    widgets: [
      { fieldId: 'niveau_peche_eau', kind: 'tank', capacity: TANK_CAPACITIES.surpresseurBacheEauM3 },
      { fieldId: 'pression', kind: 'gauge' },
    ],
  },
  {
    // All compresseur units (Compresseur "07", "08", …).
    type: 'match',
    token: 'compresseur',
    widgets: [
      { fieldId: 'temperature', kind: 'thermometer' },
      { fieldId: 'pression', kind: 'gauge' },
    ],
  },
  {
    type: 'id',
    equipmentId: 'local_carburant',
    widgets: [{ fieldId: 'niveau_mazout', kind: 'gauge', capacity: TANK_CAPACITIES.localCarburantMazoutL }],
  },
  {
    type: 'id',
    equipmentId: 'tgbt_1',
    widgets: [{ kind: 'bars', label: 'Tensions', fieldIds: ['tension_ph1', 'tension_ph2', 'tension_ph3'] }],
  },
  {
    type: 'id',
    equipmentId: 'tgbt_2',
    widgets: [{ kind: 'bars', label: 'Tensions', fieldIds: ['tension_ph1', 'tension_ph2', 'tension_ph3'] }],
  },
  {
    type: 'id',
    equipmentId: 'consommation_eau',
    widgets: [{ fieldId: 'compteur', kind: 'tank', capacity: TANK_CAPACITIES.consommationEauM3 }],
  },
]

/** A reading older than this is flagged "stale" so nobody trusts it as live. */
export const STALE_AFTER_MS = 24 * 60 * 60 * 1000
