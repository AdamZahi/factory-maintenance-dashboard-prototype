import { useState } from 'react'
import { TechnicianForm } from './components/TechnicianForm'
import { InspectionForm } from './components/InspectionForm'
import { Dashboard } from './components/Dashboard'
import { History } from './components/History'
import { ImportExport } from './components/ImportExport'
import { EquipmentParametersDetails } from './components/EquipmentParametersDetails'
import { useInspections } from './hooks/useData'
import { LayoutDashboard, ClipboardList, History as HistoryIcon, FileSpreadsheet, Factory, Search, Bell, ChevronDown, LifeBuoy, LogOut } from 'lucide-react'

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

  const activeTitle = selectedEquipmentId
    ? 'Parameter details'
    : tab === 'dashboard'
      ? 'Dashboard'
      : tab === 'inspection'
        ? 'Inspection du jour'
        : tab === 'history'
          ? 'Historique'
          : 'Import / Export'

  const openEquipmentDetails = (equipmentId: string) => {
    setSelectedEquipmentId(equipmentId)
    setTab('dashboard')
  }

  const closeEquipmentDetails = () => {
    setSelectedEquipmentId(null)
    setTab('dashboard')
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="flex min-h-screen">
        <aside className="flex h-screen w-70 flex-col border-r border-[--color-graphite-100] bg-white px-4 py-5">
          <div className="flex items-center gap-3 rounded-2xl bg-[--color-graphite-50] px-4 py-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[--color-amber-signal] text-black shadow-sm">
              <Factory className="h-5 w-5" />
            </div>
            <div>
              <p className="font-display text-base font-semibold uppercase tracking-[0.12em] text-[--color-graphite-900]">SBM Tunisie</p>
              <p className="text-xs text-[--color-graphite-500]">Maintenance dashboard</p>
            </div>
          </div>

          <nav className="mt-6 space-y-2">
            {TABS.map((t) => {
              const active = tab === t.id && !selectedEquipmentId
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    setSelectedEquipmentId(null)
                    setTab(t.id)
                  }}
                  className={`flex w-full items-center gap-3 rounded-full px-4 py-3 text-sm font-medium transition-all ${
                    active
                      ? 'bg-[--color-status-normal-bg] text-[--color-status-normal] shadow-sm'
                      : 'text-[--color-graphite-500] hover:bg-[--color-graphite-50] hover:text-[--color-graphite-900]'
                  }`}
                >
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full ${active ? 'bg-white/70' : 'bg-[--color-graphite-50]'}`}>
                    {t.icon}
                  </span>
                  <span>{t.label}</span>
                </button>
              )
            })}
          </nav>

          <div className="mt-auto space-y-3 border-t border-[--color-graphite-100] pt-4">
            <button className="flex w-full items-center gap-3 rounded-full px-4 py-3 text-sm text-[--color-graphite-500] hover:bg-[--color-graphite-50] hover:text-[--color-graphite-900]">
              <LifeBuoy className="h-4 w-4" />
              Help &amp; information
            </button>
            <button className="flex w-full items-center gap-3 rounded-full px-4 py-3 text-sm text-[--color-graphite-500] hover:bg-[--color-graphite-50] hover:text-[--color-graphite-900]">
              <LogOut className="h-4 w-4" />
              Log out
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col bg-[--color-graphite-50]">
          <header className="border-b border-[--color-graphite-100] bg-white px-6 py-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-[--color-graphite-500]">{activeTitle}</p>
                <h1 className="mt-1 font-display text-2xl font-semibold uppercase tracking-[0.12em] text-[--color-graphite-900]">Contrôle journalier des équipements</h1>
              </div>

              <div className="flex flex-1 items-center justify-end gap-3">
                <label className="relative hidden max-w-85 flex-1 md:block">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[--color-graphite-400]" />
                  <input
                    type="search"
                    placeholder="Search inspections, equipment, technicians"
                    className="w-full rounded-full border border-[--color-graphite-100] bg-[--color-graphite-50] py-3 pl-11 pr-4 text-sm outline-none transition-colors focus:border-[--color-amber-signal]"
                  />
                </label>
                <button className="relative flex h-11 w-11 items-center justify-center rounded-full border border-[--color-graphite-100] bg-white text-[--color-graphite-500] shadow-sm transition-colors hover:text-[--color-graphite-900]">
                  <Bell className="h-4 w-4" />
                  <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-[--color-status-critical]" />
                </button>
                <div className="flex items-center gap-3 rounded-full border border-[--color-graphite-100] bg-white px-3 py-2 shadow-sm">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[--color-status-normal-bg] font-semibold text-[--color-status-normal]">GA</div>
                  <div className="hidden text-left sm:block">
                    <p className="text-sm font-semibold text-[--color-graphite-900]">Graham Alexander</p>
                    <p className="text-xs text-[--color-graphite-500]">Operations manager</p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-[--color-graphite-400]" />
                </div>
              </div>
            </div>
          </header>

          <main className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
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

          <footer className="border-t border-[--color-graphite-100] bg-white px-6 py-4 text-center text-xs text-[--color-graphite-500]">
            Démonstrateur frontend — données stockées localement dans ce navigateur (localStorage). Aucune donnée n'est envoyée à un serveur.
          </footer>
        </div>
      </div>
    </div>
  )
}
