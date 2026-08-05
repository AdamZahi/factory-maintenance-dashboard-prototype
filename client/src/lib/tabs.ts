// Tabs a technician can be granted/denied access to (moderator-configurable).
// A technician's `allowedTabs` restricts them to this subset; an empty list
// means no restriction (all of these are visible).
export const TECHNICIAN_TABS = [
  { id: 'dashboard', label: 'Tableau de bord' },
  { id: 'monitoring', label: 'Supervision' },
  { id: 'inspection', label: 'Inspection du jour' },
  { id: 'history', label: 'Historique' },
  { id: 'maintenance', label: 'Entretien' },
] as const

export const TECHNICIAN_TAB_IDS = TECHNICIAN_TABS.map((t) => t.id) as readonly string[]
