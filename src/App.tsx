import { useState } from 'react'
import { TechnicianForm } from './components/TechnicianForm'
import { InspectionForm } from './components/InspectionForm'
import { Dashboard } from './components/Dashboard'
import { History } from './components/History'
import { ImportExport } from './components/ImportExport'
import { EquipmentParametersDetails } from './components/EquipmentParametersDetails'
import { useInspections } from './hooks/useData'
import { LayoutDashboard, ClipboardList, History as HistoryIcon, FileSpreadsheet, Factory } from 'lucide-react'

type Tab = 'dashboard' | 'inspection' | 'history' | 'excel'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Tableau de bord', icon: <LayoutDashboard className="h-4 w-4" /> },
  { id: 'inspection', label: 'Inspection du jour', icon: <ClipboardList className="h-4 w-4" /> },
  { id: 'history', label: 'Historique', icon: <HistoryIcon className="h-4 w-4" /> },
  { id: 'excel', label: 'Import / Export', icon: <FileSpreadsheet className="h-4 w-4" /> },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard')
  const [technicianId, setTechnicianId] = useState<string | null>(null)
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | null>(null)
  const { items: inspections } = useInspections()

  const openEquipmentDetails = (equipmentId: string) => {
    setSelectedEquipmentId(equipmentId)
    setTab('dashboard')
  }

  const closeEquipmentDetails = () => {
    setSelectedEquipmentId(null)
    setTab('dashboard')
  }

  return (
    <div className="min-h-screen bg-[--color-graphite-50]">
      <header className="plate-texture bg-[--color-graphite-900] text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[--color-amber-signal]">
              <Factory className="h-5 w-5 text-black" />
            </div>
            <div>
              <h1 className="font-display text-lg font-bold uppercase tracking-wide text-black">Contrôle Journalier des Équipements</h1>
              <p className="text-xs text-black">SBM Tunisie — Maintenance &amp; Infrastructure · Prototype</p>
            </div>
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 px-6">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setSelectedEquipmentId(null)
                setTab(t.id)
              }}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                tab === t.id
                  ? 'border-[--color-amber-signal] text-black'
                  : 'border-transparent text-gray-600 hover:text-black'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl space-y-4 px-6 py-6">
        {selectedEquipmentId ? (
          <EquipmentParametersDetails
            equipmentId={selectedEquipmentId}
            inspections={inspections}
            onBack={closeEquipmentDetails}
          />
        ) : tab === 'dashboard' ? (
          <Dashboard inspections={inspections} onSelectEquipment={openEquipmentDetails} />
        ) : null}
        {tab === 'inspection' && (
          <div className="space-y-4">
            <TechnicianForm activeTechnicianId={technicianId} onSelect={setTechnicianId} />
            <InspectionForm technicianId={technicianId} />
          </div>
        )}
        {tab === 'history' && <History inspections={inspections} />}
        {tab === 'excel' && <ImportExport />}
      </main>

      <footer className="mx-auto max-w-7xl px-6 py-8 text-center text-xs text-[--color-graphite-500]">
        Démonstrateur frontend — données stockées localement dans ce navigateur (localStorage). Aucune donnée n'est envoyée à un serveur.
      </footer>
    </div>
  )
}
