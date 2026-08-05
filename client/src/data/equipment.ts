import type { EquipmentDefinition } from '../types'

// Days recorded on the original paper form: 0=Lundi ... 5=Samedi
const MON_WED_FRI = [0, 2, 4]

export const EQUIPMENT_DEFINITIONS: EquipmentDefinition[] = [
  {
    id: 'chaudiere',
    name: 'Chaudière',
    fields: [
      { id: 'th', label: 'TH', unit: '°f', kind: 'number', recordedOn: MON_WED_FRI, rule: { equals: 0 } },
      { id: 'ph', label: 'PH', kind: 'number', recordedOn: MON_WED_FRI, rule: { min: 10.5, max: 12 } },
      { id: 'sulfite', label: 'Sulfite', unit: 'mg/L', kind: 'number', recordedOn: MON_WED_FRI, rule: { min: 30, max: 100 } },
      { id: 'niveau_peche_brut', label: 'Niveau bâche brut', unit: 'm³', kind: 'number', recordedOn: MON_WED_FRI, rule: { thresholdBelow: 10 } },
      { id: 'niveau_peche_adoucie', label: 'Niveau bâche adoucie (8H)', unit: 'm³', kind: 'number' },
    ],
  },
  {
    id: 'groupe_electrogene',
    name: 'Groupe électrogène',
    fields: [
      { id: 'batterie', label: 'Batterie', unit: 'V', kind: 'number', recordedOn: MON_WED_FRI, rule: { min: 26.4, max: 27.9 } },
      { id: 'niveau_carburant', label: 'Niveau carburant', unit: 'L', kind: 'number', recordedOn: MON_WED_FRI, rule: { thresholdBelow: 200 } },
      { id: 'compteur', label: 'Compteur', unit: 'h', kind: 'number', recordedOn: MON_WED_FRI },
      { id: 'nombre_start', label: 'Nombre de start', kind: 'number', recordedOn: MON_WED_FRI },
    ],
  },
  {
    id: 'surpresseur_eau',
    name: "Surpresseur d'eau",
    fields: [
      { id: 'niveau_peche_eau', label: 'Niveau bâche eau', unit: 'm³', kind: 'number', recordedOn: MON_WED_FRI, rule: { thresholdBelow: 20 } },
      { id: 'pression', label: 'Pression', unit: 'bar', kind: 'number', recordedOn: MON_WED_FRI, rule: { equals: 5 } },
    ],
  },
  {
    id: 'compresseur',
    name: 'Compresseur',
    fields: [
      { id: 'compteur', label: 'Compteur', unit: 'h', kind: 'number', recordedOn: [0] },
      { id: 'temperature', label: 'Température', unit: '°C', kind: 'number', recordedOn: [0], rule: { max: 90 }, helpText: 'Plus la température est basse, mieux c’est — alerte seulement au-dessus du seuil' },
      { id: 'temperateur_local', label: 'Température locale', unit: '°C', kind: 'number', recordedOn: [0], rule: { greaterThan: 23 } },
      { id: 'pression', label: 'Pression', unit: 'bar', kind: 'number', rule: { equals: 7 } },
    ],
  },
  {
    id: 'local_carburant',
    name: 'Local carburant',
    fields: [
      { id: 'niveau_mazout', label: 'Niveau mazout', unit: 'L', kind: 'number', recordedOn: [3], rule: { thresholdBelow: 500 }, helpText: 'Réservoir de 500 L — à remplir sous le seuil' },
    ],
  },
  {
    id: 'chariot_elevateur',
    name: 'Chariot élévateur',
    fields: [
      { id: 'compteur', label: 'Compteur', unit: 'h', kind: 'number', recordedOn: [0] },
    ],
  },
  {
    id: 'consommation_eau',
    name: "Consommation d'eau",
    fields: [
      { id: 'compteur', label: 'Compteur', unit: 'm³', kind: 'number', recordedOn: [5], rule: { thresholdBelow: 10 } },
    ],
  },
  {
    id: 'tgbt_1',
    name: 'TGBT "1"',
    fields: [
      { id: 'tension_ph1', label: 'Tension Ph1', unit: 'V', kind: 'number', recordedOn: [0, 4], rule: { min: 180, max: 250 } },
      { id: 'courant_ph1', label: 'Courant Ph1', unit: 'A', kind: 'number', recordedOn: [0, 4] },
      { id: 'tension_ph2', label: 'Tension Ph2', unit: 'V', kind: 'number', recordedOn: [0, 4], rule: { min: 180, max: 250 } },
      { id: 'courant_ph2', label: 'Courant Ph2', unit: 'A', kind: 'number', recordedOn: [0, 4] },
      { id: 'tension_ph3', label: 'Tension Ph3', unit: 'V', kind: 'number', recordedOn: [0, 4], rule: { min: 180, max: 250 } },
      { id: 'courant_ph3', label: 'Courant Ph3', unit: 'A', kind: 'number', recordedOn: [0, 4] },
      { id: 'cos_phi', label: 'Cos φ', kind: 'number', recordedOn: [2], rule: { min: 0.8, max: 1 } },
      { id: 'terre', label: 'Terre', unit: 'Ω', kind: 'number', recordedOn: [2], rule: { max: 10 } },
    ],
  },
  {
    id: 'tgbt_2',
    name: 'TGBT "2"',
    fields: [
      { id: 'tension_ph1', label: 'Tension Ph1', unit: 'V', kind: 'number', recordedOn: [0, 4], rule: { min: 180, max: 250 } },
      { id: 'courant_ph1', label: 'Courant Ph1', unit: 'A', kind: 'number', recordedOn: [0, 4] },
      { id: 'tension_ph2', label: 'Tension Ph2', unit: 'V', kind: 'number', recordedOn: [0, 4], rule: { min: 180, max: 250 } },
      { id: 'courant_ph2', label: 'Courant Ph2', unit: 'A', kind: 'number', recordedOn: [0, 4] },
      { id: 'tension_ph3', label: 'Tension Ph3', unit: 'V', kind: 'number', recordedOn: [0, 4], rule: { min: 180, max: 250 } },
      { id: 'courant_ph3', label: 'Courant Ph3', unit: 'A', kind: 'number', recordedOn: [0, 4] },
      { id: 'cos_phi', label: 'Cos φ', kind: 'number', recordedOn: [2], rule: { min: 0.8, max: 1 } },
      { id: 'terre', label: 'Terre', unit: 'Ω', kind: 'number', recordedOn: [2], rule: { max: 10 } },
    ],
  },
]

export const DAY_LABELS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']

export function getEquipment(id: string) {
  return EQUIPMENT_DEFINITIONS.find((e) => e.id === id)
}
